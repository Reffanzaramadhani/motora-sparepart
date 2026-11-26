(() => {
  'use strict';
  const app = () => window.app;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const rupiah = value => app().money(Number(value) || 0);
  const number = value => Number(value || 0).toLocaleString('id-ID');
  const parts = () => app().state.parts || [];
  const movements = () => app().state.movements || app().state.transactions || [];
  const findPart = id => parts().find(part => String(part.id) === String(id));
  const units = tx => tx.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const indonesiaDate = date => new Intl.DateTimeFormat('id-ID', {day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Jakarta'}).format(new Date(date.slice(0,10) + 'T12:00:00+07:00'));
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Jakarta'}).format(new Date());
  const typeLabel = type => type === 'in' ? 'Barang masuk' : 'Penjualan';
  const stockLabel = part => part.stock === 0 ? 'Habis' : part.stock <= part.minStock ? 'Menipis' : 'Tersedia';
  const button = (label, action, primary = false) => '<button type="button" class="op-button' + (primary ? ' op-primary' : '') + '" data-op="' + action + '">' + escape(label) + '</button>';
  const field = (label, content, full = false) => '<label class="op-field' + (full ? ' op-full' : '') + '"><span>' + escape(label) + '</span>' + content + '</label>';
  const input = (name, value = '', extra = '') => '<input name="' + name + '" value="' + escape(value) + '" ' + extra + '>';
  const option = (value, label, selected) => '<option value="' + escape(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + escape(label) + '</option>';
  let currentDialog;
  function dialog(title, markup) {
    if (currentDialog?.open) currentDialog.close();
    const element = document.createElement('dialog');
    element.className = 'op-dialog';
    element.setAttribute('aria-labelledby', 'op-dialog-title');
    element.innerHTML = '<div class="op-head"><h2 id="op-dialog-title">' + escape(title) + '</h2><button type="button" class="op-x" aria-label="Tutup dialog">×</button></div>' + markup;
    document.body.append(element);
    element.querySelector('.op-x').onclick = () => element.close();
    element.addEventListener('close', () => {
      element.remove();
      if (currentDialog === element) currentDialog = null;
    }, {once:true});
    currentDialog = element;
    element.showModal();
    return element;
  }
  function formMarkup(body, submit) {
    return '<form class="op-form">' + body + '<p class="op-error" role="alert"></p><div class="op-actions">' + button('Batal','cancel') + '<button type="submit" class="op-button op-primary">' + escape(submit) + '</button></div></form>';
  }
  function bindSave(element, request, message) {
    const form = element.querySelector('form');
    const error = form.querySelector('.op-error');
    const submit = form.querySelector('[type=submit]');
    form.querySelector('[data-op=cancel]').onclick = () => element.close();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      error.textContent = '';
      try {
        const {url, method, payload} = request(new FormData(form));
        const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
        if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan data.');
      } catch (failure) {
        error.textContent = failure.message === 'Failed to fetch' ? 'Koneksi terputus. Silakan coba lagi.' : failure.message;
        submit.disabled = false;
        return;
      }
      element.close();
      try {
        await app().refresh();
        app().toast(message);
      } catch {
        app().toast('Data tersimpan. Muat ulang halaman untuk melihat pembaruan.');
      }
    });
  }
  function openPart(id) {
    const original = id == null ? null : findPart(id);
    if (id != null && !original) return app().toast('Sparepart tidak ditemukan.');
    const p = original || {};
    const categories = [...new Set([...(app().categories || []).filter(c => c !== 'Semua'), ...(p.category ? [p.category] : [])])];
    const images = [...new Set(parts().map(part => part.image).filter(Boolean))];
    const imageLabel = path => path.split('/').pop().replace(/\.[a-z0-9]+$/i,'').replaceAll('-',' ');
    const body = '<div class="op-fields">' +
      field('Nama sparepart', input('name',p.name,'required maxlength="120" placeholder="Contoh: Busi standar"'),true) +
      field('Kode sparepart',input('code',p.code,'required maxlength="40" placeholder="Contoh: BUS-001"')) +
      field('Kategori','<select name="category" required><option value="">Pilih kategori</option>' + categories.map(c => option(c,c,p.category)).join('') + '</select>') +
      field('Merek',input('brand',p.brand,'maxlength="80" placeholder="Merek sparepart"')) +
      field('Tipe motor',input('compatibility',p.compatibility,'maxlength="200" placeholder="Contoh: BeAT, Scoopy"')) +
      field('Harga jual (Rp)',input('price',p.price ?? '', 'required type="number" min="0" step="1"')) +
      field('Stok minimum',input('minStock',p.minStock ?? 3,'required type="number" min="0" step="1"')) +
      (original ? '' : field('Stok awal',input('stock',0,'required type="number" min="0" step="1"'))) +
      field('Ilustrasi katalog','<select name="image"><option value="">Tanpa gambar</option>' + images.map(path=>option(path,imageLabel(path),p.image)).join('') + '</select>') + '</div>';
    const el = dialog(original ? 'Edit sparepart' : 'Tambah sparepart', formMarkup(body,'Simpan sparepart'));
    bindSave(el, values => {
      const payload = Object.fromEntries(values.entries());
      for (const name of ['name','code','brand','compatibility']) payload[name] = payload[name].trim();
      for (const name of ['price','minStock','stock']) if (name in payload) payload[name] = Number(payload[name]);
      return {url:original ? '/api/parts/' + encodeURIComponent(id) : '/api/parts', method:original ? 'PATCH' : 'POST', payload};
    }, 'Data sparepart tersimpan.');
  }
  function openDetail(id) {
    const part = findPart(id);
    if (!part) return app().toast('Sparepart tidak ditemukan.');
    const rows = [['Kode',part.code],['Kategori',part.category],['Merek',part.brand],['Tipe motor',part.compatibility],['Harga jual',rupiah(part.price)],['Stok tersedia',number(part.stock) + ' unit'],['Stok minimum',number(part.minStock) + ' unit']];
    const visual = part.image ? '<img class="op-detail-image" alt="Ilustrasi ' + escape(part.name) + '" src="' + escape(part.image) + '">' : '';
    const el = dialog(part.name,'<div class="op-content">' + visual + '<p class="op-stock">' + stockLabel(part) + '</p><dl class="op-definition">' + rows.map(([k,v]) => '<div><dt>' + k + '</dt><dd>' + escape(v || '—') + '</dd></div>').join('') + '</dl><div class="op-actions">' + button('Edit','edit') + button('Barang masuk','in') + (part.stock > 0 ? button('Catat penjualan','sale',true) : '') + '</div></div>');
    el.querySelector('[data-op=edit]').onclick = () => openPart(id);
    for (const type of ['in','sale']) el.querySelector('[data-op=' + type + ']')?.addEventListener('click', () => openMovement(type,id));
  }
  function openMovement(type, id) {
    const incoming = type === 'in';
    const available = parts().filter(p => incoming || p.stock > 0);
    if (!available.length) return app().toast(incoming ? 'Tambahkan sparepart terlebih dahulu.' : 'Belum ada sparepart dengan stok tersedia.');
    const candidates = available.map(p => option(p.id,p.name + ' · ' + p.code)).join('');
    const suppliers = app().state.suppliers || [];
    const body = '<div class="op-fields">' +
      field('Tanggal',input('date',today(),'type="date" required')) +
      field(incoming ? 'Nama pemasok' : 'Pelanggan (opsional)',input('party','',incoming ? 'required list="op-suppliers" maxlength="120"' : 'maxlength="120" placeholder="Pelanggan umum"')) +
      '</div><datalist id="op-suppliers">' + suppliers.map(s=>option(s.name,s.name)).join('') + '</datalist>' +
      '<div class="op-lines"></div><div class="op-addline">' + button('+ Tambah item','add') + '</div><div class="op-total"><span>Total transaksi</span><strong></strong></div>';
    const el = dialog(incoming ? 'Catat barang masuk' : 'Catat penjualan',formMarkup(body,'Simpan transaksi'));
    const lines = el.querySelector('.op-lines');
    const total = el.querySelector('.op-total strong');
    function update() {
      let sum = 0;
      for (const row of lines.children) {
        const part = findPart(row.querySelector('select').value);
        const qty = row.querySelector('[data-qty]');
        const price = row.querySelector('[data-cost]');
        price.readOnly = !incoming;
        if (!incoming) {price.value = part?.price ?? ''; qty.max = String(part?.stock || 0);}
        row.querySelector('.op-available').textContent = part ? 'Stok tersedia ' + number(part.stock) + ' unit' : '';
        sum += Number(qty.value) * Number(price.value);
        row.querySelector('.op-remove').hidden = lines.children.length <= 1;
      }
      total.textContent = rupiah(sum);
    }
    function newLine(partId) {
      const row = document.createElement('div');
      row.className = 'op-line';
      row.innerHTML = '<div class="op-line-head"><span>Item transaksi</span><button type="button" class="op-remove">Hapus item</button></div>' +
        field('Sparepart','<select required><option value="">Pilih sparepart</option>' + candidates + '</select>') +
        '<div class="op-fields">' + field('Jumlah unit','<input type="number" required min="1" step="1" value="1" data-qty>') +
        field(incoming ? 'Harga beli per unit (Rp)' : 'Harga jual per unit (Rp)','<input type="number" required min="0" step="1" data-cost>') +
        '</div><span class="op-available"></span>';
      const select = row.querySelector('select');
      if (partId != null) select.value = String(partId);
      row.querySelector('.op-remove').onclick = () => {row.remove(); update();};
      lines.append(row);
      update();
      return select;
    }
    newLine(id);
    el.querySelector('[data-op=add]').onclick = () => newLine().focus();
    lines.addEventListener('input', update);
    lines.addEventListener('change', update);
    const key = crypto.randomUUID();
    bindSave(el, values => {
      const items = Array.from(lines.children, row => {
        const part = findPart(row.querySelector('select').value);
        const quantity = Number(row.querySelector('[data-qty]').value);
        if (!part) throw new Error('Pilih sparepart untuk setiap item.');
        if (!incoming && quantity > part.stock) throw new Error('Stok ' + part.name + ' tidak mencukupi.');
        const item = {partId:part.id,quantity};
        if (incoming) item.unitPrice = Number(row.querySelector('[data-cost]').value);
        return item;
      });
      if (new Set(items.map(i=>i.partId)).size !== items.length) throw new Error('Gunakan satu baris per sparepart dan sesuaikan jumlahnya.');
      return {url:'/api/transactions',method:'POST',payload:{id:key,type:incoming ? 'in' : 'sale',date:values.get('date'),party:values.get('party').trim() || 'Pelanggan umum',items}};
    }, incoming ? 'Barang masuk tersimpan. Stok sudah bertambah.' : 'Penjualan tersimpan. Stok sudah diperbarui.');
  }
  function table(headers, rows, emptyText) {
    return rows.length ? '<div class="op-scroll" tabindex="0" role="region" aria-label="Tabel ' + escape(headers[0]) + '"><table class="op-table"><thead><tr>' +
      headers.map(label=>'<th scope="col">' + escape(label) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(cells=>'<tr>' + cells.map(value=>'<td>' + value + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>' : '<p class="op-empty">' + escape(emptyText) + '</p>';
  }
  const historyFilters = {type:'',from:'',until:''};
  const reportFilters = {from:'',until:''};
  function dateFields(filters, kinds) {
    return '<div class="op-filters">' + field('Dari tanggal',input('from',filters.from,'type="date"')) +
      field('Sampai tanggal',input('until',filters.until,'type="date"')) + (kinds ? field('Jenis transaksi','<select name="type">' +
        [['','Semua transaksi'],['in','Barang masuk'],['sale','Penjualan']].map(([v,t])=>option(v,t,filters.type)).join('') + '</select>') : '') +
      button('Atur ulang','reset') + '</div>';
  }
  function byPeriod(filters) {
    return movements().filter(tx => (!filters.from || tx.date.slice(0,10) >= filters.from) &&
      (!filters.until || tx.date.slice(0,10) <= filters.until) && (!filters.type || filters.type === tx.type))
      .sort((a,b)=>b.date.localeCompare(a.date));
  }
  function useFilters(container, filters, update) {
    const filterBar = container.querySelector('.op-filters');
    const from = filterBar.querySelector('[name=from]');
    const until = filterBar.querySelector('[name=until]');
    function refresh() {
      from.max = until.value;
      until.min = from.value;
      const invalid = !from.validity.valid || !until.validity.valid;
      const message = container.querySelector('[data-error]');
      message.textContent = invalid ? 'Tanggal akhir harus sama atau setelah tanggal awal.' : '';
      const target = container.querySelector('.op-result');
      target.hidden = invalid;
      if (!invalid) update(byPeriod(filters));
    }
    filterBar.onchange = event => {
      if (Object.hasOwn(filters,event.target.name)) filters[event.target.name] = event.target.value;
      refresh();
    };
    filterBar.querySelector('[data-op=reset]').onclick = () => {
      for (const control of filterBar.querySelectorAll('[name]')) {control.value = ''; filters[control.name] = '';}
      refresh();
    };
    refresh();
  }
  function transactionDetail(tx) {
    const rows = tx.items.map(item=>[escape(item.name),number(item.quantity),escape(rupiah(item.unitPrice)),escape(rupiah(item.quantity*item.unitPrice))]);
    dialog(typeLabel(tx.type),'<div class="op-content"><dl class="op-definition"><div><dt>Tanggal</dt><dd>' + escape(indonesiaDate(tx.date)) + '</dd></div><div><dt>' +
      (tx.type === 'in' ? 'Pemasok' : 'Pelanggan') + '</dt><dd>' + escape(tx.party || 'Pelanggan umum') + '</dd></div></dl>' +
      table(['Sparepart','Jumlah','Harga satuan','Subtotal'],rows,'Belum ada item.') + '<div class="op-total"><span>Total transaksi</span><strong>' + escape(rupiah(tx.total)) + '</strong></div></div>');
  }
  function renderHistory(container) {
    container.innerHTML = '<section class="op-page"><div class="op-pagehead"><h1>Riwayat transaksi</h1><div class="op-actions">' +
      button('Barang masuk','in') + button('Catat penjualan','sale',true) + '</div></div>' + dateFields(historyFilters,true) +
      '<p class="op-error" role="alert" data-error></p><div class="op-result"></div></section>';
    for (const type of ['in','sale']) container.querySelector('[data-op=' + type + ']').onclick = () => openMovement(type);
    const target = container.querySelector('.op-result');
    useFilters(container,historyFilters,txs=>{
      target.innerHTML = table(['Tanggal','Jenis','Pemasok / pelanggan','Jumlah','Total','Rincian'],txs.map((tx,index)=>[
        escape(indonesiaDate(tx.date)),escape(typeLabel(tx.type)),escape(tx.party || 'Pelanggan umum'),number(units(tx)) + ' unit',escape(rupiah(tx.total)),
        '<button type="button" class="op-link" data-tx="' + index + '" aria-label="Detail transaksi ' + escape(typeLabel(tx.type)) + ' ' + escape(indonesiaDate(tx.date)) + '">Lihat detail</button>']),
        'Belum ada transaksi yang sesuai dengan filter.');
      target.querySelectorAll('[data-tx]').forEach(btn=>{btn.onclick=()=>transactionDetail(txs[Number(btn.dataset.tx)]);});
    });
  }
  function renderReports(container) {
    container.innerHTML = '<section class="op-page"><div class="op-pagehead"><h1>Laporan transaksi</h1></div>' +
      dateFields(reportFilters,false) + '<p class="op-error" role="alert" data-error></p><div class="op-result"></div></section>';
    const target = container.querySelector('.op-result');
    useFilters(container,reportFilters,txs=>{
      const byPart = new Map();
      let incoming = 0, outgoing = 0, revenue = 0;
      for (const tx of txs) {
        const sale = tx.type === 'sale';
        if (sale) {outgoing += units(tx); revenue += Number(tx.total);} else incoming += units(tx);
        for (const item of tx.items) {
          let row = byPart.get(item.partId);
          if (!row) {row = {name:item.name,code:item.code,bought:0,sold:0,revenue:0}; byPart.set(item.partId,row);}
          if (sale) {row.sold += item.quantity; row.revenue += item.quantity * item.unitPrice;} else row.bought += item.quantity;
        }
      }
      const list = [...byPart.values()].sort((a,b)=>b.sold-a.sold || a.name.localeCompare(b.name,'id'));
      const cards = [['Unit masuk',number(incoming)],['Unit terjual',number(outgoing)],['Nilai penjualan',rupiah(revenue)]];
      target.innerHTML = '<div class="op-metrics">' + cards.map(([label,value])=>'<div><span>' + label + '</span><strong>' + escape(value) + '</strong></div>').join('') +
        '</div><div class="op-subhead"><h2>Rekap per sparepart</h2>' + (list.length ? button('Unduh CSV','csv') : '') + '</div>' +
        table(['Sparepart','Kode','Masuk','Terjual','Nilai penjualan'],list.map(row=>[escape(row.name),escape(row.code),number(row.bought),number(row.sold),escape(rupiah(row.revenue))]),'Belum ada transaksi pada periode ini.');
      const download = target.querySelector('[data-op=csv]');
      if (download) download.onclick = () => {
        const rows = [['Sparepart','Kode','Masuk','Terjual','Nilai penjualan (Rp)'],...list.map(row=>[row.name,row.code,row.bought,row.sold,row.revenue])];
        const csv = rows.map(cells=>cells.map(value=>{
          let s = String(value);
          if (typeof value === 'string' && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"','""') + '"';
        }).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'laporan-sparepart-' + (reportFilters.from || 'awal') + '-' + (reportFilters.until || today()) + '.csv';
        document.body.append(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      };
    });
  }
  window.ops = {openPart,openDetail,openMovement,renderHistory,renderReports};
})();
