(() => {
  'use strict';

  // Tell the early inline guard that the storefront script is alive.
  document.documentElement.classList.add('sf-ready');

  const state = { parts: [], category: '', query: '' };

  const els = {
    categoryGrid: document.getElementById('category-grid'),
    productGrid: document.getElementById('product-grid'),
    catalogNote: document.getElementById('catalog-note'),
    searchInput: document.getElementById('part-search'),
    motorSelect: document.getElementById('motor-select'),
    motorChips: document.getElementById('motor-chips'),
    compatibilityForm: document.getElementById('compatibility-form'),
    compatibilityMessage: document.getElementById('compatibility-message'),
    resetFilters: document.getElementById('reset-filters'),
    filterList: document.getElementById('filter-list'),
    dialog: document.getElementById('part-dialog'),
    dialogContent: document.getElementById('dialog-content'),
    localCount: document.getElementById('local-count'),
    statParts: document.getElementById('stat-parts'),
    statCategories: document.getElementById('stat-categories'),
    statMotors: document.getElementById('stat-motors'),
    header: document.getElementById('sf-header'),
    menuToggle: document.getElementById('sf-menu-toggle'),
    mobileMenu: document.getElementById('sf-mobile-menu'),
    toTop: document.getElementById('sf-to-top')
  };

  const ARROW_ICON = '<svg class="sf-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

  const categoryImage = {
    Mesin: '/media/piston.webp',
    Pengapian: '/media/busi.webp',
    Pengereman: '/media/kampas-rem.webp',
    Transmisi: '/media/gear.webp',
    'Kaki-kaki': '/media/laher.webp'
  };

  const FALLBACK_IMAGE = '/media/filter-udara.webp';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const formatPrice = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

  const normalized = (value) => String(value || '').toLocaleLowerCase('id-ID');

  const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduceMotion = () => Boolean(reduceMotionQuery && reduceMotionQuery.matches);

  function categories() {
    return [...new Set(state.parts.map((part) => part.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id'));
  }

  function motorTypes() {
    return [...new Set(state.parts.map((part) => part.compatibility).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id'));
  }

  function matchesFilter(part) {
    const query = normalized(state.query.trim());
    const categoryMatches = !state.category || part.category === state.category;
    const fields = [part.name, part.code, part.category, part.compatibility, part.brand].map(normalized);
    return categoryMatches && (!query || fields.some((field) => field.includes(query)));
  }

  function filteredParts() {
    return state.parts.filter(matchesFilter).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }

  /* ------------------------------------------------------------------------
     Scroll-reveal
     ------------------------------------------------------------------------ */
  const revealObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' })
    : null;

  function observeReveals(root = document) {
    const targets = [...root.querySelectorAll('.sf-reveal:not(.is-in)')];
    if (!revealObserver) {
      targets.forEach((target) => target.classList.add('is-in'));
      return;
    }
    targets.forEach((target) => revealObserver.observe(target));
  }

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */
  function renderCategories() {
    const list = categories();
    if (!list.length) {
      els.categoryGrid.innerHTML = '<p class="sf-empty">Kategori belum tersedia.</p>';
      return;
    }
    els.categoryGrid.innerHTML = list.map((category, index) => {
      const count = state.parts.filter((part) => part.category === category).length;
      const image = categoryImage[category] || FALLBACK_IMAGE;
      return `<button class="sf-category-card sf-reveal" type="button" data-category="${escapeHtml(category)}" aria-label="Lihat kategori ${escapeHtml(category)}" style="--i:${Math.min(index, 4)}">
        <span class="sf-category-media"><img src="${escapeHtml(image)}" alt="Ilustrasi ${escapeHtml(category)}" loading="lazy" width="627" height="627"></span>
        <span class="sf-category-body">
          <span class="sf-category-title">${escapeHtml(category)}</span>
          <span class="sf-category-description">${count} sparepart pada katalog</span>
        </span>
        <span class="sf-category-arrow" aria-hidden="true">${ARROW_ICON}</span>
      </button>`;
    }).join('');
    observeReveals(els.categoryGrid);
  }

  function renderCategoryFilters() {
    const anchor = els.filterList.querySelector('[data-filter-anchor]');
    if (!anchor) return;
    [...els.filterList.querySelectorAll('.sf-filter-button[data-category]')].forEach((button) => {
      if (button !== anchor) button.remove();
    });
    categories().forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sf-filter-button';
      button.dataset.category = category;
      button.textContent = category;
      els.filterList.append(button);
    });
    updateFilterButtons();
  }

  function updateFilterButtons() {
    [...els.filterList.querySelectorAll('.sf-filter-button')].forEach((button) => {
      const selected = button.dataset.category === state.category;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderProducts({ animate = true } = {}) {
    const parts = filteredParts();
    const notes = [];
    if (state.category) notes.push(`kategori ${state.category}`);
    if (state.query.trim()) notes.push(`pencarian “${state.query.trim()}”`);
    els.catalogNote.textContent = parts.length
      ? `${parts.length} sparepart${notes.length ? ' · ' + notes.join(' · ') : ''} ditampilkan.`
      : 'Tidak ada sparepart yang sesuai dengan pencarian.';
    els.resetFilters.hidden = !(state.category || state.query.trim());

    if (!parts.length) {
      els.productGrid.innerHTML = `<p class="sf-empty">Ubah kata kunci atau pilih kategori lain untuk melihat sparepart.<br><button class="sf-button sf-button-outline" type="button" data-reset>Hapus filter</button></p>`;
      return;
    }

    els.productGrid.innerHTML = parts.map((part, index) => {
      const reveal = animate ? ' sf-reveal' : '';
      const delay = animate ? ` style="--i:${index % 6}"` : '';
      const compatibility = part.compatibility ? `Cocok: ${escapeHtml(part.compatibility)}` : 'Lihat catatan kecocokan';
      return `<button class="sf-product-card${reveal}" type="button" data-part-id="${escapeHtml(part.id)}" aria-label="Lihat detail ${escapeHtml(part.name)}"${delay}>
        <span class="sf-card-media">
          <img src="${escapeHtml(part.image || FALLBACK_IMAGE)}" alt="Ilustrasi ${escapeHtml(part.name)}" loading="lazy" width="627" height="627">
          <span class="sf-card-badge">${escapeHtml(part.category || 'Sparepart')}</span>
          <span class="sf-card-code">${escapeHtml(part.code || '—')}</span>
        </span>
        <span class="sf-card-copy">
          <strong class="sf-card-title" role="heading" aria-level="3">${escapeHtml(part.name)}</strong>
          <span class="sf-card-compat">${compatibility}</span>
          <span class="sf-card-bottom">
            <span class="sf-card-price">${formatPrice(part.price)}</span>
            <span class="sf-card-detail">Lihat detail ${ARROW_ICON}</span>
          </span>
        </span>
      </button>`;
    }).join('');

    if (animate) observeReveals(els.productGrid);
  }

  function populateMotorSelect() {
    const entries = motorTypes();
    els.motorSelect.innerHTML = '<option value="">Pilih tipe motor</option>'
      + entries.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry)}</option>`).join('');
    renderMotorChips();
  }

  function renderMotorChips() {
    const entries = motorTypes();
    if (!els.motorChips) return;
    if (!entries.length) {
      els.motorChips.innerHTML = '';
      return;
    }
    els.motorChips.innerHTML = entries.map((entry) => {
      const active = els.motorSelect.value === entry ? ' is-active' : '';
      return `<button class="sf-motor-chip${active}" type="button" data-motor="${escapeHtml(entry)}">${escapeHtml(entry)}</button>`;
    }).join('');
  }

  function updateMotorChips() {
    [...els.motorChips.querySelectorAll('.sf-motor-chip')].forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.motor === els.motorSelect.value);
    });
  }

  function updateCatalogSummary() {
    const parts = state.parts.length;
    const categoryCount = categories().length;
    const motorCount = motorTypes().length;
    if (els.localCount) els.localCount.textContent = `${parts} komponen`;
    if (els.statParts) els.statParts.textContent = String(parts);
    if (els.statCategories) els.statCategories.textContent = String(categoryCount);
    if (els.statMotors) els.statMotors.textContent = String(motorCount);
  }

  /* ------------------------------------------------------------------------
     Product dialog
     ------------------------------------------------------------------------ */
  let lastFocused = null;
  let dialogClosing = false;

  function openPart(id, trigger) {
    const part = state.parts.find((item) => String(item.id) === String(id));
    if (!part) return;
    els.dialogContent.innerHTML = `<div class="sf-dialog-grid">
      <div class="sf-dialog-image"><img src="${escapeHtml(part.image || FALLBACK_IMAGE)}" alt="Ilustrasi ${escapeHtml(part.name)}" width="627" height="627"></div>
      <div class="sf-dialog-copy">
        <p class="sf-eyebrow">${escapeHtml(part.category || 'Sparepart')}</p>
        <h2 id="dialog-title">${escapeHtml(part.name)}</h2>
        <p class="sf-dialog-price">${formatPrice(part.price)}</p>
        <dl class="sf-dialog-details">
          <div><dt>Kode sparepart</dt><dd>${escapeHtml(part.code || '—')}</dd></div>
          <div><dt>Merek</dt><dd>${escapeHtml(part.brand || '—')}</dd></div>
          <div><dt>Catatan kecocokan</dt><dd>${escapeHtml(part.compatibility || '—')}</dd></div>
        </dl>
        <p class="sf-dialog-note">Konfirmasi ketersediaan serta kesesuaian kendaraan sebelum melakukan pembelian.</p>
      </div>
    </div>`;
    lastFocused = trigger || document.activeElement;
    dialogClosing = false;
    els.dialog.classList.remove('is-closing');
    els.dialog.showModal();
  }

  function closeDialog() {
    if (!els.dialog.open || dialogClosing) return;
    if (reduceMotion()) {
      els.dialog.close();
      return;
    }
    dialogClosing = true;
    els.dialog.classList.add('is-closing');
    window.setTimeout(() => {
      if (els.dialog.classList.contains('is-closing')) els.dialog.close();
    }, 210);
  }

  /* ------------------------------------------------------------------------
     Filtering helpers
     ------------------------------------------------------------------------ */
  function scrollToCatalog() {
    const target = document.getElementById('katalog');
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function setCategory(category) {
    state.category = category;
    updateFilterButtons();
    renderProducts({ animate: true });
    scrollToCatalog();
  }

  function applyCompatibility(value) {
    if (!value) {
      els.compatibilityMessage.textContent = 'Pilih tipe motor terlebih dahulu.';
      els.motorSelect.focus();
      return;
    }
    state.category = '';
    state.query = value;
    els.searchInput.value = value;
    updateFilterButtons();
    renderProducts({ animate: true });
    const amount = filteredParts().length;
    els.compatibilityMessage.textContent = `${amount} sparepart dengan catatan kecocokan “${value}” ditampilkan pada katalog.`;
    scrollToCatalog();
  }

  function resetFilters() {
    state.category = '';
    state.query = '';
    els.searchInput.value = '';
    els.motorSelect.value = '';
    els.compatibilityMessage.textContent = 'Pilih tipe motor untuk melihat katalog yang relevan.';
    updateFilterButtons();
    updateMotorChips();
    renderProducts({ animate: true });
  }

  /* ------------------------------------------------------------------------
     Header, navigation state, back to top
     ------------------------------------------------------------------------ */
  function navOffset() {
    const headerHeight = els.header ? els.header.offsetHeight : 56;
    const anchorNav = document.querySelector('.sf-anchor-nav');
    const anchorHeight = anchorNav && getComputedStyle(anchorNav).position === 'sticky'
      ? anchorNav.offsetHeight
      : 0;
    return headerHeight + anchorHeight + 36;
  }

  const navSections = [
    { id: 'kategori', el: document.getElementById('kategori') },
    { id: 'katalog', el: document.getElementById('katalog') },
    { id: 'cocok', el: document.getElementById('cocok') },
    { id: 'tentang', el: document.getElementById('tentang') }
  ].filter((section) => section.el);

  function updateActiveNav() {
    const marker = window.scrollY + navOffset();
    let activeId = '';
    navSections.forEach((section) => {
      if (section.el.getBoundingClientRect().top + window.scrollY <= marker) activeId = section.id;
    });
    [...document.querySelectorAll('[data-nav-section]')].forEach((link) => {
      link.classList.toggle('is-active', link.dataset.navSection === activeId);
      if (link.dataset.navSection === activeId) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  let scrollTicking = false;

  function onScroll() {
    if (els.header) els.header.classList.toggle('is-scrolled', window.scrollY > 6);
    if (els.toTop) els.toTop.classList.toggle('is-visible', window.scrollY > 620);
    updateActiveNav();
  }

  function bindScroll() {
    window.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        onScroll();
      });
    }, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------------ */
  let menuCloseTimer = 0;

  function openMenu() {
    if (!els.mobileMenu || !els.mobileMenu.hidden) return;
    window.clearTimeout(menuCloseTimer);
    els.mobileMenu.hidden = false;
    els.mobileMenu.classList.remove('is-closing');
    els.menuToggle.classList.add('is-open');
    els.menuToggle.setAttribute('aria-expanded', 'true');
    els.menuToggle.setAttribute('aria-label', 'Tutup menu navigasi');
    const firstLink = els.mobileMenu.querySelector('a');
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function closeMenu({ restoreFocus = false } = {}) {
    if (!els.mobileMenu || els.mobileMenu.hidden) return;
    els.menuToggle.classList.remove('is-open');
    els.menuToggle.setAttribute('aria-expanded', 'false');
    els.menuToggle.setAttribute('aria-label', 'Buka menu navigasi');
    els.mobileMenu.classList.add('is-closing');
    window.clearTimeout(menuCloseTimer);
    menuCloseTimer = window.setTimeout(() => {
      if (!els.mobileMenu.classList.contains('is-closing')) return;
      els.mobileMenu.hidden = true;
      els.mobileMenu.classList.remove('is-closing');
    }, 200);
    if (restoreFocus) els.menuToggle.focus({ preventScroll: true });
  }

  function bindMenu() {
    if (!els.menuToggle || !els.mobileMenu) return;
    els.menuToggle.addEventListener('click', () => {
      if (els.mobileMenu.hidden) openMenu();
      else closeMenu({ restoreFocus: true });
    });
    els.mobileMenu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (els.mobileMenu.hidden) return;
      if (els.header && els.header.contains(event.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || els.mobileMenu.hidden) return;
      closeMenu({ restoreFocus: true });
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  /* ------------------------------------------------------------------------
     Event bindings
     ------------------------------------------------------------------------ */
  function bindEvents() {
    els.searchInput.addEventListener('input', () => {
      state.query = els.searchInput.value;
      renderProducts({ animate: false });
    });

    document.addEventListener('click', (event) => {
      const categoryButton = event.target.closest('[data-category]');
      if (categoryButton) {
        setCategory(categoryButton.dataset.category);
        return;
      }
      const partButton = event.target.closest('[data-part-id]');
      if (partButton) {
        openPart(partButton.dataset.partId, partButton);
        return;
      }
      const motorChip = event.target.closest('[data-motor]');
      if (motorChip) {
        els.motorSelect.value = motorChip.dataset.motor;
        updateMotorChips();
        applyCompatibility(motorChip.dataset.motor);
        return;
      }
      if (event.target.closest('[data-reset]')) {
        resetFilters();
        return;
      }
      if (event.target.closest('.sf-dialog-close')) {
        closeDialog();
      }
    });

    els.compatibilityForm.addEventListener('submit', (event) => {
      event.preventDefault();
      applyCompatibility(els.motorSelect.value);
    });

    els.motorSelect.addEventListener('change', updateMotorChips);

    els.dialog.addEventListener('click', (event) => {
      if (event.target === els.dialog) closeDialog();
    });
    els.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    els.dialog.addEventListener('close', () => {
      dialogClosing = false;
      els.dialog.classList.remove('is-closing');
      if (lastFocused && lastFocused.isConnected) lastFocused.focus({ preventScroll: true });
    });

    if (els.toTop) {
      els.toTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      });
    }

    bindMenu();
    bindScroll();
  }

  /* ------------------------------------------------------------------------
     Data loading
     ------------------------------------------------------------------------ */
  async function loadCatalog() {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) throw new Error('Katalog tidak dapat dimuat.');
      const data = await response.json();
      state.parts = Array.isArray(data.parts) ? data.parts : [];
      renderCategories();
      renderCategoryFilters();
      populateMotorSelect();
      renderProducts();
      updateCatalogSummary();
      observeReveals();
    } catch (error) {
      const message = '<p class="sf-error">Katalog belum dapat dimuat. <button type="button" class="reload-catalog">Coba lagi</button></p>';
      els.categoryGrid.innerHTML = message;
      els.productGrid.innerHTML = message;
      els.catalogNote.textContent = 'Periksa koneksi server lalu coba lagi.';
      els.localCount.textContent = 'tidak tersedia';
      [els.statParts, els.statCategories, els.statMotors].forEach((node) => { if (node) node.textContent = '—'; });
      [...document.querySelectorAll('.reload-catalog')].forEach((button) => {
        button.addEventListener('click', () => location.reload());
      });
    }
  }

  bindEvents();
  observeReveals();
  loadCatalog();
})();
