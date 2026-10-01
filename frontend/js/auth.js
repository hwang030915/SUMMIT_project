/**
 * 인증 서비스 (임시 목업)
 *
 * 백엔드가 준비되기 전까지 브라우저 안에서만 동작하는 가짜 인증입니다.
 * 계정은 localStorage, 로그인 상태는 sessionStorage(탭을 닫으면 로그아웃)에 저장합니다.
 * 백엔드 연결 시 각 함수 내부만 실제 API 호출로 교체하면 화면 코드는 수정하지 않아도 됩니다.
 */
const Auth = (() => {
  const SESSION_KEY = "gyeolsan.session";
  const USERS_KEY = "gyeolsan.users";
  const RESET_KEY = "gyeolsan.reset";
  const RESET_TTL_MS = 3 * 60 * 1000;

  const ROLES = ["재무 담당자", "부서 담당자", "팀장"];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;
  const PASSWORD_HINT = "8자 이상, 영문·숫자·특수문자를 포함하여 입력해주세요.";

  // 시연용 가상 계정 (실제 회사 정보 아님)
  const SEED_USERS = [
    { name: "김재무", email: "finance@gyeolsan.com", password: "1234", department: "재무팀", role: "재무 담당자" },
    { name: "이구매", email: "buy@gyeolsan.com", password: "1234", department: "구매팀", role: "부서 담당자" },
    { name: "박팀장", email: "leader@gyeolsan.com", password: "1234", department: "재무팀", role: "팀장" },
  ];

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeEmail = (email) => (email || "").trim().toLowerCase();

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* 손상 시 초기화 */
    }
    saveUsers(SEED_USERS);
    return [...SEED_USERS];
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function toProfile(user) {
    const { password: _omit, ...profile } = user;
    return profile;
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: toProfile(user), loggedInAt: new Date().toISOString() }));
  }

  /* ---------- 로그인 / 로그아웃 ---------- */
  async function login(email, password) {
    await delay(600);
    const user = loadUsers().find((u) => u.email === normalizeEmail(email));
    if (!user || user.password !== password) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    setSession(user);
    return toProfile(user);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function currentUser() {
    const session = getSession();
    return session ? session.user : null;
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

  /* ---------- 회원가입 ---------- */
  async function signup({ name, email, department, password }) {
    await delay(600);
    const users = loadUsers();
    const normalized = normalizeEmail(email);
    if (users.some((u) => u.email === normalized)) {
      throw new Error("이미 가입된 이메일입니다.");
    }
    const dept = department.trim();
    const user = {
      name: name.trim(),
      email: normalized,
      password,
      department: dept,
      role: dept === "재무팀" ? "재무 담당자" : "부서 담당자",
    };
    users.push(user);
    saveUsers(users);
    return toProfile(user);
  }

  /* ---------- 비밀번호 찾기 ---------- */
  async function requestResetCode(name, email) {
    await delay(700);
    const user = loadUsers().find((u) => u.email === normalizeEmail(email) && u.name === name.trim());
    if (!user) throw new Error("입력하신 이름과 이메일로 가입된 계정이 없습니다.");

    // 실제로는 서버가 메일로 발송. 목업에서는 화면에 데모 코드를 보여줍니다.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem(
      RESET_KEY,
      JSON.stringify({ email: user.email, code, expiresAt: Date.now() + RESET_TTL_MS, verified: false })
    );
    return { code, expiresAt: Date.now() + RESET_TTL_MS };
  }

  function readReset() {
    try {
      return JSON.parse(sessionStorage.getItem(RESET_KEY));
    } catch {
      return null;
    }
  }

  async function verifyResetCode(email, code) {
    await delay(500);
    const reset = readReset();
    if (!reset || reset.email !== normalizeEmail(email)) throw new Error("인증번호를 먼저 받아주세요.");
    if (Date.now() > reset.expiresAt) throw new Error("인증번호가 만료되었습니다. 다시 받아주세요.");
    if (reset.code !== code.trim()) throw new Error("인증번호가 일치하지 않습니다.");
    reset.verified = true;
    sessionStorage.setItem(RESET_KEY, JSON.stringify(reset));
  }

  async function resetPassword(email, newPassword) {
    await delay(600);
    const reset = readReset();
    if (!reset || !reset.verified || reset.email !== normalizeEmail(email)) {
      throw new Error("인증이 완료되지 않았습니다. 처음부터 다시 진행해주세요.");
    }
    updateUser(reset.email, { password: newPassword });
    sessionStorage.removeItem(RESET_KEY);
  }

  /* ---------- 내 정보 ---------- */
  function updateUser(email, patch) {
    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    if (!user) throw new Error("계정을 찾을 수 없습니다.");
    Object.assign(user, patch);
    saveUsers(users);
    return user;
  }

  async function changePassword(newPassword) {
    await delay(600);
    const me = currentUser();
    if (!me) throw new Error("로그인이 필요합니다.");
    updateUser(me.email, { password: newPassword });
  }

  async function updateProfile(patch) {
    await delay(400);
    const me = currentUser();
    if (!me) throw new Error("로그인이 필요합니다.");
    const user = updateUser(me.email, patch);
    setSession(user);
    return toProfile(user);
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
