/* 1. 로그인 */
(() => {
  const MAIN_PAGE = "main.html";
  const MESSAGES = {
    signup: "회원가입이 완료되었습니다. 가입한 계정으로 로그인하세요.",
    reset: "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인하세요.",
    logout: "로그아웃되었습니다.",
  };

  // 이미 로그인한 상태면 메인 화면으로 이동
  if (Auth.currentUser()) {
    location.replace(MAIN_PAGE);
    return;
  }

  Icons.hydrate();

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const formAlert = document.getElementById("formAlert");
  const loginBtn = document.getElementById("loginBtn");

  UI.bindPasswordToggle(document.getElementById("togglePassword"), passwordInput);

  // 회원가입·비밀번호 재설정·로그아웃 후 돌아왔을 때 안내
  const msg = MESSAGES[Utils.query("msg")];
  if (msg) UI.showFormAlert(formAlert, msg, "success");
  const presetEmail = Utils.query("email");
  if (presetEmail) {
    emailInput.value = presetEmail;
    passwordInput.focus();
  }

  function validate() {
    const email = emailInput.value.trim();
    let firstInvalid = null;

    if (!email) {
      UI.setFieldError(emailInput, "이메일을 입력하세요.");
      firstInvalid = emailInput;
    } else if (!Auth.EMAIL_PATTERN.test(email)) {
      UI.setFieldError(emailInput, "올바른 이메일 형식이 아닙니다.");
      firstInvalid = emailInput;
    } else {
      UI.setFieldError(emailInput, "");
    }

    if (!passwordInput.value.trim()) {
      UI.setFieldError(passwordInput, "비밀번호를 입력하세요.");
      firstInvalid = firstInvalid || passwordInput;
    } else {
      UI.setFieldError(passwordInput, "");
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  [emailInput, passwordInput].forEach((input) => input.addEventListener("input", () => UI.setFieldError(input, "")));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    UI.showFormAlert(formAlert, "");
    if (!validate()) return;

    UI.setButtonLoading(loginBtn, true, "로그인 중...");
    try {
      await Auth.login(emailInput.value, passwordInput.value);
      location.href = MAIN_PAGE;
    } catch (err) {
      // 실패 시 입력값은 유지하고 오류만 안내
      UI.showFormAlert(formAlert, err.message || "로그인에 실패했습니다. 잠시 후 다시 시도하세요.");
      UI.setButtonLoading(loginBtn, false);
      passwordInput.focus();
      passwordInput.select();
    }
  });
})();
