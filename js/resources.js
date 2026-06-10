/* Tucson Compass — resources page: organized link hub.
   Renders data/links.json into grouped, tappable cards with a jump-to row.
   Re-renders on language change. Print button produces a clean handout
   (see the print stylesheet in styles.css). */
(function () {
  'use strict';

  let groups = [];

  const $jump = document.getElementById('res-jump');
  const $groups = document.getElementById('res-groups');
  const $print = document.getElementById('res-print');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (_) { return url; }
  }

  function linkCardHtml(link, color) {
    const name = escapeHtml(link.name);
    const desc = escapeHtml(TW.fieldByLang(link, 'desc'));
    const isTel = !!link.tel;
    const isUrl = !!link.url;

    /* Primary action: phone numbers beat websites for this audience.
       Cards with neither (e.g. a text line) render as a plain card. */
    let open = '<div class="link-card" style="--gc: var(--cat-' + color + ')">';
    let close = '</div>';
    let meta = '';
    let icon = 'info';
    if (isTel) {
      open = '<a class="link-card link-card--tel" style="--gc: var(--cat-' + color + ')" href="tel:' + escapeHtml(link.tel) + '">';
      close = '</a>';
      meta = TW.formatPhone(link.tel);
      icon = 'phone';
    } else if (isUrl) {
      open = '<a class="link-card" style="--gc: var(--cat-' + color + ')" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">';
      close = '</a>';
      meta = hostOf(link.url);
      icon = 'external';
    }
    /* A tel-card that also has a website shows both in the meta line */
    if (isTel && isUrl) meta += ' · ' + hostOf(link.url);

    return (
      open +
        '<span class="link-card__icon">' + TW.icon(icon) + '</span>' +
        '<span class="link-card__body">' +
          '<span class="link-card__name">' + name + (isUrl && !isTel ? ' ' + TW.icon('external') : '') + '</span>' +
          '<span class="link-card__desc">' + desc + '</span>' +
          (meta ? '<span class="link-card__meta">' + escapeHtml(meta) + '</span>' : '') +
        '</span>' +
      close
    );
  }

  function render() {
    /* Jump chips */
    $jump.innerHTML = groups.map((g) => (
      '<a href="#g-' + escapeHtml(g.id) + '">' +
        '<span class="chip__dot" style="--cat: var(--cat-' + escapeHtml(g.color) + '); background: var(--cat-' + escapeHtml(g.color) + ')" aria-hidden="true"></span>' +
        '<span>' + escapeHtml(TW.fieldByLang(g, 'title')) + '</span>' +
      '</a>'
    )).join('');

    /* Group sections */
    $groups.innerHTML = groups.map((g) => (
      '<section class="res-group" id="g-' + escapeHtml(g.id) + '" style="--gc: var(--cat-' + escapeHtml(g.color) + ')">' +
        '<div class="res-group__head">' +
          '<span class="res-group__icon">' + TW.icon(g.icon) + '</span>' +
          '<h2>' + escapeHtml(TW.fieldByLang(g, 'title')) + '</h2>' +
        '</div>' +
        '<p class="res-group__sub">' + escapeHtml(TW.fieldByLang(g, 'sub')) + '</p>' +
        '<div class="res-group__grid">' +
          g.links.map((l) => linkCardHtml(l, g.color)).join('') +
        '</div>' +
      '</section>'
    )).join('');

    TW.hydrateIcons($groups);
  }

  function wirePrint() {
    if (!$print) return;
    $print.addEventListener('click', () => window.print());
  }

  async function boot() {
    const res = await fetch('data/links.json', { cache: 'no-cache' });
    const data = await res.json();
    groups = data.groups || [];
    render();
    wirePrint();
  }

  document.addEventListener('tw:langchange', render);

  if (TW.t && TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
