/**
 * 인증 서비스 — 서버 API(/api/auth) 사용
 * 로그인 상태(토큰·사용자 정보)는 sessionStorage에 보관합니다. 탭을 닫으면 로그아웃됩니다.
 */
const Auth = (() => {
  const SESSION_KEY = Api.SESSION_KEY;
  const ROLES = ["재무 담당자", "부서 담당자", "팀장"];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;
  const PASSWORD_HINT = "8자 이상, 영문·숫자·특수문자를 포함하여 입력해주세요.";

  let resetToken = null; // 비밀번호 찾기: 인증번호 확인 후 받은 1회용 토큰

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function saveSession(token, user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, loggedInAt: new Date().toISOString() }));
  }

  function currentUser() {
    const s = getSession();
    return s && s.token ? s.user : null;
  }

  /** 로그인이 필요한 화면에서 호출. 로그인 전이면 로그인 화면으로 보냄 */
  function requireAuth() {
    const user = currentUser();
    if (!user) {
      location.replace("login.html");
      return null;
    }
    return user;
  }

  /* ---------- 로그인 / 로그아웃 ---------- */
  async function login(email, password) {
    const { token, user } = await Api.request("auth?action=login", {
      method: "POST",
      body: { email: email.trim(), password },
      auth: false,
    });
    saveSession(token, user);
    return user;
  }

  async function logout() {
    try {
      await Api.request("auth?action=logout", { method: "POST" });
    } catch {
      /* 서버 세션 삭제에 실패해도 이 기기에서는 로그아웃 */
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ---------- 회원가입 ---------- */
  async function signup({ name, email, department, password }) {
    const { user } = await Api.request("auth?action=signup", {
      method: "POST",
      body: { name, email, department, password },
      auth: false,
    });
    return user;
  }

  /* ---------- 비밀번호 찾기 ---------- */
  async function requestResetCode(name, email) {
    const { expiresAt, demoCode, delivery } = await Api.request("auth?action=reset-request", {
      method: "POST",
      body: { name, email },
      auth: false,
    });
    return { code: demoCode, delivery, expiresAt: new Date(expiresAt).getTime() };
  }

  async function verifyResetCode(email, code) {
    const data = await Api.request("auth?action=reset-verify", {
      method: "POST",
      body: { email, code },
      auth: false,
    });
    resetToken = data.resetToken;
  }

  async function resetPassword(email, newPassword) {
    await Api.request("auth?action=reset-confirm", {
      method: "POST",
      body: { email, resetToken, newPassword },
      auth: false,
    });
    resetToken = null;
  }

  /* ---------- 내 정보 ---------- */
  async function changePassword(newPassword) {
    await Api.request("auth?action=password", { method: "POST", body: { newPassword } });
  }

  async function updateProfile(patch) {
    const { user } = await Api.request("auth?action=profile", { method: "PATCH", body: patch });
    saveSession(getSession().token, user);
    return user;
  }

  return {
    ROLES,
    EMAIL_PATTERN,
    PASSWORD_PATTERN,
    PASSWORD_HINT,
    login,
    logout,
    getSession,
    currentUser,
    requireAuth,
    signup,
    requestResetCode,
    verifyResetCode,
    resetPassword,
    changePassword,
    updateProfile,
  };
})();
