/* 12. 회원가입 */
(() => {
  Icons.hydrate();

  const $ = (id) => document.getElementById(id);
  const form = $("signupForm");
  const fields = {
    name: $("name"),
    email: $("email"),
    department: $("department"),
    password: $("password"),
    passwordConfirm: $("passwordConfirm"),
    agree: $("agree"),
  };
  const formAlert = $("formAlert");
  const signupBtn = $("signupBtn");

  // 부서 자동완성: 재무팀 + 결산 대상 부서
  $("departmentList").innerHTML = ["재무팀", ...Store.DEPARTMENTS].map((d) => `<option value="${d}"></option>`).join("");

  UI.bindPasswordToggle($("togglePassword"), fields.password);
  UI.bindPasswordToggle($("togglePasswordConfirm"), fields.passwordConfirm);

  Object.values(fields).forEach((input) => {
    const evt = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(evt, () => UI.setFieldError(input, ""));
  });

  // 비밀번호 칸을 벗어날 때 규칙 안내
  fields.password.addEventListener("blur", () => {
    if (fields.password.value && !Auth.PASSWORD_PATTERN.test(fields.password.value)) {
      UI.setFieldError(fields.password, Auth.PASSWORD_HINT);
    }
  });

  function validate() {
    const rules = [
      [fields.name, () => (!fields.name.value.trim() ? "이름을 입력하세요." : "")],
      [
        fields.email,
        () => {
          const v = fields.email.value.trim();
          if (!v) return "이메일을 입력하세요.";
          if (!Auth.EMAIL_PATTERN.test(v)) return "올바른 이메일 형식이 아닙니다.";
          return "";
        },
      ],
      [fields.department, () => (!fields.department.value.trim() ? "소속 부서를 입력하세요." : "")],
      [
        fields.password,
        () => {
          if (!fields.password.value) return "비밀번호를 입력하세요.";
          if (!Auth.PASSWORD_PATTERN.test(fields.password.value)) return Auth.PASSWORD_HINT;
          return "";
        },
      ],
      [
        fields.passwordConfirm,
        () => {
          if (!fields.passwordConfirm.value) return "비밀번호를 한 번 더 입력하세요.";
          if (fields.passwordConfirm.value !== fields.password.value) return "비밀번호가 일치하지 않습니다.";
          return "";
        },
      ],
      [fields.agree, () => (!fields.agree.checked ? "이용약관 및 개인정보 수집·이용에 동의해주세요." : "")],
    ];

    let first = null;
    rules.forEach(([input, check]) => {
      const msg = check();
      UI.setFieldError(input, msg);
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.showFormAlert(formAlert, "");
    if (!validate()) return;

    UI.setButtonLoading(signupBtn, true, "가입 중...");
    try {
      const user = await Auth.signup({
        name: fields.name.value,
        email: fields.email.value,
        department: fields.department.value,
        password: fields.password.value,
      });
      location.href = `login.html?msg=signup&email=${encodeURIComponent(user.email)}`;
    } catch (err) {
      UI.showFormAlert(formAlert, err.message || "회원가입에 실패했습니다. 잠시 후 다시 시도하세요.");
      UI.setButtonLoading(signupBtn, false);
      if (/이메일/.test(err.message)) {
        UI.setFieldError(fields.email, err.message);
        fields.email.focus();
      }
    }
  });

  /* ---------- 약관 보기 ---------- */
  const TERMS = {
    terms: {
      title: "이용약관",
      body: `<h3>제1조 (목적)</h3><p>본 약관은 SUMMIT 서비스 이용에 필요한 사항을 정합니다.</p>
             <h3>제2조 (서비스 내용)</h3><p>결산 자료의 요청 등록, 제출 상태 표시, 현황 조회 기능을 제공합니다. 실제 파일 제출은 기존 메일·ERP로 진행합니다.</p>
             <h3>제3조 (이용자의 의무)</h3><p>이용자는 사실에 맞게 제출 상태를 표시해야 하며, 실제 회사 기밀 정보를 입력하지 않습니다.</p>`,
    },
    privacy: {
      title: "개인정보 수집·이용",
      body: `<h3>수집 항목</h3><p>이름, 이메일, 소속 부서, 비밀번호</p>
             <h3>이용 목적</h3><p>로그인, 제출자 표시, 비밀번호 재설정 안내</p>
             <h3>보관 기간</h3><p>회원 탈퇴 시까지</p>`,
    },
  };

  function openTerms(key) {
    const t = TERMS[key];
    const m = UI.modal({
      title: t.title,
      content: `<div class="terms-body">${t.body}</div>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-agree>동의</button></div>`,
    });
    m.el.querySelector("[data-agree]").addEventListener("click", () => {
      fields.agree.checked = true;
      UI.setFieldError(fields.agree, "");
      m.close(true);
    });
  }

  $("termsLink").addEventListener("click", (e) => {
    e.preventDefault();
    openTerms("terms");
  });
  $("privacyLink").addEventListener("click", (e) => {
    e.preventDefault();
    openTerms("privacy");
  });
})();
