import { seedDemo } from './seed.mjs';

class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function stringField(value, label, limit, required = false) {
  if (value == null) value = '';
  if (typeof value !== 'string' || value.trim().length > limit || (required && !value.trim())) {
    throw new InputError(label + ' tidak valid.');
  }
  return value.trim();
}
function integer(value, label, min = 0, max = 100000000) {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new InputError(label + ' harus bilangan bulat antara ' + min + ' dan ' + max + '.');
  }
  return value;
}
function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError('Pilih tanggal transaksi.');
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new InputError('Tanggal tidak valid.');
  return value;
}
function getImage(value) {
  const path = stringField(value,'Lokasi gambar',250);
  if (path && !/^\/media\/[A-Za-z0-9_-]+\.(?:webp|png|jpe?g)$/i.test(path)) throw new InputError('Pilih gambar dari katalog.');
  return path;
}
const partFields = {
  code: value => stringField(value, 'Kode', 40, true).toUpperCase(),
  name: value => stringField(value, 'Nama sparepart', 120, true),
  category: value => stringField(value, 'Kategori', 60, true),
  brand: value => stringField(value, 'Merek', 80),
  compatibility: value => stringField(value, 'Tipe motor', 200),
  price: value => integer(value ?? 0, 'Harga'),
  minStock: value => integer(value ?? 0, 'Stok minimum'),
  image: getImage
};

async function state(db) {
  // A transactional read gives the balance and ledger from the same snapshot.
  const [partsResult,orders,lines,suppliers] = await db.batch([
    db.prepare('SELECT * FROM parts ORDER BY code COLLATE NOCASE'),
    db.prepare('SELECT id,type,date,party FROM transactions ORDER BY date DESC, createdAt DESC, rowid DESC'),
    db.prepare('SELECT * FROM transaction_items ORDER BY rowid'),
    db.prepare('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE')
  ]);
  const transactions = orders.results.map(row => ({ ...row, items: [], total: 0 }));
  const byId = new Map(transactions.map(row => [row.id,row]));
  for (const {transactionId,...line} of lines.results) {
    const order = byId.get(transactionId);
    order.items.push(line);
    order.total += line.quantity * line.unitPrice;
  }
  return {parts:partsResult.results.map(row => ({...row,active:Boolean(row.active)})),transactions,suppliers:suppliers.results};
}

async function partWrite(db, body, id) {
  const fields = Object.keys(partFields).filter(field => !id || Object.hasOwn(body,field));
  if (!fields.length) throw new InputError('Masukkan perubahan sparepart.');
  const values = fields.map(field => partFields[field](body[field]));
  if (id) {
    const assignments = fields.map(field => field + ' = ?').join(', ');
    const result = await db.prepare('UPDATE parts SET ' + assignments + ' WHERE id = ?').bind(...values,id).run();
    if (result.meta.changes === 0) throw new InputError('Sparepart tidak ditemukan.',404);
    return {ok:true,id};
  }
  id = crypto.randomUUID();
  const stock = integer(body.stock ?? 0, 'Stok awal');
  const marks = [...fields,'id','stock'].map(() => '?').join(',');
  await db.prepare('INSERT INTO parts(' + fields.join(',') + ',id,stock) VALUES(' + marks + ')').bind(...values,id,stock).run();
  return {ok:true,id};
}

async function writeTransaction(db, body) {
  const id = stringField(body.id,'ID transaksi',80,true);
  const { type } = body;
  if (!['in','sale'].includes(type)) throw new InputError('Pilih jenis transaksi.');
  const date = isoDate(body.date);
  const party = stringField(body.party,type === 'in' ? 'Pemasok' : 'Pelanggan',120,type === 'in') || 'Pelanggan umum';
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) throw new InputError('Pilih 1–30 item.');
  const items = body.items.map(line => {
    if (!line || typeof line !== 'object') throw new InputError('Item tidak valid.');
    const partId = stringField(line.partId,'Sparepart',100,true);
    const quantity = integer(line.quantity,'Jumlah',1,10000);
    const unitPrice = type === 'in' ? integer(line.unitPrice ?? 0,'Harga beli') : null;
    return {partId,quantity,unitPrice};
  }).sort((a,b) => a.partId.localeCompare(b.partId));
  if (new Set(items.map(i=>i.partId)).size !== items.length) throw new InputError('Gabungkan jumlah item yang sama.');
  const signature = JSON.stringify({type,date,party,items});
  const header = db.prepare('INSERT INTO transactions(id,type,date,party,signature) VALUES(?,?,?,?,?)');
  const detail = db.prepare(`INSERT INTO transaction_items(transactionId,partId,code,name,quantity,unitPrice)
    VALUES (?, ?, (SELECT code FROM parts WHERE id = ? AND active = 1),
            (SELECT name FROM parts WHERE id = ?), ?, COALESCE(?, (SELECT price FROM parts WHERE id = ?)))`);
  const adjust = db.prepare('UPDATE parts SET stock = stock + ? WHERE id = ?');
  const batch = [header.bind(id,type,date,party,signature)];
  for (const {partId,quantity,unitPrice} of items) {
    batch.push(detail.bind(id,partId,partId,partId,quantity,unitPrice,partId));
    batch.push(adjust.bind(type === 'in' ? quantity : -quantity,partId));
  }
  try {
    await db.batch(batch);
  } catch (error) {
    // The unique transaction ID also handles simultaneous submissions with the same key.
    const prior = await db.prepare('SELECT signature FROM transactions WHERE id = ?').bind(id).first();
    if (prior?.signature === signature) return {ok:true,id};
    if (prior) throw new InputError('ID transaksi sudah dipakai untuk transaksi lain.',409);
    throw error;
  }
  return {ok:true,id};
}

export async function handleApi(request,env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!env.DB) return reply({error:'Koneksi basis data belum tersedia.'},503);
    const db = env.DB;
    if (request.method === 'GET' && path === '/api/state') {
      await seedDemo(db);
      return reply(await state(db));
    }
    const updateId = request.method === 'PATCH' && path.match(/^\/api\/parts\/([^/]+)$/)?.[1];
    const isCreate = request.method === 'POST' && ['/api/parts','/api/transactions','/api/suppliers'].includes(path);
    if (!updateId && !isCreate) return reply({error:'Alamat API tidak ditemukan.'},404);
    if (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) {
      throw new InputError('Asal permintaan tidak valid.',403);
    }
    if (!request.headers.get('Content-Type')?.includes('application/json')) throw new InputError('Kirim data dalam format JSON.',415);
    let body;
    try { body = await request.json(); } catch { throw new InputError('Data JSON tidak valid.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Data tidak valid.');
    await seedDemo(db);
    if (updateId) return reply(await partWrite(db,body,decodeURIComponent(updateId)));
    if (path === '/api/parts') return reply(await partWrite(db,body),201);
    if (path === '/api/transactions') return reply(await writeTransaction(db,body),201);
    const name = stringField(body.name,'Nama pemasok',120,true);
    const contact = stringField(body.contact,'Kontak pemasok',160);
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO suppliers(id,name,contact) VALUES(?,?,?)').bind(id,name,contact).run();
    return reply({ok:true,id},201);
  } catch(error) {
    if (error instanceof InputError) return reply({error:error.message},error.status);
    const message = [error.message,error.cause?.message].join(' ');
    if (message.includes('stock_available')) return reply({error:'Stok tidak mencukupi. Periksa kembali jumlah penjualan.'},409);
    if (message.includes('parts.code')) return reply({error:'Kode sparepart sudah digunakan.'},409);
    if (message.includes('suppliers.name')) return reply({error:'Nama pemasok sudah digunakan.'},409);
    if (message.includes('transaction_items.code')) return reply({error:'Sparepart tidak ditemukan atau sudah nonaktif.'},400);
    console.error('Kesalahan pada API inventaris:',error.message);
    return reply({error:'Basis data tidak dapat memproses permintaan. Coba lagi.'},500);
  }
}
