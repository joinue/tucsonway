/* Tucson Compass — map page (Leaflet + OpenStreetMap).
   App-like mobile UX: Map/List view toggle, FAB locate-me, compact hotline pill
   that opens a modal sheet. Desktop keeps the side-by-side map + list. */
(function () {
  'use strict';

  const CATEGORIES = [
    'all', 'emergency', 'family', 'women', 'men',
    'youth', 'veterans', 'employment', 'civic',
  ];

  const CAT_ICON = {
    emergency: 'bed',
    family: 'family',
    women: 'women',
    men: 'men',
    youth: 'youth',
    veterans: 'veterans',
    domestic_violence: 'domestic_violence',
    employment: 'employment',
    outreach: 'outreach',
    civic: 'civic',
  };

  const PRIMARY_ORDER = [
    'emergency', 'domestic_violence', 'women', 'family',
    'youth', 'veterans', 'men', 'employment', 'civic', 'outreach',
  ];

  /* ---------- state ---------- */
  let resources = [];
  let activeFilter = 'all';
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
  function hotlineResources() {
    return resources.filter(
      (r) => r.confidential_location && (r.phone || []).length
    );
  }

  function visibleResources() {
    let list = mappableResources();
    if (activeFilter !== 'all') {
      list = list.filter((r) => (r.categories || []).includes(activeFilter));
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

  /* ---------- filter chips ---------- */
  function renderFilters() {
    $filters.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', String(cat === activeFilter));
      btn.dataset.filter = cat;
      if (cat !== 'all') {
        const dot = document.createElement('span');
        dot.className = 'chip__dot';
        dot.style.setProperty('--cat', 'var(--cat-' + cat + ')');
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
      }
      const label = document.createElement('span');
      label.textContent = TW.t('filter_' + cat);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        activeFilter = cat;
        renderFilters();
        renderAll();
      });
      $filters.appendChild(btn);
    });
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

    $list.querySelectorAll('.map-list__card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const r = resources.find((x) => x.id === id);
        if (!r) return;
        /* On mobile, hop to the map view to show the pin */
        if (currentView === 'list' && window.matchMedia('(max-width: 979px)').matches) {
          setView('map');
        }
        setActive(id);
        const m = markersById.get(id);
        if (m && map) {
          map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
          m.openPopup();
        }
      });
    });
  }

  /* ---------- markers ---------- */
  function renderMarkers() {
    if (!map) return;
    if (markerLayer) markerLayer.remove();
    markerLayer = L.layerGroup().addTo(map);
    markersById.clear();

    const list = visibleResources();
    list.forEach((r) => {
      const cat = primaryCategoryFor(r);
      const m = L.marker([r.lat, r.lng], {
        icon: pinIcon(cat, activeId === r.id),
        title: r.name,
        alt: r.name,
        keyboard: true,
      });
      m.bindPopup(popupHtml(r), { maxWidth: 260, autoPanPadding: [24, 24] });
      m.on('popupopen', () => {
        setActive(r.id, { skipMap: true });
        TW.hydrateIcons(document.querySelector('.leaflet-popup-content') || document);
      });
      m.on('popupclose', () => { if (activeId === r.id) setActive(null); });
      m.addTo(markerLayer);
      markersById.set(r.id, m);
    });

    if (list.length) {
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

  function renderAll() {
    renderList();
    renderMarkers();
  }

  /* ---------- view toggle (mobile) ---------- */
  function setView(v) {
    currentView = v;
    $mapLayout.dataset.view = v;
    $viewMap.setAttribute('aria-selected', String(v === 'map'));
    $viewList.setAttribute('aria-selected', String(v === 'list'));
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
    /* state: 'idle' | 'searching' | 'on' | 'error' */
    const chipLabel = $locateChip.querySelector('span');
    if (state === 'searching') {
      $locateChip.disabled = true;
      if (chipLabel) chipLabel.textContent = TW.t('dir_near_me_searching');
    } else if (state === 'on') {
      $locateChip.disabled = false;
      $locateChip.setAttribute('aria-pressed', 'true');
      $locateFab.setAttribute('aria-pressed', 'true');
      if (chipLabel) chipLabel.textContent = TW.t('map_locate_me_on');
    } else if (state === 'error') {
      $locateChip.disabled = false;
      if (chipLabel) chipLabel.textContent = TW.t('dir_near_me_unavailable');
      setTimeout(() => syncLocateUI('idle'), 3000);
    } else { /* idle */
      $locateChip.disabled = false;
      $locateChip.setAttribute('aria-pressed', 'false');
      $locateFab.setAttribute('aria-pressed', 'false');
      if (chipLabel) chipLabel.textContent = TW.t('map_locate_me');
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
        renderAll();
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

  /* ---------- boot ---------- */
  async function boot() {
    const data = await TW.loadResources();
    resources = data.resources || [];

    map = L.map('map', {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([32.2226, -110.9747], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: TW.t('map_attribution'),
    }).addTo(map);

    map.on('popupclose', () => { if (activeId) setActive(null); });

    renderHotlines();
    renderFilters();
    renderAll();
    wireViewToggle();
    wireModal();
    wireLocate();

    /* Resize handling — if user rotates / resizes across the breakpoint,
       reset the layout so neither pane stays accidentally hidden. */
    const mq = window.matchMedia('(min-width: 980px)');
    mq.addEventListener('change', () => {
      if (mq.matches) {
        /* Desktop: ensure both panes visible regardless of dataset */
        if (map) setTimeout(() => map.invalidateSize(), 60);
      } else {
        /* Mobile: respect current view */
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
