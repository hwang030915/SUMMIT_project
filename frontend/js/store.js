/**
 * 결산 요청 데이터 저장소 (임시 목업)
 *
 * 백엔드 전까지 브라우저 localStorage에 저장합니다.
 * ※ localStorage는 같은 브라우저에서만 공유되며 PC 간 공유는 되지 않습니다(PRD 7장).
 *   백엔드 연결 시 list/create/submit/cancelSubmission 내부만 API 호출로 교체하세요.
 */
const Store = (() => {
  const KEY = "gyeolsan.requests";
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const DEPARTMENTS = ["영업팀", "생산팀", "구매팀", "인사팀", "총무팀", "연구소"];

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /** 시연용 가상 데이터: 오늘 기준 상대 날짜로 만들어 지연 2건·임박 2건이 항상 보이게 함 */
  function seed() {
    const today = Utils.todayKST();
    const month = Utils.lastMonth();
    const prevMonth = Utils.addMonths(month, -1);
    const now = Date.now();

    // [결산월, 자료명, 부서, 기한(오늘+n일), 요청 메모, 제출자, 제출 메모, 제출일(오늘+n일)]
    const rows = [
      [month, "미지급 내역", "구매팀", -3, "거래처별 정리"],
      [month, "인건비 내역", "인사팀", -1, "9월 급여"],
      [month, "사무용품 비용", "총무팀", 0, "영수증 정리"],
      [month, "매출 내역", "영업팀", 2, "월별 매출 집계"],
      [month, "생산 비용", "생산팀", 4, "원자재, 인건비 포함", "김생산", "ERP 제출 완료", -1],
      [month, "연구비 집행", "연구소", 4, "프로젝트별 정리", "이연구", "9/30 제출", -1],
      [month, "세금계산서 내역", "구매팀", 6, "9월 발행분"],
      [month, "계약 현황", "총무팀", 9, "계약서 사본", "박총무", "9/29 완료", -2],
      [month, "광고비 집행", "영업팀", 11, "매체별 집행 내역"],
      [month, "복리후생비", "인사팀", 14, "부서별 사용 내역", "최인사", "ERP 첨부 완료", 0],
      [month, "재고 실사표", "생산팀", 5, "창고별 실사 결과", "김생산", "", -1],
      [month, "외주 가공비", "생산팀", 7, "업체별 정산", "정생산", "세금계산서 포함", 0],
      [month, "퇴직급여 충당금", "인사팀", 8, "", "최인사", "", -2],
      [month, "법인카드 사용 내역", "총무팀", 3, "카드별 정리", "박총무", "영수증 첨부", -1],
      [month, "매출채권 잔액", "영업팀", 10, "거래처별 잔액", "한영업", "", 0],
      [month, "시험 장비 감가상각", "연구소", 12, "", "이연구", "ERP 등록", -2],
      [prevMonth, "미지급 내역", "구매팀", -27, "거래처별 정리", "이구매", "", -28],
      [prevMonth, "인건비 내역", "인사팀", -26, "8월 급여", "최인사", "", -27],
      [prevMonth, "매출 내역", "영업팀", -25, "월별 매출 집계", "한영업", "", -25],
    ];

    return rows.map(([m, title, department, offset, requestMemo, submitter, submitMemo, submittedOffset], i) => {
      const done = Boolean(submitter);
      const submittedDate = done ? Utils.addDays(today, submittedOffset) : null;
      return {
        id: newId(),
        month: m,
        title,
        department,
        deadline: Utils.addDays(today, offset),
        requestMemo: requestMemo || "",
        status: done ? "done" : "pending",
        submitter: submitter || "",
        submitMemo: submitMemo || "",
        submittedDate,
        submittedAt: done ? new Date(`${submittedDate}T09:00:00+09:00`).toISOString() : null,
        // 이번 결산월 첫 행이 가장 최근 등록 (최근 등록한 요청 목록 순서)
        createdAt: new Date(now - (m === month ? i + 1 : 1000 + i) * 3600000).toISOString(),
      };
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* 손상된 데이터는 다시 생성 */
    }
    const data = seed();
    save(data);
    return data;
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      if (err && err.name === "QuotaExceededError") {
        throw new Error("브라우저 저장 공간이 부족합니다. 첨부파일 수나 크기를 줄여주세요.");
      }
      throw err;
    }
  }

  /** PRD 4장 입력 규칙 */
  function validateRequest(input) {
    const value = {
      month: (input.month || "").trim(),
      title: (input.title || "").trim(),
      department: input.department || "",
      deadline: input.deadline || "",
      requestMemo: (input.requestMemo || "").trim(),
    };
    const errors = {};
    if (!Utils.isValidMonth(value.month)) errors.month = "결산월을 선택하세요.";
    if (!value.title) errors.title = "자료명을 입력하세요.";
    else if (value.title.length > 50) errors.title = "자료명은 50자 이내로 입력하세요.";
    if (!DEPARTMENTS.includes(value.department)) errors.department = "담당 부서를 선택하세요.";
    if (!value.deadline) errors.deadline = "제출 기한을 선택하세요.";
    else if (!Utils.isValidDate(value.deadline)) errors.deadline = "올바른 날짜가 아닙니다.";
    if (value.requestMemo.length > 300) errors.requestMemo = "요청 메모는 300자 이내로 입력하세요.";

    value.attachments = (input.attachments || []).map(({ name, size, type, dataUrl }) => ({
      name,
      size,
      type: type || "",
      dataUrl: dataUrl || null,
    }));
    if (value.attachments.length > MAX_FILES) errors.attachments = `첨부파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`;
    else if (value.attachments.some((f) => f.size > MAX_FILE_SIZE)) errors.attachments = "파일당 10MB 이하만 첨부할 수 있습니다.";
    return { value, errors, valid: Object.keys(errors).length === 0 };
  }

  async function list() {
    await delay(250);
    return clone(load());
  }

  async function create(input) {
    await delay(400);
    const { value, errors, valid } = validateRequest(input);
    if (!valid) throw new Error(Object.values(errors)[0]);

    const item = {
      id: newId(),
      ...value,
      attachments: value.attachments.map((f) => ({ id: newId(), ...f })),
      status: "pending",
      submitter: "",
      submitMemo: "",
      submittedDate: null,
      submittedAt: null,
      createdAt: new Date().toISOString(),
    };
    const data = load();
    data.push(item);
    save(data);
    return clone(item);
  }

  function findOrThrow(data, id) {
    const item = data.find((row) => row.id === id);
    if (!item) throw new Error("요청을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.");
    return item;
  }

  /** 상태·제출자·메모·일시를 한 번에 저장 */
  async function submit(id, { submitter, submitMemo, submittedDate }) {
    await delay(400);
    const name = (submitter || "").trim();
    if (!name) throw new Error("제출자를 입력하세요.");
    const date = submittedDate || Utils.todayKST();
    if (!Utils.isValidDate(date)) throw new Error("제출 일자가 올바르지 않습니다.");

    const data = load();
    const item = findOrThrow(data, id);
    Object.assign(item, {
      status: "done",
      submitter: name,
      submitMemo: (submitMemo || "").trim(),
      submittedDate: date,
      submittedAt: new Date().toISOString(),
    });
    save(data);
    return clone(item);
  }

  /** 미제출로 되돌리고 제출 정보 초기화 */
  async function cancelSubmission(id) {
    await delay(400);
    const data = load();
    const item = findOrThrow(data, id);
    Object.assign(item, {
      status: "pending",
      submitter: "",
      submitMemo: "",
      submittedDate: null,
      submittedAt: null,
    });
    save(data);
    return clone(item);
  }

  return { DEPARTMENTS, MAX_FILES, MAX_FILE_SIZE, validateRequest, list, create, submit, cancelSubmission };
})();
