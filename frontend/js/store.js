/**
 * 결산 요청 데이터 — 서버 API(/api/requests, MongoDB) 사용
 * 저장된 데이터는 모든 PC에서 공유됩니다. 다른 PC의 변경은 새로고침하면 반영됩니다.
 */
const Store = (() => {
  const DEPARTMENTS = ["영업팀", "생산팀", "구매팀", "인사팀", "총무팀", "연구소"];
  const MAX_FILES = 5;
  // Vercel 함수 요청 크기 한도(4.5MB) 때문에 첨부파일 합계 3MB까지
  const MAX_TOTAL_SIZE = 3 * 1024 * 1024;

  /** PRD 4장 입력 규칙 (서버에서도 같은 규칙으로 다시 검사) */
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

    const files = input.attachments || [];
    const total = files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (files.length > MAX_FILES) errors.attachments = `첨부파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`;
    else if (total > MAX_TOTAL_SIZE) errors.attachments = "첨부파일은 합계 3MB까지 올릴 수 있습니다.";

    return { value, errors, valid: Object.keys(errors).length === 0 };
  }

  async function list() {
    const { items } = await Api.request("requests");
    return items;
  }

  /** attachments: [{ name, type, data(base64) }] */
  async function create(input) {
    const { value, errors, valid } = validateRequest(input);
    if (!valid) throw new Error(Object.values(errors)[0]);
    const { item } = await Api.request("requests", {
      method: "POST",
      body: { ...value, attachments: input.attachments || [] },
    });
    return item;
  }

  /** 상태·제출자·메모·일시를 한 번에 저장 */
  async function submit(id, { submitter, submitMemo, submittedDate }) {
    const { item } = await Api.request(`requests?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { action: "submit", submitter, submitMemo, submittedDate },
    });
    return item;
  }

  /** 미제출로 되돌리고 제출 정보 초기화 */
  async function cancelSubmission(id) {
    const { item } = await Api.request(`requests?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { action: "cancel" },
    });
    return item;
  }

  function downloadAttachment(id, name) {
    return Api.download(`attachment?id=${encodeURIComponent(id)}`, name);
  }

  return {
    DEPARTMENTS,
    MAX_FILES,
    MAX_TOTAL_SIZE,
    validateRequest,
    list,
    create,
    submit,
    cancelSubmission,
    downloadAttachment,
  };
})();
