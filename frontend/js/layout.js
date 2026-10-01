/**
 * 로그인 후 화면 공통 레이아웃
 * - 사이드바 메뉴, 상단 제목·날짜·사용자
 * - 5.계정 메뉴 / 6.내 정보 / 9.비밀번호 변경 / 10.로그아웃
 */
const Layout = (() => {
  const esc = Utils.escapeHtml;
  const NAV = [
    { key: "dashboard", href: "main.html", label: "결산 현황", icon: "chart" },
    { key: "request", href: "request.html", label: "결산 요청 등록", icon: "plusCircle" },
    { key: "submit", href: "submit.html", label: "제출 체크", icon: "checkSquare" },
  ];

  let user = null;
  let menu, userButton;

  function mount({ active, title, subtitle }) {
    user = Auth.requireAuth();
    if (!user) return null;

    document.getElementById("sidebar").innerHTML = `
      <a class="sidebar-logo" href="main.html">
        <span class="logo-mark">${Icons.get("check")}</span><span class="logo-text">결산체크</span>
      </a>
      <nav class="sidebar-nav" aria-label="주 메뉴">
        ${NAV.map(
          (n) => `<a class="nav-item ${n.key === active ? "is-active" : ""}" href="${n.href}" ${n.key === active ? 'aria-current="page"' : ""}>
              <span class="nav-icon">${Icons.get(n.icon)}</span><span>${n.label}</span></a>`
        ).join("")}
      </nav>
      <div class="sidebar-user">
        <div class="user-menu" id="userMenu" role="menu" hidden>
          <div class="user-menu-head">
            <span class="avatar avatar-lg">${Icons.get("userFill")}</span>
            <div><p class="user-menu-name" data-user-name></p><p class="user-menu-meta" data-user-meta></p></div>
          </div>
          <button type="button" class="user-menu-item" role="menuitem" data-action="profile">${Icons.get("user")}<span>내 정보</span></button>
          <button type="button" class="user-menu-item" role="menuitem" data-action="role">${Icons.get("swap")}<span>역할 변경</span></button>
          <button type="button" class="user-menu-item" role="menuitem" data-action="help">${Icons.get("help")}<span>도움말</span></button>
          <div class="user-menu-sep"></div>
          <button type="button" class="user-menu-item is-danger" role="menuitem" data-action="logout">${Icons.get("logout")}<span>로그아웃</span></button>
        </div>
        <button type="button" class="user-button" id="userButton" aria-haspopup="menu" aria-expanded="false" aria-controls="userMenu">
          <span class="avatar">${Icons.get("userFill")}</span>
          <span class="user-button-name" data-user-name></span>
          <span class="user-button-chevron">${Icons.get("chevronRight")}</span>
        </button>
      </div>`;

    document.getElementById("pageHeader").innerHTML = `
      <div>
        <h1 class="page-title">${esc(title)}</h1>
        <p class="page-subtitle">${esc(subtitle)}</p>
      </div>
      <div class="page-header-right">
        <span class="today">${Icons.get("calendar")}<span>${Utils.formatKoreanDate(Utils.todayKST())}</span></span>
        <button type="button" class="theme-toggle" data-theme-toggle></button>
        <button type="button" class="user-chip" id="headerUser" title="내 정보">
          <span class="avatar">${Icons.get("userFill")}</span><span data-user-name></span>
        </button>
      </div>`;

    menu = document.getElementById("userMenu");
    userButton = document.getElementById("userButton");
    renderUser();
    bindMenu();
    document.getElementById("headerUser").addEventListener("click", openProfile);
    return user;
  }

  function renderUser() {
    document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = user.name));
    document.querySelectorAll("[data-user-meta]").forEach((el) => (el.textContent = `${user.department} · ${user.role}`));
  }

  const getUser = () => user;

  /* ---------- 5. 계정 메뉴 ---------- */
  function setMenu(open) {
    menu.hidden = !open;
    userButton.setAttribute("aria-expanded", String(open));
    userButton.classList.toggle("is-open", open);
    if (open) menu.querySelector(".user-menu-item").focus();
  }

  function bindMenu() {
    userButton.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenu(menu.hidden);
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !menu.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        setMenu(false);
        userButton.focus();
      }
    });
    menu.addEventListener("click", (e) => {
      const item = e.target.closest("[data-action]");
      if (!item) return;
      setMenu(false);
      ({ profile: openProfile, role: openRoleChange, help: openHelp, logout: confirmLogout })[item.dataset.action]();
    });
  }

  /* ---------- 6. 내 정보 + 9. 비밀번호 변경 ---------- */
  function openProfile() {
    const m = UI.modal({
      title: "내 정보",
      content: `
        <div class="info-card">
          <span class="info-icon">${Icons.get("userFill")}</span>
          <div class="info-body"><p class="info-label">이름</p><p class="info-value">${esc(user.name)}</p></div>
        </div>
        <div class="info-card">
          <span class="info-icon">${Icons.get("mail")}</span>
          <div class="info-body"><p class="info-label">이메일</p><p class="info-value">${esc(user.email)}</p></div>
        </div>
        <div class="info-card info-card-column">
          <button type="button" class="info-toggle" aria-expanded="false" aria-controls="pwForm">
            <span class="info-icon info-icon-plain">${Icons.get("lock")}</span>
            <span class="info-toggle-label">비밀번호 변경</span>
            <span class="info-chevron">${Icons.get("chevronRight")}</span>
          </button>
          <form class="pw-form" id="pwForm" novalidate hidden>
            <div class="field">
              <label class="field-label" for="newPassword">새 비밀번호<span class="required">*</span></label>
              <div class="input-wrap">
                <input class="input has-trailing" type="password" id="newPassword" autocomplete="new-password" placeholder="새 비밀번호를 입력하세요." />
                <button type="button" class="icon-btn" data-toggle-pw></button>
              </div>
              <p class="field-hint">${esc(Auth.PASSWORD_HINT)}</p>
              <p class="field-error"></p>
            </div>
            <div class="pw-actions"><button type="submit" class="btn btn-primary btn-sm">확인</button></div>
          </form>
        </div>`,
    });

    const toggle = m.el.querySelector(".info-toggle");
    const form = m.el.querySelector(".pw-form");
    const input = form.querySelector("#newPassword");
    const submitBtn = form.querySelector('button[type="submit"]');
    UI.bindPasswordToggle(form.querySelector("[data-toggle-pw]"), input);
    input.addEventListener("input", () => UI.setFieldError(input, ""));

    toggle.addEventListener("click", () => {
      const open = form.hidden;
      form.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.classList.toggle("is-open", open);
      if (open) input.focus();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!Auth.PASSWORD_PATTERN.test(input.value)) {
        UI.setFieldError(input, Auth.PASSWORD_HINT);
        input.focus();
        return;
      }
      const ok = await UI.confirm({
        icon: "alert",
        title: "비밀번호를 변경하시겠습니까?",
        message: "새 비밀번호로 변경됩니다.",
        okText: "변경",
      });
      if (!ok) return;

      UI.setButtonLoading(submitBtn, true, "변경 중...");
      try {
        await Auth.changePassword(input.value);
        UI.toast("비밀번호가 변경되었습니다.");
        input.value = "";
        form.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.classList.remove("is-open");
      } catch (err) {
        UI.setFieldError(input, err.message || "변경에 실패했습니다. 다시 시도하세요.");
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });
  }

  /* ---------- 역할 변경 ---------- */
  function openRoleChange() {
    const DESC = {
      "재무 담당자": "결산 요청을 등록하고 미제출·지연 현황을 확인합니다.",
      "부서 담당자": "우리 부서 자료와 기한을 확인하고 제출 완료를 표시합니다.",
      팀장: "전체 진행률과 지연 건수를 확인합니다.",
    };
    const m = UI.modal({
      title: "역할 변경",
      size: "sm",
      content: `
        <p class="modal-desc">업무상 역할 표시만 바뀌며, 사용할 수 있는 기능은 같습니다.</p>
        <div class="role-list" role="radiogroup">
          ${Auth.ROLES.map(
            (r) => `<label class="role-option">
                <input type="radio" name="role" value="${r}" ${r === user.role ? "checked" : ""} />
                <span><strong>${r}</strong><small>${DESC[r]}</small></span>
              </label>`
          ).join("")}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-close>취소</button>
          <button type="button" class="btn btn-primary btn-sm" data-save>저장</button>
        </div>`,
    });
    const saveBtn = m.el.querySelector("[data-save]");
    saveBtn.addEventListener("click", async () => {
      const role = m.el.querySelector('input[name="role"]:checked').value;
      if (role === user.role) return m.close(false);
      UI.setButtonLoading(saveBtn, true, "저장 중...");
      try {
        user = await Auth.updateProfile({ role });
        renderUser();
        UI.toast(`역할이 '${role}'(으)로 변경되었습니다.`);
        m.close(true);
      } catch (err) {
        UI.toast(err.message, "error");
        UI.setButtonLoading(saveBtn, false);
      }
    });
  }

  /* ---------- 도움말 ---------- */
  function openHelp() {
    UI.modal({
      title: "도움말",
      content: `
        <ol class="help-list">
          <li><strong>결산 요청 등록</strong> 재무 담당자가 결산월·자료명·부서·기한을 입력해 요청을 등록합니다.</li>
          <li><strong>자료 확인</strong> 각 부서는 결산 현황에서 우리 부서 자료와 D-day를 확인합니다.</li>
          <li><strong>제출 체크</strong> 메일·ERP로 자료를 낸 뒤 제출 체크 화면에서 제출 완료를 표시합니다.</li>
          <li><strong>현황 확인</strong> 재무·팀장은 진행률과 지연 건수를 확인합니다. 기한이 지난 미제출 건은 빨간색으로 표시됩니다.</li>
        </ol>
        <p class="modal-desc">다른 사람이 바꾼 내용은 새로고침하면 반영됩니다.</p>`,
    });
  }

  /* ---------- 10. 로그아웃 ---------- */
  async function confirmLogout() {
    const ok = await UI.confirm({
      icon: "logout",
      title: "로그아웃 하시겠습니까?",
      message: "현재 세션이 종료됩니다.",
      okText: "로그아웃",
    });
    if (!ok) return;
    Auth.logout();
    location.replace("login.html?msg=logout");
  }

  return { mount, getUser };
})();
