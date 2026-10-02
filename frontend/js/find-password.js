/* 11. 비밀번호 찾기: 본인 확인(이름·이메일·인증번호) → 새 비밀번호 설정 */
(() => {
  Icons.hydrate();

  const $ = (id) => document.getElementById(id);
  const verifyForm = $("verifyForm");
  const resetForm = $("resetForm");
  const nameInput = $("name");
  const emailInput = $("email");
  const codeInput = $("code");
  const sendCodeBtn = $("sendCodeBtn");
  const codeHint = $("codeHint");
  const verifyAlert = $("verifyAlert");
  const verifyBtn = $("verifyBtn");
  const newPassword = $("newPassword");
  const confirmPassword = $("confirmPassword");
  const resetAlert = $("resetAlert");
  const resetBtn = $("resetBtn");

  const DEFAULT_HINT = codeHint.textContent;
  let codeRequested = false;
  let timer = null;
  let verifiedEmail = "";

  $("passwordHint").textContent = Auth.PASSWORD_HINT;
  UI.bindPasswordToggle($("toggleNew"), newPassword);
  UI.bindPasswordToggle($("toggleConfirm"), confirmPassword);

  [nameInput, emailInput, codeInput, newPassword, confirmPassword].forEach((input) =>
    input.addEventListener("input", () => UI.setFieldError(input, ""))
  );
  codeInput.addEventListener("input", () => (codeInput.value = codeInput.value.replace(/\D/g, "")));

  function validateIdentity() {
    let first = null;
    const fail = (input, msg) => {
      UI.setFieldError(input, msg);
      first = first || input;
    };
    if (!nameInput.value.trim()) fail(nameInput, "이름을 입력하세요.");
    else UI.setFieldError(nameInput, "");

    const email = emailInput.value.trim();
    if (!email) fail(emailInput, "이메일을 입력하세요.");
    else if (!Auth.EMAIL_PATTERN.test(email)) fail(emailInput, "올바른 이메일 형식이 아닙니다.");
    else UI.setFieldError(emailInput, "");

    if (first) first.focus();
    return !first;
  }

  /* ---------- 인증번호 받기 + 3분 타이머 ---------- */
  function startTimer(expiresAt, demoCode, email) {
    clearInterval(timer);
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      const mm = Math.floor(left / 60);
      const ss = String(left % 60).padStart(2, "0");
      if (left === 0) {
        clearInterval(timer);
        codeHint.textContent = "· 인증번호가 만료되었습니다. 다시 받아주세요.";
        return;
      }
      codeHint.textContent = demoCode
        ? `· 메일 발송이 설정되지 않은 시연 모드입니다. 인증번호: ${demoCode} · 남은 시간 ${mm}:${ss}`
        : `· ${email}(으)로 인증번호를 보냈습니다. 메일이 없으면 스팸함을 확인하세요. 남은 시간 ${mm}:${ss}`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  sendCodeBtn.addEventListener("click", async () => {
    UI.showFormAlert(verifyAlert, "");
    if (!validateIdentity()) return;

    UI.setButtonLoading(sendCodeBtn, true, "발송 중...");
    try {
      const { code, expiresAt } = await Auth.requestResetCode(nameInput.value, emailInput.value);
      // 재전송은 60초 뒤부터 (서버 제한과 같게)
      sendCodeBtn.disabled = true;
      setTimeout(() => (sendCodeBtn.disabled = false), 60 * 1000);
      codeRequested = true;
      sendCodeBtn.innerHTML = "재전송";
      startTimer(expiresAt, code, emailInput.value.trim());
      codeInput.focus();
    } catch (err) {
      UI.setButtonLoading(sendCodeBtn, false);
      UI.showFormAlert(verifyAlert, err.message);
    }
  });

  // 이름·이메일을 바꾸면 인증을 다시 받아야 함
  [nameInput, emailInput].forEach((input) =>
    input.addEventListener("input", () => {
      if (!codeRequested) return;
      codeRequested = false;
      clearInterval(timer);
      codeHint.textContent = DEFAULT_HINT;
      sendCodeBtn.textContent = "인증번호 받기";
    })
  );

  /* ---------- 1단계 제출: 인증번호 확인 ---------- */
  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.showFormAlert(verifyAlert, "");
    if (!validateIdentity()) return;

    if (!codeRequested) {
      UI.setFieldError(codeInput, "인증번호 받기를 먼저 눌러주세요.");
      sendCodeBtn.focus();
      return;
    }
    if (!/^\d{6}$/.test(codeInput.value)) {
      UI.setFieldError(codeInput, "인증번호 6자리를 입력하세요.");
      codeInput.focus();
      return;
    }

    UI.setButtonLoading(verifyBtn, true, "확인 중...");
    try {
      await Auth.verifyResetCode(emailInput.value, codeInput.value);
      clearInterval(timer);
      verifiedEmail = emailInput.value.trim();
      showResetStep();
    } catch (err) {
      UI.showFormAlert(verifyAlert, err.message);
      UI.setButtonLoading(verifyBtn, false);
    }
  });

  function showResetStep() {
    verifyForm.hidden = true;
    resetForm.hidden = false;
    $("pageTitle").textContent = "새 비밀번호를 설정하세요.";
    $("pageSubtitle").textContent = "본인 확인이 완료되었습니다. 사용할 새 비밀번호를 입력해주세요.";
    newPassword.focus();
  }

  /* ---------- 2단계 제출: 새 비밀번호 저장 ---------- */
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.showFormAlert(resetAlert, "");
    let first = null;

    if (!Auth.PASSWORD_PATTERN.test(newPassword.value)) {
      UI.setFieldError(newPassword, Auth.PASSWORD_HINT);
      first = newPassword;
    }
    if (!confirmPassword.value) {
      UI.setFieldError(confirmPassword, "새 비밀번호를 한 번 더 입력하세요.");
      first = first || confirmPassword;
    } else if (confirmPassword.value !== newPassword.value) {
      UI.setFieldError(confirmPassword, "비밀번호가 일치하지 않습니다.");
      first = first || confirmPassword;
    }
    if (first) {
      first.focus();
      return;
    }

    UI.setButtonLoading(resetBtn, true, "변경 중...");
    try {
      await Auth.resetPassword(verifiedEmail, newPassword.value);
      location.href = `login.html?msg=reset&email=${encodeURIComponent(verifiedEmail)}`;
    } catch (err) {
      UI.showFormAlert(resetAlert, err.message);
      UI.setButtonLoading(resetBtn, false);
    }
  });
})();
