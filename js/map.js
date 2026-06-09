/* Tucson Way — map page (Leaflet + OpenStreetMap). */
(function () {
  'use strict';

  const LEGEND_CATS = [
    'emergency', 'family', 'women', 'men',
    'youth', 'veterans', 'employment',
  ];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function pinIcon(category) {
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--cat-' + category).trim() || '#c4452a';
    return L.divIcon({
      html: '<div class="map-pin" style="background:' + color + '"></div>',
      className: 'map-pin-wrap',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function popupHtml(r) {
    const cats = (r.categories || [])
      .map((c) => escapeHtml(TW.t('filter_' + c))).join(' · ');
    const phone = (r.phone || [])[0];
    const phoneHtml = phone
      ? '<a href="tel:' + escapeHtml(phone.tel) + '">' + escapeHtml(TW.t('card_call')) + '</a>'
      : '';
    const dirHtml = r.address
      ? '<a class="secondary" href="' + TW.directionsUrl(r.address) + '" target="_blank" rel="noopener">' + escapeHtml(TW.t('card_directions')) + '</a>'
      : '';
    const hours = TW.fieldByLang(r, 'hours_notes');
    const approx = r.coords_approximate
      ? '<p style="margin:6px 0 0;font-size:.78rem;color:#555;">' + escapeHtml(TW.t('card_coords_approximate')) + '</p>'
      : '';
    return (
      '<h3>' + escapeHtml(r.name) + '</h3>' +
      (cats ? '<p style="margin:0;color:#666;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">' + cats + '</p>' : '') +
      (r.address ? '<p style="margin:6px 0;font-size:.92rem;">' + escapeHtml(r.address) + '</p>' : '') +
      (hours ? '<p style="margin:6px 0;font-size:.85rem;color:#555;">' + escapeHtml(hours) + '</p>' : '') +
      '<div class="popup-actions">' + phoneHtml + dirHtml + '</div>' +
      approx
    );
  }

  function renderLegend() {
    const $items = document.getElementById('legend-items');
    if (!$items) return;
    $items.innerHTML = LEGEND_CATS.map((cat) => {
      const color = 'var(--cat-' + cat + ')';
      return (
        '<span class="legend__item">' +
        '<span class="legend__swatch" style="background:' + color + '"></span>' +
        escapeHtml(TW.t('filter_' + cat)) +
        '</span>'
      );
    }).join('');
  }

  let map, markerLayer;
  let resourceData = null;

  function plotMarkers() {
    if (!resourceData) return;
    if (markerLayer) markerLayer.remove();
    markerLayer = L.layerGroup().addTo(map);

    const mappable = resourceData.filter(
      (r) => !r.confidential_location && r.lat != null && r.lng != null
    );

    mappable.forEach((r) => {
      const primaryCat = (r.categories && r.categories[0]) || 'outreach';
      const m = L.marker([r.lat, r.lng], {
        icon: pinIcon(primaryCat),
        title: r.name,
        alt: r.name,
        keyboard: true,
      });
      m.bindPopup(popupHtml(r));
      m.addTo(markerLayer);
    });

    if (mappable.length) {
      const bounds = L.latLngBounds(mappable.map((r) => [r.lat, r.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }

  async function boot() {
    const data = await TW.loadResources();
    resourceData = data.resources || [];

    map = L.map('map', {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([32.2226, -110.9747], 12); // Tucson

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: TW.t('map_attribution'),
    }).addTo(map);

    plotMarkers();
    renderLegend();
  }

  document.addEventListener('tw:langchange', () => {
    renderLegend();
    if (markerLayer) plotMarkers();
  });

  if (TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
