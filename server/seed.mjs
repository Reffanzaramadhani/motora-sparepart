// Fictional shop records. Model families, prices and balances are demonstration data.
const demoParts = [
  ['MP-001', 'Busi Iridium', 'Pengapian', 'Matic 110 cc', 85000, 28, 5, 'busi'],
  ['MP-002', 'Kampas Rem Cakram', 'Pengereman', 'Matic 125 cc', 65000, 4, 5, 'kampas-rem'],
  ['MP-003', 'Filter Udara Matic', 'Mesin', 'Matic 150 cc', 48000, 16, 5, 'filter-udara'],
  ['MP-004', 'Piston Standar', 'Mesin', 'Bebek 110 cc', 125000, 10, 3, 'piston'],
  ['MP-005', 'Bearing Roda Depan', 'Kaki-kaki', 'Bebek 125 cc', 35000, 21, 6, 'laher'],
  ['MP-006', 'Gear Belakang', 'Transmisi', 'Sport 150 cc', 96000, 8, 3, 'gear'],
  ['MP-007', 'Busi Standar', 'Pengapian', 'Bebek 110 cc', 25000, 46, 10, 'busi'],
  ['MP-008', 'Kampas Rem Belakang', 'Pengereman', 'Sport 150 cc', 72000, 0, 4, 'kampas-rem'],
  ['MP-009', 'Filter Udara Sport', 'Mesin', 'Sport 150 cc', 68000, 14, 4, 'filter-udara'],
  ['MP-010', 'Piston Oversize', 'Mesin', 'Bebek 125 cc', 154000, 6, 2, 'piston'],
  ['MP-011', 'Laher Roda Belakang', 'Kaki-kaki', 'Matic 125 cc', 39500, 3, 4, 'laher'],
  ['MP-012', 'Gear Depan', 'Transmisi', 'Bebek 125 cc', 42000, 18, 5, 'gear']
];
const demoSuppliers = ['Sentra Teknik Motor', 'Prima Suku Cadang', 'Mitra Komponen'];
const demoMovements = [
  [6, 'in', 0, 0, 15, 63000],
  [4, 'sale', null, 0, 2, 85000],
  [3, 'in', 1, 2, 10, 32000],
  [2, 'sale', null, 1, 2, 65000],
  [1, 'sale', null, 4, 3, 35000],
  [0, 'in', 2, 5, 5, 78000]
];
const marker = 'demo-v1';

export async function seedDemo(db) {
  if (await db.prepare('SELECT value FROM app_meta WHERE key = ?').bind(marker).first()) return;
  const statements = [];
  for (const [code,name,category,compatibility,price,stock,minStock,asset] of demoParts) {
    statements.push(db.prepare(
      'INSERT OR IGNORE INTO parts(id,code,name,category,compatibility,price,stock,minStock,image) VALUES(?,?,?,?,?,?,?,?,?)'
    ).bind(code.toLowerCase(),code,name,category,compatibility,price,stock,minStock,'/media/' + asset + '.webp'));
  }
  demoSuppliers.forEach((name,index) => statements.push(db.prepare(
    'INSERT OR IGNORE INTO suppliers(id,name) VALUES(?,?)'
  ).bind('pemasok-demo-' + index,name)));
  const todayJakarta = new Date(Date.now() + 7 * 3600000);
  demoMovements.forEach(([daysAgo,type,supplier,partIndex,quantity,unitPrice],index) => {
    const [code,name] = demoParts[partIndex];
    const date = new Date(todayJakarta.getTime() - daysAgo * 86400000).toISOString().slice(0,10);
    const id = 'DEMO-' + String(index+1).padStart(3,'0');
    const party = supplier === null ? 'Pelanggan umum' : demoSuppliers[supplier];
    statements.push(db.prepare(
      'INSERT OR IGNORE INTO transactions(id,type,date,party,signature) VALUES(?,?,?,?,?)'
    ).bind(id,type,date,party,'demo'));
    statements.push(db.prepare(
      'INSERT OR IGNORE INTO transaction_items(transactionId,partId,code,name,quantity,unitPrice) VALUES(?,?,?,?,?,?)'
    ).bind(id,code.toLowerCase(),code,name,quantity,unitPrice));
  });
  statements.push(db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)').bind(marker,'1'));
  await db.batch(statements);
}
