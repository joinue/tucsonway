/* Tucson Way — inline SVG icon library.
   Clean Lucide-style: 24x24, currentColor stroke, round caps/joins.
   Avoids gendered/stereotyped silhouettes; uses universal symbols
   (Venus/Mars for women/men, briefcase for jobs, etc.). */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});

  // Shared attrs for stroke-style line icons
  const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  const ICONS = {
    /* Category icons */
    shelter:
      '<svg ' + S + '><path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
    family:
      '<svg ' + S + '><circle cx="9" cy="8" r="3.2"/>' +
      '<path d="M2 21v-1a7 7 0 0 1 14 0v1"/>' +
      '<circle cx="17.5" cy="6.5" r="2.3"/>' +
      '<path d="M17.5 11c2.6 0 4.5 1.8 4.5 4.5V17"/></svg>',
    women:
      '<svg ' + S + '><circle cx="12" cy="9" r="5"/>' +
      '<path d="M12 14v8"/><path d="M9 19h6"/></svg>',
    men:
      '<svg ' + S + '><circle cx="10" cy="14" r="5"/>' +
      '<path d="m14.5 9.5 5.5-5.5"/><path d="M14 4h6v6"/></svg>',
    youth:
      '<svg ' + S + '><path d="M6 22V10a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v12"/>' +
      '<path d="M9 6V5a3 3 0 0 1 6 0v1"/>' +
      '<path d="M6 14h12"/><path d="M10 18h4"/></svg>',
    veterans:
      '<svg ' + S + '><circle cx="12" cy="9" r="6"/>' +
      '<path d="M8.21 13.89 7 22l5-3 5 3-1.21-8.13"/></svg>',
    domestic_violence:
      '<svg ' + S + '><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
      '<path d="m9 12.5 2 2 4-4"/></svg>',
    employment:
      '<svg ' + S + '><rect x="3" y="7" width="18" height="13" rx="2"/>' +
      '<path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>' +
      '<path d="M3 13h18"/></svg>',
    outreach:
      '<svg ' + S + '><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>',
    emergency:
      '<svg ' + S + '><path d="m10.3 3.86-8.4 14.5A2 2 0 0 0 3.65 21.5h16.7a2 2 0 0 0 1.74-3.14L13.7 3.86a2 2 0 0 0-3.46 0z"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>',

    /* Action icons */
    phone:
      '<svg ' + S + '><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    compass:
      '<svg ' + S + '><circle cx="12" cy="12" r="10"/>' +
      '<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    pin:
      '<svg ' + S + '><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>' +
      '<circle cx="12" cy="10" r="3"/></svg>',
    map:
      '<svg ' + S + '><polygon points="3 6 9 4 15 6 21 4 21 18 15 20 9 18 3 20 3 6"/>' +
      '<line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/></svg>',
    search:
      '<svg ' + S + '><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    bed:
      '<svg ' + S + '><path d="M2 4v16"/>' +
      '<path d="M22 20v-7a3 3 0 0 0-3-3H2"/>' +
      '<path d="M2 16h20"/><circle cx="7" cy="13" r="2"/></svg>',
    globe:
      '<svg ' + S + '><circle cx="12" cy="12" r="10"/>' +
      '<path d="M2 12h20"/>' +
      '<path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>',
    clock:
      '<svg ' + S + '><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    info:
      '<svg ' + S + '><circle cx="12" cy="12" r="10"/>' +
      '<path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
    warn:
      '<svg ' + S + '><path d="m10.3 3.86-8.4 14.5A2 2 0 0 0 3.65 21.5h16.7a2 2 0 0 0 1.74-3.14L13.7 3.86a2 2 0 0 0-3.46 0z"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    check:
      '<svg ' + S + '><path d="m5 12 5 5 9-11"/></svg>',
    close:
      '<svg ' + S + '><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chevron:
      '<svg ' + S + '><path d="m9 6 6 6-6 6"/></svg>',
    location:
      '<svg ' + S + '><circle cx="12" cy="12" r="3" fill="currentColor"/>' +
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    home:
      '<svg ' + S + '><path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
    list:
      '<svg ' + S + '><path d="M8 6h13M8 12h13M8 18h13"/>' +
      '<circle cx="3.5" cy="6" r=".9" fill="currentColor"/>' +
      '<circle cx="3.5" cy="12" r=".9" fill="currentColor"/>' +
      '<circle cx="3.5" cy="18" r=".9" fill="currentColor"/></svg>',
  };

  TW.icon = function (name, cls) {
    const svg = ICONS[name];
    if (!svg) return '';
    if (!cls) return svg;
    return svg.replace('<svg ', '<svg class="' + cls + '" ');
  };

  /* Inject icons into static markup: <i data-icon="phone"></i> */
  TW.hydrateIcons = function (root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconHydrated) return;
      const name = el.dataset.icon;
      const svg = ICONS[name];
      if (!svg) return;
      el.innerHTML = svg;
      el.dataset.iconHydrated = '1';
    });
  };

  document.addEventListener('DOMContentLoaded', () => TW.hydrateIcons());
})();
