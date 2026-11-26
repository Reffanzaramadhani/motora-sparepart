(() => {
  'use strict';
  const main = document.getElementById('main');
  const paths = {
    shop:'<path d="M3 10h18l-2-6H5l-2 6zm1 0v10h16V10M9 20v-6h6v6M2 10c0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', movement:'<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
    box:'<path d="m3 7 9-5 9 5v10l-9 5-9-5V7zm0 0 9 5 9-5m-9 5v10m-5-17 10 5"/>',
    stack:'<path d="m3 7 9-5 9 5-9 5-9-5zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
    alert:'<path d="m12 3 10 17H2L12 3zM12 9v5m0 3h.01"/>',
    receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3zm4 5h6m-6 4h6"/>',
    search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
    down:'<path d="m5 9 7 7 7-7"/>', grid:'<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1"/>'
  };
  const icon = name => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => 'Rp' + Number(value).toLocaleString('id-ID');
  const defaultCategories = ['Mesin','Pengapian','Pengereman','Transmisi','Kaki-kaki','Kelistrikan','Lainnya'];
  const app = window.app = {state:{parts:[],movements:[],suppliers:[]}, categories:defaultCategories, escape, money, refresh, toast};
  let filter = {query:'',category:'',stock:''};
  let mode = 'grid', loaded = false, timer;
  const localDate = new Date();
  document.getElementById('today').textContent = new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(localDate);
  document.getElementById('profile').innerHTML = icon('shop');
  function toast(message) {
    clearTimeout(timer);
    const el = document.getElementById('toast'); el.textContent = message;
    timer = setTimeout(() => { el.textContent = ''; },4000);
  }
  async function refresh() {
    const response = await fetch('/api/state',{cache:'no-store'});
    if (!response.ok) throw new Error('Inventaris belum bisa dimuat.');
    const data = await response.json();
    app.state = {...data,movements:data.transactions};
    app.categories = [...new Set([...defaultCategories,...data.parts.map(p=>p.category)])];
    loaded = true; render();
  }
  function route() {
    const value = location.hash.slice(1);
    return ['katalog','transaksi','laporan'].includes(value) ? value : 'ringkasan';
  }
  const status = p => !p.stock ? 'empty' : p.stock <= p.minStock ? 'low' : 'available';
  function badge(p) {
    const key=status(p);
    return '<span class="stock-badge '+key+'"><i class="badge-dot"></i>'+({available:'Tersedia',low:'Menipis',empty:'Habis'}[key])+'</span>';
  }
  function pic(p) {
    return /^\/media\/[\w-]+\.webp$/.test(p.image||'') ? '<img loading="lazy" src="'+escape(p.image)+'" alt="">' : '<span class="fallback-img">'+icon('box')+'</span>';
  }
  function hero(){
    return '<section class="hero"><img class="hero-art" src="/media/hero.webp" alt="" fetchpriority="high"><div class="eyebrow">Ruang kerja bengkel</div><h1>Inventaris sparepart.</h1><p>Pantau stok dan kelola transaksi sparepart motor.</p><div class="hero-actions"><button class="btn" data-action="new">'+icon('plus')+'Tambah sparepart</button><button class="btn outline-white" data-action="sale">'+icon('movement')+'Catat penjualan</button></div><span class="caption">Piston &amp; setang seher</span></section>';
  }
  function metrics() {
    const {parts,transactions} = app.state;
    const rows = [['Jenis sparepart',parts.length,'SKU','box','catalog'],['Total stok',parts.reduce((n,p)=>n+p.stock,0),'unit','stack','catalog'],['Stok menipis',parts.filter(p=>p.stock<=p.minStock).length,'SKU','alert','low'],['Total transaksi',transactions.length,'catatan','receipt','history']];
    return '<section class="metrics" aria-label="Ringkasan inventaris">'+rows.map(([label,n,unit,i,action])=>'<button class="metric" data-action="'+action+'"><span class="stats-label">'+label+icon(i)+'</span><strong>'+n.toLocaleString('id-ID')+'</strong><small>'+unit+'</small></button>').join('')+'</section>';
  }
  function options(values,active) {return values.map(([value,label])=>'<option value="'+escape(value)+'"'+(value===active?' selected':'')+'>'+escape(label)+'</option>').join('');}
  function select(label,key,values) {
    return '<label class="select-wrap"><select class="compact-select" data-filter="'+key+'" aria-label="'+label+'">'+options(values,filter[key])+'</select>'+icon('down')+'</label>';
  }
  function catalog(isHome) {
    const categories = [...new Set(app.state.parts.map(p=>p.category))].sort();
    const head = isHome ? '<div class="section-head"><div class="head-left"><h2>Katalog sparepart</h2><span class="index-count">'+app.state.parts.length+'</span></div><a class="more-link" href="#katalog">Lihat semua</a></div>' : '<div class="page-top"><div><div class="section-label">Inventaris</div><h1 class="page-heading">Katalog sparepart</h1></div><button class="btn dark" data-action="new">'+icon('plus')+'Tambah sparepart</button></div>';
    return '<section>'+head+'<div class="toolbar"><label class="search-box">'+icon('search')+'<input type="search" id="search" aria-label="Cari nama, kode, atau tipe motor" placeholder="Cari nama, kode, tipe motor…" value="'+escape(filter.query)+'"></label>'+select('Kategori','category',[['','Semua kategori'],...categories.map(c=>[c,c])])+select('Status stok','stock',[['','Semua stok'],['available','Tersedia'],['critical','Menipis / habis'],['empty','Habis']])+'<div class="view-tools" aria-label="Tampilan katalog"><button aria-label="Tampilan kartu" data-mode="grid" aria-pressed="'+(mode==='grid')+'">'+icon('grid')+'</button><button aria-label="Tampilan daftar" data-mode="list" aria-pressed="'+(mode==='list')+'">'+icon('list')+'</button></div></div><div id="products"></div></section>';
  }
  function results() {
    const target = document.getElementById('products');
    if(!target) return;
    const q = filter.query.trim().toLowerCase();
    const filtered = app.state.parts.filter(p => (!filter.category || p.category===filter.category) && (!filter.stock || (filter.stock==='critical'?p.stock<=p.minStock:status(p)===filter.stock)) && [p.name,p.code,p.brand,p.compatibility,p.category].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>a.code.localeCompare(b.code,'id',{numeric:true}));
    if(!filtered.length) {target.innerHTML='<div class="empty-view"><p>Sparepart tidak ditemukan.</p><button class="btn" data-action="reset">Hapus filter</button></div>';return;}
    const display=route()==='ringkasan'?filtered.slice(0,8):filtered;
    if(mode==='grid') {
      target.innerHTML='<div class="grid">'+display.map(p => '<button class="product" data-part="'+escape(p.id)+'"><div class="product-visual">'+pic(p)+badge(p)+'</div><div class="product-text"><div class="sku">'+escape(p.code)+' · '+escape(p.category)+'</div><div class="prod-name">'+escape(p.name)+'</div><div class="prod-bottom"><span class="price">'+money(p.price)+'</span><span class="meta">'+p.stock+' unit</span></div></div></button>').join('')+'</div>';
    } else {
      target.innerHTML='<div class="catalog-list"><table><thead><tr><th>Sparepart</th><th>Kode</th><th>Harga</th><th>Stok</th><th>Status</th></tr></thead><tbody>'+display.map(p=>'<tr><td><button class="part-link" data-part="'+escape(p.id)+'">'+pic(p)+escape(p.name)+'</button></td><td>'+escape(p.code)+'</td><td>'+money(p.price)+'</td><td>'+p.stock+' unit</td><td>'+badge(p)+'</td></tr>').join('')+'</tbody></table></div>';
    }
  }
  function render(){
    if(!loaded)return;
    const view=route();
    document.querySelectorAll('#nav a').forEach(a=>{if(a.hash==='#'+view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const title={ringkasan:'Ringkasan',katalog:'Katalog',transaksi:'Transaksi',laporan:'Laporan'}[view];
    document.title=title+' · Motora';
    if(view==='transaksi'){main.innerHTML='';window.ops.renderHistory(main);return;}
    if(view==='laporan'){main.innerHTML='';window.ops.renderReports(main);return;}
    main.innerHTML=(view==='ringkasan'?hero()+metrics():'')+catalog(view==='ringkasan');
    results();
  }
  main.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.part){window.ops.openDetail(b.dataset.part);return;}
    if(b.dataset.mode){mode=b.dataset.mode;main.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode===mode)));results();return;}
    switch(b.dataset.action){
      case 'new':window.ops.openPart();break;
      case 'sale':window.ops.openMovement('sale');break;
      case 'catalog':case 'low': filter={query:'',category:'',stock:b.dataset.action==='low'?'critical':''};location.hash='katalog';break;
      case 'history':location.hash='transaksi';break;
      case 'reset':filter={query:'',category:'',stock:''};render();break;
      case 'retry':start();break;
    }
  });
  main.addEventListener('input',e=>{if(e.target.id==='search'){filter.query=e.target.value;results();}});
  main.addEventListener('change',e=>{if(e.target.dataset.filter){filter[e.target.dataset.filter]=e.target.value;results();}});
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
  async function start(){
    try {await refresh();}
    catch {main.innerHTML='<div class="empty-view"><p>Inventaris gagal dimuat. Coba hubungkan kembali ke server.</p><button class="btn" data-action="retry">Coba lagi</button></div>';}
  }
  start();
})();
