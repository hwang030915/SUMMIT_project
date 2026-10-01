/* 4. 제출 체크: 목록에서 자료를 선택하고 오른쪽 패널에서 제출 완료 / 제출 취소 */
(() => {
  const user = Layout.mount({
    active: "submit",
    title: "제출 체크",
    subtitle: "요청된 결산 자료의 제출 여부를 확인하고, 부서에서 직접 제출 처리할 수 있습니다.",
  });
  if (!user) return;

  Icons.hydrate();

  const esc = Utils.escapeHtml;
  const PER_PAGE = 10;
  const COLS = 8;
  const MEMO_MAX = 500;
  const $ = (id) => document.getElementById(id);
  const tbody = $("tableBody");
  const panel = $("submitPanel");
  const monthFilter = $("monthFilter");
  const statusFilter = $("statusFilter");
  const searchInput = $("searchInput");

  const state = {
    all: [],
    status: "loading",
    month: Utils.lastMonth(),
    filter: "all",
    search: "",
    page: 1,
    selectedId: Utils.query("id"),
    saving: false,
  };

  /* ---------- 필터 ---------- */
  function renderMonthFilter() {
    const months = Utils.monthOptions(state.all.map((i) => i.month));
    monthFilter.innerHTML = UI.monthOptionsHtml(months, state.month, { includeAll: true });
  }

  const inMonth = () => state.all.filter((i) => !state.month || i.month === state.month);

  function filtered() {
    const q = state.search.trim().toLowerCase();
    return inMonth()
      .filter((i) => {
        if (state.filter === "pending" && Utils.isDone(i)) return false;
        if (state.filter === "done" && !Utils.isDone(i)) return false;
        if (state.filter === "late" && !Utils.isLate(i)) return false;
        if (q && !`${i.title} ${i.department}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort(Utils.byDeadline);
  }

  monthFilter.addEventListener("change", () => {
    state.month = monthFilter.value;
    state.page = 1;
    render();
  });
  statusFilter.addEventListener("change", () => {
    state.filter = statusFilter.value;
    state.page = 1;
    render();
  });
  searchInput.addEventListener(
    "input",
    Utils.debounce(() => {
      state.search = searchInput.value;
      state.page = 1;
      render();
    }, 150)
  );

  /* ---------- 목록 ---------- */
  function renderTable(list) {
    if (state.status === "loading") {
      tbody.innerHTML = `<tr class="table-state"><td colspan="${COLS}"><span class="spinner spinner-dark"></span> 불러오는 중...</td></tr>`;
      return;
    }
    if (state.status === "error") {
      tbody.innerHTML = `<tr class="table-state"><td colspan="${COLS}">목록을 불러오지 못했습니다.<br />
        <button type="button" class="btn btn-sm btn-outline" data-action="reload">${Icons.get("refresh")}다시 불러오기</button></td></tr>`;
      $("pagination").innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(list.length / PER_PAGE);
    state.page = Math.min(Math.max(1, state.page), Math.max(1, totalPages));
    const start = (state.page - 1) * PER_PAGE;
    const pageItems = list.slice(start, start + PER_PAGE);

    tbody.innerHTML = pageItems.length
      ? pageItems
          .map((item, i) => {
            const selected = item.id === state.selectedId;
            return `
              <tr data-id="${item.id}" class="is-clickable ${selected ? "is-selected" : ""}">
                <td class="col-check"><input type="checkbox" class="table-check" ${selected ? "checked" : ""} aria-label="${esc(item.title)} 선택" /></td>
                <td>${start + i + 1}</td>
                <td class="cell-left cell-strong">${esc(item.title)}${UI.attachmentBadge(item)}</td>
                <td>${esc(item.department)}</td>
                <td>${esc(item.deadline)}</td>
                <td>${UI.ddayBadge(item)}</td>
                <td>${UI.statusBadge(item)}</td>
                <td><span class="row-chevron">${Icons.get("chevronRight")}</span></td>
              </tr>`;
          })
          .join("")
      : `<tr class="table-state"><td colspan="${COLS}">${
          state.all.length ? "조건에 맞는 요청이 없습니다." : "등록된 요청이 없습니다."
        }</td></tr>`;

    $("totalCount").textContent = `총 ${list.length}건`;
    UI.pagination($("pagination"), {
      page: state.page,
      totalPages,
      onChange: (p) => {
        state.page = p;
        render();
      },
    });
  }

  tbody.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="reload"]')) return load();
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    // 같은 행을 다시 누르면 선택 해제
    state.selectedId = state.selectedId === row.dataset.id ? null : row.dataset.id;
    render();
    if (state.selectedId && window.matchMedia("(max-width: 1280px)").matches) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  /* ---------- 오른쪽 제출 처리 패널 ---------- */
  function renderPanel() {
    const item = state.all.find((i) => i.id === state.selectedId);
    if (!item) {
      panel.innerHTML = `
        <div class="panel-head">
          <span class="panel-head-icon">${Icons.get("fileFill")}</span>
          <div><h2 class="panel-title" id="panelTitle">결산 자료 제출 처리</h2>
          <p class="panel-sub">선택한 결산 요청에 대해 제출 상태를 등록합니다.</p></div>
        </div>
        <div class="panel-body panel-empty">
          <span class="panel-empty-icon">${Icons.get("checkSquare")}</span>
          <p>목록에서 결산 자료를 선택하세요.</p>
          <small>선택한 자료의 제출 완료·취소를 이곳에서 처리합니다.</small>
        </div>`;
      return;
    }

    const done = Utils.isDone(item);
    panel.innerHTML = `
      <div class="panel-head">
        <span class="panel-head-icon">${Icons.get("fileFill")}</span>
        <div><h2 class="panel-title" id="panelTitle">결산 자료 제출 처리</h2>
        <p class="panel-sub">선택한 결산 요청에 대해 제출 상태를 등록합니다.</p></div>
      </div>
      <div class="panel-body">
        <dl class="detail-list detail-list-plain">
          <div><dt>자료명</dt><dd>${esc(item.title)}</dd></div>
          <div><dt>담당 부서</dt><dd>${esc(item.department)}</dd></div>
          <div><dt>제출 기한</dt><dd>${Utils.formatKoreanDatePadded(item.deadline)} ${UI.ddayBadge(item)}</dd></div>
          <div><dt>현재 상태</dt><dd>${UI.statusBadge(item)}</dd></div>
          ${item.requestMemo ? `<div><dt>요청 메모</dt><dd class="dd-normal">${esc(item.requestMemo)}</dd></div>` : ""}
          ${(item.attachments || []).length ? `<div><dt>첨부파일</dt><dd class="dd-normal">${UI.attachmentList(item)}</dd></div>` : ""}
        </dl>

        <form id="submitForm" novalidate>
          <div class="form-alert" role="alert"></div>

          <div class="field">
            <label class="field-label" for="statusSelect">제출 상태<span class="required">*</span></label>
            <div class="input-wrap">
              <span class="input-icon status-icon" id="statusIcon"></span>
              <select class="input select" id="statusSelect" name="status">
                <option value="done" selected>제출 완료</option>
                <option value="pending">미제출</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="submitter">제출자<span class="required">*</span></label>
            <div class="input-wrap">
              <span class="input-icon">${Icons.get("userFill")}</span>
              <input class="input" id="submitter" name="submitter" maxlength="20" placeholder="제출한 담당자 이름"
                value="${esc(done ? item.submitter : `${user.name}`)}" />
            </div>
            <p class="field-error"></p>
          </div>

          <div class="field">
            <label class="field-label" for="submittedDate">제출 일자<span class="required">*</span></label>
            <div class="input-wrap">
              <span class="input-icon">${Icons.get("calendar")}</span>
              <input class="input date-input" type="date" id="submittedDate" name="submittedDate" max="${Utils.todayKST()}"
                value="${done ? item.submittedDate || "" : Utils.todayKST()}" />
            </div>
            <p class="field-error"></p>
          </div>

          <div class="field">
            <label class="field-label" for="submitMemo">메모</label>
            <textarea class="input textarea" id="submitMemo" name="submitMemo" rows="3" maxlength="${MEMO_MAX}"
              placeholder="제출 관련 특이사항을 입력하세요. (선택)">${esc(done ? item.submitMemo : "")}</textarea>
            <div class="textarea-counter"></div>
          </div>

          <p class="panel-note" id="panelNote"></p>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="closePanel">닫기</button>
            <button type="submit" class="btn btn-primary" id="panelSubmit"></button>
          </div>
        </form>
      </div>`;

    const form = $("submitForm");
    const statusSelect = $("statusSelect");
    const submitter = $("submitter");
    const submittedDate = $("submittedDate");
    const memo = $("submitMemo");
    const submitBtn = $("panelSubmit");
    const note = $("panelNote");
    UI.bindCounter(memo, form.querySelector(".textarea-counter"));
    [submitter, submittedDate].forEach((el) => el.addEventListener("input", () => UI.setFieldError(el, "")));

    /** 선택한 상태에 따라 입력칸·버튼 변경 */
    function syncMode() {
      const target = statusSelect.value;
      $("statusIcon").innerHTML = Icons.get(target === "done" ? "checkCircle" : "clock");
      $("statusIcon").classList.toggle("is-done", target === "done");

      // 완료 건은 기록 보기 전용, 미제출로 바꾸려는 경우도 입력 불필요
      const editable = !done && target === "done";
      [submitter, submittedDate, memo].forEach((el) => (el.disabled = !editable));

      submitBtn.className = "btn btn-primary";
      if (!done && target === "done") {
        submitBtn.innerHTML = `${Icons.get("send")}<span>제출 완료</span>`;
        submitBtn.disabled = false;
        note.textContent = "";
      } else if (!done && target === "pending") {
        submitBtn.innerHTML = "<span>제출 완료</span>";
        submitBtn.disabled = true;
        note.textContent = "이미 미제출 상태입니다. 자료를 낸 뒤 '제출 완료'로 선택하세요.";
      } else if (done && target === "done") {
        submitBtn.innerHTML = `${Icons.get("check")}<span>제출 완료됨</span>`;
        submitBtn.disabled = true;
        note.textContent = "이미 제출 완료된 자료입니다. 되돌리려면 제출 상태를 '미제출'로 바꾸세요.";
      } else {
        submitBtn.className = "btn btn-danger";
        submitBtn.innerHTML = "<span>제출 취소</span>";
        submitBtn.disabled = false;
        note.textContent = "제출을 취소하면 제출자·제출 일자·메모가 초기화됩니다.";
      }
    }
    statusSelect.addEventListener("change", syncMode);
    syncMode();

    $("closePanel").addEventListener("click", () => {
      state.selectedId = null;
      render();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (state.saving || submitBtn.disabled) return;
      const alertEl = form.querySelector(".form-alert");
      UI.showFormAlert(alertEl, "");

      if (!done) {
        // 제출 완료 처리
        let first = null;
        if (!submitter.value.trim()) {
          UI.setFieldError(submitter, "제출자를 입력하세요.");
          first = submitter;
        }
        if (!Utils.isValidDate(submittedDate.value)) {
          UI.setFieldError(submittedDate, "제출 일자를 선택하세요.");
          first = first || submittedDate;
        } else if (submittedDate.value > Utils.todayKST()) {
          UI.setFieldError(submittedDate, "제출 일자는 오늘 이후로 선택할 수 없습니다.");
          first = first || submittedDate;
        }
        if (first) return first.focus();

        await save(
          () => Store.submit(item.id, { submitter: submitter.value, submitMemo: memo.value, submittedDate: submittedDate.value }),
          (u) => `'${u.title}' 제출 완료로 저장했습니다.`,
          alertEl,
          submitBtn
        );
      } else {
        // 제출 취소
        const ok = await UI.confirm({
          icon: "alert",
          title: "제출을 취소하시겠습니까?",
          message: "미제출로 바뀌고 제출자·제출 일자·메모가 초기화됩니다.",
          cancelText: "닫기",
          okText: "제출 취소",
        });
        if (!ok) return;
        await save(() => Store.cancelSubmission(item.id), (u) => `'${u.title}' 제출을 취소했습니다.`, alertEl, submitBtn);
      }
    });
  }

  async function save(action, successMessage, alertEl, btn) {
    state.saving = true;
    UI.setButtonLoading(btn, true, "저장 중...");
    try {
      const updated = await action();
      const idx = state.all.findIndex((i) => i.id === updated.id);
      if (idx >= 0) state.all[idx] = updated;
      render();
      UI.toast(successMessage(updated));
    } catch (err) {
      // 실패 시 입력 유지 + 재시도 안내
      UI.showFormAlert(alertEl, `${err.message || "저장에 실패했습니다."} 다시 시도하세요.`);
      UI.setButtonLoading(btn, false);
    } finally {
      state.saving = false;
    }
  }

  /* ---------- 전체 갱신 ---------- */
  function render() {
    UI.renderStats($("stats"), Utils.summarize(inMonth()), { progressTitle: "전체 제출 현황" });
    renderTable(filtered());
    renderPanel();
  }

  async function load() {
    state.status = "loading";
    renderTable([]);
    try {
      state.all = await Store.list();
      state.status = "ready";
    } catch {
      state.status = "error";
    }

    // ?id= 로 들어오면 그 자료의 결산월·페이지로 이동해 선택
    const target = state.all.find((i) => i.id === state.selectedId);
    if (target) {
      state.month = target.month;
      const index = filtered().findIndex((i) => i.id === target.id);
      state.page = Math.floor(index / PER_PAGE) + 1;
    } else {
      state.selectedId = null;
    }
    renderMonthFilter();
    render();
  }

  load();
})();
