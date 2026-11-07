/* ============================================================
   Оранжерея — main JS
   Каталог, корзина, модалки, формы, анимации
   ============================================================ */

(() => {
  'use strict';

  // ============ Утилиты ============
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fmtPrice = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' \u20BD';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function showToast(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('is-visible'), ms);
  }

  function setHidden(el, hidden) {
    if (hidden) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }

  // ============ Состояние корзины ============
  const Cart = {
    items: [],
    listeners: new Set(),

    init() {
      try {
        const saved = localStorage.getItem('orangerie_cart');
        if (saved) this.items = JSON.parse(saved);
      } catch { this.items = []; }
      this.render();
    },

    subscribe(fn) {
      this.listeners.add(fn);
      // Render persisted state immediately for late subscribers.
      fn(this.items);
      return () => this.unsubscribe(fn);
    },
    unsubscribe(fn) { this.listeners.delete(fn); },

    notify() {
      this.listeners.forEach(fn => fn(this.items));
      try { localStorage.setItem('orangerie_cart', JSON.stringify(this.items)); } catch { /* storage is optional */ }
    },

    add(item) {
      const exist = this.items.find(i => i.id === item.id);
      if (exist) exist.qty = Math.min(99, exist.qty + 1);
      else this.items.push({ ...item, qty: 1 });
      this.notify();
      showToast('\u00AB' + item.name + '\u00BB добавлено в корзину');
    },

    setQty(id, qty) {
      const item = this.items.find(i => i.id === id);
      if (!item) return;
      if (qty <= 0) this.remove(id);
      else { item.qty = clamp(qty, 1, 99); this.notify(); }
    },

    remove(id) {
      this.items = this.items.filter(i => i.id !== id);
      this.notify();
    },

    clear() {
      this.items = [];
      this.notify();
    },

    getTotal() {
      return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    },

    getCount() {
      return this.items.reduce((sum, i) => sum + i.qty, 0);
    },

    render() {
      this.notify();
    }
  };

  // ============ Каталог: фильтрация табами ============
  function initCatalogTabs() {
    const tabs = $$('.tab');
    const cards = $$('.card');
    const note = $('#catalogNote');

    // Счётчики в табах считаем по факту, чтобы не расходились с каталогом
    const counts = { all: cards.length };
    cards.forEach(card => {
      const key = card.dataset.cat;
      counts[key] = (counts[key] || 0) + 1;
    });
    tabs.forEach(tab => {
      const span = tab.querySelector('span');
      if (span) span.textContent = counts[tab.dataset.filter] || 0;
    });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;
        tabs.forEach(t => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab);
        });

        let visible = 0;
        cards.forEach(card => {
          const match = filter === 'all' || card.dataset.cat === filter;
          card.classList.toggle('is-hidden', !match);
          if (match) visible++;
        });

        setHidden(note, visible > 0);
      });
    });
  }

  // ============ Каталог: кнопки «добавить» ============
  function initAddButtons() {
    const grid = $('#grid');
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      const card = btn.closest('.card');
      const id = card.dataset.id;
      const name = card.dataset.name;
      const price = Number(card.dataset.price);
      const priceMax = card.dataset.priceMax ? Number(card.dataset.priceMax) : null;
      const from = card.dataset.from ? Number(card.dataset.from) : null;

      Cart.add({
        id,
        name,
        price,
        priceMax,
        from,
        cat: card.dataset.cat,
        icon: card.querySelector('.card__pic use, .card__icon use')?.getAttribute('href')?.replace('#', '') || 'i-sprout',
        tag: card.querySelector('.card__tag')?.textContent || ''
      });
    });
  }

  // ============ Корзина: сайдбар (drawer) ============
  function initDrawer() {
    const drawer = $('#drawer');
    const overlay = $('#overlay');
    const openBtn = $('#cartOpen');
    const closeBtn = $('#cartClose');
    const clearBtn = $('#cartClear');
    const checkoutBtn = $('#checkoutBtn');
    const itemsEl = $('#cartItems');
    const emptyEl = $('#cartEmpty');
    const footEl = $('#cartFoot');
    const totalEl = $('#cartTotal');
    const countEl = $('#cartCount');
    const hintEl = $('#cartHint');
    let lastFocused = null;
    let closeTimer = null;

    function open() {
      clearTimeout(closeTimer);
      lastFocused = document.activeElement;
      drawer.hidden = false;
      overlay.hidden = false;
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
      });
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function close({ restoreFocus = true } = {}) {
      clearTimeout(closeTimer);
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      closeTimer = setTimeout(() => {
        drawer.hidden = true;
        overlay.hidden = true;
        document.body.style.overflow = '';
        if (restoreFocus && lastFocused && lastFocused.focus) lastFocused.focus();
      }, 450);
    }

    document.addEventListener('close-cart', () => close());
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    $('#cartToCatalog')?.addEventListener('click', e => {
      e.preventDefault();
      close({ restoreFocus: false });
      setTimeout(() => $('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
    });

    clearBtn.addEventListener('click', () => {
      Cart.clear();
      showToast('Корзина очищена');
    });

    checkoutBtn.addEventListener('click', () => {
      close();
      const formSection = $('#order');
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#fieldName')?.focus();
    });

    Cart.subscribe(items => {
      const count = Cart.getCount();
      countEl.textContent = count;
      setHidden(countEl, count === 0);

      if (items.length === 0) {
        itemsEl.innerHTML = '';
        emptyEl.hidden = false;
        footEl.hidden = true;
        return;
      }

      emptyEl.hidden = true;
      footEl.hidden = false;

      itemsEl.innerHTML = items.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item__art">
            <svg aria-hidden="true"><use href="#${item.icon}"/></svg>
          </div>
          <div>
            <p class="cart-item__name">${escapeHtml(item.name)}</p>
            <p class="cart-item__price">${item.priceMax ? '\u043E\u0442 ' + fmtPrice(item.price) : fmtPrice(item.price)}</p>
          </div>
          <div class="cart-item__side">
            <div class="qty" role="group" aria-label="Количество">
              <button type="button" data-dec aria-label="Уменьшить">\u2212</button>
              <span>${item.qty}</span>
              <button type="button" data-inc aria-label="Увеличить">+</button>
            </div>
            <button type="button" class="cart-item__remove" data-remove>\u0443\u0434\u0430\u043B\u0438\u0442\u044C</button>
          </div>
        </div>
      `).join('');

      totalEl.textContent = fmtPrice(Cart.getTotal());

      const hasRange = items.some(i => i.priceMax || i.from);
      setHidden(hintEl, !hasRange);
    });

    itemsEl.addEventListener('click', e => {
      const itemEl = e.target.closest('.cart-item');
      if (!itemEl) return;
      const id = itemEl.dataset.id;

      if (e.target.matches('[data-inc]')) {
        const item = Cart.items.find(i => i.id === id);
        if (item) Cart.setQty(id, item.qty + 1);
      } else if (e.target.matches('[data-dec]')) {
        const item = Cart.items.find(i => i.id === id);
        if (item) Cart.setQty(id, item.qty - 1);
      } else if (e.target.matches('[data-remove]')) {
        Cart.remove(id);
        showToast('Удалено из корзины');
      }
    });
  }

  // ============ Блок «Состав заказа» в форме ============
  function initOrderSummary() {
    const listEl = $('#orderList');
    const emptyEl = $('#orderEmpty');
    const sumEl = $('#orderSum');
    const totalEl = $('#orderTotal');
    const clearBtn = $('#summaryClear');
    const hintEl = $('#orderHint');

    Cart.subscribe(items => {
      if (items.length === 0) {
        listEl.innerHTML = '';
        emptyEl.hidden = false;
        sumEl.hidden = true;
        hintEl.hidden = true;
        return;
      }

      emptyEl.hidden = true;
      sumEl.hidden = false;

      listEl.innerHTML = items.map(item => `
        <li class="order__list-item" data-id="${item.id}">
          <div class="order__item-main">
            <span class="order__item-name">${escapeHtml(item.name)}</span>
            <span class="order__item-qty">\u00D7 ${item.qty}</span>
          </div>
          <div class="order__item-side">
            <span class="order__item-price">${item.priceMax ? '\u043E\u0442 ' + fmtPrice(item.price) : fmtPrice(item.price * item.qty)}</span>
            <button type="button" class="order__item-remove" data-remove>\u00D7</button>
          </div>
        </li>
      `).join('');

      totalEl.textContent = fmtPrice(Cart.getTotal());
      const hasRange = items.some(i => i.priceMax || i.from);
      setHidden(hintEl, !hasRange);
    });

    listEl.addEventListener('click', e => {
      if (e.target.matches('[data-remove]')) {
        const li = e.target.closest('[data-id]');
        if (li) Cart.remove(li.dataset.id);
      }
    });

    clearBtn.addEventListener('click', () => {
      Cart.clear();
      showToast('Корзина очищена');
    });
  }

  // ============ Форма заявки ============
  function initOrderForm() {
    const form = $('#orderForm');
    const errorEl = $('#formError');
    const doneEl = $('#orderDone');
    const gridEl = $('.order__grid');
    const previewEl = $('#orderPreview');
    const resetBtn = $('#orderReset');
    const copyBtn = $('#orderCopy');

    function validate(formData) {
      const name = formData.get('name')?.trim();
      const phone = formData.get('phone')?.trim();
      const errors = [];

      if (!name) errors.push('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F');
      if (!phone) errors.push('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043B\u0435\u0444\u043E\u043D');
      else if (!/^(?:\+?7|8)?\d{10}$/.test(phone.replace(/[\s()-]/g, '').replace(/^8(?=\d{10}$)/, '7'))) {
        errors.push('\u0422\u0435\u043B\u0435\u0444\u043E\u043D \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 +7 900 000-00-00');
      }
      return errors;
    }

    function buildPreview(formData, items) {
      const lines = [];
      lines.push('\u0418\u043C\u044F: ' + formData.get('name'));
      lines.push('\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ' + formData.get('phone'));
      const comment = formData.get('comment')?.trim();
      if (comment) lines.push('\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439: ' + comment);
      lines.push('');
      lines.push('\u0421\u043E\u0441\u0442\u0430\u0432 \u0437\u0430\u043A\u0430\u0437\u0430:');
      if (items.length === 0) {
        lines.push('  (\u043F\u0443\u0441\u0442\u043E \u2014 \u0434\u0435\u0442\u0430\u043B\u0438 \u0432 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438 \u0438\u043B\u0438 \u043F\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443)');
      } else {
        items.forEach(item => {
          const priceStr = item.priceMax ? '\u043E\u0442 ' + fmtPrice(item.price) : fmtPrice(item.price * item.qty);
          lines.push('  ' + item.name + ' \u00D7 ' + item.qty + ' \u2014 ' + priceStr);
        });
        lines.push('  \u0418\u0442\u043E\u0433\u043E: ' + fmtPrice(Cart.getTotal()));
        const hasRange = items.some(i => i.priceMax || i.from);
        if (hasRange) lines.push('  * \u0426\u0435\u043D\u044B \u043F\u043E\u0437\u0438\u0446\u0438\u0439 \u00AB\u0432 \u0430\u0441\u0441\u043E\u0440\u0442\u0438\u043C\u0435\u043D\u0442\u0435\u00BB \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0437\u0432\u043E\u043D\u043A\u0435.');
      }
      return lines.join('\n');
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorEl.hidden = true;
      errorEl.textContent = '';

      const formData = new FormData(form);
      const errors = validate(formData);

      if (errors.length) {
        errorEl.textContent = errors.join('. ');
        errorEl.hidden = false;
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430\u2026';

      await new Promise(r => setTimeout(r, 800));

      const preview = buildPreview(formData, Cart.items);
      previewEl.textContent = preview;
      if (gridEl) gridEl.hidden = true;
      doneEl.hidden = false;

      Cart.clear();
      showToast('\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430! \u041C\u044B \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F \u0441 \u0432\u0430\u043C\u0438.');
    });

    resetBtn.addEventListener('click', () => {
      form.reset();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
      }
      if (gridEl) gridEl.hidden = false;
      doneEl.hidden = true;
      form.hidden = false;
    });

    copyBtn.addEventListener('click', async () => {
      const text = previewEl.textContent;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        showToast('\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0432 \u0431\u0443\u0444\u0435\u0440 \u043e\u0431\u043c\u0435\u043d\u0430');
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        showToast(copied ? '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0432 \u0431\u0443\u0444\u0435\u0440 \u043e\u0431\u043c\u0435\u043d\u0430' : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c');
      }
    });
  }

  // ============ Мобильное меню ============
  function initMobileMenu() {
    const burger = $('#burger');
    const nav = $('#nav');

    burger.addEventListener('click', () => {
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', !expanded);
      nav.classList.toggle('is-open');
    });

    const closeMenu = () => {
      burger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };

    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });
    document.addEventListener('pointerdown', e => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !burger.contains(e.target)) closeMenu();
    });
  }

  // ============ Хедер: скролл ============
  function initHeaderScroll() {
    const header = $('#header');
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 20);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============ Статус «Открыто/Закрыто» ============
  function initStatusChip() {
    const chip = $('#statusChip');
    const textEl = $('#statusText');

    function update() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const mins = h * 60 + m;

      const open = 10 * 60;
      if (mins >= open) {
        chip.classList.add('is-open');
        textEl.textContent = '\u041E\u0442\u043A\u0440\u044B\u0442\u043E \u00B7 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E \u0441 10:00';
      } else {
        chip.classList.remove('is-open');
        if (mins < open) {
          const diff = open - mins;
          const hh = Math.floor(diff / 60);
          const mm = diff % 60;
          textEl.textContent = '\u0417\u0430\u043A\u0440\u044B\u0442\u043E \u00B7 \u043E\u0442\u043A\u0440\u043E\u0435\u043C\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ' + hh + ' \u0447 ' + mm + ' \u043C\u0438\u043D';
        } else {
          textEl.textContent = '\u0417\u0430\u043A\u0440\u044B\u0442\u043E \u00B7 \u043E\u0442\u043A\u0440\u043E\u0435\u043C\u0441\u044F \u0437\u0430\u0432\u0442\u0440\u0430 \u0432 10:00';
        }
      }
    }

    update();
    setInterval(update, 60_000);
  }

  // ============ Год в футере ============
  function initYear() {
    $('#year').textContent = new Date().getFullYear();
  }

  // ============ Анимации появления (IntersectionObserver) ============
  function initReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $$('.reveal').forEach(el => el.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    $$('.reveal').forEach((el, i) => {
      el.style.setProperty('--delay', `${i * 40}ms`);
      observer.observe(el);

      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        el.classList.add('is-in');
        observer.unobserve(el);
      }
    });

    setTimeout(() => {
      $$('.reveal:not(.is-in)').forEach(el => el.classList.add('is-in'));
    }, 1200);
  }

  // ============ Плавный скролл для якорей ============
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.focus({ preventScroll: true });
        }
      });
    });
  }

  // ============ Карточки: кнопка «Подробнее» и модалка товара ============
  let currentCard = null;
  let lastFocused = null;

  function priceLabel(card) {
    const price = Number(card.dataset.price || 0);
    const max = Number(card.dataset.priceMax || 0);
    const fmt = n => n.toLocaleString('ru-RU');
    if (max > price) return fmt(price) + ' – ' + fmt(max) + ' ₽';
    if (card.dataset.from === '1') return 'от ' + fmt(price) + ' ₽';
    return fmt(price) + ' ₽';
  }

  function initCardOverlays() {
    $$('.card').forEach(card => {
      const art = card.querySelector('.card__art');
      if (!art || art.querySelector('[data-view]')) return;

      const name = card.dataset.name || (card.querySelector('.card__title') || {}).textContent || 'Растение';
      const wrap = document.createElement('div');
      wrap.className = 'card__overlay';
      wrap.innerHTML =
        '<button class="card__overlay-btn" type="button" data-view>' +
        'Подробнее<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button>';
      const btn = wrap.querySelector('button');
      btn.setAttribute('aria-label', 'Подробнее: ' + name);
      art.appendChild(wrap);
      btn.addEventListener('click', () => openProduct(card));
    });
  }

  function openProduct(card) {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    currentCard = card;
    const d = card.dataset;
    const art = card.querySelector('.card__art');

    const box = modal.querySelector('[data-product-art]');
    if (box && art) {
      box.className = 'product__art ' + art.className;
      const photo = art.querySelector('.card__photo');
      if (photo) {
        box.innerHTML = '<img class="card__photo" src="' + photo.getAttribute('src') + '" alt="">';
        const modalPhoto = box.querySelector('.card__photo');
        modalPhoto.addEventListener('error', () => {
          box.classList.add('is-fallback');
          modalPhoto.remove();
          const fallback = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          fallback.classList.add('card__pic');
          fallback.setAttribute('viewBox', '0 0 64 72');
          fallback.setAttribute('aria-hidden', 'true');
          fallback.innerHTML = '<use href="' + (art.querySelector('.card__pic use')?.getAttribute('href') || '#p-tulip') + '"/>';
          box.appendChild(fallback);
        }, { once: true });
      } else {
        box.classList.add('is-fallback');
        const pic = art.querySelector('.card__pic use');
        box.innerHTML = '<svg class="card__pic" viewBox="0 0 64 72" aria-hidden="true"><use href="' +
          (pic ? pic.getAttribute('href') : '#p-tulip') + '"/></svg>';
      }
    }

    const set = (sel, val) => {
      const el = modal.querySelector(sel);
      if (el) el.textContent = val || '';
    };
    set('[data-product-name]', d.name);
    set('[data-product-latin]', d.latin);
    set('[data-product-tag]', d.tag || (card.querySelector('.card__tag') || {}).textContent);
    set('[data-product-desc]', d.desc || (card.querySelector('.card__desc') || {}).textContent);
    set('[data-product-meta]', d.meta || (card.querySelector('.card__meta') || {}).textContent);
    set('[data-product-note]', d.note || 'Наличие и точный размер подтвердим по телефону.');
    set('[data-product-price]', priceLabel(card));

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('is-locked');
    const closeBtn = modal.querySelector('[data-product-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeProduct() {
    const modal = document.getElementById('productModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('is-locked');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function initProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    $$('[data-product-close]', modal).forEach(el => el.addEventListener('click', closeProduct));
    modal.addEventListener('click', e => { if (e.target === modal) closeProduct(); });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!modal.hidden) closeProduct();
      const drawer = document.getElementById('drawer');
      if (drawer && drawer.classList.contains('is-open')) {
        document.dispatchEvent(new CustomEvent('close-cart'));
      }
    });

    const addBtn = modal.querySelector('[data-product-add]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!currentCard) return;
        Cart.add({
          id: currentCard.dataset.id,
          name: currentCard.dataset.name,
          price: Number(currentCard.dataset.price || 0),
          priceMax: currentCard.dataset.priceMax ? Number(currentCard.dataset.priceMax) : null,
          from: currentCard.dataset.from ? Number(currentCard.dataset.from) : null,
          cat: currentCard.dataset.cat,
          icon: (currentCard.querySelector('.card__pic use, .card__icon use')?.getAttribute('href') || '#i-sprout').replace('#', ''),
          tag: (currentCard.querySelector('.card__tag') || {}).textContent || ''
        });
        closeProduct();
      });
    }

    const bookBtn = modal.querySelector('[data-product-book]');
    if (bookBtn) {
      bookBtn.addEventListener('click', () => {
        closeProduct();
        const target = document.getElementById('order');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const comment = document.getElementById('fieldComment');
        if (comment && currentCard) {
          comment.value = 'Интересует: ' + currentCard.dataset.name;
        }
      });
    }
  }

  // ============ Экранирование HTML ============
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '\u0026amp;', '<': '\u0026lt;', '>': '\u0026gt;', '"': '\u0026quot;', "'": '\u0026#39;'
    })[s]);
  }

  // ============ Инициализация ============
  function init() {
    try { Cart.init(); } catch (e) { console.error('Cart.init', e); }
    try { initCatalogTabs(); } catch (e) { console.error('initCatalogTabs', e); }
    try { initAddButtons(); } catch (e) { console.error('initAddButtons', e); }
    try { initCardOverlays(); } catch (e) { console.error('initCardOverlays', e); }
    try { initProductModal(); } catch (e) { console.error('initProductModal', e); }
    try { initDrawer(); } catch (e) { console.error('initDrawer', e); }
    try { initOrderSummary(); } catch (e) { console.error('initOrderSummary', e); }
    try { initOrderForm(); } catch (e) { console.error('initOrderForm', e); }
    try { initMobileMenu(); } catch (e) { console.error('initMobileMenu', e); }
    try { initHeaderScroll(); } catch (e) { console.error('initHeaderScroll', e); }
    try { initStatusChip(); } catch (e) { console.error('initStatusChip', e); }
    try { initYear(); } catch (e) { console.error('initYear', e); }
    try { initReveal(); } catch (e) { console.error('initReveal', e); }
    try { initSmoothScroll(); } catch (e) { console.error('initSmoothScroll', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();