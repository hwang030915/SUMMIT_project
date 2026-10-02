/**
 * AI 결산 비서 '모아' 챗봇
 * - 로그인 후 모든 화면 오른쪽 아래 떠 있는 버튼, 'AI 비서 모아' 메뉴(chat.html)에서는 화면 전체 크기
 * - 상담 카테고리 4가지 (실제 결산 데이터를 읽어서 안내)
 *   ① 결산 제출 현황  ② 미제출·지연 관리  ③ 결산 일정 관리  ④ 결산 담당자 문의
 * - 직접 입력한 질문: /api/chat (Claude가 결산 데이터를 근거로 답변), AI 미설정 시 키워드로 카테고리 안내
 * - 대화 내용은 이 탭(sessionStorage)에만 보관합니다.
 */
(() => {
  const user = Auth.currentUser();
  if (!user) return;

  const esc = Utils.escapeHtml;
  const STORE_KEY = `moa.chat.v2.${user.email}`;
  const MAX_SAVED = 80;
  let seq = 0;

  /* =========================================================
   * 그림 (마스코트 · 컬러 아이콘)
   * ======================================================= */
  function mascot() {
    const g = `moaGrad${++seq}`;
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="${g}" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#ffe6d2"/><stop offset=".6" stop-color="#ffc49c"/><stop offset="1" stop-color="#ff9f6e"/>
      </radialGradient></defs>
      <path d="M60 28c-3.4-6.6-13-6-13 1.2 0 6.4 13 12.8 13 12.8s13-6.4 13-12.8c0-7.2-9.6-7.8-13-1.2z" fill="#ff6b6b"/>
      <ellipse cx="21" cy="76" rx="10" ry="14" fill="#ffb487" transform="rotate(-28 21 76)"/>
      <ellipse cx="99" cy="76" rx="10" ry="14" fill="#ffb487" transform="rotate(28 99 76)"/>
      <circle cx="60" cy="74" r="40" fill="url(#${g})"/>
      <circle cx="60" cy="67" r="20" fill="#fff"/>
      <circle cx="62" cy="67" r="12" fill="#1f2430"/>
      <circle cx="66.5" cy="62" r="4" fill="#fff"/>
      <ellipse cx="33" cy="86" rx="8" ry="5.5" fill="#ff7b7b" opacity=".7"/>
      <ellipse cx="87" cy="86" rx="8" ry="5.5" fill="#ff7b7b" opacity=".7"/>
      <path d="M53 96q7 6 14 0" stroke="#8a4630" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  const face = (cls = "") => `<span class="moa-face ${cls}">${mascot()}</span>`;

  const ICO = {
    chart: `<svg viewBox="0 0 32 32"><rect x="4" y="17" width="6" height="11" rx="2" fill="#ffb347"/><rect x="13" y="11" width="6" height="17" rx="2" fill="#5b8def"/><rect x="22" y="4" width="6" height="24" rx="2" fill="#ff5a5f"/></svg>`,
    alarm: `<svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" fill="#ffe3e3" stroke="#ff5a5f" stroke-width="2.4"/><path d="M16 11v6l4 3" fill="none" stroke="#ff5a5f" stroke-width="2.4" stroke-linecap="round"/><path d="M4 7l4-3M28 7l-4-3" stroke="#ff5a5f" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    calendar: `<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="22" rx="4" fill="#fff4e6" stroke="#ff922b" stroke-width="2.2"/><path d="M4 13h24" stroke="#ff922b" stroke-width="2.2"/><path d="M11 3v6M21 3v6" stroke="#ff922b" stroke-width="2.4" stroke-linecap="round"/><rect x="9" y="17" width="5" height="4" rx="1" fill="#ff922b"/></svg>`,
    people: `<svg viewBox="0 0 32 32"><circle cx="12" cy="11" r="5" fill="#5b8def"/><path d="M3 27a9 9 0 0 1 18 0z" fill="#5b8def"/><circle cx="22" cy="12" r="4" fill="#9cc0ff"/><path d="M17 27a8 8 0 0 1 13-6.2V27z" fill="#9cc0ff"/></svg>`,
    check: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#d3f9d8"/><path d="M10 16.5l4 4 8-9" fill="none" stroke="#2f9e44" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    doc: `<svg viewBox="0 0 32 32"><path d="M8 3h11l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff0f0" stroke="#ff5a5f" stroke-width="2"/><path d="M19 3v7h7" fill="none" stroke="#ff5a5f" stroke-width="2"/><path d="M11 16h10M11 21h10" stroke="#ff5a5f" stroke-width="2" stroke-linecap="round"/></svg>`,
    send: `<svg viewBox="0 0 32 32"><path d="M4 15L28 4l-7 24-5-9z" fill="#e7f0ff" stroke="#5b8def" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 19l12-15" stroke="#5b8def" stroke-width="2.2"/></svg>`,
    flag: `<svg viewBox="0 0 32 32"><path d="M7 29V4" stroke="#495057" stroke-width="2.4" stroke-linecap="round"/><path d="M7 5h17l-4 6 4 6H7z" fill="#40c057"/></svg>`,
    mail: `<svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="19" rx="3" fill="#fff4e6" stroke="#ff922b" stroke-width="2.2"/><path d="M4 9l12 9 12-9" fill="none" stroke="#ff922b" stroke-width="2.2"/></svg>`,
  };
  const ico = (name, cls = "moa-ico") => `<span class="${cls}">${ICO[name] || ICO.chart}</span>`;

  const RAIL_ICONS = {
    chat: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.6 1.4 4.9 3.6 6.5L5 21.5l4.2-2.1c.9.2 1.8.3 2.8.3 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/><circle cx="8" cy="11.5" r="1.3" fill="#fff"/><circle cx="12" cy="11.5" r="1.3" fill="#fff"/><circle cx="16" cy="11.5" r="1.3" fill="#fff"/></svg>`,
    status: Icons.get("chart"),
    overdue: Icons.get("alarm"),
    schedule: Icons.get("calendar"),
    contact: Icons.get("user"),
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  };

  /* =========================================================
   * 상담 카테고리
   * ======================================================= */
  const SERVICES = [
    { key: "status", ico: "chart", card: "결산 제출\n현황 보기", quick: "결산 제출 현황", ask: "결산 제출 현황을 알려줘." },
    { key: "overdue", ico: "alarm", card: "미제출·지연\n관리하기", quick: "미제출·지연 관리", ask: "미제출이랑 지연된 자료를 알려줘." },
    { key: "schedule", ico: "calendar", card: "결산 일정\n확인하기", quick: "결산 일정 관리", ask: "결산 일정을 알려줘." },
    { key: "contact", ico: "people", card: "결산 담당자\n문의하기", quick: "결산 담당자 문의", ask: "결산 담당자에게 문의하고 싶어." },
  ];
  const RAIL = [
    ["chat", "채팅"],
    ["status", "현황"],
    ["overdue", "지연"],
    ["schedule", "일정"],
    ["contact", "문의"],
    ["settings", "설정"],
  ];
  const DEPARTMENTS = [...Store.DEPARTMENTS];

  /* =========================================================
   * 결산 데이터 (서버에서 읽어 15초 동안 재사용)
   * ======================================================= */
  const cache = { at: 0, items: null, dir: null };

  async function loadItems() {
    if (cache.items && Date.now() - cache.at < 15000) return cache.items;
    cache.items = await Store.list();
    cache.at = Date.now();
    return cache.items;
  }

  async function loadDirectory() {
    if (!cache.dir) cache.dir = (await Api.request("auth?action=directory")).users;
    return cache.dir;
  }

  /** 결산 현황 화면과 같은 기준: 지난달, 데이터가 없으면 가장 최근 결산월 */
  function pickMonth(items) {
    const last = Utils.lastMonth();
    if (items.some((i) => i.month === last)) return last;
    return items.map((i) => i.month).sort().pop() || last;
  }

  async function monthData() {
    const items = await loadItems();
    const month = pickMonth(items);
    const list = items.filter((i) => i.month === month).sort(Utils.byDeadline);
    return { items, month, list, label: Utils.monthLabel(month) };
  }

  const dday = (i) => Utils.dday(i.deadline);
  const ddayText = (i) => Utils.ddayLabel(dday(i));
  const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const pending = (list) => list.filter((i) => !Utils.isDone(i));
  const late = (list) => list.filter(Utils.isLate);
  const groupByDept = (list) =>
    DEPARTMENTS.map((d) => ({ dept: d, items: list.filter((i) => i.department === d) })).filter((g) => g.items.length);

  function itemLine(i) {
    if (Utils.isDone(i)) return `- ${i.title} · **제출 완료** (${i.submitter || "-"}, ${i.submittedDate ? shortDate(i.submittedDate) : "-"})`;
    const n = dday(i);
    return `- ${i.title} · ${n < 0 ? `**${-n}일 지연**` : n <= 2 ? `**${ddayText(i)}**` : ddayText(i)} (기한 ${shortDate(i.deadline)})`;
  }

  function pieOf(progress, hasLate) {
    const color = hasLate ? "#ff6b6b" : progress === 100 ? "#40c057" : "#ff922b";
    return `conic-gradient(${color} 0 ${progress}%, #ffe8dc ${progress}% 100%)`;
  }

  /* =========================================================
   * 상태 (이 탭에만 저장)
   * ======================================================= */
  let messages = [];
  let aiAvailable = null; // null: 아직 모름
  let busy = false;

  try {
    messages = JSON.parse(sessionStorage.getItem(STORE_KEY)) || [];
  } catch {
    messages = [];
  }
  const save = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.filter((m) => m.kind !== "typing").slice(-MAX_SAVED)));
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  };
  const nowLabel = () => new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  const newId = () => `m${Date.now().toString(36)}${(++seq).toString(36)}`;

  /* =========================================================
   * 화면 뼈대
   * ======================================================= */
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "moa-launcher";
  launcher.setAttribute("aria-label", "AI 결산 비서 모아 열기");
  launcher.innerHTML = `${face()}<span>모아</span>`;

  const panel = document.createElement("section");
  panel.className = "moa-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "AI 결산 비서 모아");
  panel.hidden = true;
  panel.innerHTML = `
    <button type="button" class="moa-close" aria-label="모아 닫기">${Icons.get("x")}</button>
    <div class="moa-welcome">
      ${face()}
      <h2>안녕하세요!<br />저는 <span class="moa-name">모아</span>이에요!</h2>
      <p>SUMMIT과 함께하는 AI 결산 비서예요.<br />제출 현황, 미제출·지연, 결산 일정,<br />담당자 문의까지 무엇이든 물어보세요!</p>
      <div class="moa-quick">
        ${SERVICES.map((s) => `<button type="button" data-service="${s.key}">${ico(s.ico)}${s.quick}</button>`).join("")}
      </div>
      <form class="moa-form" data-form>
        <input type="text" maxlength="500" placeholder="예) 구매팀 미제출 자료 알려줘" aria-label="모아에게 질문" autocomplete="off" />
        <button type="submit" class="moa-send" aria-label="보내기">${Icons.get("chevronRight")}</button>
      </form>
    </div>
    <div class="moa-chat" hidden>
      <nav class="moa-rail" aria-label="모아 메뉴">
        ${RAIL.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === "chat" ? "is-active" : ""}">${RAIL_ICONS[k]}<span>${l}</span></button>`).join("")}
      </nav>
      <div class="moa-main">
        <div class="moa-messages" role="log" aria-live="polite"></div>
        <form class="moa-form" data-form>
          <input type="text" maxlength="500" placeholder="메시지를 입력하세요." aria-label="메시지 입력" autocomplete="off" />
          <button type="submit" class="moa-send" aria-label="보내기">${Icons.get("chevronRight")}</button>
        </form>
        <div class="moa-settings" hidden></div>
      </div>
    </div>`;

  // 'AI 비서 모아' 메뉴 화면(chat.html)에서는 화면 안에 크게, 그 밖의 화면에서는 오른쪽 아래 떠 있는 버튼으로
  const host = document.getElementById("moaPage");
  const embedded = Boolean(host);
  if (embedded) {
    panel.classList.add("is-embedded");
    panel.removeAttribute("role");
    host.appendChild(panel);
  } else {
    document.body.append(launcher, panel);
  }

  const welcomeEl = panel.querySelector(".moa-welcome");
  const chatEl = panel.querySelector(".moa-chat");
  const listEl = panel.querySelector(".moa-messages");
  const settingsEl = panel.querySelector(".moa-settings");
  const chatInput = chatEl.querySelector("input");

  /* =========================================================
   * 메시지 그리기
   * ======================================================= */
  /** 간단한 서식: **굵게**, "- " / "1. " 목록, 줄바꿈 (HTML은 모두 이스케이프) */
  function fmt(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split("\n");
    let html = "";
    let inList = false;
    for (const line of lines) {
      const item = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)/);
      if (item) {
        if (!inList) html += "<ul>";
        inList = true;
        html += `<li>${item[1]}</li>`;
      } else {
        if (inList) html += "</ul>";
        inList = false;
        html += `${line}<br>`;
      }
    }
    if (inList) html += "</ul>";
    return html.replace(/(<br>)+$/, "");
  }

  function extraHtml(m) {
    const locked = m.answered ? "disabled" : "";
    switch (m.kind) {
      case "cards":
        return `<div class="moa-cards">${SERVICES.map(
          (s) => `<button type="button" class="moa-card-btn" data-service="${s.key}">${ico(s.ico)}<span>${esc(s.card).replace("\n", "<br>")}</span></button>`
        ).join("")}</div>`;
      case "suggest":
        return `<div class="moa-suggest">
          <button type="button" class="moa-suggest-head" data-toggle-suggest aria-expanded="true">이런 내용은 어떠세요? ${Icons.get("chevronUp")}</button>
          <ul>${TOPICS[m.topic].items
            .map((it, i) => `<li><button type="button" data-suggest="${m.topic}:${i}">${esc(it.label)}${Icons.get("chevronRight")}</button></li>`)
            .join("")}</ul></div>`;
      case "question": {
        const selected = m.selected || [];
        return `<div class="moa-question">
          ${m.question ? `<p>${esc(m.question)}</p>` : ""}
          <div class="moa-chips">${m.options
            .map(
              (o) =>
                `<button type="button" class="moa-chip ${selected.includes(o.value) ? "is-selected" : ""}" data-chip="${esc(o.value)}" ${locked}>${esc(o.label)}</button>`
            )
            .join("")}</div>
        </div>`;
      }
      case "result":
        return resultHtml(m);
      default:
        return "";
    }
  }

  /** 말풍선 아래 버튼: 이동 링크, 메일, 복사 */
  function actionsHtml(m) {
    const links = (m.links || [])
      .map((l) => `<a class="btn btn-outline btn-xs" href="${esc(l.href)}">${esc(l.label)}</a>`)
      .join("");
    const copy = m.copyText ? `<button type="button" class="btn btn-primary btn-xs" data-copy>${Icons.get("check")}메시지 복사</button>` : "";
    return links || copy ? `<div class="moa-actions">${copy}${links}</div>` : "";
  }

  function resultHtml(m) {
    const slides = m.slides
      .map(
        (s) => `<div class="moa-slide ${s.alert ? "is-alert" : ""}">
          ${s.pie ? `<span class="moa-pie" style="background:${s.pie}"><b>${esc(s.pieLabel || "")}</b></span>` : ico(s.ico)}
          <strong>${esc(s.title)}</strong>
          <span>${esc(s.desc).replace(/\n/g, "<br>")}</span>
        </div>`
      )
      .join("");
    return `<div class="moa-result">
      <div class="moa-result-head">${ico(m.icon || "chart")}<div><h3>${fmt(m.title)}</h3><p>${esc(m.subtitle || "").replace(/\n/g, "<br>")}</p></div></div>
      <div class="moa-carousel">${slides}</div>
      <div class="moa-dots">${m.slides.map((_, i) => `<i class="${i === 0 ? "is-active" : ""}"></i>`).join("")}</div>
      ${m.note ? `<p class="moa-note" style="padding:0 16px">${esc(m.note)}</p>` : ""}
    </div>`;
  }

  function messageEl(m) {
    const row = document.createElement("div");
    row.className = `moa-row ${m.from === "user" ? "is-user" : ""} ${m.kind === "result" || m.kind === "cards" ? "is-wide" : ""}`;
    row.dataset.id = m.id;
    if (m.kind === "typing") {
      row.innerHTML = `${face()}<div class="moa-col"><div class="moa-bubble moa-typing" aria-label="입력 중"><i></i><i></i><i></i></div></div>`;
      return row;
    }
    const time = `<span class="moa-time">${esc(m.time)}</span>`;
    if (m.from === "user") {
      row.innerHTML = `<div class="moa-col"><div class="moa-bubble">${fmt(m.text)}</div>${time}</div>`;
    } else {
      row.innerHTML = `${face()}<div class="moa-col">${m.text ? `<div class="moa-bubble">${fmt(m.text)}</div>` : ""}${extraHtml(m)}${actionsHtml(m)}${time}</div>`;
    }
    const carousel = row.querySelector(".moa-carousel");
    if (carousel) bindCarousel(carousel, row.querySelectorAll(".moa-dots i"));
    return row;
  }

  function bindCarousel(carousel, dots) {
    carousel.addEventListener("scroll", () => {
      const slide = carousel.querySelector(".moa-slide");
      if (!slide) return;
      const step = slide.offsetWidth + 10;
      const atEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4;
      const index = atEnd ? dots.length - 1 : Math.round(carousel.scrollLeft / step);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    });
  }

  function upsert(m) {
    const existing = listEl.querySelector(`[data-id="${m.id}"]`);
    const el = messageEl(m);
    if (existing) existing.replaceWith(el);
    else listEl.appendChild(el);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function renderAll() {
    listEl.innerHTML = "";
    messages.forEach(upsert);
  }

  function push(m) {
    const msg = { id: newId(), time: nowLabel(), from: "bot", ...m };
    messages.push(msg);
    upsert(msg);
    save();
    return msg;
  }

  function update(m, patch) {
    Object.assign(m, patch);
    upsert(m);
    save();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function showTyping() {
    const typing = { id: newId(), kind: "typing", from: "bot" };
    messages.push(typing);
    upsert(typing);
    return () => {
      messages = messages.filter((x) => x !== typing);
      listEl.querySelector(`[data-id="${typing.id}"]`)?.remove();
    };
  }

  /** 봇이 잠깐 입력하는 것처럼 보여준 뒤 메시지 추가 */
  async function botSay(...list) {
    for (const m of list) {
      const done = showTyping();
      await wait(400);
      done();
      push(m);
    }
  }

  const userSay = (text) => push({ from: "user", text });

  /** 데이터를 읽어 답하는 흐름: 읽는 동안 입력 중 표시, 실패하면 안내 */
  async function withData(fn) {
    const done = showTyping();
    try {
      const result = await fn();
      done();
      return result;
    } catch (err) {
      done();
      push({ text: `결산 데이터를 불러오지 못했어요. ${err.message}` });
      return null;
    }
  }

  /* =========================================================
   * ① 결산 제출 현황
   * ======================================================= */
  async function startStatus() {
    setTab("status");
    const data = await withData(monthData);
    if (!data) return;
    const { month, list, label } = data;
    if (!list.length) return botSay({ text: `${label}에 등록된 결산 요청이 아직 없어요.`, links: [{ label: "결산 요청 등록하기", href: "request.html" }] });

    const s = Utils.summarize(list);
    const groups = groupByDept(list).map((g) => ({ ...g, s: Utils.summarize(g.items) }));
    await botSay({
      text: `**${label}** 결산 현황이에요.\n전체 ${s.total}건 중 **${s.done}건 제출**(진행률 ${s.progress}%)\n미제출 ${s.pending}건 · 지연 **${s.late}건**`,
      kind: "result",
      icon: "chart",
      title: "**모아**의 부서별 제출 현황",
      subtitle: "부서 카드를 넘겨 보세요!\n빨간색은 지연이 있는 부서예요.",
      slides: groups.map((g) => ({
        pie: pieOf(g.s.progress, g.s.late > 0),
        pieLabel: `${g.s.progress}%`,
        title: g.dept,
        desc: `제출 ${g.s.done}/${g.s.total}\n${g.s.late ? `지연 ${g.s.late}건` : g.s.pending ? `미제출 ${g.s.pending}건` : "모두 제출 완료!"}`,
        alert: g.s.late > 0,
      })),
      aiText: `${label} 결산 현황: 전체 ${s.total}건, 제출 ${s.done}건(${s.progress}%), 미제출 ${s.pending}건, 지연 ${s.late}건. 부서별: ${groups
        .map((g) => `${g.dept} ${g.s.done}/${g.s.total}`)
        .join(", ")}`,
    });
    await botSay({
      kind: "question",
      qid: "deptStatus",
      month,
      question: "특정 부서의 제출 상태를 자세히 볼까요?",
      options: groups.map((g) => ({ value: g.dept, label: g.dept })),
    });
  }

  async function answerDeptStatus(dept, month) {
    const items = await withData(loadItems);
    if (!items) return;
    const list = items.filter((i) => i.month === month && i.department === dept).sort(Utils.byDeadline);
    const s = Utils.summarize(list);
    const firstPending = list.find((i) => !Utils.isDone(i));
    await botSay({
      text: `**${dept}**의 ${Utils.monthLabel(month)} 제출 상태예요. (${s.done}/${s.total}건 제출)\n${list.map(itemLine).join("\n")}`,
      links: firstPending ? [{ label: "제출 체크에서 처리하기", href: `submit.html?id=${encodeURIComponent(firstPending.id)}` }] : [],
    });
  }

  /* =========================================================
   * ② 미제출·지연 관리
   * ======================================================= */
  async function startOverdue() {
    setTab("overdue");
    const data = await withData(monthData);
    if (!data) return;
    const { list, label } = data;
    const p = pending(list);
    const l = late(list).sort((a, b) => dday(a) - dday(b));

    if (!p.length) {
      return botSay({ text: `**${label}** 결산 자료가 모두 제출됐어요! 🎉\n독촉할 부서가 없어요.` });
    }
    const intro = `**${label}** 기준 미제출 **${p.length}건**, 그중 **${l.length}건**이 기한을 넘겼어요.`;
    if (l.length) {
      await botSay({
        text: intro,
        kind: "result",
        icon: "alarm",
        title: "**모아**의 지연 현황",
        subtitle: "기한이 오래 지난 순서예요.\n카드를 넘겨 보세요!",
        slides: l.map((i) => ({ ico: "alarm", title: i.title, desc: `${i.department}\n${-dday(i)}일 지연 (기한 ${shortDate(i.deadline)})`, alert: true })),
        aiText: `${intro} 지연: ${l.map((i) => `${i.title}(${i.department}, ${-dday(i)}일 지연)`).join(", ")}`,
      });
    } else {
      await botSay({ text: `${intro}\n아직 기한이 지난 건은 없어요.` });
    }
    await botSay({ text: "더 필요한 내용을 골라 주세요.", kind: "suggest", topic: "overdue" });
  }

  async function answerPendingDepts() {
    const data = await withData(monthData);
    if (!data) return;
    const groups = groupByDept(pending(data.list));
    await botSay({
      text: groups.length
        ? `미제출 자료가 있는 부서는 **${groups.length}곳**이에요.\n${groups
            .map((g) => `- **${g.dept}** ${g.items.length}건: ${g.items.map((i) => i.title).join(", ")}`)
            .join("\n")}`
        : "미제출 자료가 있는 부서가 없어요! 🎉",
    });
  }

  async function answerLateDays() {
    const data = await withData(monthData);
    if (!data) return;
    const l = late(data.list).sort((a, b) => dday(a) - dday(b));
    await botSay({
      text: l.length
        ? `기한이 지난 자료 **${l.length}건**이에요. (오래 지난 순)\n${l
            .map((i) => `- **${i.department}** · ${i.title} · **${-dday(i)}일 지연** (기한 ${shortDate(i.deadline)})`)
            .join("\n")}`
        : "기한이 지난 미제출 자료는 없어요! 👍",
    });
  }

  async function answerRemindTargets() {
    const data = await withData(monthData);
    if (!data) return;
    const targets = pending(data.list).filter((i) => dday(i) <= 2).sort(Utils.byDeadline);
    if (!targets.length) return botSay({ text: "지금 바로 독촉할 대상은 없어요. 지연되었거나 이틀 안에 마감되는 미제출 건이 없어요." });
    const depts = [...new Set(targets.map((i) => i.department))];
    await botSay({
      text: `지연되었거나 **2일 안에 마감**되는 미제출 자료예요. 이 부서들에 먼저 연락해 보세요.\n${targets.map((i) => `- **${i.department}** · ${i.title} · ${ddayText(i)}`).join("\n")}`,
    });
    await botSay({ kind: "question", qid: "remind", question: "독촉 메시지를 만들어 드릴까요? 부서를 골라 주세요.", options: depts.map((d) => ({ value: d, label: d })) });
  }

  async function askRemindDept() {
    const data = await withData(monthData);
    if (!data) return;
    const depts = groupByDept(pending(data.list)).map((g) => g.dept);
    if (!depts.length) return botSay({ text: "미제출 부서가 없어서 독촉 메시지가 필요 없어요! 🎉" });
    await botSay({ kind: "question", qid: "remind", question: "어느 부서에 보낼 메시지를 만들까요?", options: depts.map((d) => ({ value: d, label: d })) });
  }

  async function makeReminder(dept) {
    const data = await withData(async () => ({ ...(await monthData()), dir: await loadDirectory().catch(() => []) }));
    if (!data) return;
    const items = pending(data.list).filter((i) => i.department === dept);
    if (!items.length) return botSay({ text: `${dept}은(는) 미제출 자료가 없어요!` });

    const message = [
      `[SUMMIT 결산 자료 제출 요청]`,
      `${dept} 담당자님, 안녕하세요. ${user.department} ${user.name}입니다.`,
      `${data.label} 결산 자료 중 아래 항목이 아직 제출되지 않아 확인 부탁드립니다.`,
      ...items.map((i) => `- ${i.title} (기한 ${shortDate(i.deadline)}, ${ddayText(i)})`),
      `자료를 메일 또는 ERP로 제출하신 뒤, SUMMIT '제출 체크' 화면에서 제출 완료로 표시해 주세요.`,
      `감사합니다.`,
    ].join("\n");

    const to = data.dir.filter((u) => u.department === dept).map((u) => u.email);
    const mailto = `mailto:${to.join(",")}?subject=${encodeURIComponent(`[SUMMIT] ${data.label} 결산 자료 제출 요청 (${dept})`)}&body=${encodeURIComponent(message)}`;
    await botSay({
      text: `**${dept}**에 보낼 독촉 메시지 초안이에요. 복사해서 메신저나 메일로 보내 보세요.\n\n${message}`,
      copyText: message,
      links: [{ label: to.length ? `${dept}에 메일 보내기` : "메일 앱으로 보내기", href: mailto }],
    });
  }

  /* =========================================================
   * ③ 결산 일정 관리
   * ======================================================= */
  async function startSchedule() {
    setTab("schedule");
    const data = await withData(monthData);
    if (!data) return;
    const p = pending(data.list);
    const today = p.filter((i) => dday(i) === 0).length;
    const soon = p.filter((i) => dday(i) > 0 && dday(i) <= 3).length;
    await botSay({
      text: `**${data.label}** 결산 일정이에요.\n오늘 마감 **${today}건**, 3일 안에 마감 **${soon}건**이 남아 있어요.`,
      kind: "suggest",
      topic: "schedule",
      aiText: `${data.label} 일정: 오늘 마감 ${today}건, 3일 이내 마감 ${soon}건`,
    });
  }

  async function answerDeadlines() {
    const data = await withData(monthData);
    if (!data) return;
    const upcoming = pending(data.list).filter((i) => dday(i) >= 0).sort(Utils.byDeadline).slice(0, 8);
    await botSay({
      text: upcoming.length
        ? `다가오는 제출 마감일이에요. (미제출 자료만)\n${upcoming
            .map((i) => `- ${shortDate(i.deadline)}(${weekday(i.deadline)}) · **${i.title}** · ${i.department} · ${ddayText(i)}`)
            .join("\n")}`
        : "앞으로 마감되는 미제출 자료가 없어요.",
      links: [{ label: "결산 현황에서 전체 보기", href: "main.html" }],
    });
  }

  const weekday = (d) => ["일", "월", "화", "수", "목", "금", "토"][new Date(`${d}T00:00:00+09:00`).getDay()];

  async function answerRemaining() {
    const data = await withData(monthData);
    if (!data) return;
    const p = pending(data.list);
    const buckets = [
      { ico: "alarm", title: "지연", items: p.filter((i) => dday(i) < 0), alert: true },
      { ico: "flag", title: "오늘 마감", items: p.filter((i) => dday(i) === 0), alert: true },
      { ico: "calendar", title: "3일 이내", items: p.filter((i) => dday(i) >= 1 && dday(i) <= 3) },
      { ico: "calendar", title: "7일 이내", items: p.filter((i) => dday(i) >= 4 && dday(i) <= 7) },
      { ico: "check", title: "그 이후", items: p.filter((i) => dday(i) > 7) },
    ];
    const nearest = p.filter((i) => dday(i) >= 0).sort(Utils.byDeadline)[0];
    await botSay({
      text: nearest
        ? `가장 가까운 마감은 **${nearest.title}**(${nearest.department}) · **${ddayText(nearest)}**예요.`
        : "앞으로 남은 마감이 없어요.",
      kind: "result",
      icon: "calendar",
      title: "**모아**의 마감 기간 분석",
      subtitle: `미제출 ${p.length}건을 남은 기간별로 나눴어요.`,
      slides: buckets.map((b) => ({
        ico: b.ico,
        title: `${b.title} ${b.items.length}건`,
        desc: b.items.length ? b.items.slice(0, 2).map((i) => i.title).join("\n") + (b.items.length > 2 ? `\n외 ${b.items.length - 2}건` : "") : "없음",
        alert: b.alert && b.items.length > 0,
      })),
      aiText: `남은 기간: ${buckets.map((b) => `${b.title} ${b.items.length}건`).join(", ")}`,
    });
  }

  async function answerSteps() {
    const data = await withData(monthData);
    if (!data) return;
    const deadlines = data.list.map((i) => i.deadline).sort();
    const first = deadlines[0];
    const last = deadlines[deadlines.length - 1];
    const s = Utils.summarize(data.list);
    await botSay({
      text: `**${data.label}** 결산은 이렇게 진행돼요. 지금은 **진행률 ${s.progress}%** 단계예요.`,
      kind: "result",
      icon: "flag",
      title: "단계별 결산 일정",
      subtitle: "등록된 제출 기한을 바탕으로 정리했어요.",
      slides: [
        { ico: "doc", title: "1. 결산 요청 등록", desc: "재무 담당자가\n부서별 자료 요청" },
        { ico: "send", title: "2. 부서 자료 제출", desc: first ? `${shortDate(first)} ~ ${shortDate(last)}\n메일·ERP 제출 후 완료 표시` : "제출 기한 미등록" },
        { ico: "alarm", title: "3. 확인·독촉", desc: `미제출 ${s.pending}건 · 지연 ${s.late}건\n확인 후 재요청` },
        { ico: "flag", title: "4. 결산 마감·보고", desc: last ? `${shortDate(last)} 이후\n진행률 100% 확인 후 보고` : "모든 제출 확인 후 보고" },
      ],
      note: "실제 결산 마감일은 회사 일정에 따라 다를 수 있어요.",
    });
  }

  /* =========================================================
   * ④ 결산 담당자 문의
   * ======================================================= */
  async function startContact() {
    setTab("contact");
    await botSay({ text: "결산 담당자 문의를 도와드릴게요!\n원하는 내용을 고르거나 직접 질문해 주세요.", kind: "suggest", topic: "contact" });
  }

  async function askContactDept() {
    const dir = await withData(loadDirectory);
    if (!dir) return;
    const depts = [...new Set([...DEPARTMENTS, ...dir.map((u) => u.department)])];
    await botSay({ kind: "question", qid: "contactDept", question: "어느 부서 담당자를 찾으세요?", options: depts.map((d) => ({ value: d, label: d })) });
  }

  async function answerContactDept(dept) {
    const data = await withData(async () => ({ dir: await loadDirectory(), ...(await monthData()) }));
    if (!data) return;
    const members = data.dir.filter((u) => u.department === dept);
    const submitters = [...new Set(data.list.filter((i) => i.department === dept && i.submitter).map((i) => i.submitter))];
    const lines = members.map((u) => `- **${u.name}** (${u.role}) · ${u.email}`);
    await botSay({
      text: [
        members.length ? `**${dept}** SUMMIT 사용자예요.\n${lines.join("\n")}` : `**${dept}**에 가입한 SUMMIT 사용자가 아직 없어요.`,
        submitters.length ? `\n${data.label} 최근 제출자: ${submitters.join(", ")}` : "",
      ].join(""),
      links: members.length ? [{ label: `${dept}에 메일 보내기`, href: `mailto:${members.map((u) => u.email).join(",")}?subject=${encodeURIComponent("[SUMMIT] 결산 자료 문의")}` }] : [],
    });
  }

  async function answerFinanceContact() {
    const dir = await withData(loadDirectory);
    if (!dir) return;
    const finance = dir.filter((u) => u.role === "재무 담당자" || u.department === "재무팀");
    await botSay({
      text: finance.length
        ? `결산 요청과 기한 조정은 **재무 담당자**에게 문의해 주세요.\n${finance.map((u) => `- **${u.name}** (${u.department} · ${u.role}) · ${u.email}`).join("\n")}`
        : "등록된 재무 담당자가 없어요. 관리자에게 문의해 주세요.",
      links: finance.length ? [{ label: "재무 담당자에게 메일 보내기", href: `mailto:${finance.map((u) => u.email).join(",")}?subject=${encodeURIComponent("[SUMMIT] 결산 제출 문의")}` }] : [],
    });
  }

  /* ---------- 추천 질문 목록 ---------- */
  const TOPICS = {
    overdue: {
      items: [
        { label: "미제출 부서 확인", run: answerPendingDepts },
        { label: "지연 부서 및 지연 일수 보기", run: answerLateDays },
        { label: "독촉이 필요한 대상 확인", run: answerRemindTargets },
        { label: "독촉 메시지 만들기", run: askRemindDept },
      ],
    },
    schedule: {
      items: [
        { label: "제출 마감일 확인", run: answerDeadlines },
        { label: "마감일까지 남은 기간 확인", run: answerRemaining },
        { label: "단계별 결산 일정 안내", run: answerSteps },
        {
          label: "D-day 색깔은 무슨 뜻인가요?",
          answer:
            "결산 현황의 D-day 색깔 기준이에요.\n- **빨간색**: 미제출이면서 기한이 지난 지연 건\n- **주황색**: 오늘 마감(D-day)이거나 2일 안에 마감\n- 회색: 마감까지 3일 이상 남았거나 이미 제출 완료\n기한 당일은 지연이 아니에요.",
        },
      ],
    },
    contact: {
      items: [
        { label: "부서별 담당자 확인", run: askContactDept },
        { label: "재무 담당자에게 문의하기", run: answerFinanceContact },
        {
          label: "제출 완료는 어떻게 표시하나요?",
          answer:
            "제출 완료는 이렇게 표시해요.\n1. 결산 자료를 메일이나 ERP로 먼저 제출해요\n2. **제출 체크** 화면에서 해당 자료를 선택해요\n3. 제출자·제출 일자를 확인하고 **[제출 완료]**를 눌러요\n결산 현황 표의 [제출 완료] 버튼으로도 바로 처리할 수 있어요.",
          links: [{ label: "제출 체크로 이동", href: "submit.html" }],
        },
        {
          label: "제출 관련 자주 묻는 질문",
          answer:
            "- **자료는 어디로 내나요?** 기존처럼 메일이나 ERP로 내고, SUMMIT에서는 제출 완료만 표시해요\n- **잘못 표시했어요.** 제출 체크에서 상태를 '미제출'로 바꾸면 제출이 취소돼요\n- **기한을 늦추고 싶어요.** 요청을 등록한 재무 담당자에게 문의해 주세요\n- **요청에 첨부된 양식은?** 결산 현황이나 제출 체크에서 📎 표시된 자료를 열면 내려받을 수 있어요",
        },
      ],
    },
  };

  /* =========================================================
   * 흐름 연결
   * ======================================================= */
  function showChatView() {
    welcomeEl.hidden = true;
    welcomeEl.style.display = "none";
    chatEl.hidden = false;
  }

  function setTab(key) {
    panel.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === key));
  }

  const STARTERS = { status: startStatus, overdue: startOverdue, schedule: startSchedule, contact: startContact };

  async function startService(key, { echo = true } = {}) {
    if (busy) return;
    busy = true;
    try {
      showChatView();
      closeSettings();
      if (key === "chat") {
        setTab("chat");
        return await botSay({ text: "어떤 도움이 필요하신가요?\n아래에서 상담 주제를 고르거나 직접 질문해 주세요!", kind: "cards" });
      }
      const service = SERVICES.find((s) => s.key === key);
      if (echo && service) userSay(service.ask);
      await STARTERS[key]();
    } finally {
      busy = false;
    }
  }

  async function onSuggest(topic, index) {
    if (busy) return;
    busy = true;
    try {
      const item = TOPICS[topic].items[index];
      userSay(item.label);
      if (item.run) await item.run();
      else await botSay({ text: item.answer, links: item.links });
    } finally {
      busy = false;
    }
  }

  async function onChoice(m, value) {
    if (busy) return;
    busy = true;
    try {
      update(m, { selected: [value], answered: true });
      if (m.qid === "deptStatus") await answerDeptStatus(value, m.month);
      else if (m.qid === "remind") await makeReminder(value);
      else if (m.qid === "contactDept") await answerContactDept(value);
    } finally {
      busy = false;
    }
  }

  /* ---------- 자유 질문 ---------- */
  const KEYWORDS = [
    { re: /독촉|미제출|지연|밀린|안\s*낸|늦/, key: "overdue" },
    { re: /일정|마감|기한|D-?day|언제|남은/i, key: "schedule" },
    { re: /담당자|문의|연락|누구|이메일|메일/, key: "contact" },
    { re: /현황|진행률|제출|몇\s*건|부서/, key: "status" },
  ];

  async function fallbackAnswer(text) {
    const hit = KEYWORDS.find((k) => k.re.test(text));
    if (hit) return startService(hit.key, { echo: false });
    await botSay({ text: "제가 도와드릴 수 있는 결산 상담 주제예요. 하나를 골라 주세요!", kind: "cards" });
  }

  function historyForAi() {
    return messages
      .filter((m) => m.kind !== "typing" && (m.text || m.aiText))
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.aiText || m.text }))
      .slice(-12);
  }

  async function ask(text) {
    if (busy) return;
    showChatView();
    closeSettings();
    setTab("chat");
    userSay(text);

    if (aiAvailable === false) return fallbackAnswer(text);

    busy = true;
    const done = showTyping();
    try {
      const { reply } = await Api.request("chat", { method: "POST", body: { messages: historyForAi() } });
      aiAvailable = true;
      done();
      push({ text: reply });
    } catch (err) {
      done();
      if (err.code === "NO_AI") {
        aiAvailable = false;
        busy = false;
        return await fallbackAnswer(text);
      }
      push({ text: `앗, ${err.message}` });
    } finally {
      busy = false;
    }
  }

  /* ---------- 설정 ---------- */
  async function openSettings() {
    setTab("settings");
    settingsEl.hidden = false;
    settingsEl.innerHTML = `
      <h3>설정</h3>
      <div class="moa-setting"><div>AI 자유 질문 답변<small>입력창에 쓴 질문을 AI가 결산 데이터로 답해요</small></div><span class="moa-status" data-ai-status>확인 중</span></div>
      <div class="moa-setting"><div>대화 내용 지우기<small>이 탭에 저장된 모아와의 대화를 모두 지워요</small></div><button type="button" class="btn btn-outline btn-xs" data-clear>지우기</button></div>
      <div class="moa-setting"><div>처음 화면으로<small>모아 소개 화면으로 돌아가요</small></div><button type="button" class="btn btn-outline btn-xs" data-home>이동</button></div>
      ${embedded ? "" : `<div class="moa-setting"><div>크게 보기<small>'AI 비서 모아' 메뉴 화면에서 넓게 대화해요</small></div><a class="btn btn-outline btn-xs" href="chat.html">열기</a></div>`}
      <p class="moa-disclaimer">모아는 SUMMIT에 등록된 결산 요청·제출 데이터를 바탕으로 안내해요. 다른 사용자가 바꾼 내용은 잠시 뒤에 반영될 수 있으니, 중요한 판단 전에는 결산 현황 화면에서 한 번 더 확인해 주세요.</p>`;

    const status = settingsEl.querySelector("[data-ai-status]");
    const show = (on) => {
      status.textContent = on ? "사용 중" : "기본 안내 모드";
      status.className = `moa-status ${on ? "is-on" : "is-off"}`;
    };
    if (aiAvailable !== null) return show(aiAvailable);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      aiAvailable = Boolean(data.env && data.env.AI_답변_설정됨);
      show(aiAvailable);
    } catch {
      status.textContent = "확인 불가";
    }
  }

  function closeSettings() {
    settingsEl.hidden = true;
  }

  async function clearChat() {
    const ok = await UI.confirm({
      icon: "trash",
      title: "대화 내용을 지울까요?",
      message: "모아와 나눈 대화가 모두 사라져요.",
      okText: "지우기",
    });
    if (!ok) return;
    messages = [];
    save();
    renderAll();
    goHome();
  }

  function goHome() {
    closeSettings();
    setTab("chat");
    chatEl.hidden = true;
    welcomeEl.hidden = false;
    welcomeEl.style.display = "";
  }

  async function copyMessage(m, btn) {
    try {
      await navigator.clipboard.writeText(m.copyText);
    } catch {
      // 클립보드 권한이 없으면 임시 입력창으로 복사
      const ta = document.createElement("textarea");
      ta.value = m.copyText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.innerHTML = `${Icons.get("check")}복사했어요`;
    UI.toast("독촉 메시지를 복사했어요.");
  }

  /* =========================================================
   * 이벤트
   * ======================================================= */
  function openPanel() {
    panel.hidden = false;
    launcher.classList.add("is-open");
    document.querySelector(".moa-tip")?.remove();
    if (messages.length) {
      showChatView();
      renderAll();
      setTimeout(() => chatInput.focus(), 50);
    } else {
      setTimeout(() => welcomeEl.querySelector("input").focus(), 50);
    }
  }

  function closePanel() {
    panel.hidden = true;
    launcher.classList.remove("is-open");
    launcher.focus();
  }

  if (embedded) {
    openPanel(); // 전용 화면은 항상 열려 있음
  } else {
    launcher.addEventListener("click", openPanel);
    panel.querySelector(".moa-close").addEventListener("click", closePanel);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden && !document.querySelector(".modal-backdrop")) closePanel();
    });
  }

  panel.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    ask(text);
    setTimeout(() => chatInput.focus(), 30);
  });

  panel.addEventListener("click", (e) => {
    const t = e.target;
    const find = (sel) => t.closest(sel);
    const msgOf = (el) => messages.find((m) => m.id === el.closest(".moa-row")?.dataset.id);

    const service = find("[data-service]");
    if (service) return startService(service.dataset.service);

    const tab = find("[data-tab]");
    if (tab) {
      if (tab.dataset.tab === "settings") return openSettings();
      return startService(tab.dataset.tab);
    }

    const toggle = find("[data-toggle-suggest]");
    if (toggle) {
      const box = toggle.closest(".moa-suggest");
      box.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!box.classList.contains("is-collapsed")));
      return;
    }

    const suggest = find("[data-suggest]");
    if (suggest) {
      const [topic, index] = suggest.dataset.suggest.split(":");
      return onSuggest(topic, Number(index));
    }

    const chip = find("[data-chip]");
    if (chip && !chip.disabled) {
      const m = msgOf(chip);
      if (m && !m.answered) onChoice(m, chip.dataset.chip);
      return;
    }

    const copy = find("[data-copy]");
    if (copy) {
      const m = msgOf(copy);
      if (m) copyMessage(m, copy);
      return;
    }

    if (find("[data-clear]")) return clearChat();
    if (find("[data-home]")) return goHome();
  });

  // 처음 한 번 말풍선 안내 (떠 있는 버튼일 때만)
  try {
    if (!embedded && !sessionStorage.getItem("moa.tipShown")) {
      sessionStorage.setItem("moa.tipShown", "1");
      const tip = document.createElement("div");
      tip.className = "moa-tip";
      tip.textContent = "결산 현황, 모아에게 물어보세요! 💬";
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 6000);
    }
  } catch {
    /* 무시 */
  }
})();
