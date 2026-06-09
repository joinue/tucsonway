/* Tucson Way — directory page: filter, search, sort-by-nearest.
   Card hierarchy: name first, then BIG call button + directions button.
   Reading is optional — icons carry every action. */
(function () {
  'use strict';

  const CATEGORIES = [
    'all', 'emergency', 'family', 'women', 'men',
    'youth', 'veterans', 'domestic_violence', 'employment', 'outreach',
  ];

  /* Map category -> icon name (some categories also reuse 'need' icons) */
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
  };

  let resources = [];
  let activeFilter = 'all';
  let query = '';
  let userPos = null;

  const $filters = document.getElementById('filters');
  const $search = document.getElementById('search');
  const $results = document.getElementById('results');
  const $noResults = document.getElementById('no-results');
  const $count = document.getElementById('results-count');
  const $near = document.getElementById('near-me-btn');
  const $clear = document.getElementById('clear-filters');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* read ?need=emergency etc on first load */
  function readUrlFilter() {
    const params = new URLSearchParams(location.search);
    const need = params.get('need');
    if (need && CATEGORIES.includes(need)) activeFilter = need;
  }

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
        // mirror filter to URL so it's shareable / refresh-safe
        const url = new URL(location.href);
        if (cat === 'all') url.searchParams.delete('need');
        else url.searchParams.set('need', cat);
        history.replaceState(null, '', url);
        renderFilters();
        render();
      });
      $filters.appendChild(btn);
    });
  }

  function primaryCategoryFor(r) {
    const order = ['emergency', 'domestic_violence', 'women', 'family', 'youth', 'veterans', 'men', 'employment', 'outreach'];
    for (const c of order) if ((r.categories || []).includes(c)) return c;
    return 'outreach';
  }

  function catLabels(cats) {
    return (cats || [])
      .map((c) => TW.t('filter_' + c))
      .join(' · ');
  }

  function phoneButton(p, primary, color) {
    const display = TW.formatPhone(p.tel);
    const tel = p.ext ? p.tel + ',' + p.ext : p.tel;
    const label = p.label ? escapeHtml(p.label) : TW.t('card_call');
    const cls = primary ? 'act act--call' : 'act act--dir';
    const style = primary ? ' style="--c: ' + color + '"' : '';
    return (
      '<a class="' + cls + '" href="tel:' + escapeHtml(tel) + '"' + style + '>' +
        TW.icon('phone') +
        '<span class="act__txt">' +
          '<span class="act__label">' + label + '</span>' +
          '<span class="act__val">' + escapeHtml(display) + '</span>' +
        '</span>' +
      '</a>'
    );
  }

  function directionsButton(address) {
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

  function cardHtml(r) {
    const eligibility = TW.fieldByLang(r, 'eligibility_notes');
    const hours = TW.fieldByLang(r, 'hours_notes');
    const notes = TW.fieldByLang(r, 'notes');
    const primary = primaryCategoryFor(r);
    const color = 'var(--cat-' + primary + ')';

    const badges = [];
    if (r.open_24_7) badges.push('<span class="badge badge--24-7">' + TW.icon('clock') + ' ' + TW.t('card_24_7') + '</span>');
    if (r.hotline_24h) badges.push('<span class="badge badge--hotline">' + TW.icon('phone') + ' ' + TW.t('card_hotline_24h') + '</span>');

    let addrHtml = '';
    if (r.confidential_location) {
      addrHtml = '<p class="card__addr card__addr--confidential">' + TW.icon('warn') + '<span>' + TW.t('card_address_confidential') + '</span></p>';
    } else if (r.address) {
      addrHtml = '<p class="card__addr">' + TW.icon('pin') + '<span>' + escapeHtml(r.address) + '</span></p>';
    }

    const phones = r.phone || [];
    const actions = [];
    if (phones.length) actions.push(phoneButton(phones[0], true, color));
    if (r.address && !r.confidential_location) actions.push(directionsButton(r.address));
    /* additional phone lines as smaller secondary actions if no directions */
    phones.slice(1).forEach((p) => actions.push(phoneButton(p, false, color)));

    const actionsCls = actions.length === 1 ? 'card__actions card__actions--solo' : 'card__actions';

    const approxNote = (r.coords_approximate && !r.confidential_location && r.address)
      ? '<div class="card__note">' + TW.t('card_coords_approximate') + '</div>'
      : '';

    const cardStyle = ' style="--c: ' + color + '"';

    return (
      '<article class="card" id="r-' + escapeHtml(r.id) + '"' + cardStyle + '>' +
        '<div class="card__body">' +
          '<div class="card__top">' +
            '<span class="card__icon-frame">' + TW.icon(CAT_ICON[primary] || 'home') + '</span>' +
            '<div class="card__heading">' +
              '<h2 class="card__name">' + escapeHtml(r.name) + '</h2>' +
              '<div class="card__cats">' + escapeHtml(catLabels(r.categories)) + '</div>' +
            '</div>' +
          '</div>' +
          (badges.length ? '<div class="badges">' + badges.join('') + '</div>' : '') +
          addrHtml +
          (eligibility ? '<div class="card__field"><span class="card__field-label">' + TW.t('card_eligibility') + '</span><span class="card__field-val">' + escapeHtml(eligibility) + '</span></div>' : '') +
          (hours ? '<div class="card__field"><span class="card__field-label">' + TW.t('card_hours') + '</span><span class="card__field-val">' + escapeHtml(hours) + '</span></div>' : '') +
          (notes ? '<div class="card__field"><span class="card__field-label">' + TW.t('card_notes') + '</span><span class="card__field-val">' + escapeHtml(notes) + '</span></div>' : '') +
          (actions.length ? '<div class="' + actionsCls + '">' + actions.join('') + '</div>' : '') +
          approxNote +
        '</div>' +
      '</article>'
    );
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    let list = resources.filter((r) => {
      if (activeFilter !== 'all' && !(r.categories || []).includes(activeFilter)) return false;
      if (q) {
        const hay = [
          r.name,
          (r.categories || []).join(' '),
          (r.categories || []).map((c) => TW.t('filter_' + c)).join(' '),
          TW.fieldByLang(r, 'eligibility_notes'),
          TW.fieldByLang(r, 'notes'),
          TW.fieldByLang(r, 'hours_notes'),
          r.address || '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (userPos) {
      list = list
        .map((r) => ({
          r,
          d: r.lat && r.lng ? TW.haversine(userPos, { lat: r.lat, lng: r.lng }) : Infinity,
        }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.r);
    }

    return list;
  }

  function render() {
    const list = filtered();
    $results.innerHTML = list.map(cardHtml).join('');
    TW.hydrateIcons($results);
    const none = list.length === 0;
    $noResults.hidden = !none;
    $results.hidden = none;
    const countText = TW.t('dir_results_count').replace('{n}', String(list.length));
    $count.textContent = countText;
  }

  function wireSearch() {
    $search.addEventListener('input', (e) => {
      query = e.target.value || '';
      render();
    });
  }

  function wireClear() {
    $clear.addEventListener('click', () => {
      query = '';
      activeFilter = 'all';
      $search.value = '';
      const url = new URL(location.href);
      url.searchParams.delete('need');
      history.replaceState(null, '', url);
      renderFilters();
      render();
    });
  }

  function wireNearMe() {
    if (!('geolocation' in navigator)) { $near.hidden = true; return; }
    $near.addEventListener('click', () => {
      if (userPos) {
        userPos = null;
        $near.setAttribute('aria-pressed', 'false');
        render();
        return;
      }
      $near.disabled = true;
      const txtEl = $near.querySelector('span');
      const original = txtEl.textContent;
      txtEl.textContent = TW.t('dir_near_me_searching');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          $near.setAttribute('aria-pressed', 'true');
          $near.disabled = false;
          txtEl.textContent = original;
          render();
        },
        () => {
          $near.disabled = false;
          txtEl.textContent = TW.t('dir_near_me_unavailable');
          setTimeout(() => { txtEl.textContent = original; }, 3000);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  async function boot() {
    readUrlFilter();
    const data = await TW.loadResources();
    resources = data.resources || [];
    renderFilters();
    render();
    wireSearch();
    wireClear();
    wireNearMe();
  }

  document.addEventListener('tw:langchange', () => {
    renderFilters();
    render();
  });

  if (TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
