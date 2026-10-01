/**
 * 날짜·D-day·진행률 계산 공통 함수
 * PRD 4장 규칙: 날짜 기준은 Asia/Seoul, 계산값은 저장하지 않고 화면에서 계산한다.
 */
const Utils = (() => {
  const TZ = "Asia/Seoul";
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- 날짜 ---------- */
  function todayKST() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toDateStr(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function addDays(str, n) {
    const d = parseDate(str);
    d.setUTCDate(d.getUTCDate() + n);
    return toDateStr(d);
  }

  function diffDays(a, b) {
    return Math.round((parseDate(a) - parseDate(b)) / 86400000);
  }

  function isValidDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str || "")) return false;
    return toDateStr(parseDate(str)) === str;
  }

  function isValidMonth(str) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(str || "");
  }

  function addMonths(month, n) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }

  const currentMonth = () => todayKST().slice(0, 7);
  const lastMonth = () => addMonths(currentMonth(), -1);

  function monthLabel(month) {
    const [y, m] = month.split("-");
    return `${month} (${y}년 ${Number(m)}월)`;
  }

  /** 다음 달부터 11개월 전까지 + 데이터에 있는 월 (최신순) */
  function monthOptions(extra = []) {
    const set = new Set(extra.filter(isValidMonth));
    const cur = currentMonth();
    for (let i = 1; i >= -11; i--) set.add(addMonths(cur, i));
    return [...set].sort().reverse();
  }

  const weekday = (str) => WEEKDAYS[parseDate(str).getUTCDay()];

  /** 2026년 10월 1일 (목) */
  function formatKoreanDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return `${y}년 ${m}월 ${d}일 (${weekday(str)})`;
  }

  /** 2026년 09월 28일 (월) */
  function formatKoreanDatePadded(str) {
    const [y, m, d] = str.split("-");
    return `${y}년 ${m}월 ${d}일 (${weekday(str)})`;
  }

  /* ---------- D-day / 상태 ---------- */
  const dday = (deadline) => diffDays(deadline, todayKST());

  function ddayLabel(n) {
    if (n > 0) return `D-${n}`;
    if (n === 0) return "D-day";
    return `${-n}일 지연`;
  }

  const isDone = (item) => item.status === "done";
  const isLate = (item) => !isDone(item) && dday(item.deadline) < 0;

  /** 미제출이고 지났으면 빨강, 0~2일이면 주황, 그 외·완료는 기본색 */
  function ddayTone(item) {
    if (isDone(item)) return "neutral";
    const n = dday(item.deadline);
    if (n < 0) return "danger";
    if (n <= 2) return "warning";
    return "neutral";
  }

  /** 진행률은 소수점 버림, 0건이면 0% */
  function summarize(list) {
    const total = list.length;
    const done = list.filter(isDone).length;
    const late = list.filter(isLate).length;
    const progress = total ? Math.floor((done / total) * 100) : 0;
    return {
      total,
      done,
      pending: total - done,
      late,
      progress,
      pendingPct: total ? 100 - progress : 0,
      latePct: total ? Math.floor((late / total) * 100) : 0,
    };
  }

  const byDeadline = (a, b) =>
    a.deadline.localeCompare(b.deadline) || (a.createdAt || "").localeCompare(b.createdAt || "");

  const ko = (a, b) => a.localeCompare(b, "ko");

  /** 결산 현황 정렬 종류 */
  const SORTS = [
    { key: "deadline-asc", label: "제출 기한 빠른 순", compare: byDeadline },
    { key: "deadline-desc", label: "제출 기한 늦은 순", compare: (a, b) => byDeadline(b, a) },
    {
      key: "pending-first",
      label: "미제출·지연 우선",
      compare: (a, b) => Number(isDone(a)) - Number(isDone(b)) || byDeadline(a, b),
    },
    {
      key: "created-desc",
      label: "최근 등록 순",
      compare: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    },
    { key: "title", label: "자료명 가나다순", compare: (a, b) => ko(a.title, b.title) || byDeadline(a, b) },
    { key: "department", label: "담당 부서순", compare: (a, b) => ko(a.department, b.department) || byDeadline(a, b) },
  ];

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  /* ---------- 기타 ---------- */
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function query(name) {
    return new URLSearchParams(location.search).get(name);
  }

  return {
    todayKST,
    addDays,
    diffDays,
    isValidDate,
    isValidMonth,
    addMonths,
    currentMonth,
    lastMonth,
    monthLabel,
    monthOptions,
    formatKoreanDate,
    formatKoreanDatePadded,
    dday,
    ddayLabel,
    isDone,
    isLate,
    ddayTone,
    summarize,
    byDeadline,
    SORTS,
    formatBytes,
    escapeHtml,
    debounce,
    query,
  };
})();
