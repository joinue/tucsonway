/* Tucson Compass — map page (Leaflet + OpenStreetMap).
   App-like mobile UX: Map/List view toggle, labeled locate FAB with toast
   feedback, compact hotline pill that opens a modal sheet, and an app frame
   (no page scroll) in Map view. Tablet/desktop keep the side-by-side map +
   list; the mouse wheel scrolls the page — Ctrl/Cmd+wheel zooms the map. */
(function () {
  'use strict';

  /* Filters are framed as a sentence: "I am [who] looking for [what]".
     WHO is a population the user identifies with; WHAT is a type of help.
     The two axes combine (AND), but a WHO match is inclusive — a provider
     with no population tag serves everyone, so picking "Women" still keeps
     food banks, job centers, and advocacy in view, not just women's shelters. */
  /* [filter value, i18n key]. Map-specific singular labels ("Woman", not the
     directory's plural "Women") so the sentence reads naturally. */
  const WHO_OPTS = [
    ['all', 'map_filter_anyone'], ['women', 'map_who_woman'], ['men', 'map_who_man'],
    ['family', 'map_who_family'], ['youth', 'map_who_youth'], ['veterans', 'map_who_veteran'],
  ];
  const NEED_OPTS = [
    ['all', 'map_filter_anything'], ['emergency', 'map_need_shelter'], ['food', 'map_need_food'],
    ['recovery', 'map_need_recovery'], ['behavioral_health', 'filter_behavioral_health'],
    ['employment', 'map_need_employment'], ['civic', 'map_need_advocacy'],
  ];
  const POP_TAGS = ['women', 'men', 'family', 'youth', 'veterans'];

  function servesWho(r, who) {
    if (who === 'all') return true;
    const cats = r.categories || [];
    if (cats.includes(who)) return true;
    // No population tag at all => general service, open to everyone.
    return !POP_TAGS.some((p) => cats.includes(p));
  }

  const CAT_ICON = {
    emergency: 'bed',
    food: 'food',
    family: 'family',
    women: 'women',
    men: 'men',
    youth: 'youth',
    veterans: 'veterans',
    domestic_violence: 'domestic_violence',
    employment: 'employment',
    outreach: 'outreach',
    civic: 'civic',
    recovery: 'recovery',
    behavioral_health: 'heart',
  };

  const PRIMARY_ORDER = [
    'emergency', 'domestic_violence', 'recovery', 'women', 'family',
    'youth', 'veterans', 'men', 'food', 'employment', 'civic', 'behavioral_health', 'outreach',
  ];

  /* ---------- state ---------- */
  let resources = [];
  let whoFilter = 'all';
  let needFilter = 'all';
  let userPos = null;
  let activeId = null;
  let currentView = 'map'; /* 'map' or 'list' (mobile only) */

  let map = null;
  let markerLayer = null;
  let userMarker = null;
  const markersById = new Map();

  /* ---------- DOM ---------- */
  const $filters = document.getElementById('map-filters');
  const $locateChip = document.getElementById('locate-me-btn');
  const $locateFab = document.getElementById('locate-fab');
  const $count = document.getElementById('map-results-count');
  const $listCountBadge = document.getElementById('view-toggle-count');
  const $listHead = document.getElementById('map-list-head');
  const $hint = document.getElementById('map-hint');
  const $toast = document.getElementById('map-toast');
  const $list = document.getElementById('map-list');
  const $noResults = document.getElementById('map-no-results');
  const $hotlineBlock = document.getElementById('hotline-block');
  const $hotlineItems = document.getElementById('hotline-items');
  const $hotlinePill = document.getElementById('hotline-pill');
  const $hotlinePillCount = document.getElementById('hotline-pill-count');
  const $hotlineModal = document.getElementById('hotline-modal');
  const $hotlineModalItems = document.getElementById('hotline-modal-items');
  const $mapLayout = document.getElementById('map-layout');
  const $viewMap = document.getElementById('view-map-btn');
  const $viewList = document.getElementById('view-list-btn');

  /* ---------- utils ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function primaryCategoryFor(r) {
    for (const c of PRIMARY_ORDER) if ((r.categories || []).includes(c)) return c;
    return 'outreach';
  }

  function catVarValue(cat) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--cat-' + cat).trim() || '#c4452a';
  }

  function kmToMiles(km) { return km * 0.621371; }

  function formatDistanceLabel(km) {
    if (km == null || !isFinite(km)) return '';
    const mi = kmToMiles(km);
    if (mi < 0.1) return TW.t('map_distance_here');
    if (mi < 10) return mi.toFixed(1) + ' ' + TW.t('map_distance_mi');
    return Math.round(mi) + ' ' + TW.t('map_distance_mi');
  }

  function distanceKm(r) {
    if (!userPos || r.lat == null || r.lng == null) return Infinity;
    return TW.haversine(userPos, { lat: r.lat, lng: r.lng });
  }

  /* ---------- partitions ---------- */
  function mappableResources() {
    return resources.filter(
      (r) => !r.confidential_location && r.lat != null && r.lng != null
    );
  }
  /* The "call, don't visit" rail: confidential-address services (DV shelters)
     plus placeless 24/7 hotlines — crisis and recovery lines that have a phone
     but no street address to map. Both are reached by phone, not by walking in.
     Keying only off confidential_location used to drop the latter off the map
     page entirely (e.g. the Pima County crisis line, SAMHSA, the OAR line). */
  function hotlineResources() {
    return resources.filter(
      (r) => (r.confidential_location || (r.lat == null && r.hotline_24h)) && (r.phone || []).length
    );
  }

  function visibleResources() {
    let list = mappableResources();
    if (whoFilter !== 'all') {
      list = list.filter((r) => servesWho(r, whoFilter));
    }
    if (needFilter !== 'all') {
      list = list.filter((r) => (r.categories || []).includes(needFilter));
    }
    if (userPos) {
      list = list
        .map((r) => ({ r, d: distanceKm(r) }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.r);
    }
    return list;
  }

  /* ---------- icons ---------- */
  function pinSvg(cat) {
    return TW.icon(CAT_ICON[cat] || 'home') || TW.icon('pin');
  }

  function pinIcon(cat, isActive) {
    const color = catVarValue(cat);
    const cls = 'map-pin-rich' + (isActive ? ' is-active' : '');
    return L.divIcon({
      html: '<div class="' + cls + '" style="background:' + color + '">' + pinSvg(cat) + '</div>',
      className: 'map-pin-wrap',
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -34],
    });
  }

  function userIcon() {
    return L.divIcon({
      html: '<div class="map-pin-user"></div>',
      className: 'map-pin-user-wrap',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  /* Food providers run on fixed meal/distribution windows, so showing up
     outside them is a wasted trip. Surface the days/hours right on the card.
     Other categories (shelters, hotlines) are far less time-boxed, so we leave
     hours off theirs to keep the cards uncluttered. */
  function foodHoursHtml(r, cls) {
    if (!(r.categories || []).includes('food')) return '';
    const hours = TW.fieldByLang(r, 'hours_notes');
    if (!hours) return '';
    const tag = cls.startsWith('popup') ? 'div' : 'span';
    return (
      '<' + tag + ' class="' + cls + '">' +
        TW.icon('clock') + '<span>' + escapeHtml(hours) + '</span>' +
      '</' + tag + '>'
    );
  }

  /* ---------- popup / cards ---------- */
  function badgeHtml(r) {
    const b = [];
    if (r.open_24_7) b.push('<span class="badge badge--24-7">' + TW.icon('clock') + ' ' + TW.t('card_24_7') + '</span>');
    if (r.hotline_24h) b.push('<span class="badge badge--hotline">' + TW.icon('phone') + ' ' + TW.t('card_hotline_24h') + '</span>');
    return b.join('');
  }

  function phoneActionHtml(p, color) {
    const display = TW.formatPhone(p.tel);
    const tel = p.ext ? p.tel + ',' + p.ext : p.tel;
    const label = p.label ? escapeHtml(p.label) : TW.t('card_call');
    return (
      '<a class="act act--call" href="tel:' + escapeHtml(tel) + '" style="--c:' + color + '">' +
        TW.icon('phone') +
        '<span class="act__txt">' +
          '<span class="act__label">' + label + '</span>' +
          '<span class="act__val">' + escapeHtml(display) + '</span>' +
        '</span>' +
      '</a>'
    );
  }

  function directionsActionHtml(address) {
    return (
      '<a class="act act--dir" href="' + TW.directionsUrl(address) + '" target="_blank" rel="noopener">' +
        TW.icon('compass') +
        '<span class="act__txt">' +
          '<span class="act__label">' + TW.t('card_directions') + '</span>' +
          '<span class="act__val">' + escapeHtml(address.split(',')[0]) + '</span>' +
        '</span>' +
        TW.newTabHint() +
      '</a>'
    );
  }

  function emailActionHtml(email) {
    return (
      '<a class="act act--dir" href="mailto:' + escapeHtml(email) + '">' +
        TW.icon('mail') +
        '<span class="act__txt">' +
          '<span class="act__label">' + TW.t('card_email') + '</span>' +
          '<span class="act__val">' + escapeHtml(email) + '</span>' +
        '</span>' +
      '</a>'
    );
  }

  function websiteActionHtml(url, label) {
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
    return (
      '<a class="act act--dir" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
        TW.icon('external') +
        '<span class="act__txt">' +
          '<span class="act__label">' + escapeHtml(label) + '</span>' +
          '<span class="act__val">' + escapeHtml(host) + '</span>' +
        '</span>' +
        TW.newTabHint() +
      '</a>'
    );
  }

  function popupHtml(r) {
    const primary = primaryCategoryFor(r);
    const color = 'var(--cat-' + primary + ')';
    const cats = (r.categories || [])
      .map((c) => escapeHtml(TW.t('filter_' + c))).join(' · ');
    const dist = userPos ? formatDistanceLabel(distanceKm(r)) : '';
    const badges = badgeHtml(r);
    const phone = (r.phone || [])[0];
    const actions = [];
    if (phone) actions.push(phoneActionHtml(phone, color));
    if (r.address) actions.push(directionsActionHtml(r.address));
    if (r.email) actions.push(emailActionHtml(r.email));
    if (r.website) actions.push(websiteActionHtml(r.website, TW.fieldByLang(r, 'website_label') || TW.t('card_website')));

    return (
      '<div class="popup" style="--c:' + color + '">' +
        '<div class="popup__head">' +
          '<span class="popup__icon">' + (TW.icon(CAT_ICON[primary] || 'home')) + '</span>' +
          '<div>' +
            '<h3 class="popup__name">' + escapeHtml(r.name) + '</h3>' +
            (cats ? '<div class="popup__cats">' + cats + '</div>' : '') +
          '</div>' +
        '</div>' +
        (badges ? '<div class="popup__badges">' + badges + '</div>' : '') +
        (r.address ? '<p class="popup__addr">' + escapeHtml(r.address) + '</p>' : '') +
        foodHoursHtml(r, 'popup__hours') +
        (dist ? '<div class="popup__meta"><strong>' + escapeHtml(dist) + '</strong></div>' : '') +
        (actions.length ? '<div class="popup__actions">' + actions.join('') + '</div>' : '') +
      '</div>'
    );
  }

  /* ---------- hotline cards ---------- */
  function hotlineCardHtml(r) {
    const phones = r.phone || [];
    const actions = phones.map((p) => phoneActionHtml(p, 'var(--accent)')).join('');
    const sub = TW.fieldByLang(r, 'hours_notes') || TW.fieldByLang(r, 'eligibility_notes') || '';
    const badges = badgeHtml(r);
    return (
      '<div class="hotline-card">' +
        '<div>' +
          '<div class="hotline-card__name">' + escapeHtml(r.name) + '</div>' +
          (sub ? '<div class="hotline-card__sub">' + escapeHtml(sub) + '</div>' : '') +
          (badges ? '<div class="popup__badges" style="margin-top:6px">' + badges + '</div>' : '') +
        '</div>' +
        (actions ? '<div class="hotline-card__actions">' + actions + '</div>' : '') +
      '</div>'
    );
  }

  function renderHotlines() {
    const list = hotlineResources();
    if (!list.length) {
      $hotlineBlock.hidden = true;
      $hotlinePill.hidden = true;
      return;
    }
    const html = list.map(hotlineCardHtml).join('');
    /* Desktop block */
    $hotlineBlock.hidden = false;
    $hotlineItems.innerHTML = html;
    TW.hydrateIcons($hotlineItems);
    /* Mobile pill */
    $hotlinePill.hidden = false;
    $hotlinePillCount.textContent = TW.t('map_hotlines_pill_count').replace('{n}', String(list.length));
    /* Modal body */
    $hotlineModalItems.innerHTML = html;
    TW.hydrateIcons($hotlineModalItems);
  }

  /* ---------- modal ---------- */
  function openModal() {
    $hotlineModal.hidden = false;
    document.body.style.overflow = 'hidden';
    /* Focus the close button for accessibility */
    const closeBtn = $hotlineModal.querySelector('.modal__close');
    if (closeBtn) closeBtn.focus();
  }
  function closeModal() {
    $hotlineModal.hidden = true;
    document.body.style.overflow = '';
    $hotlinePill.focus();
  }
  function wireModal() {
    $hotlinePill.addEventListener('click', openModal);
    $hotlineModal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$hotlineModal.hidden) closeModal();
    });
  }

  /* ---------- toast + hint overlays ---------- */
  let toastTimer = null;
  function showToast(msg, ms) {
    if (!$toast) return;
    $toast.textContent = msg;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, ms || 4000);
  }

  /* One-time "tap a pin" hint — phones only (the lead paragraph that says
     this is hidden there). Cleared forever once the user opens any popup. */
  const HINT_KEY = 'tw.map.hintDone';
  let hintTimer = null;
  function maybeShowHint() {
    try { if (localStorage.getItem(HINT_KEY)) return; } catch (e) { /* ignore */ }
    if (!window.matchMedia('(max-width: 719px)').matches) return;
    $hint.hidden = false;
    hintTimer = setTimeout(() => { $hint.hidden = true; }, 10000);
  }
  function dismissHint() {
    clearTimeout(hintTimer);
    if (!$hint.hidden) $hint.hidden = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* ignore */ }
  }

  /* ---------- filter chips ---------- */
  /* The phone chip row scrolls horizontally behind a fade (CSS mask); clear
     the fade once the row is scrolled to the end so nothing looks cut off. */
  function syncFilterFade() {
    const atEnd = $filters.scrollLeft + $filters.clientWidth >= $filters.scrollWidth - 4;
    $filters.dataset.scrollEnd = String(atEnd);
  }

  /* Custom listbox so the open menu can be branded (native <select> popups
     can't be styled). Implements the WAI-ARIA listbox pattern: a button
     (aria-haspopup/expanded) toggles a role="listbox" of role="option"s,
     navigated with arrows/Home/End/Enter/Esc and aria-activedescendant.
     The trigger lights up with the accent + the selection's icon once a real
     value is chosen. `opts` is [value, i18nKey] pairs. */
  let selUid = 0;

  function buildFilterPart(labelKey, opts, active, onPick) {
    const uid = 'twsel-' + (++selUid);
    let current = active;
    let open = false;
    let activeIdx = Math.max(0, opts.findIndex(([v]) => v === current));

    const part = document.createElement('div');
    part.className = 'map-filter-part';

    const lead = document.createElement('span');
    lead.className = 'map-filter-part__lead';
    lead.id = uid + '-lead';
    lead.textContent = TW.t(labelKey);
    part.appendChild(lead);

    const wrap = document.createElement('div');
    wrap.className = 'tw-select';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tw-select__btn';
    btn.id = uid + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const glyph = document.createElement('span');
    glyph.className = 'tw-select__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    const valEl = document.createElement('span');
    valEl.className = 'tw-select__value';
    valEl.id = uid + '-val';
    const chev = document.createElement('span');
    chev.className = 'tw-select__chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = TW.icon('chevron');
    btn.setAttribute('aria-labelledby', lead.id + ' ' + valEl.id);
    btn.append(glyph, valEl, chev);

    const menu = document.createElement('ul');
    menu.className = 'tw-select__menu';
    menu.id = uid + '-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('tabindex', '-1');
    menu.setAttribute('aria-labelledby', lead.id);
    menu.hidden = true;

    const optEls = opts.map(([val, key], i) => {
      const li = document.createElement('li');
      li.className = 'tw-select__opt';
      li.id = uid + '-opt-' + i;
      li.setAttribute('role', 'option');
      li.dataset.value = val;
      const ic = val !== 'all' ? CAT_ICON[val] : null;
      li.innerHTML =
        '<span class="tw-select__opt-icon" aria-hidden="true">' + (ic ? TW.icon(ic) : '') + '</span>' +
        '<span class="tw-select__opt-label">' + escapeHtml(TW.t(key)) + '</span>' +
        '<span class="tw-select__opt-check" aria-hidden="true">' + TW.icon('check') + '</span>';
      li.addEventListener('click', () => choose(i));
      li.addEventListener('mousemove', () => setActive(i));
      menu.appendChild(li);
      return li;
    });

    function renderValue() {
      const found = opts.find(([v]) => v === current) || opts[0];
      valEl.textContent = TW.t(found[1]);
      const ic = found[0] !== 'all' ? CAT_ICON[found[0]] : null;
      glyph.innerHTML = ic ? TW.icon(ic) : '';
      wrap.dataset.active = String(found[0] !== 'all');
      optEls.forEach((li) => li.setAttribute('aria-selected', String(li.dataset.value === current)));
    }
    function setActive(i) {
      activeIdx = i;
      optEls.forEach((li, n) => li.classList.toggle('is-active', n === i));
      menu.setAttribute('aria-activedescendant', optEls[i].id);
      optEls[i].scrollIntoView({ block: 'nearest' });
    }
    function openMenu() {
      if (open) return;
      open = true;
      menu.hidden = false;
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      setActive(Math.max(0, opts.findIndex(([v]) => v === current)));
      menu.focus();
      document.addEventListener('click', onDocClick, true);
    }
    function closeMenu(focusBtn) {
      if (!open) return;
      open = false;
      menu.hidden = true;
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick, true);
      if (focusBtn) btn.focus();
    }
    function choose(i) {
      current = opts[i][0];
      renderValue();
      closeMenu(true);
      onPick(current);
      renderAll();
    }
    function onDocClick(e) { if (!wrap.contains(e.target)) closeMenu(false); }

    btn.addEventListener('click', () => (open ? closeMenu(true) : openMenu()));
    btn.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); }
    });
    menu.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive(Math.min(activeIdx + 1, optEls.length - 1)); break;
        case 'ArrowUp': e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); break;
        case 'Home': e.preventDefault(); setActive(0); break;
        case 'End': e.preventDefault(); setActive(optEls.length - 1); break;
        case 'Enter': case ' ': e.preventDefault(); choose(activeIdx); break;
        case 'Escape': e.preventDefault(); closeMenu(true); break;
        case 'Tab': closeMenu(false); break;
        default: break;
      }
    });

    wrap.append(btn, menu);
    part.appendChild(wrap);
    renderValue();
    return part;
  }

  function renderFilters() {
    $filters.innerHTML = '';
    $filters.appendChild(
      buildFilterPart('map_filter_who', WHO_OPTS, whoFilter, (v) => { whoFilter = v; })
    );
    $filters.appendChild(
      buildFilterPart('map_filter_need', NEED_OPTS, needFilter, (v) => { needFilter = v; })
    );
  }

  /* ---------- list ---------- */
  function listCardHtml(r) {
    const primary = primaryCategoryFor(r);
    const color = 'var(--cat-' + primary + ')';
    const dist = userPos ? formatDistanceLabel(distanceKm(r)) : '';
    const cats = (r.categories || [])
      .slice(0, 3)
      .map((c) => escapeHtml(TW.t('filter_' + c))).join(' · ');
    const badges = badgeHtml(r);
    const isActive = activeId === r.id;
    return (
      '<button type="button" class="map-list__card' + (isActive ? ' is-active' : '') +
        '" data-id="' + escapeHtml(r.id) + '" style="--c:' + color + '">' +
        '<span class="map-list__icon">' + TW.icon(CAT_ICON[primary] || 'home') + '</span>' +
        '<span class="map-list__body">' +
          '<span class="map-list__name">' + escapeHtml(r.name) + '</span>' +
          '<span class="map-list__meta">' +
            (dist ? '<strong>' + escapeHtml(dist) + '</strong>' : '') +
            (cats ? '<span>' + cats + '</span>' : '') +
          '</span>' +
          (r.address ? '<span class="map-list__addr">' + escapeHtml(r.address) + '</span>' : '') +
          foodHoursHtml(r, 'map-list__hours') +
          (badges ? '<span class="map-list__badges">' + badges + '</span>' : '') +
        '</span>' +
      '</button>'
    );
  }

  function renderList() {
    const list = visibleResources();
    $list.innerHTML = list.map(listCardHtml).join('');
    TW.hydrateIcons($list);
    const none = list.length === 0;
    $noResults.hidden = !none;
    $list.hidden = none;
    const countText = TW.t('dir_results_count').replace('{n}', String(list.length));
    $count.textContent = countText;
    if ($listCountBadge) $listCountBadge.textContent = String(list.length);
    if ($listHead) {
      /* Phone list view has no other place that shows the result count */
      $listHead.hidden = none;
      $listHead.textContent = '';
      const c = document.createElement('span');
      c.textContent = countText;
      $listHead.appendChild(c);
      if (userPos) {
        const s = document.createElement('span');
        s.textContent = TW.t('map_sorted_nearest');
        $listHead.appendChild(s);
      }
    }

    $list.querySelectorAll('.map-list__card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const r = resources.find((x) => x.id === id);
        if (!r) return;
        /* On phones, hop to the map view to show the pin */
        if (currentView === 'list' && window.matchMedia('(max-width: 719px)').matches) {
          setView('map');
        }
        setActive(id);
        const m = markersById.get(id);
        if (m && map) {
          /* Fly to the marker's display position (fanned-out pins sit a few
             meters off their true coords); zoom deeper for those so the
             shared-building pins visibly separate. */
          const targetZoom = Math.max(map.getZoom(), m.twOffset ? 17 : 15);
          /* The popup opens upward from the pin, so centering the pin clips
             the popup against the top edge. On the desktop split layout, aim
             the map a bit above the pin so it sits lower in the viewport and
             the popup has room. */
          let target = m.getLatLng();
          if (window.matchMedia('(min-width: 720px)').matches) {
            const pt = map.project(target, targetZoom);
            const offsetY = Math.round(map.getSize().y * 0.22);
            target = map.unproject(pt.subtract(L.point(0, offsetY)), targetZoom);
          }
          map.flyTo(target, targetZoom, { duration: 0.6 });
          m.openPopup();
        }
      });
    });
  }

  /* ---------- markers ---------- */
  /* Every place gets its own always-visible pin — no clustering, since it
     hides what's on the map and users zoom in anyway. A few providers share
     one building (identical coordinates), which would stack pins exactly on
     top of each other forever; fan those out ~28m in a tiny circle so each
     one is visible and tappable once zoomed in. */
  function displayPositions(list) {
    const byCoord = new Map();
    list.forEach((r) => {
      const key = r.lat.toFixed(5) + ',' + r.lng.toFixed(5);
      if (!byCoord.has(key)) byCoord.set(key, []);
      byCoord.get(key).push(r.id);
    });
    const pos = new Map();
    byCoord.forEach((ids) => {
      ids.forEach((id, i) => {
        const r = list.find((x) => x.id === id);
        if (ids.length === 1) {
          pos.set(id, { lat: r.lat, lng: r.lng, offset: false });
        } else {
          const angle = (2 * Math.PI * i) / ids.length + 0.6;
          const d = 0.00028; /* ≈ 28 m */
          pos.set(id, {
            lat: r.lat + d * Math.sin(angle),
            lng: r.lng + d * Math.cos(angle),
            offset: true,
          });
        }
      });
    });
    return pos;
  }

  function renderMarkers(opts) {
    if (!map) return;
    opts = opts || {};
    if (markerLayer) markerLayer.remove();
    markerLayer = L.layerGroup().addTo(map);
    markersById.clear();

    const list = visibleResources();
    const positions = displayPositions(list);
    list.forEach((r) => {
      const cat = primaryCategoryFor(r);
      const p = positions.get(r.id);
      const m = L.marker([p.lat, p.lng], {
        icon: pinIcon(cat, activeId === r.id),
        title: r.name,
        alt: r.name,
        keyboard: true,
      });
      m.twOffset = p.offset;
      m.bindPopup(popupHtml(r), { maxWidth: 260, autoPanPadding: [24, 24] });
      m.on('popupopen', () => {
        dismissHint();
        setActive(r.id);
        TW.hydrateIcons(document.querySelector('.leaflet-popup-content') || document);
      });
      m.on('popupclose', () => { if (activeId === r.id) setActive(null); });
      m.addTo(markerLayer);
      markersById.set(r.id, m);
    });

    if (list.length && !opts.skipFit) {
      const points = list.map((r) => [r.lat, r.lng]);
      if (userPos) points.push([userPos.lat, userPos.lng]);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  function setActive(id) {
    activeId = id;
    $list.querySelectorAll('.map-list__card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.id === id);
      if (c.dataset.id === id) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    markersById.forEach((m, mid) => {
      const r = resources.find((x) => x.id === mid);
      if (!r) return;
      m.setIcon(pinIcon(primaryCategoryFor(r), mid === id));
    });
  }

  function renderAll(opts) {
    renderList();
    renderMarkers(opts);
  }

  /* Center the map on the user at roughly a 2-mile radius. Used right
     after a successful geolocation so the map doesn't re-fit to all pins. */
  function zoomToUser() {
    if (!userPos || !map) return;
    const radiusMeters = 2 * 1609.344; // 2 miles
    const bounds = L.latLng(userPos.lat, userPos.lng).toBounds(radiusMeters * 2);
    map.flyToBounds(bounds, { duration: 0.7, maxZoom: 15 });
  }

  /* ---------- view toggle (mobile) ---------- */
  function setView(v) {
    currentView = v;
    $mapLayout.dataset.view = v;
    /* The body attribute drives the phone app frame (no page scroll in Map
       view) and the hotline pill's position (above the list in List view). */
    document.body.dataset.mapView = v;
    $viewMap.setAttribute('aria-pressed', String(v === 'map'));
    $viewList.setAttribute('aria-pressed', String(v === 'list'));
    /* Leaflet needs invalidateSize when its container becomes visible after being hidden */
    if (v === 'map' && map) {
      setTimeout(() => map.invalidateSize(), 60);
    }
  }
  function wireViewToggle() {
    $viewMap.addEventListener('click', () => setView('map'));
    $viewList.addEventListener('click', () => setView('list'));
  }

  /* ---------- locate-me ---------- */
  function setUserMarker() {
    if (userMarker) { userMarker.remove(); userMarker = null; }
    if (!userPos || !map) return;
    userMarker = L.marker([userPos.lat, userPos.lng], {
      icon: userIcon(),
      title: TW.t('map_pin_user'),
      alt: TW.t('map_pin_user'),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }

  function syncLocateUI(state) {
    /* state: 'idle' | 'searching' | 'on' | 'error'
       Both controls reflect every state: the chip (tablet/desktop) via its
       label, the FAB (phones) via its label + pulse — the FAB used to stay
       silent, so a denied geolocation prompt looked like a dead button. */
    const chipLabel = $locateChip.querySelector('span');
    const fabLabel = $locateFab.querySelector('.map-fab__label');
    $locateFab.classList.toggle('is-searching', state === 'searching');
    if (state === 'searching') {
      $locateChip.disabled = true;
      if (chipLabel) chipLabel.textContent = TW.t('dir_near_me_searching');
      if (fabLabel) fabLabel.textContent = TW.t('map_near_me_searching');
    } else if (state === 'on') {
      $locateChip.disabled = false;
      $locateChip.setAttribute('aria-pressed', 'true');
      $locateFab.setAttribute('aria-pressed', 'true');
      if (chipLabel) chipLabel.textContent = TW.t('map_locate_me_on');
      if (fabLabel) fabLabel.textContent = TW.t('map_near_me_on');
    } else if (state === 'error') {
      $locateChip.disabled = false;
      if (chipLabel) chipLabel.textContent = TW.t('dir_near_me_unavailable');
      if (fabLabel) fabLabel.textContent = TW.t('map_near_me');
      showToast(TW.t('map_locate_error'), 5000);
      setTimeout(() => syncLocateUI('idle'), 3000);
    } else { /* idle */
      $locateChip.disabled = false;
      $locateChip.setAttribute('aria-pressed', 'false');
      $locateFab.setAttribute('aria-pressed', 'false');
      if (chipLabel) chipLabel.textContent = TW.t('map_locate_me');
      if (fabLabel) fabLabel.textContent = TW.t('map_near_me');
    }
  }

  function toggleLocate() {
    if (!('geolocation' in navigator)) {
      $locateChip.hidden = true;
      $locateFab.hidden = true;
      return;
    }
    if (userPos) {
      userPos = null;
      setUserMarker();
      syncLocateUI('idle');
      renderAll();
      return;
    }
    syncLocateUI('searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        syncLocateUI('on');
        setUserMarker();
        renderAll({ skipFit: true });
        zoomToUser();
      },
      () => { syncLocateUI('error'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  function wireLocate() {
    if (!('geolocation' in navigator)) {
      $locateChip.hidden = true;
      $locateFab.hidden = true;
      return;
    }
    $locateChip.addEventListener('click', toggleLocate);
    $locateFab.addEventListener('click', toggleLocate);
  }

  /* ---------- wheel zoom (mouse devices) ---------- */
  /* A mouse wheel over the map used to zoom it, swallowing the page scroll —
     the classic embedded-map trap. Scroll now moves the page; Ctrl/Cmd+wheel
     (and trackpad pinch, which browsers report as ctrl+wheel) zooms the map,
     with a toast teaching the gesture. Touch devices keep one-finger pan: the
     phone layout is an app frame, so there's no page scroll to trap there. */
  function wireWheelZoom() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    map.scrollWheelZoom.disable();
    const mapEl = document.getElementById('map');
    let zoomCooldown = false;
    let hintCooldown = false;
    mapEl.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (zoomCooldown) return;
        zoomCooldown = true;
        setTimeout(() => { zoomCooldown = false; }, 90);
        const dir = e.deltaY < 0 ? 1 : -1;
        map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + dir);
      } else if (!hintCooldown) {
        /* Page scrolls normally; teach the zoom gesture without nagging */
        hintCooldown = true;
        setTimeout(() => { hintCooldown = false; }, 8000);
        const isMac = /Mac/.test(navigator.platform || '');
        showToast(TW.t('map_zoom_hint').replace('{key}', isMac ? '⌘' : 'Ctrl'), 2500);
      }
    }, { passive: false });
  }

  /* ---------- boot ---------- */
  async function boot() {
    const data = await TW.loadResources();
    resources = data.resources || [];

    document.body.dataset.mapView = currentView;

    map = L.map('map', {
      zoomControl: true,
      scrollWheelZoom: true, /* wireWheelZoom() turns this off on mouse devices */
    }).setView([32.2226, -110.9747], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: TW.t('map_attribution'),
    }).addTo(map);

    renderHotlines();
    renderFilters();
    renderAll();
    wireViewToggle();
    wireModal();
    wireLocate();
    wireWheelZoom();
    maybeShowHint();

    $filters.addEventListener('scroll', syncFilterFade, { passive: true });
    window.addEventListener('resize', syncFilterFade);

    /* Resize handling — if user rotates / resizes across the breakpoint,
       reset the layout so neither pane stays accidentally hidden. */
    const mq = window.matchMedia('(min-width: 720px)');
    mq.addEventListener('change', () => {
      if (mq.matches) {
        /* Split layout: ensure both panes visible regardless of dataset */
        if (map) setTimeout(() => map.invalidateSize(), 60);
      } else {
        /* Phone: respect current view */
        setView(currentView);
      }
    });
  }

  document.addEventListener('tw:langchange', () => {
    renderHotlines();
    renderFilters();
    renderAll();
    syncLocateUI(userPos ? 'on' : 'idle');
  });

  if (TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
