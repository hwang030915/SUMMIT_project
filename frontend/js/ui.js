/**
 * 화면 공통 UI: 모달, 확인창, 토스트, 배너, 페이지네이션, 통계 카드, 폼 도우미
 */
const UI = (() => {
  const esc = Utils.escapeHtml;
  let stack = [];

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stack.length) stack[stack.length - 1].close(false);
  });

  /* ---------- 모달 ---------- */
  function modal({ title = "", content = "", size = "md", className = "", onClose } = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.style.zIndex = String(1000 + stack.length * 10);
    const titleId = `modal-title-${Date.now()}`;
    backdrop.innerHTML = `
      <div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${titleId}"` : ""}>
        ${
          title
            ? `<div class="modal-header"><h2 class="modal-title" id="${titleId}">${esc(title)}</h2>
               <button type="button" class="modal-close" data-close aria-label="닫기">${Icons.get("x")}</button></div>`
            : `<button type="button" class="modal-close modal-close-floating" data-close aria-label="닫기">${Icons.get("x")}</button>`
        }
        <div class="modal-body"></div>
      </div>`;

    const body = backdrop.querySelector(".modal-body");
    if (typeof content === "string") body.innerHTML = content;
    else if (content) body.appendChild(content);
    Icons.hydrate(backdrop);

    const prevFocus = document.activeElement;
    const instance = { el: backdrop, body, close };

    function close(result) {
      if (!stack.includes(instance)) return;
      stack = stack.filter((m) => m !== instance);
      backdrop.classList.remove("is-open");
      setTimeout(() => backdrop.remove(), 150);
      if (!stack.length) document.body.classList.remove("modal-open");
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (onClose) onClose(result);
    }

    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) close(false);
    });
    backdrop.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => close(false)));

    document.body.appendChild(backdrop);
    document.body.classList.add("modal-open");
    stack.push(instance);
    requestAnimationFrame(() => backdrop.classList.add("is-open"));
    setTimeout(() => {
      const target =
        backdrop.querySelector("[autofocus]") ||
        backdrop.querySelector(".modal-body input:not([disabled]):not([readonly]), .modal-body textarea:not([disabled])") ||
        backdrop.querySelector(".modal-close");
      if (target) target.focus();
    }, 30);
    return instance;
  }

  /** 확인창. 확인을 누르면 true */
  function confirm({ icon = "alert", title, message = "", cancelText = "취소", okText = "확인" }) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const m = modal({
        size: "sm",
        className: "dialog",
        content: `
          <div class="dialog-icon"><span data-icon="${icon}"></span></div>
          <h2 class="dialog-title">${esc(title)}</h2>
          ${message ? `<p class="dialog-message">${esc(message)}</p>` : ""}
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-cancel>${esc(cancelText)}</button>
            <button type="button" class="btn btn-primary" data-ok autofocus>${esc(okText)}</button>
          </div>`,
        onClose: () => finish(false),
      });
      m.el.querySelector("[data-cancel]").addEventListener("click", () => m.close(false));
      m.el.querySelector("[data-ok]").addEventListener("click", () => {
        finish(true);
        m.close(true);
      });
    });
  }

  /* ---------- 토스트 ---------- */
  function toast(message, type = "success") {
    let stackEl = document.querySelector(".toast-stack");
    if (!stackEl) {
      stackEl = document.createElement("div");
      stackEl.className = "toast-stack";
      stackEl.setAttribute("role", "status");
      stackEl.setAttribute("aria-live", "polite");
      document.body.appendChild(stackEl);
    }
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "is-error" : ""}`;
    el.innerHTML = `<span class="icon">${Icons.get(type === "error" ? "alert" : "checkCircle")}</span><span>${esc(message)}</span>`;
    stackEl.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ---------- 성공 배너 (7.요청 등록) ---------- */
  function banner(container, { title, message, tone = "success" }) {
    container.innerHTML = `
      <div class="banner banner-${tone}" role="status">
        <span class="banner-icon">${Icons.get(tone === "success" ? "check" : "alert")}</span>
        <div class="banner-text">
          <p class="banner-title">${esc(title)}</p>
          <p class="banner-message">${esc(message)}</p>
        </div>
        <button type="button" class="banner-close" aria-label="알림 닫기">${Icons.get("x")}</button>
      </div>`;
    const el = container.firstElementChild;
    el.querySelector(".banner-close").addEventListener("click", () => el.remove());
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
    clearTimeout(container._bannerTimer);
    container._bannerTimer = setTimeout(() => el.remove(), 8000);
  }

  /* ---------- 페이지네이션 ---------- */
  function pagination(container, { page, totalPages, onChange }) {
    if (totalPages <= 0) {
      container.innerHTML = "";
      return;
    }
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    container.innerHTML = `
      <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="이전 페이지">${Icons.get("chevronLeft")}</button>
      ${pages
        .map(
          (p) =>
            `<button type="button" class="page-btn ${p === page ? "is-active" : ""}" data-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
        )
        .join("")}
      <button type="button" class="page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="다음 페이지">${Icons.get("chevronRight")}</button>`;
    container.onclick = (e) => {
      const btn = e.target.closest("[data-page]");
      if (!btn || btn.disabled) return;
      onChange(Number(btn.dataset.page));
    };
  }

  /* ---------- 통계 카드 ---------- */
  function renderStats(container, s, { progressTitle = "전체 진행률", clickable = false } = {}) {
    // clickable이면 완료·미제출·지연 카드를 버튼으로 만들어 data-stat 값으로 구분
    const card = (key, cls, inner, label) =>
      clickable
        ? `<button type="button" class="stat-card is-clickable ${cls}" data-stat="${key}" aria-label="${label} 목록 보기">${inner}<span class="stat-more">${Icons.get("chevronRight")}</span></button>`
        : `<div class="stat-card ${cls}">${inner}</div>`;
    container.innerHTML = `
      <div class="stat-card stat-card-progress">
        <div class="donut" style="--p:${s.progress}" role="img" aria-label="진행률 ${s.progress}%"><span>${s.progress}%</span></div>
        <div>
          <p class="stat-title">${esc(progressTitle)}</p>
          <p class="stat-sub"><span class="nowrap">제출 ${s.done}건 /</span> <span class="nowrap">전체 ${s.total}건</span></p>
        </div>
      </div>
      ${card(
        "done",
        "stat-card-done",
        `<span class="stat-icon stat-icon-success">${Icons.get("check")}</span>
         <div><p class="stat-label">제출 완료</p><p class="stat-value">${s.done}건</p><p class="stat-pct">${s.progress}%</p></div>`,
        "제출 완료"
      )}
      ${card(
        "pending",
        "",
        `<span class="stat-icon stat-icon-neutral">${Icons.get("fileFill")}</span>
         <div><p class="stat-label">미제출</p><p class="stat-value">${s.pending}건</p><p class="stat-pct">${s.pendingPct}%</p></div>`,
        "미제출"
      )}
      ${card(
        "late",
        "",
        `<span class="stat-icon stat-icon-danger">${Icons.get("alarm")}</span>
         <div><p class="stat-label">지연 건수</p><p class="stat-value is-danger">${s.late}건</p><p class="stat-pct">${s.latePct}%</p></div>`,
        "지연"
      )}`;
  }

  /* ---------- 배지 ---------- */
  function ddayBadge(item) {
    return `<span class="badge badge-${Utils.ddayTone(item)}">${Utils.ddayLabel(Utils.dday(item.deadline))}</span>`;
  }

  function statusBadge(item) {
    return Utils.isDone(item)
      ? '<span class="badge badge-success">제출 완료</span>'
      : '<span class="badge badge-pink">미제출</span>';
  }

  /* ---------- 첨부파일 ---------- */
  function attachmentBadge(item) {
    const files = item.attachments || [];
    if (!files.length) return "";
    const names = files.map((f) => f.name).join(", ");
    return `<span class="attach-badge" title="첨부: ${esc(names)}">${Icons.get("paperclip")}${files.length}</span>`;
  }

  /** 내용이 저장된 파일은 다운로드 링크, 큰 파일은 이름만 표시 */
  function attachmentList(item) {
    const files = item.attachments || [];
    if (!files.length) return '<span class="muted">없음</span>';
    return `<ul class="attach-list">${files
      .map((f) => {
        const label = `<span class="attach-name">${esc(f.name)}</span><span class="attach-size">${Utils.formatBytes(f.size)}</span>`;
        return f.dataUrl
          ? `<li><a class="attach-link" href="${esc(f.dataUrl)}" download="${esc(f.name)}" title="다운로드">${Icons.get(
              "paperclip"
            )}${label}${Icons.get("download")}</a></li>`
          : `<li><span class="attach-link is-disabled" title="큰 파일은 백엔드 연결 후 다운로드할 수 있습니다.">${Icons.get(
              "paperclip"
            )}${label}</span></li>`;
      })
      .join("")}</ul>`;
  }

  /* ---------- 폼 도우미 ---------- */
  function setFieldError(input, message) {
    const field = input.closest(".field");
    const errorEl = field && field.querySelector(".field-error");
    if (errorEl) errorEl.textContent = message || "";
    input.classList.toggle("is-invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function showFormAlert(el, message, type = "error") {
    el.textContent = message || "";
    el.classList.toggle("is-visible", Boolean(message));
    el.classList.toggle("is-success", type === "success");
  }

  function setButtonLoading(btn, loading, loadingText = "처리 중...") {
    if (loading) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(loadingText)}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  /** 비밀번호 보기/숨기기 (숨김 상태에서는 사선 눈 아이콘) */
  function bindPasswordToggle(button, input) {
    const render = () => {
      const shown = input.type === "text";
      button.innerHTML = Icons.get(shown ? "eye" : "eyeOff");
      button.setAttribute("aria-label", shown ? "비밀번호 숨기기" : "비밀번호 보기");
      button.setAttribute("aria-pressed", String(shown));
    };
    button.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      render();
      input.focus();
    });
    render();
  }

  function bindCounter(textarea, counterEl) {
    const update = () => (counterEl.textContent = `${textarea.value.length} / ${textarea.maxLength}`);
    textarea.addEventListener("input", update);
    update();
    return update;
  }

  function monthOptionsHtml(months, selected, { includeAll = false } = {}) {
    return (
      (includeAll ? `<option value="" ${selected === "" ? "selected" : ""}>전체 월</option>` : "") +
      months
        .map((m) => `<option value="${m}" ${m === selected ? "selected" : ""}>${Utils.monthLabel(m)}</option>`)
        .join("")
    );
  }

  return {
    modal,
    confirm,
    toast,
    banner,
    pagination,
    renderStats,
    ddayBadge,
    statusBadge,
    attachmentBadge,
    attachmentList,
    setFieldError,
    showFormAlert,
    setButtonLoading,
    bindPasswordToggle,
    bindCounter,
    monthOptionsHtml,
  };
})();
