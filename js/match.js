/* Tucson Compass — match.js
   Privacy-first questionnaire matcher.

   - Answers live ONLY in component memory. Never written to localStorage,
     cookies, URL params, or sent anywhere. Refreshing the page wipes them.
   - Matching runs entirely in the browser against data/resources.json.
*/
(function () {
  'use strict';

  let resources = [];
  let quickAccess = [];

  const $form = document.getElementById('match-form');
  const $results = document.getElementById('match-results');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* -------------------- read answers from the form -------------------- */

  function readAnswers() {
    const fd = new FormData($form);
    const answers = {
      needs: fd.getAll('needs'),
      housing: fd.get('housing') || '',
      age: fd.get('age') || '',
      with: fd.getAll('with'),
      vet: fd.get('vet') || '',
      gender: fd.getAll('gender'),
      dv: fd.get('dv') || '',
      substance: fd.get('substance') || '',
      faith: fd.get('faith') || '',
      tribal: fd.get('tribal') || '',
      reentry: fd.get('reentry') || '',
    };
    return answers;
  }

  /* -------------------- age helpers -------------------- */

  function ageWindow(range) {
    switch (range) {
      case '12_17': return [12, 17];
      case '18_24': return [18, 24];
      case '25_59': return [25, 59];
      case '60_plus': return [60, 999];
      default: return null; // skipped
    }
  }

  /* -------------------- scoring -------------------- */

  /* returns { keep: bool, score: number, reasons: [string] } */
  function evaluate(r, a) {
    const m = r.match || {};
    const reasons = [];
    let score = 0;

    /* ---------- HARD FILTERS (return keep:false to drop) ---------- */

    // gender — only filter when user explicitly identified
    if (m.g === 'women' && a.gender.length && !a.gender.includes('woman') && !a.gender.includes('nonbinary')) {
      return { keep: false };
    }
    if (m.g === 'men' && a.gender.length && !a.gender.includes('man') && !a.gender.includes('nonbinary')) {
      return { keep: false };
    }

    // age
    const userAges = ageWindow(a.age);
    if (userAges && m.ages) {
      const [uMin, uMax] = userAges;
      const [pMin, pMax] = m.ages;
      if (uMax < pMin || uMin > pMax) return { keep: false };
    }

    // family with children
    const hasKids = a.with.includes('children');
    if (m.kids === 'required' && !hasKids) return { keep: false };
    if (m.kids === 'no' && hasKids) return { keep: false };

    // veteran-required programs
    if (m.vet && a.vet !== 'yes') return { keep: false };

    // sobriety requirements
    if (m.sober && a.substance === 'not_seeking') return { keep: false };

    // tribal-only programs
    if (m.tribal_only && a.tribal !== 'yes') return { keep: false };

    // housing-status alignment (only filter if user said something)
    if (a.housing && a.housing !== 'skip' && a.housing !== 'for_someone' && m.housing) {
      const userBucket = (a.housing === 'at_risk') ? 'at_risk' : 'unhoused';
      const programServes = m.housing;
      const ok = programServes.includes('any')
        || programServes.includes(userBucket)
        || (userBucket === 'unhoused' && programServes.includes('unhoused'));
      if (!ok) {
        // exception: if user is housed-at-risk but program is only unhoused,
        // and user picked a need only that program offers, still surface it.
        // For now: skip.
        return { keep: false };
      }
    }

    /* ---------- SOFT SCORING ---------- */

    // Need matches — primary driver
    if (a.needs.length && m.needs) {
      const matched = a.needs.filter((n) => m.needs.includes(n));
      score += matched.length * 12;
      if (matched.length) reasons.push(needsReasonLabel(matched));
    }

    // Crisis boost (DV/mental-health emergency)
    if (m.crisis && (a.dv === 'yes' || a.needs.includes('dv') || a.needs.includes('mental_health'))) {
      score += 25;
    }

    // DV explicit — push DV-categorized to the top
    if (a.dv === 'yes' && (r.categories || []).includes('domestic_violence')) {
      score += 30;
      reasons.push(TW.t('match_reason_dv_specialist'));
    }

    // LGBTQ-focused programs match LGBTQ users
    if (m.lgbtq_focused && a.gender.includes('lgbtq')) {
      score += 18;
      reasons.push(TW.t('match_reason_lgbtq'));
    }

    // Pets
    if (a.with.includes('pets')) {
      if (m.pets) { score += 14; reasons.push(TW.t('match_reason_pets')); }
      else if ((m.needs || []).includes('shelter')) { score -= 3; }
    }

    // Veteran identity
    if (a.vet === 'yes' && (r.categories || []).includes('veterans')) {
      score += 10;
      reasons.push(TW.t('match_reason_vets'));
    }

    // Reentry friendly
    if (a.reentry === 'yes' && m.post_incarceration) {
      score += 10;
      reasons.push(TW.t('match_reason_post_inc'));
    }

    // Faith preference handling
    if (m.faith) {
      if (a.faith === 'non_religious') score -= 8;          // user prefers secular → de-prioritize
      else if (a.faith === 'comfortable') { score += 3; reasons.push(TW.t('match_reason_faith')); }
      else if (a.faith === 'no_pref' || a.faith === 'skip') reasons.push(TW.t('match_reason_faith'));
    }

    // Substance use match (housing first programs)
    if (a.substance === 'not_seeking' && (m.needs || []).includes('shelter') && !m.sober) {
      score += 8;
      reasons.push(TW.t('match_reason_housing_first'));
    }

    // Age-specific match — strong boost for youth-only programs
    if (userAges && m.ages) {
      const [uMin, uMax] = userAges;
      const [pMin, pMax] = m.ages;
      const tight = (pMax - pMin) < 20; // youth-only, senior-only, etc.
      if (tight && uMin >= pMin && uMax <= pMax) { score += 10; reasons.push(TW.t('match_reason_age_fit')); }
    }

    // Family programs match users with kids
    if (hasKids && (m.kids === 'required' || (r.categories || []).includes('family'))) {
      score += 6; reasons.push(TW.t('match_reason_families'));
    }

    // Gender-specific shelter alignment
    if (m.g === 'women' && a.gender.includes('woman')) { score += 4; reasons.push(TW.t('match_reason_women_only')); }
    if (m.g === 'men' && a.gender.includes('man')) { score += 4; reasons.push(TW.t('match_reason_men_only')); }

    // 60+ → prevention boost
    if (a.age === '60_plus' && m.ages && m.ages[0] >= 60) { score += 8; }

    return { keep: true, score, reasons: [...new Set(reasons)] };
  }

  function needsReasonLabel(matched) {
    const list = (matched.length === 1)
      ? needLabel(matched[0])
      : matched.slice(0, 3).map(needLabel).join(', ');
    const tmpl = TW.t('match_helps_with');
    return tmpl.indexOf('{needs}') >= 0 ? tmpl.replace('{needs}', list) : (tmpl + ' ' + list);
  }

  const NEED_KEYS = [
    'shelter', 'food', 'showers', 'rent_assistance', 'mental_health',
    'substance_use', 'dv', 'health', 'id_mail', 'employment',
    'transportation', 'benefits', 'outreach',
  ];
  function needLabel(n) {
    const k = 'match_inline_' + n;
    const v = TW.t(k);
    return v && v !== k ? v : n;
  }

  /* -------------------- result grouping -------------------- */

  /* Bucket each result by its strongest matching need so the output is
     organized by what the user asked for. Titles resolved via i18n at render. */
  const NEED_GROUPS = [
    'dv', 'crisis', 'shelter', 'rent_assistance', 'food',
    'showers', 'mental_health', 'substance_use', 'health',
    'employment', 'id_mail', 'benefits', 'transportation', 'other',
  ];

  function bucketFor(r, a) {
    const m = r.match || {};
    const needs = a.needs.length ? a.needs : NEED_KEYS;
    // DV first if matched
    if (a.dv === 'yes' && (r.categories || []).includes('domestic_violence')) return 'dv';
    if (m.crisis) return 'crisis';
    // Use the first need the user picked that this resource addresses
    for (const n of needs) {
      if ((m.needs || []).includes(n)) return n;
    }
    return 'other';
  }

  /* -------------------- rendering -------------------- */

  function phoneActionFor(r) {
    const phones = r.phone || [];
    if (!phones.length) return '';
    const p = phones[0];
    const tel = p.ext ? p.tel + ',' + p.ext : p.tel;
    const ext = TW.t('match_phone_ext');
    return (
      '<a class="match-card__call" href="tel:' + escapeHtml(tel) + '">' +
        TW.icon('phone') +
        '<span>' + escapeHtml(TW.formatPhone(p.tel)) +
          (p.ext ? ' <small>' + escapeHtml(ext) + ' ' + escapeHtml(p.ext) + '</small>' : '') +
        '</span>' +
      '</a>'
    );
  }

  function directionsActionFor(r) {
    if (r.confidential_location || !r.address) return '';
    return (
      '<a class="match-card__dir" href="' + escapeHtml(TW.directionsUrl(r.address)) + '" target="_blank" rel="noopener">' +
        TW.icon('compass') +
        '<span>' + escapeHtml(TW.t('card_directions')) + '</span>' +
      '</a>'
    );
  }

  function shareActionFor(r) {
    if (r.confidential_location) return '';
    const phones = r.phone || [];
    const phoneTxt = phones.length ? TW.formatPhone(phones[0].tel) : '';
    const parts = [r.name];
    if (r.address) parts.push(r.address);
    if (phoneTxt) parts.push(phoneTxt);
    const msg = parts.join(' — ');
    return (
      '<button type="button" class="match-card__share" data-share="' + escapeHtml(msg) + '" data-share-name="' + escapeHtml(r.name) + '">' +
        TW.icon('share') +
        '<span>' + escapeHtml(TW.t('match_share')) + '</span>' +
      '</button>'
    );
  }

  function cardHtml(r, reasons) {
    const why = (reasons && reasons.length)
      ? '<ul class="match-card__why">' +
          reasons.slice(0, 4).map((w) => '<li>' + escapeHtml(w) + '</li>').join('') +
        '</ul>'
      : '';

    const addr = r.confidential_location
      ? '<p class="match-card__addr match-card__addr--confidential">' + TW.icon('warn') + ' <span>' + escapeHtml(TW.t('match_loc_confidential')) + '</span></p>'
      : (r.address ? '<p class="match-card__addr">' + TW.icon('pin') + ' <span>' + escapeHtml(r.address) + '</span></p>' : '');

    const detailHref = 'directory.html#r-' + encodeURIComponent(r.id);

    return (
      '<article class="match-card">' +
        '<div class="match-card__top">' +
          '<h3 class="match-card__name">' + escapeHtml(r.name) + '</h3>' +
          why +
        '</div>' +
        addr +
        '<div class="match-card__actions">' +
          phoneActionFor(r) +
          directionsActionFor(r) +
          shareActionFor(r) +
          '<a class="match-card__more" href="' + detailHref + '">' +
            TW.icon('chevron') + '<span>' + escapeHtml(TW.t('match_full_details')) + '</span>' +
          '</a>' +
        '</div>' +
      '</article>'
    );
  }

  function wireShareButtons(root) {
    root.querySelectorAll('.match-card__share').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-share') || '';
        const title = btn.getAttribute('data-share-name') || '';
        if (navigator.share) {
          try { await navigator.share({ title, text }); return; } catch (_) { /* fallthrough */ }
        }
        // Fallback: open SMS composer prefilled
        const url = 'sms:?&body=' + encodeURIComponent(text);
        window.location.href = url;
      });
    });
  }

  function crisisCalloutHtml(a) {
    const items = [];

    if (a.dv === 'yes') {
      items.push({
        title: TW.t('match_crisis_emerge_title'),
        tel: '5207954266',
        sub: TW.t('match_crisis_emerge_sub'),
      });
      if (a.gender.includes('lgbtq')) {
        items.push({
          title: TW.t('match_crisis_saaf_title'),
          tel: '18005539387',
          sub: TW.t('match_crisis_saaf_sub'),
        });
      }
    }

    if (a.needs.includes('mental_health') || a.substance === 'seeking') {
      items.push({
        title: TW.t('match_crisis_988_title'),
        tel: '988',
        sub: TW.t('match_crisis_988_sub'),
      });
      items.push({
        title: TW.t('match_crisis_crc_title'),
        tel: '5203012284',
        sub: TW.t('match_crisis_crc_sub'),
      });
    }

    if (a.vet === 'yes' && (a.housing === 'unhoused_outside' || a.housing === 'unhoused_temp' || a.housing === 'unhoused_shelter')) {
      items.push({
        title: TW.t('match_crisis_vet_title'),
        tel: '18774243838',
        sub: TW.t('match_crisis_vet_sub'),
      });
    }

    if (!items.length) return '';

    return (
      '<div class="crisis-callout" role="region" aria-label="' + escapeHtml(TW.t('match_right_now_help')) + '">' +
        '<h2 class="crisis-callout__title">' + TW.icon('warn') + ' <span>' + escapeHtml(TW.t('match_right_now_help')) + '</span></h2>' +
        '<ul class="crisis-callout__list">' +
          items.map((i) => (
            '<li class="crisis-callout__item">' +
              '<a class="crisis-callout__call" href="tel:' + escapeHtml(i.tel) + '">' +
                TW.icon('phone') +
                '<span class="crisis-callout__phone">' + escapeHtml(TW.formatPhone(i.tel)) + '</span>' +
              '</a>' +
              '<div class="crisis-callout__meta">' +
                '<strong>' + escapeHtml(i.title) + '</strong>' +
                '<span>' + escapeHtml(i.sub) + '</span>' +
              '</div>' +
            '</li>'
          )).join('') +
        '</ul>' +
      '</div>'
    );
  }

  function render(answers) {
    /* Run scoring */
    const scored = resources
      // Civic / advocacy entries (city ward offices, etc.) are not direct services.
      // Skip them in matching even if a future entry lacks a `match` block.
      .filter((r) => !(r.categories || []).includes('civic'))
      .map((r) => ({ r, ev: evaluate(r, answers) }))
      .filter((x) => x.ev.keep && x.ev.score > 0);

    if (!scored.length) {
      const body = TW.t('match_no_match_body');
      const linked = body.replace('2-1-1', '<a href="tel:211">2-1-1</a>');
      $results.innerHTML =
        '<h2 class="match-results__h2">' + escapeHtml(TW.t('match_no_match_h2')) + '</h2>' +
        '<p class="note">' + linked + '</p>';
      $results.hidden = false;
      TW.hydrateIcons($results);
      $results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    /* Sort by score within scored list, then bucket */
    scored.sort((a, b) => b.ev.score - a.ev.score);

    const buckets = {};
    scored.forEach((x) => {
      const b = bucketFor(x.r, answers);
      (buckets[b] = buckets[b] || []).push(x);
    });

    /* Build group sections in NEED_GROUPS order */
    let html = '';
    html += crisisCalloutHtml(answers);
    html += '<h2 class="match-results__h2">' + escapeHtml(TW.t('match_results_h2')) + '</h2>';
    const subTmpl = scored.length === 1 ? TW.t('match_results_sub_one') : TW.t('match_results_sub_many');
    html += '<p class="match-results__sub">' + escapeHtml(subTmpl.replace('{n}', scored.length)) + '</p>';

    NEED_GROUPS.forEach((groupId) => {
      const list = buckets[groupId];
      if (!list || !list.length) return;
      const title = TW.t('match_group_' + groupId);
      html += '<section class="match-group">';
      html += '<h3 class="match-group__title">' + escapeHtml(title) + ' <span class="match-group__count">' + list.length + '</span></h3>';
      html += '<div class="match-group__grid">';
      list.forEach((x) => { html += cardHtml(x.r, x.ev.reasons); });
      html += '</div>';
      html += '</section>';
    });

    html += '<div class="match-actions match-actions--bottom">' +
              '<button type="button" class="btn-secondary" id="match-revise">' +
                TW.icon('chevron') + '<span>' + escapeHtml(TW.t('match_revise')) + '</span>' +
              '</button>' +
            '</div>';

    $results.innerHTML = html;
    $results.hidden = false;
    TW.hydrateIcons($results);
    wireShareButtons($results);

    const revise = document.getElementById('match-revise');
    if (revise) {
      revise.addEventListener('click', () => {
        $form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    $results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* -------------------- form behavior -------------------- */

  function wireForm() {
    $form.addEventListener('submit', (e) => {
      e.preventDefault();
      const a = readAnswers();
      render(a);
    });

    $form.addEventListener('reset', () => {
      $results.hidden = true;
      $results.innerHTML = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* Visual feedback on selected options */
    $form.querySelectorAll('.opt input').forEach((input) => {
      input.addEventListener('change', () => {
        const opt = input.closest('.opt');
        if (input.type === 'radio') {
          // clear siblings in this group
          const name = input.name;
          $form.querySelectorAll('.opt input[name="' + name + '"]').forEach((sib) => {
            sib.closest('.opt').classList.toggle('opt--on', sib.checked);
          });
        } else {
          opt.classList.toggle('opt--on', input.checked);
        }
      });
    });
  }

  /* -------------------- boot -------------------- */

  async function boot() {
    const data = await TW.loadResources();
    resources = data.resources || [];
    quickAccess = data.quick_access || [];
    wireForm();
  }

  if (TW.t && TW.t('site_title') !== 'site_title') {
    boot();
  } else {
    document.addEventListener('tw:i18nready', boot, { once: true });
  }
})();
