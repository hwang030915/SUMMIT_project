/**
 * 로그인·회원가입·비밀번호 찾기 화면의 왼쪽 브랜드 영역 (세 화면 공통)
 */
(() => {
  const el = document.getElementById("authBrand");
  if (!el) return;

  // 소개 장면: 약 3초마다 옆으로 살짝 밀리며 겹쳐 바뀜
  const SLIDES = [
    { src: "images/intro-1.webp", alt: "요청은 한 번에 — 필요한 자료를 부서별로 요청하세요" },
    { src: "images/intro-2.webp", alt: "제출은 간편하게 — 완료 체크로 제출 상태를 공유하세요" },
    { src: "images/intro-3.webp", alt: "현황은 한눈에 — 진행률과 마감일을 함께 확인하세요" },
  ];
  const INTERVAL = 3000;

  el.innerHTML = `
    <div class="brand-logo">
      <span class="brand-logo-mark" aria-hidden="true">${Icons.get("check")}</span>
      <div class="brand-logo-name">
        <p class="brand-logo-text">SUMMIT</p>
        <p class="brand-slogan"><span class="nowrap">놓치기 쉬운 결산,</span> <span class="nowrap">빠짐없이 <strong>SUMMIT</strong></span></p>
      </div>
    </div>

    <div class="brand-illust brand-slides" role="region" aria-roledescription="carousel" aria-label="SUMMIT 기능 소개">
      <div class="slides-stage">
        ${SLIDES.map(
          (s, i) => `<img class="slide ${i === 0 ? "is-active" : ""}" src="${s.src}" alt="${s.alt}" width="636" height="624"
            ${i === 0 ? "" : 'aria-hidden="true"'} decoding="async" />`
        ).join("")}
      </div>
      <div class="slide-dots" role="group" aria-label="소개 장면 선택">
        ${SLIDES.map(
          (s, i) => `<button type="button" class="slide-dot ${i === 0 ? "is-active" : ""}" data-slide="${i}"
            aria-label="${i + 1}번째 장면 보기" ${i === 0 ? 'aria-current="true"' : ""}></button>`
        ).join("")}
      </div>
    </div>

    <ul class="brand-features">
      <li>
        <span class="feature-icon" aria-hidden="true">${Icons.get("file")}</span>
        <p class="feature-title">요청 관리</p>
        <p class="feature-desc">부서별 결산 요청</p>
      </li>
      <li>
        <span class="feature-icon" aria-hidden="true">${Icons.get("user")}</span>
        <p class="feature-title">제출 현황</p>
        <p class="feature-desc">실시간 진행 확인</p>
      </li>
      <li>
        <span class="feature-icon" aria-hidden="true">${Icons.get("chart")}</span>
        <p class="feature-title">업무 효율화</p>
        <p class="feature-desc">소요 시간 절감</p>
      </li>
    </ul>`;

  /* ---------- 소개 장면 자동 전환 ---------- */
  const slides = [...el.querySelectorAll(".slide")];
  const dots = [...el.querySelectorAll(".slide-dot")];
  let current = 0;
  let timer = null;

  function show(next) {
    if (next === current) return;
    const prev = slides[current];
    prev.classList.remove("is-active");
    prev.classList.add("is-leaving");
    prev.setAttribute("aria-hidden", "true");
    // 나가는 장면이 끝나면 다음 진입을 위해 오른쪽 대기 위치로 되돌림
    setTimeout(() => prev.classList.remove("is-leaving"), 800);

    slides[next].classList.remove("is-leaving");
    slides[next].classList.add("is-active");
    slides[next].removeAttribute("aria-hidden");
    dots.forEach((d, i) => {
      d.classList.toggle("is-active", i === next);
      if (i === next) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
    current = next;
  }

  const start = () => {
    clearInterval(timer);
    timer = setInterval(() => show((current + 1) % slides.length), INTERVAL);
  };
  const stop = () => clearInterval(timer);

  dots.forEach((dot) =>
    dot.addEventListener("click", () => {
      show(Number(dot.dataset.slide));
      start(); // 직접 고른 장면도 3초 동안 보여줌
    })
  );
  // 다른 탭을 보는 동안에는 멈춤
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
})();
