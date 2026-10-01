/* 2. 결산 현황 (공용 현황판) — 필터 · 검색 · 정렬 · 제출 완료/취소 */
(() => {
  const user = Layout.mount({
    active: "dashboard",
    title: "결산 현황",
    subtitle: "부서별 결산 자료 제출 현황을 한눈에 확인하세요.",
  });
  if (!user) return;

  Icons.hydrate();

  const esc = Utils.escapeHtml;
  const PER_PAGE = 10;
  const COLS = 11;
  const $ = (id) => document.getElementById(id);
  const monthFilter = $("monthFilter");
  const deptFilter = $("deptFilter");
  const searchInput = $("searchInput");
  const sortSelect = $("sortSelect");
  const tbody = $("tableBody");

  const state = {
    all: [],
    status: "loading", // loading | ready | error
    month: Utils.lastMonth(),
    dept: "",
    search: "",
    sort: Utils.SORTS[0].key,
    page: 1,
    highlightId: null,
  };

  /* ---------- 필터 · 검색 · 정렬 ---------- */
  function renderFilters() {
    const months = Utils.monthOptions(state.all.map((i) => i.month));
    monthFilter.innerHTML = UI.monthOptionsHtml(months, state.month, { includeAll: true });
    deptFilter.innerHTML =
      `<option value="">전체 부서</option>` +
      Store.DEPARTMENTS.map((d) => `<option value="${d}" ${d === state.dept ? "selected" : ""}>${d}</option>`).join("");
  }

  sortSelect.innerHTML = Utils.SORTS.map((s) => `<option value="${s.key}">${s.label}</option>`).join("");

  const resetPageAndRender = () => {
    state.page = 1;
    render();
  };

  monthFilter.addEventListener("change", () => {
    state.month = monthFilter.value;
    resetPageAndRender();
  });
  deptFilter.addEventListener("change", () => {
    state.dept = deptFilter.value;
    resetPageAndRender();
  });
  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    resetPageAndRender();
  });
  searchInput.addEventListener(
    "input",
    Utils.debounce(() => {
      state.search = searchInput.value;
      resetPageAndRender();
    }, 150)
  );

  /** 요약 카드 기준: 결산월 · 부서 필터 (PRD 4장) */
  const scoped = () =>
    state.all.filter((i) => (!state.month || i.month === state.month) && (!state.dept || i.department === state.dept));

  /** 목록 기준: 위 필터 + 검색어 + 정렬 */
  function visible() {
    const q = state.search.trim().toLowerCase();
    const sorter = (Utils.SORTS.find((s) => s.key === state.sort) || Utils.SORTS[0]).compare;
    return scoped()
      .filter((i) => {
        if (!q) return true;
        const haystack = [
          i.title,
          i.department,
          i.submitter,
          i.requestMemo,
          i.submitMemo,
          ...(i.attachments || []).map((f) => f.name),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(sorter);
  }

  /* ---------- 목록 ---------- */
  function rowHtml(item, no) {
    const done = Utils.isDone(item);
    return `
      <tr data-id="${item.id}" class="${item.id === state.highlightId ? "is-highlight" : ""}">
        <td>${no}</td>
        <td>${esc(item.month)}</td>
        <td class="cell-left cell-strong">${esc(item.title)}${UI.attachmentBadge(item)}</td>
        <td>${esc(item.department)}</td>
        <td>${esc(item.deadline)}</td>
        <td>${UI.ddayBadge(item)}</td>
        <td>${UI.statusBadge(item)}</td>
        <td>${esc(item.submitter || "-")}</td>
        <td class="cell-memo" title="${esc(item.requestMemo)}">${esc(item.requestMemo || "-")}</td>
        <td class="cell-memo" title="${esc(item.submitMemo)}">${esc(item.submitMemo || "-")}</td>
        <td>${
          done
            ? '<button type="button" class="btn btn-xs btn-outline" data-action="cancel">제출 취소</button>'
            : '<button type="button" class="btn btn-xs btn-primary" data-action="submit">제출 완료</button>'
        }</td>
      </tr>`;
  }

  function emptyMessage() {
    if (state.search.trim()) return `'${esc(state.search.trim())}'에 대한 검색 결과가 없습니다.`;
    return "등록된 요청이 없습니다.";
  }

  function renderTable(list) {
    if (state.status === "loading") {
      tbody.innerHTML = `<tr class="table-state"><td colspan="${COLS}"><span class="spinner spinner-dark"></span> 불러오는 중...</td></tr>`;
      return;
    }
    if (state.status === "error") {
      tbody.innerHTML = `<tr class="table-state"><td colspan="${COLS}">
          목록을 불러오지 못했습니다. 네트워크 상태를 확인하세요.<br />
          <button type="button" class="btn btn-sm btn-outline" data-action="reload">${Icons.get("refresh")}다시 불러오기</button>
        </td></tr>`;
      $("pagination").innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(list.length / PER_PAGE);
    state.page = Math.min(Math.max(1, state.page), Math.max(1, totalPages));
    const start = (state.page - 1) * PER_PAGE;
    const pageItems = list.slice(start, start + PER_PAGE);

    tbody.innerHTML = pageItems.length
      ? pageItems.map((item, i) => rowHtml(item, start + i + 1)).join("")
      : `<tr class="table-state"><td colspan="${COLS}">${emptyMessage()}</td></tr>`;

    UI.pagination($("pagination"), {
      page: state.page,
      totalPages,
      onChange: (p) => {
        state.page = p;
        render();
      },
    });
  }

  function render() {
    const base = scoped();
    const list = visible();
    UI.renderStats($("stats"), Utils.summarize(base), { clickable: true });
    if (statModal) renderStatModal();
    $("totalCount").textContent = state.search.trim()
      ? `검색 ${list.length}건 / 총 ${base.length}건`
      : `총 ${base.length}건`;
    renderTable(list);
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
    renderFilters();
    render();
  }

  function replaceItem(updated) {
    const idx = state.all.findIndex((i) => i.id === updated.id);
    if (idx >= 0) state.all[idx] = updated;
  }

  /* ---------- 목록 버튼: 제출 완료 / 제출 취소 ---------- */
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "reload") return load();

    const item = state.all.find((i) => i.id === btn.closest("tr").dataset.id);
    if (!item) return;
    if (btn.dataset.action === "submit") openSubmitModal(item);
    if (btn.dataset.action === "cancel") cancelSubmission(item, btn);
  });

  function openSubmitModal(item) {
    const m = UI.modal({
      title: "제출 완료 처리",
      content: `
        <dl class="detail-list">
          <div><dt>자료명</dt><dd>${esc(item.title)}</dd></div>
          <div><dt>담당 부서</dt><dd>${esc(item.department)}</dd></div>
          <div><dt>제출 기한</dt><dd>${esc(item.deadline)} ${UI.ddayBadge(item)}</dd></div>
          ${item.requestMemo ? `<div><dt>요청 메모</dt><dd>${esc(item.requestMemo)}</dd></div>` : ""}
          ${(item.attachments || []).length ? `<div><dt>첨부파일</dt><dd>${UI.attachmentList(item)}</dd></div>` : ""}
        </dl>
        <form novalidate>
          <div class="form-alert" role="alert"></div>
          <div class="field">
            <label class="field-label" for="submitter">제출자<span class="required">*</span></label>
            <div class="input-wrap">
              <span class="input-icon">${Icons.get("user")}</span>
              <input class="input" id="submitter" name="submitter" maxlength="20" value="${esc(user.name)}" />
            </div>
            <p class="field-error"></p>
          </div>
          <div class="field">
            <label class="field-label" for="submitMemo">제출 메모</label>
            <textarea class="input textarea" id="submitMemo" name="submitMemo" maxlength="500" rows="3"
              placeholder="누락 사항이나 추가 설명을 입력하세요. (선택)"></textarea>
            <div class="textarea-counter"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-close>취소</button>
            <button type="submit" class="btn btn-primary btn-sm">${Icons.get("check")}제출 확정</button>
          </div>
        </form>`,
    });

    const form = m.el.querySelector("form");
    const submitter = form.elements.submitter;
    const confirmBtn = form.querySelector('button[type="submit"]');
    UI.bindCounter(form.elements.submitMemo, form.querySelector(".textarea-counter"));
    submitter.addEventListener("input", () => UI.setFieldError(submitter, ""));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (confirmBtn.disabled) return;
      if (!submitter.value.trim()) {
        UI.setFieldError(submitter, "제출자를 입력하세요.");
        submitter.focus();
        return;
      }
      UI.setButtonLoading(confirmBtn, true, "저장 중...");
      try {
        const updated = await Store.submit(item.id, {
          submitter: submitter.value,
          submitMemo: form.elements.submitMemo.value,
        });
        replaceItem(updated);
        state.highlightId = updated.id;
        render();
        m.close(true);
        UI.toast(`'${updated.title}' 제출 완료로 표시했습니다.`);
      } catch (err) {
        UI.showFormAlert(form.querySelector(".form-alert"), `${err.message} 다시 시도하세요.`);
        UI.setButtonLoading(confirmBtn, false);
      }
    });
  }

  async function cancelSubmission(item, btn) {
    const ok = await UI.confirm({
      icon: "alert",
      title: "제출을 취소하시겠습니까?",
      message: "미제출로 바뀌고 제출자·제출 메모가 초기화됩니다.",
      cancelText: "닫기",
      okText: "제출 취소",
    });
    if (!ok) return;
    UI.setButtonLoading(btn, true, "취소 중");
    try {
      const updated = await Store.cancelSubmission(item.id);
      replaceItem(updated);
      state.highlightId = updated.id;
      render();
      UI.toast(`'${updated.title}' 제출을 취소했습니다.`);
    } catch (err) {
      UI.setButtonLoading(btn, false);
      UI.toast(`${err.message} 다시 시도하세요.`, "error");
    }
  }

  /* ---------- 요약 카드 클릭 → 조건별 목록 창 ---------- */
  const STAT_VIEWS = {
    done: { title: "제출 완료", filter: Utils.isDone, empty: "제출 완료된 항목이 없습니다." },
    pending: { title: "미제출", filter: (i) => !Utils.isDone(i), empty: "미제출 항목이 없습니다. 모두 제출되었습니다." },
    late: { title: "지연", filter: Utils.isLate, empty: "기한이 지난 미제출 항목이 없습니다." },
  };
  let statModal = null; // { key, modal }

  function filterLabel() {
    const month = state.month ? Utils.monthLabel(state.month) : "전체 월";
    return `${month} · ${state.dept || "전체 부서"} 기준`;
  }

  function statRowHtml(item) {
    const done = Utils.isDone(item);
    return `
      <tr data-id="${item.id}">
        <td class="cell-left cell-strong">${esc(item.title)}${UI.attachmentBadge(item)}</td>
        <td>${esc(item.department)}</td>
        <td>${esc(item.deadline)}</td>
        <td>${UI.ddayBadge(item)}</td>
        <td>${done ? esc(item.submitter || "-") : UI.statusBadge(item)}</td>
        <td>${
          done
            ? '<button type="button" class="btn btn-xs btn-outline" data-action="cancel">제출 취소</button>'
            : '<button type="button" class="btn btn-xs btn-primary" data-action="submit">제출 완료</button>'
        }</td>
      </tr>`;
  }

  function renderStatModal() {
    const view = STAT_VIEWS[statModal.key];
    const list = scoped().filter(view.filter).sort(Utils.byDeadline);
    const body = statModal.modal.body;
    body.querySelector(".stat-modal-count").textContent = `${list.length}건`;
    body.querySelector(".stat-modal-filter").textContent = filterLabel();
    body.querySelector("tbody").innerHTML = list.length
      ? list.map(statRowHtml).join("")
      : `<tr class="table-state"><td colspan="6">${view.empty}</td></tr>`;
  }

  function openStatModal(key) {
    const view = STAT_VIEWS[key];
    const modal = UI.modal({
      title: `${view.title} 목록`,
      size: "lg",
      className: `stat-modal stat-modal-${key}`,
      content: `
        <p class="stat-modal-summary"><strong class="stat-modal-count"></strong><span class="stat-modal-filter"></span></p>
        <div class="table-wrap stat-modal-table">
          <table class="table">
            <thead>
              <tr>
                <th>자료명</th><th>담당 부서</th><th>제출 기한</th><th>D-day</th>
                <th>${key === "done" ? "제출자" : "제출 상태"}</th><th>작업</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`,
      onClose: () => (statModal = null),
    });
    statModal = { key, modal };
    renderStatModal();

    // 창 안에서도 바로 제출 완료 / 제출 취소 (처리 후 창 목록이 자동 갱신됨)
    modal.body.querySelector("tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const item = state.all.find((i) => i.id === btn.closest("tr").dataset.id);
      if (!item) return;
      if (btn.dataset.action === "submit") openSubmitModal(item);
      if (btn.dataset.action === "cancel") cancelSubmission(item, btn);
    });
  }

  $("stats").addEventListener("click", (e) => {
    const card = e.target.closest("[data-stat]");
    if (card) openStatModal(card.dataset.stat);
  });

  load();
})();
