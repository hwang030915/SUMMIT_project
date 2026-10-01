/**
 * 다크 모드 / 일반 모드 전환
 * - <head>에서 바로 실행해 화면이 깜빡이지 않게 테마를 먼저 적용합니다.
 * - 저장된 선택이 없으면 운영체제 설정(다크/라이트)을 따릅니다.
 * - [data-theme-toggle] 버튼을 누르면 전환됩니다. 버튼이 없는 화면(로그인 등)은 오른쪽 위에 떠 있는 버튼을 만듭니다.
 */
const Theme = (() => {
  const KEY = "gyeolsan.theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>';
  const MOON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z"/></svg>';

  function saved() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function current() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function renderButtons() {
    const dark = current() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      // 지금 모드의 반대 아이콘을 보여줌 (누르면 그 모드로 바뀜)
      btn.innerHTML = dark ? SUN : MOON;
      btn.setAttribute("aria-label", dark ? "일반 모드로 전환" : "다크 모드로 전환");
      btn.title = dark ? "일반 모드로 전환" : "다크 모드로 전환";
      btn.setAttribute("aria-pressed", String(dark));
    });
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    renderButtons();
  }

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 저장 불가 환경에서도 전환은 동작 */
    }
    apply(next);
  }

  // 1) 즉시 적용 (깜빡임 방지)
  apply(saved() || (media.matches ? "dark" : "light"));

  // 2) 사용자가 직접 고른 적 없으면 OS 설정 변경을 따라감
  media.addEventListener("change", (e) => {
    if (!saved()) apply(e.matches ? "dark" : "light");
  });

  // 3) 버튼 클릭 (나중에 그려지는 버튼도 동작하도록 위임)
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-theme-toggle]")) toggle();
  });

  // 4) 페이지에 버튼이 없으면 떠 있는 버튼 추가
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-theme-toggle]")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle theme-toggle-floating";
      btn.setAttribute("data-theme-toggle", "");
      document.body.appendChild(btn);
    }
    renderButtons();
  });

  return { toggle, current, renderButtons };
})();
