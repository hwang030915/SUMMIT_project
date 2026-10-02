/**
 * 아이콘 모음
 * HTML에서는 <span data-icon="calendar"></span> 으로 쓰고 Icons.hydrate()로 채웁니다.
 * JS에서는 Icons.get("calendar")로 SVG 문자열을 받습니다.
 */
const Icons = (() => {
  const stroke = (body, width = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const fill = (body) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

  const EYE = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>';

  const set = {
    check: stroke('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
    chart: fill('<rect x="4" y="13" width="4" height="7" rx="1.2"/><rect x="10" y="9" width="4" height="11" rx="1.2"/><rect x="16" y="4" width="4" height="16" rx="1.2"/>'),
    plusCircle: fill('<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2h-3z"/>'),
    plus: stroke('<path d="M12 6v12M6 12h12"/>', 2.6),
    checkSquare:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: stroke('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 1.8),
    user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>', 1.8),
    userFill: fill('<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/>'),
    chevronDown: stroke('<path d="M6 9l6 6 6-6"/>'),
    chevronUp: stroke('<path d="M6 15l6-6 6 6"/>'),
    chevronRight: stroke('<path d="M9 6l6 6-6 6"/>'),
    chevronLeft: stroke('<path d="M15 6l-6 6 6 6"/>'),
    sort: stroke('<path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"/>', 1.8),
    file: stroke('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    fileFill:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H7a2.5 2.5 0 0 0-2.5 2.5v15A2.5 2.5 0 0 0 7 22h10a2.5 2.5 0 0 0 2.5-2.5V7.5z" fill="currentColor"/><path d="M14 2v4a1.5 1.5 0 0 0 1.5 1.5h4z" fill="#fff" opacity=".45"/><path d="M8.5 12.5h7M8.5 16.5h7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    alarm: stroke('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.8M3.5 5l3-2.5M20.5 5l-3-2.5"/>', 2.2),
    mail: stroke('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>', 1.8),
    lock: stroke('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5"/>', 1.8),
    eye: stroke(EYE, 1.8),
    eyeOff: stroke(EYE + '<path d="M4 20L20 4"/>', 1.8),
    x: stroke('<path d="M6 6l12 12M18 6L6 18"/>'),
    send: stroke('<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-3.5-7-7-3.5z"/>', 2),
    trash: stroke('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 2.2),
    logout: stroke('<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>', 2),
    swap: stroke('<path d="M4 8h15l-4-4M20 16H5l4 4"/>', 1.8),
    help: stroke('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.6M12 17h.01"/>', 1.8),
    clock: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 2.2),
    search: stroke('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    shield: stroke('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>', 1.8),
    building: stroke('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>', 1.8),
    alert: stroke('<path d="M12 6v8M12 18h.01"/>', 3),
    checkCircle: stroke('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>', 2),
    chat: stroke('<path d="M12 3.5c-5 0-9 3.4-9 7.6 0 2.3 1.2 4.4 3.2 5.8L5.5 20.5l3.9-1.9c.8.2 1.7.3 2.6.3 5 0 9-3.4 9-7.7S17 3.5 12 3.5z"/><path d="M8 11.2h.01M12 11.2h.01M16 11.2h.01"/>', 2),
    paperclip: stroke('<path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>', 1.8),
    upload: stroke('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>', 1.8),
    download: stroke('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>', 1.8),
    refresh: stroke('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', 2),
  };

  function get(name) {
    return set[name] || "";
  }

  function hydrate(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const svg = set[el.dataset.icon];
      if (!svg) return;
      el.innerHTML = svg;
      el.classList.add("icon");
      el.removeAttribute("data-icon");
    });
  }

  /** 안내 카드용 작은 그림 (문서 + 막대) */
  function promoArt() {
    return `<svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="58" cy="70" rx="56" ry="22" fill="#fbd0bd" opacity=".7"/>
      <g transform="rotate(4 70 40)">
        <rect x="52" y="6" width="50" height="64" rx="6" fill="#fff"/>
        <rect x="60" y="15" width="22" height="16" rx="2" fill="#4b5563"/>
        <rect x="60" y="37" width="34" height="3.5" rx="1.75" fill="#d1d5db"/>
        <rect x="60" y="45" width="34" height="3.5" rx="1.75" fill="#d1d5db"/>
        <rect x="60" y="53" width="24" height="3.5" rx="1.75" fill="#d1d5db"/>
      </g>
      <rect x="14" y="44" width="40" height="38" rx="6" fill="#fff"/>
      <path d="M22 74V64l6-4v14zM31 74V56l7-4v22zM41 74V50l6-4v28z" fill="#374151"/>
    </svg>`;
  }

  return { get, hydrate, promoArt };
})();
