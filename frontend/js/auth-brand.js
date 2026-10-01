/**
 * 로그인·회원가입·비밀번호 찾기 화면의 왼쪽 브랜드 영역 (세 화면 공통)
 */
(() => {
  const el = document.getElementById("authBrand");
  if (!el) return;

  el.innerHTML = `
    <div class="brand-logo">
      <span class="brand-logo-mark" aria-hidden="true">${Icons.get("check")}</span>
      <p class="brand-logo-text">결산체크</p>
    </div>
    <p class="brand-tagline">월말 결산 자료의 요청·제출 상태를<br />한곳에서 관리하세요.</p>

    <div class="brand-illust" aria-hidden="true">
      <svg viewBox="0 0 440 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#e8805a" flood-opacity="0.22" />
          </filter>
        </defs>
        <g class="illust-blobs" fill="#fde4d8">
          <circle cx="335" cy="62" r="42" />
          <circle cx="378" cy="104" r="36" />
          <circle cx="300" cy="110" r="52" />
          <circle cx="58" cy="178" r="44" />
          <circle cx="96" cy="128" r="56" opacity="0.7" />
          <circle cx="110" cy="250" r="40" opacity="0.6" />
        </g>
        <circle cx="215" cy="172" r="128" fill="none" stroke="#f08360" stroke-width="2" stroke-dasharray="7 7" opacity="0.85" />
        <g transform="rotate(6 220 160)" filter="url(#cardShadow)">
          <rect x="135" y="30" width="180" height="248" rx="16" fill="#ffffff" />
          <rect x="163" y="62" width="80" height="14" rx="7" fill="#9ca3af" />
          <rect x="163" y="92" width="122" height="10" rx="5" fill="#e5e7eb" />
          <rect x="163" y="114" width="100" height="10" rx="5" fill="#e5e7eb" />
          <rect x="168" y="214" width="20" height="40" rx="6" fill="#374151" />
          <rect x="198" y="196" width="20" height="58" rx="6" fill="#fbb79c" />
          <rect x="228" y="170" width="20" height="84" rx="6" fill="#4b5563" />
        </g>
        <g transform="rotate(-6 78 170)" filter="url(#cardShadow)">
          <rect x="20" y="114" width="116" height="112" rx="14" fill="#ffffff" />
          <circle cx="78" cy="170" r="32" fill="#fcd8c7" />
          <path d="M78 170 L78 138 A32 32 0 0 1 108.4 180 Z" fill="#ff6a3d" />
        </g>
        <g transform="rotate(8 330 216)" filter="url(#cardShadow)">
          <rect x="256" y="158" width="150" height="118" rx="14" fill="#ffffff" />
          <rect x="276" y="180" width="28" height="28" rx="7" fill="#ff6a3d" />
          <path d="M283 194l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="316" y="184" width="66" height="8" rx="4" fill="#e5e7eb" />
          <rect x="316" y="198" width="44" height="8" rx="4" fill="#eef0f2" />
          <rect x="276" y="222" width="28" height="28" rx="7" fill="#ff6a3d" />
          <path d="M283 236l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="316" y="226" width="66" height="8" rx="4" fill="#e5e7eb" />
          <rect x="316" y="240" width="44" height="8" rx="4" fill="#eef0f2" />
        </g>
      </svg>
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
})();
