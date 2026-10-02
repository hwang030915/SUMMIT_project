/** 날짜 계산과 입력 규칙 (PRD 4장) — 화면 쪽 utils.js / store.js 규칙과 같게 유지 */

export const DEPARTMENTS = ["영업팀", "생산팀", "구매팀", "인사팀", "총무팀", "연구소"];
export const ROLES = ["재무 담당자", "부서 담당자", "팀장"];
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;
export const PASSWORD_HINT = "8자 이상, 영문·숫자·특수문자를 포함하여 입력해주세요.";

export const MAX_FILES = 5;
// Vercel 함수 요청 크기 한도(4.5MB) 안에 들어가도록 base64 인코딩 전 기준 3MB
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
export const ALLOWED_FILE = /\.(pdf|xlsx?|csv|docx?|hwpx?|pptx?|txt|png|jpe?g|gif|zip)$/i;

const pad = (n) => String(n).padStart(2, "0");

export function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const toDateStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(str, n) {
  const d = parseDate(str);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

/** b - a (일) */
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export const lastMonthKST = () => addMonths(todayKST().slice(0, 7), -1);

export function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || "")) return false;
  return toDateStr(parseDate(str)) === str;
}

export const isValidMonth = (str) => /^\d{4}-(0[1-9]|1[0-2])$/.test(str || "");
