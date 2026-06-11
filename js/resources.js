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
    /* Relative links (e.g. a local PDF) have no host — label by type instead */
    if (/\.pdf(?:$|[?#])/i.test(url)) return 'PDF';
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (_) { return url; }
  }

  function linkCardHtml(link, color) {
    const name = escapeHtml(link.name);
    const desc = escapeHtml(TW.fieldByLang(link, 'desc'));
    const isTel = !!link.tel;
    const isUrl = !!link.url;
    const gc = ' style="--gc: var(--cat-' + color + ')"';

    /* Dual-action card: the phone call is the primary tap target, but the
       website stays reachable as its own distinct action. You can't nest an
       <a> inside an <a>, so the card becomes a container with two sibling
       links: a wide "call" zone and a smaller "website" zone beside it. */
    if (isTel && isUrl) {
      const website = escapeHtml(TW.t('res_website'));
      return (
        '<div class="link-card link-card--tel link-card--dual"' + gc + '>' +
          '<a class="link-card__main" href="tel:' + escapeHtml(link.tel) + '">' +
            '<span class="link-card__icon">' + TW.icon('phone') + '</span>' +
            '<span class="link-card__body">' +
              '<span class="link-card__name">' + name + '</span>' +
              '<span class="link-card__desc">' + desc + '</span>' +
              '<span class="link-card__meta">' + escapeHtml(TW.formatPhone(link.tel)) + '</span>' +
            '</span>' +
          '</a>' +
          '<a class="link-card__site" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener" aria-label="' + name + ' ' + website + ' (' + escapeHtml(TW.t('opens_new_tab')) + ')">' +
            TW.icon('external') +
            '<span class="link-card__site-host">' + escapeHtml(hostOf(link.url)) + '</span>' +
          '</a>' +
        '</div>'
      );
    }

    /* Single-action card: phone-only, website-only, or neither (e.g. a text
       line) renders as one whole-card link, or a plain card with no action. */
    let open = '<div class="link-card"' + gc + '>';
    let close = '</div>';
    let meta = '';
    let icon = 'info';
    if (isTel) {
      open = '<a class="link-card link-card--tel"' + gc + ' href="tel:' + escapeHtml(link.tel) + '">';
      close = '</a>';
      meta = TW.formatPhone(link.tel);
      icon = 'phone';
    } else if (isUrl) {
      open = '<a class="link-card"' + gc + ' href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">';
      close = '</a>';
      meta = hostOf(link.url);
      icon = 'external';
    }

    return (
      open +
        '<span class="link-card__icon">' + TW.icon(icon) + '</span>' +
        '<span class="link-card__body">' +
          '<span class="link-card__name">' + name + (isUrl && !isTel ? ' ' + TW.icon('external') : '') + '</span>' +
          '<span class="link-card__desc">' + desc + '</span>' +
          (meta ? '<span class="link-card__meta">' + escapeHtml(meta) + '</span>' : '') +
        '</span>' +
        (isUrl && !isTel ? TW.newTabHint() : '') +
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

  /* The browser tries to scroll to a #hash before the groups exist in the
     DOM (they render after the fetch), so a deep link like #g-cooling lands
     nowhere. Re-apply the hash once the sections are on the page. */
  function scrollToHash() {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }

  async function boot() {
    const res = await fetch('/data/links.json', { cache: 'no-cache' });
    const data = await res.json();
    groups = data.groups || [];
    render();
    wirePrint();
    scrollToHash();
  }

  document.addEventListener('tw:langchange', render);

  if (TW.t && TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
