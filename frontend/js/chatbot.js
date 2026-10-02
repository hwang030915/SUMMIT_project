/**
 * AI 금융 비서 '모아' 챗봇 (로그인 후 모든 화면 오른쪽 아래)
 * - 버튼 안내 흐름: 지출 분석 / 예산 세우기 / 세금 / 금융상품 추천 (서버 없이 동작)
 * - 직접 입력한 질문: /api/chat (Claude) 답변, AI 미설정 시 키워드 기반 안내로 대신
 * - 대화 내용은 이 탭(sessionStorage)에만 보관합니다.
 */
(() => {
  const user = Auth.currentUser();
  if (!user) return;

  const esc = Utils.escapeHtml;
  const STORE_KEY = `moa.chat.${user.email}`;
  const MAX_SAVED = 80;
  let seq = 0;

  /* =========================================================
   * 그림 (마스코트 · 컬러 아이콘)
   * ======================================================= */
  function mascot() {
    const g = `moaGrad${++seq}`;
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="${g}" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#ffe6d2"/><stop offset=".6" stop-color="#ffc49c"/><stop offset="1" stop-color="#ff9f6e"/>
      </radialGradient></defs>
      <path d="M60 28c-3.4-6.6-13-6-13 1.2 0 6.4 13 12.8 13 12.8s13-6.4 13-12.8c0-7.2-9.6-7.8-13-1.2z" fill="#ff6b6b"/>
      <ellipse cx="21" cy="76" rx="10" ry="14" fill="#ffb487" transform="rotate(-28 21 76)"/>
      <ellipse cx="99" cy="76" rx="10" ry="14" fill="#ffb487" transform="rotate(28 99 76)"/>
      <circle cx="60" cy="74" r="40" fill="url(#${g})"/>
      <circle cx="60" cy="67" r="20" fill="#fff"/>
      <circle cx="62" cy="67" r="12" fill="#1f2430"/>
      <circle cx="66.5" cy="62" r="4" fill="#fff"/>
      <ellipse cx="33" cy="86" rx="8" ry="5.5" fill="#ff7b7b" opacity=".7"/>
      <ellipse cx="87" cy="86" rx="8" ry="5.5" fill="#ff7b7b" opacity=".7"/>
      <path d="M53 96q7 6 14 0" stroke="#8a4630" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  const face = (cls = "") => `<span class="moa-face ${cls}">${mascot()}</span>`;

  const ICO = {
    chart: `<svg viewBox="0 0 32 32"><rect x="4" y="17" width="6" height="11" rx="2" fill="#ffb347"/><rect x="13" y="11" width="6" height="17" rx="2" fill="#5b8def"/><rect x="22" y="4" width="6" height="24" rx="2" fill="#ff5a5f"/></svg>`,
    wallet: `<svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="19" rx="4" fill="#fff1ea" stroke="#ff6a3d" stroke-width="2.2"/><path d="M3 12h26" stroke="#ff6a3d" stroke-width="2.2"/><rect x="19" y="15" width="10" height="7" rx="2.5" fill="#ff6a3d"/><circle cx="23" cy="18.5" r="1.4" fill="#fff"/></svg>`,
    doc: `<svg viewBox="0 0 32 32"><path d="M8 3h11l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff0f0" stroke="#ff5a5f" stroke-width="2"/><path d="M19 3v7h7" fill="none" stroke="#ff5a5f" stroke-width="2"/><path d="M11 16h10M11 21h10" stroke="#ff5a5f" stroke-width="2" stroke-linecap="round"/></svg>`,
    bulb: `<svg viewBox="0 0 32 32"><circle cx="16" cy="13" r="9" fill="#ffd43b"/><path d="M12 22h8v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" fill="#adb5bd"/><path d="M16 9v6" stroke="#f08c00" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    piggy: `<svg viewBox="0 0 32 32"><circle cx="17" cy="5.5" r="3.5" fill="#ffc94a" stroke="#f0a500" stroke-width="1.2"/><ellipse cx="16" cy="19" rx="11" ry="8.5" fill="#ff9fb4"/><path d="M9 12l2-4 3 4z" fill="#ff8aa3"/><ellipse cx="27" cy="19" rx="3" ry="2.5" fill="#ff8aa3"/><circle cx="12" cy="17" r="1.3" fill="#7a2d3c"/><rect x="9" y="25" width="3" height="4" rx="1.2" fill="#ff8aa3"/><rect x="19" y="25" width="3" height="4" rx="1.2" fill="#ff8aa3"/></svg>`,
    target: `<svg viewBox="0 0 32 32"><circle cx="15" cy="17" r="12" fill="#ff5a5f"/><circle cx="15" cy="17" r="8" fill="#fff"/><circle cx="15" cy="17" r="4" fill="#ff5a5f"/><path d="M15 17L27 5" stroke="#495057" stroke-width="2" stroke-linecap="round"/><path d="M24 4h4v4" fill="none" stroke="#495057" stroke-width="2" stroke-linecap="round"/></svg>`,
    sprout: `<svg viewBox="0 0 32 32"><path d="M9 21h14l-2 8H11z" fill="#f4c7a1"/><path d="M16 21V12" stroke="#2f9e44" stroke-width="2.2"/><path d="M16 14c0-5-4-8-9-8 0 5 4 8 9 8z" fill="#51cf66"/><path d="M16 12c0-4 3-7 8-7 0 4-3 7-8 7z" fill="#40c057"/></svg>`,
    table: `<svg viewBox="0 0 32 32"><rect x="4" y="5" width="24" height="22" rx="3" fill="#ebfbee" stroke="#2f9e44" stroke-width="2"/><path d="M4 12h24M4 19h24M13 5v22" stroke="#2f9e44" stroke-width="2"/></svg>`,
    cart: `<svg viewBox="0 0 32 32"><path d="M3 5h4l3 15h15l3-11H9" fill="none" stroke="#5b8def" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="26" r="2.4" fill="#5b8def"/><circle cx="23" cy="26" r="2.4" fill="#5b8def"/></svg>`,
    food: `<svg viewBox="0 0 32 32"><path d="M5 15h22a11 11 0 0 1-22 0z" fill="#ffb347"/><path d="M3 15h26" stroke="#f08c00" stroke-width="2.2" stroke-linecap="round"/><path d="M12 10c0-2 2-2 2-4M18 10c0-2 2-2 2-4" stroke="#adb5bd" stroke-width="2" stroke-linecap="round"/></svg>`,
    bus: `<svg viewBox="0 0 32 32"><rect x="6" y="4" width="20" height="21" rx="4" fill="#5b8def"/><rect x="9" y="8" width="14" height="7" rx="1.5" fill="#e7f0ff"/><circle cx="11" cy="20" r="1.8" fill="#fff"/><circle cx="21" cy="20" r="1.8" fill="#fff"/><path d="M9 25v3M23 25v3" stroke="#5b8def" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    phone: `<svg viewBox="0 0 32 32"><rect x="9" y="3" width="14" height="26" rx="3" fill="#845ef7"/><rect x="11" y="6" width="10" height="17" rx="1" fill="#f3f0ff"/><circle cx="16" cy="26" r="1.3" fill="#fff"/></svg>`,
    gift: `<svg viewBox="0 0 32 32"><rect x="5" y="12" width="22" height="16" rx="2" fill="#ff8787"/><rect x="3" y="8" width="26" height="6" rx="2" fill="#ff6b6b"/><path d="M16 8v20" stroke="#ffe066" stroke-width="3"/><path d="M16 8c-2-5-8-5-7-1s7 1 7 1zM16 8c2-5 8-5 7-1s-7 1-7 1z" fill="#ffe066"/></svg>`,
    game: `<svg viewBox="0 0 32 32"><rect x="3" y="10" width="26" height="14" rx="7" fill="#20c997"/><path d="M10 14v6M7 17h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="21" cy="16" r="1.6" fill="#fff"/><circle cx="24" cy="19" r="1.6" fill="#fff"/></svg>`,
    shield: `<svg viewBox="0 0 32 32"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#5b8def"/><path d="M11 16l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    coin: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#ffd43b" stroke="#f08c00" stroke-width="2"/><path d="M12 12l2 9 2-6 2 6 2-9M11 16h10" stroke="#f08c00" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>`,
  };
  const ico = (name, cls = "moa-ico") => `<span class="${cls}">${ICO[name] || ICO.coin}</span>`;

  const RAIL_ICONS = {
    chat: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.6 1.4 4.9 3.6 6.5L5 21.5l4.2-2.1c.9.2 1.8.3 2.8.3 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/><circle cx="8" cy="11.5" r="1.3" fill="#fff"/><circle cx="12" cy="11.5" r="1.3" fill="#fff"/><circle cx="16" cy="11.5" r="1.3" fill="#fff"/></svg>`,
    analysis: Icons.get("chart"),
    budget: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><rect x="14" y="12" width="7" height="5" rx="2"/></svg>`,
    tax: Icons.get("file"),
    product: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 6h20v4H2zM12 6v15M12 6c-1.5-4-6-4-5.5-1S12 6 12 6zM12 6c1.5-4 6-4 5.5-1S12 6 12 6z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  };

  /* =========================================================
   * 안내 내용
   * ======================================================= */
  const SERVICES = [
    { key: "analysis", ico: "chart", card: "이번 달 지출 분석\n요약 보기", quick: "지출 분석하기" },
    { key: "budget", ico: "wallet", card: "예산 계획\n도와줘", quick: "예산 세우기" },
    { key: "tax", ico: "doc", card: "세금 관련\n궁금한 점", quick: "세금 궁금증" },
    { key: "product", ico: "piggy", quickIco: "bulb", card: "나에게 맞는\n금융상품 추천", quick: "금융상품 추천" },
  ];

  const TOPICS = {
    budget: {
      ask: "예산 세우는 방법이 궁금해요.",
      intro: "예산과 관련해서 궁금한 점이시군요!\n아래 예시 중에서 선택하시거나\n원하는 내용을 입력해 주세요.",
      items: [
        { label: "월별 예산 설정 방법", flow: "budget" },
        {
          label: "고정비 줄이는 팁",
          answer:
            "고정비는 한 번만 줄여도 **매달 절약 효과**가 이어져요!\n- 통신비: 데이터 사용량에 맞는 요금제나 알뜰폰으로 바꾸기\n- 구독 서비스: 최근 한 달간 안 쓴 구독은 바로 해지\n- 보험: 보장이 겹치지 않는지 점검하기 ('내보험찾아줌'에서 조회 가능)\n- 공과금: 자동이체 할인, 대기전력 차단\n- 대출: 금리가 낮은 상품으로 갈아탈 수 있는지 확인",
        },
        {
          label: "저축 목표 설정하기",
          answer:
            "저축 목표는 **구체적인 금액과 기간**으로 정하는 게 좋아요.\n- 예: '6개월 안에 비상금 300만원' → 매달 50만원\n- 월급날 저축부터 자동이체하는 **선저축 후지출**이 효과적이에요\n- 비상금은 보통 생활비 3~6개월분을 권해요\n\n'월별 예산 설정 방법'을 누르면 수입에 맞춘 저축액을 계산해 드릴게요!",
        },
        {
          label: "카테고리별 적정 지출 비율",
          answer:
            "월 실수령액 기준으로 많이 쓰는 참고 비율이에요.\n- 주거·관리비: 25~30%\n- 식비: 10~15%\n- 교통·통신: 10% 안팎\n- 여가·쇼핑: 10% 안팎\n- 저축·투자: **20% 이상**\n\n생활 형편에 따라 다르니, 수입을 알려주시면 맞춤 비율을 추천해 드릴게요.",
        },
        { label: "예산 템플릿 받아보기", flow: "budget" },
      ],
    },
    tax: {
      ask: "세금 관련해서 궁금한 게 있어요.",
      intro: "세금 관련 궁금증이시군요!\n자주 묻는 질문을 골라 보시거나\n직접 질문을 입력해 주세요.",
      items: [
        {
          label: "연말정산 꼭 챙길 공제 항목",
          answer:
            "**연말정산**은 보통 1~2월에 회사에서 진행해요.\n- 국세청 홈택스 **연말정산 간소화 서비스**에서 자료를 한 번에 내려받을 수 있어요\n- 신용·체크카드와 현금영수증 사용액, 의료비, 교육비, 기부금, 월세가 대표적인 공제 항목이에요\n- 부양가족 공제는 가족의 연간 소득 요건을 꼭 확인하세요\n\n공제 요건과 한도는 해마다 바뀔 수 있으니 홈택스에서 최종 확인해 주세요.",
        },
        {
          label: "종합소득세 신고 기간과 대상",
          answer:
            "**종합소득세**는 매년 **5월 1일~31일**에 지난해 소득을 신고해요.\n- 사업소득, 프리랜서 소득, 2곳 이상에서 받은 근로소득, 연 2천만원이 넘는 금융소득 등이 대상이에요\n- 홈택스·손택스에서 직접 신고할 수 있어요\n- 성실신고확인 대상 사업자는 6월 30일까지예요",
        },
        {
          label: "부가가치세 신고 일정",
          answer:
            "**부가가치세** 신고 일정이에요.\n- 개인 일반과세자: 1월 25일(지난해 7~12월분), 7월 25일(1~6월분)\n- 법인: 1·4·7·10월 25일까지 분기별 신고\n- 간이과세자: 다음 해 1월 25일까지 1년분 신고\n\n기한이 공휴일이면 다음 영업일까지예요.",
        },
        {
          label: "경비로 인정되는 항목",
          answer:
            "업무와 관련된 지출이면 경비로 인정될 수 있어요.\n- 세금계산서, 카드 영수증, 현금영수증 같은 **적격증빙**을 꼭 챙기세요\n- 일반적으로 건당 3만원을 넘는 지출은 적격증빙이 필요해요\n- 기업업무추진비(옛 접대비), 차량 관련 비용은 한도와 요건이 따로 있어요\n\n애매한 항목은 세무 담당자나 세무사와 확인해 주세요.",
        },
        {
          label: "세금 신고 기한 놓치지 않는 법",
          answer:
            "신고 기한을 놓치면 가산세가 붙을 수 있어요.\n- 홈택스에서 **신고 안내 알림**을 받도록 설정하기\n- 신고에 필요한 자료(매출·매입 내역, 증빙)를 월말 결산 때 미리 모아 두기\n- **SUMMIT 결산 요청**에 신고 준비 자료를 등록하면 부서별 제출 현황을 함께 관리할 수 있어요",
        },
      ],
    },
  };

  const INCOME = [
    { value: "lt100", label: "100만원 미만", base: 80, ratio: [70, 20, 0, 10] },
    { value: "100-300", label: "100만 ~ 300만원", base: 200, ratio: [60, 20, 10, 10] },
    { value: "300-500", label: "300만 ~ 500만원", base: 400, ratio: [55, 25, 12, 8] },
    { value: "gt500", label: "500만원 이상", base: 600, ratio: [50, 25, 18, 7] },
  ];
  const RATIO_NAMES = ["지출", "저축", "투자", "여유"];
  const RATIO_COLORS = ["#ff6a3d", "#5b8def", "#ffc94a", "#40c057"];
  // 지출 몫을 다시 나누는 비율 (예산 템플릿용)
  const SPEND_SPLIT = [
    ["주거·관리비", 40],
    ["식비", 25],
    ["교통", 10],
    ["통신·구독", 8],
    ["생활용품", 7],
    ["여가·경조사", 10],
  ];

  const SPEND_CATS = [
    { value: "food", label: "식비·배달", ico: "food", tip: "배달은 주 2회처럼 횟수를 정하고, 장보기 목록으로 충동구매를 줄여 보세요." },
    { value: "shopping", label: "쇼핑", ico: "cart", tip: "장바구니에 담고 48시간 뒤에 결제하면 충동구매가 확 줄어요." },
    { value: "transport", label: "교통", ico: "bus", tip: "대중교통 요금 환급 제도(예: K-패스)나 정기권 할인을 확인해 보세요." },
    { value: "subscription", label: "통신·구독", ico: "phone", tip: "한 달에 한 번 구독 목록을 점검하고, 요금제를 사용량에 맞게 바꿔 보세요." },
    { value: "events", label: "경조사·선물", ico: "gift", tip: "경조사비는 연간 예산을 따로 정해 두면 갑작스러운 지출이 덜 부담돼요." },
    { value: "hobby", label: "여가·취미", ico: "game", tip: "여가비는 월 한도를 정하고 남은 금액은 다음 달로 넘겨 보세요." },
  ];
  const SPEND_CHANGE = [
    { value: "same", label: "거의 비슷해요", msg: "지난달과 비슷하게 잘 관리하고 계세요! 지금 패턴을 유지하면서 아래 항목만 조금씩 다듬어 봐요." },
    { value: "10", label: "10% 정도 늘었어요", msg: "조금 늘었지만 금방 되돌릴 수 있어요. 아래 항목부터 점검해 보세요!" },
    { value: "20-30", label: "20~30% 늘었어요", msg: "지난달보다 꽤 늘었어요. 비중이 큰 항목부터 이번 주 한도를 정해 보세요." },
    { value: "30+", label: "30% 이상 늘었어요", msg: "지출이 많이 늘었어요. 고정비와 큰 지출부터 점검하고, 다음 달 예산을 새로 세워 보는 걸 추천해요." },
  ];

  const GOALS = [
    { value: "save", label: "목돈 모으기" },
    { value: "emergency", label: "비상금 관리" },
    { value: "retire", label: "노후 준비" },
    { value: "invest", label: "투자 시작하기" },
  ];
  const PERIODS = [
    { value: "short", label: "1년 미만" },
    { value: "mid", label: "1 ~ 3년" },
    { value: "long", label: "3년 이상" },
  ];
  const PRODUCTS = {
    installment: { name: "정기적금", ico: "piggy", desc: "매달 일정액을 넣어\n목돈 만들기" },
    deposit: { name: "정기예금", ico: "coin", desc: "모은 목돈을 맡기고\n확정 이자 받기" },
    parking: { name: "파킹통장", ico: "wallet", desc: "언제든 넣고 빼는\n수시입출금 통장" },
    cma: { name: "CMA", ico: "chart", desc: "하루만 맡겨도\n이자가 붙는 계좌" },
    isa: { name: "ISA", ico: "shield", desc: "예금·펀드·ETF를 한 계좌에\n비과세 혜택" },
    pension: { name: "연금저축", ico: "sprout", desc: "노후 준비 +\n연말정산 세액공제" },
    irp: { name: "IRP", ico: "target", desc: "개인형 퇴직연금\n세액공제 한도 추가" },
    etf: { name: "인덱스 ETF 적립식", ico: "chart", desc: "지수를 따라 매달 조금씩\n(원금 손실 가능)" },
  };
  function productPicks(goal, period) {
    if (goal === "emergency") return ["parking", "cma", "deposit"];
    if (goal === "retire") return ["pension", "irp", "isa"];
    if (goal === "invest") return period === "short" ? ["cma", "parking", "etf"] : ["isa", "etf", "pension"];
    if (period === "short") return ["installment", "parking", "cma"];
    if (period === "mid") return ["installment", "deposit", "isa"];
    return ["isa", "deposit", "pension"];
  }

  const won = (manwon) => `${Math.round(manwon).toLocaleString("ko-KR")}만원`;

  /* =========================================================
   * 상태 (이 탭에만 저장)
   * ======================================================= */
  let messages = [];
  let aiAvailable = null; // null: 아직 모름
  let busy = false;

  try {
    messages = JSON.parse(sessionStorage.getItem(STORE_KEY)) || [];
  } catch {
    messages = [];
  }
  const save = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.filter((m) => m.kind !== "typing").slice(-MAX_SAVED)));
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  };
  const nowLabel = () => new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  const newId = () => `m${Date.now().toString(36)}${(++seq).toString(36)}`;

  /* =========================================================
   * 화면 뼈대
   * ======================================================= */
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "moa-launcher";
  launcher.setAttribute("aria-label", "AI 금융 비서 모아 열기");
  launcher.innerHTML = `${face()}<span>모아</span>`;

  const panel = document.createElement("section");
  panel.className = "moa-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "AI 금융 비서 모아");
  panel.hidden = true;
  panel.innerHTML = `
    <button type="button" class="moa-close" aria-label="모아 닫기">${Icons.get("x")}</button>
    <div class="moa-welcome">
      ${face()}
      <h2>안녕하세요!<br />저는 <span class="moa-name">모아</span>이에요!</h2>
      <p>SUMMIT과 함께하는 AI 금융 비서예요.<br />지출 관리, 예산 상담, 세금, 금융상품까지<br />무엇이든 물어보세요!</p>
      <div class="moa-quick">
        ${SERVICES.map((s) => `<button type="button" data-service="${s.key}">${ico(s.quickIco || s.ico)}${s.quick}</button>`).join("")}
      </div>
      <form class="moa-form" data-form>
        <input type="text" maxlength="500" placeholder="궁금한 것을 입력해 보세요." aria-label="모아에게 질문" autocomplete="off" />
        <button type="submit" class="moa-send" aria-label="보내기">${Icons.get("chevronRight")}</button>
      </form>
    </div>
    <div class="moa-chat" hidden>
      <nav class="moa-rail" aria-label="모아 메뉴">
        ${[
          ["chat", "채팅"],
          ["analysis", "분석"],
          ["budget", "예산"],
          ["tax", "세금"],
          ["product", "상품"],
          ["settings", "설정"],
        ]
          .map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === "chat" ? "is-active" : ""}">${RAIL_ICONS[k]}<span>${l}</span></button>`)
          .join("")}
      </nav>
      <div class="moa-main">
        <div class="moa-messages" role="log" aria-live="polite"></div>
        <form class="moa-form" data-form>
          <input type="text" maxlength="500" placeholder="메시지를 입력하세요." aria-label="메시지 입력" autocomplete="off" />
          <button type="submit" class="moa-send" aria-label="보내기">${Icons.get("chevronRight")}</button>
        </form>
        <div class="moa-settings" hidden></div>
      </div>
    </div>`;

  // 'AI 비서 모아' 메뉴 화면(chat.html)에서는 화면 안에 크게, 그 밖의 화면에서는 오른쪽 아래 떠 있는 버튼으로
  const host = document.getElementById("moaPage");
  const embedded = Boolean(host);
  if (embedded) {
    panel.classList.add("is-embedded");
    panel.removeAttribute("role");
    host.appendChild(panel);
  } else {
    document.body.append(launcher, panel);
  }

  const welcomeEl = panel.querySelector(".moa-welcome");
  const chatEl = panel.querySelector(".moa-chat");
  const listEl = panel.querySelector(".moa-messages");
  const settingsEl = panel.querySelector(".moa-settings");
  const chatInput = chatEl.querySelector("input");

  /* =========================================================
   * 메시지 그리기
   * ======================================================= */
  /** 간단한 서식: **굵게**, "- " 목록, 줄바꿈 (HTML은 모두 이스케이프) */
  function fmt(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split("\n");
    let html = "";
    let inList = false;
    for (const line of lines) {
      const item = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)/);
      if (item) {
        if (!inList) html += "<ul>";
        inList = true;
        html += `<li>${item[1]}</li>`;
      } else {
        if (inList) html += "</ul>";
        inList = false;
        html += `${line}<br>`;
      }
    }
    if (inList) html += "</ul>";
    return html.replace(/(<br>)+$/, "");
  }

  function extraHtml(m) {
    const locked = m.answered ? "disabled" : "";
    switch (m.kind) {
      case "cards":
        return `<div class="moa-cards">${SERVICES.map(
          (s) => `<button type="button" class="moa-card-btn" data-service="${s.key}">${ico(s.ico)}<span>${esc(s.card).replace("\n", "<br>")}</span></button>`
        ).join("")}</div>`;
      case "suggest":
        return `<div class="moa-suggest">
          <button type="button" class="moa-suggest-head" data-toggle-suggest aria-expanded="true">이런 내용은 어떠세요? ${Icons.get("chevronUp")}</button>
          <ul>${TOPICS[m.topic].items
            .map((it, i) => `<li><button type="button" data-suggest="${m.topic}:${i}">${esc(it.label)}${Icons.get("chevronRight")}</button></li>`)
            .join("")}</ul></div>`;
      case "question": {
        const selected = m.selected || [];
        return `<div class="moa-question">
          ${m.question ? `<p>${esc(m.question)}</p>` : ""}
          <div class="moa-chips">${m.options
            .map(
              (o) =>
                `<button type="button" class="moa-chip ${selected.includes(o.value) ? "is-selected" : ""}" data-chip="${o.value}" ${locked}>${esc(o.label)}</button>`
            )
            .join("")}</div>
          ${m.multi && !m.answered ? `<button type="button" class="btn btn-primary btn-sm moa-done-btn" data-multi-done ${selected.length ? "" : "disabled"}>선택 완료</button>` : ""}
        </div>`;
      }
      case "confirm":
        return `<div class="moa-confirm">
          <button type="button" class="is-yes ${m.choice === "yes" ? "is-selected" : ""}" data-confirm="yes" ${locked}>${esc(m.yes || "네, 맞아요")}</button>
          <button type="button" class="is-no ${m.choice === "no" ? "is-selected" : ""}" data-confirm="no" ${locked}>${esc(m.no || "아니요, 다시 선택할게요")}</button>
        </div>`;
      case "result":
        return resultHtml(m);
      default:
        return "";
    }
  }

  function resultHtml(m) {
    const slides = m.slides
      .map(
        (s, i) => `<div class="moa-slide">
          ${s.pie ? `<span class="moa-pie" style="background:${s.pie}"></span>` : ico(s.ico)}
          <strong>${esc(s.title)}</strong>
          <span>${esc(s.desc).replace(/\n/g, "<br>")}</span>
          ${s.action ? `<button type="button" class="btn btn-outline btn-xs" data-slide-action="${s.action}" data-slide-index="${i}">${esc(s.actionLabel)}</button>` : ""}
        </div>`
      )
      .join("");
    return `<div class="moa-result">
      <div class="moa-result-head">${ico(m.icon || "chart")}<div><h3>${fmt(m.title)}</h3><p>${esc(m.subtitle).replace(/\n/g, "<br>")}</p></div></div>
      <div class="moa-carousel">${slides}</div>
      <div class="moa-dots">${m.slides.map((_, i) => `<i class="${i === 0 ? "is-active" : ""}"></i>`).join("")}</div>
      ${m.note ? `<p class="moa-note" style="padding:0 16px">${esc(m.note)}</p>` : ""}
    </div>`;
  }

  function messageEl(m) {
    const row = document.createElement("div");
    row.className = `moa-row ${m.from === "user" ? "is-user" : ""} ${m.kind === "result" || m.kind === "cards" ? "is-wide" : ""}`;
    row.dataset.id = m.id;
    if (m.kind === "typing") {
      row.innerHTML = `${face()}<div class="moa-col"><div class="moa-bubble moa-typing" aria-label="입력 중"><i></i><i></i><i></i></div></div>`;
      return row;
    }
    const time = `<span class="moa-time">${esc(m.time)}</span>`;
    if (m.from === "user") {
      row.innerHTML = `<div class="moa-col"><div class="moa-bubble">${fmt(m.text)}</div>${time}</div>`;
    } else {
      row.innerHTML = `${face()}<div class="moa-col">${m.text ? `<div class="moa-bubble">${fmt(m.text)}</div>` : ""}${extraHtml(m)}${time}</div>`;
    }
    const carousel = row.querySelector(".moa-carousel");
    if (carousel) bindCarousel(carousel, row.querySelectorAll(".moa-dots i"));
    return row;
  }

  function bindCarousel(carousel, dots) {
    carousel.addEventListener("scroll", () => {
      const slide = carousel.querySelector(".moa-slide");
      if (!slide) return;
      const step = slide.offsetWidth + 10;
      const atEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4;
      const index = atEnd ? dots.length - 1 : Math.round(carousel.scrollLeft / step);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    });
  }

  function upsert(m) {
    const existing = listEl.querySelector(`[data-id="${m.id}"]`);
    const el = messageEl(m);
    if (existing) existing.replaceWith(el);
    else listEl.appendChild(el);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function renderAll() {
    listEl.innerHTML = "";
    messages.forEach(upsert);
  }

  function push(m) {
    const msg = { id: newId(), time: nowLabel(), from: "bot", ...m };
    messages.push(msg);
    upsert(msg);
    save();
    return msg;
  }

  function update(m, patch) {
    Object.assign(m, patch);
    upsert(m);
    save();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 봇이 잠깐 입력하는 것처럼 보여준 뒤 메시지 추가 */
  async function botSay(...list) {
    for (const m of list) {
      const typing = { id: newId(), kind: "typing", from: "bot" };
      messages.push(typing);
      upsert(typing);
      await wait(450);
      messages = messages.filter((x) => x !== typing);
      listEl.querySelector(`[data-id="${typing.id}"]`)?.remove();
      push(m);
    }
  }

  const userSay = (text) => push({ from: "user", text });

  /* =========================================================
   * 흐름
   * ======================================================= */
  function showChatView() {
    welcomeEl.hidden = true;
    welcomeEl.style.display = "none";
    chatEl.hidden = false;
  }

  function setTab(key) {
    panel.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === key));
  }

  async function startService(key) {
    showChatView();
    closeSettings();
    setTab(key === "chat" ? "chat" : key);
    if (key === "chat") return botSay({ text: "어떤 도움이 필요하신가요?\n아래에서 원하는 서비스를 선택하거나\n직접 질문해 주세요!", kind: "cards" });
    if (key === "budget" || key === "tax") {
      userSay(TOPICS[key].ask);
      return botSay({ text: TOPICS[key].intro, kind: "suggest", topic: key, aiText: TOPICS[key].intro });
    }
    if (key === "analysis") return startAnalysis();
    if (key === "product") return startProduct();
  }

  // ---------- 예산 ----------
  async function startBudget() {
    setTab("budget");
    await botSay({
      text: "먼저 현재 상황을 확인할게요!\n정확한 안내를 위해 몇 가지 정보를 알려주세요. 😊",
      kind: "question",
      qid: "income",
      question: "월 평균 수입은 어느 정도인가요?",
      options: INCOME.map(({ value, label }) => ({ value, label })),
    });
  }

  function budgetResult(incomeValue) {
    const inc = INCOME.find((i) => i.value === incomeValue) || INCOME[1];
    const amounts = inc.ratio.map((r) => (inc.base * r) / 100);
    let acc = 0;
    const stops = inc.ratio
      .map((r, i) => {
        const from = acc;
        acc += r;
        return r ? `${RATIO_COLORS[i]} ${from}% ${acc}%` : null;
      })
      .filter(Boolean)
      .join(", ");
    const saving = amounts[1];
    return {
      kind: "result",
      icon: "chart",
      title: "**모아**의 맞춤 예산 제안",
      subtitle: `월 ${won(inc.base)} 기준으로 추천드려요.\n아래 카드를 확인해 보세요!`,
      income: inc.value,
      slides: [
        {
          pie: `conic-gradient(${stops})`,
          title: "추천 예산 비율",
          desc: `지출 ${inc.ratio[0]}% · 저축 ${inc.ratio[1]}%\n투자 ${inc.ratio[2]}% · 여유 ${inc.ratio[3]}%`,
        },
        { ico: "target", title: "3개월 저축 챌린지", desc: `매달 ${won(saving)}씩\n3개월이면 ${won(saving * 3)}!` },
        { ico: "sprout", title: "추천 금융상품", desc: "지금 나에게 맞는\n상품을 확인해요", action: "product", actionLabel: "추천 받기" },
        { ico: "table", title: "예산 템플릿", desc: "엑셀에서 바로 여는\n월 예산표", action: "template", actionLabel: "내려받기" },
      ],
      aiText: `맞춤 예산 제안(월 ${won(inc.base)} 기준): ${RATIO_NAMES.map((n, i) => `${n} ${inc.ratio[i]}%(${won(amounts[i])})`).join(", ")}`,
    };
  }

  function budgetBreakdown(incomeValue) {
    const inc = INCOME.find((i) => i.value === incomeValue) || INCOME[1];
    const lines = RATIO_NAMES.map((n, i) => `- ${n}: **${won((inc.base * inc.ratio[i]) / 100)}** (${inc.ratio[i]}%)`).filter(
      (_, i) => inc.ratio[i] > 0
    );
    return `월 ${won(inc.base)} 기준 예산이에요.\n${lines.join("\n")}\n\n월급날 **저축부터 자동이체**하고, 남은 돈으로 생활하면 지키기 쉬워요!`;
  }

  function downloadTemplate(incomeValue) {
    const inc = INCOME.find((i) => i.value === incomeValue) || INCOME[1];
    const total = inc.base * 10000;
    const spend = (total * inc.ratio[0]) / 100;
    const rows = [["항목", "비율(%)", "월 예산(원)", "실제 지출(원)", "차액(원)"]];
    SPEND_SPLIT.forEach(([name, pct]) => {
      const amount = Math.round((spend * pct) / 100 / 1000) * 1000;
      rows.push([name, ((inc.ratio[0] * pct) / 100).toFixed(1), amount, "", ""]);
    });
    RATIO_NAMES.slice(1).forEach((name, i) => {
      const r = inc.ratio[i + 1];
      if (r) rows.push([name, r, Math.round((total * r) / 100), "", ""]);
    });
    rows.push(["합계", 100, total, "", ""]);
    const csv = "﻿" + rows.map((r) => r.join(",")).join("\r\n"); // 엑셀 한글 깨짐 방지(BOM)
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `SUMMIT_월예산표_${inc.base}만원.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast("예산 템플릿을 내려받았어요.");
  }

  // ---------- 지출 분석 ----------
  async function startAnalysis() {
    setTab("analysis");
    userSay("이번 달 지출을 분석해 줘.");
    await botSay({
      text: "좋아요! 카드·계좌 내역은 연결되어 있지 않아서\n몇 가지만 여쭤보고 분석해 드릴게요.",
      kind: "question",
      qid: "spendCats",
      multi: true,
      question: "이번 달 지출이 많았던 항목을 모두 골라주세요.",
      options: SPEND_CATS.map(({ value, label }) => ({ value, label })),
    });
  }

  function analysisResult(cats, change) {
    const picked = SPEND_CATS.filter((c) => cats.includes(c.value));
    const ch = SPEND_CHANGE.find((c) => c.value === change) || SPEND_CHANGE[0];
    return {
      kind: "result",
      icon: "chart",
      title: "**모아**의 지출 분석",
      subtitle: `지난달 대비: ${ch.label}\n많이 쓴 항목 ${picked.length}개의 절약 팁을 넘겨 보세요!`,
      slides: picked.map((c) => ({ ico: c.ico, title: c.label, desc: c.tip })),
      aiText: `지출 분석 결과: 많이 쓴 항목 ${picked.map((c) => c.label).join(", ")}, 지난달 대비 ${ch.label}`,
      changeMsg: ch.msg,
    };
  }

  // ---------- 금융상품 ----------
  async function startProduct() {
    setTab("product");
    userSay("나에게 맞는 금융상품을 추천해 줘.");
    await botSay({
      text: "목적과 기간에 맞는 상품 유형을 추천해 드릴게요!",
      kind: "question",
      qid: "goal",
      question: "어떤 목적의 상품을 찾으세요?",
      options: GOALS,
    });
  }

  function productResult(goal, period) {
    const picks = productPicks(goal, period).map((k) => PRODUCTS[k]);
    const g = GOALS.find((x) => x.value === goal);
    const p = PERIODS.find((x) => x.value === period);
    return {
      kind: "result",
      icon: "sprout",
      title: "**모아**의 추천 금융상품",
      subtitle: `'${g.label}' · ${p.label} 기준이에요.\n카드를 넘겨 보세요!`,
      slides: picks.map((x) => ({ ico: x.ico, title: x.name, desc: x.desc })),
      note: "특정 금융회사의 상품을 권유하는 것이 아니에요. 금리·조건은 금융사마다 달라요.",
      aiText: `추천 상품 유형(${g.label}, ${p.label}): ${picks.map((x) => x.name).join(", ")}`,
    };
  }

  /* ---------- 선택지 처리 ---------- */
  async function onChoice(m, values) {
    if (busy) return;
    busy = true;
    try {
      update(m, { selected: values, answered: true });
      const label = (opts, v) => (opts.find((o) => o.value === v) || {}).label;

      if (m.qid === "income") {
        await botSay({
          text: `선택하신 월 평균 수입이\n약 **${label(INCOME, values[0])}**이 맞을까요?`,
          kind: "confirm",
          cid: "income",
          value: values[0],
        });
      } else if (m.qid === "spendCats") {
        await botSay({
          kind: "question",
          qid: "spendChange",
          cats: values,
          question: "지난달과 비교하면 지출이 얼마나 늘었나요?",
          options: SPEND_CHANGE.map(({ value, label: l }) => ({ value, label: l })),
        });
      } else if (m.qid === "spendChange") {
        const result = analysisResult(m.cats, values[0]);
        await botSay({ text: "분석을 마쳤어요! 📊", ...result });
        await botSay({
          text: `${result.changeMsg}\n\n이참에 다음 달 예산도 같이 세워볼까요?`,
          kind: "confirm",
          cid: "toBudget",
          yes: "네, 좋아요",
          no: "다음에 할게요",
        });
      } else if (m.qid === "goal") {
        await botSay({ kind: "question", qid: "period", goal: values[0], question: "얼마 동안 운용할 계획인가요?", options: PERIODS });
      } else if (m.qid === "period") {
        await botSay({ text: "목적과 기간에 맞춰 골라봤어요! 🌱", ...productResult(m.goal, values[0]) });
        await botSay({
          text: "실제 금리와 조건은 금융감독원 **'금융상품 한눈에'**(finlife.fss.or.kr)에서 한 번에 비교할 수 있어요.\n투자 상품은 원금 손실이 생길 수 있으니 꼭 설명서를 확인하세요!",
        });
      }
    } finally {
      busy = false;
    }
  }

  async function onConfirm(m, yes) {
    if (busy) return;
    busy = true;
    try {
      update(m, { choice: yes ? "yes" : "no", answered: true });
      if (m.cid === "income") {
        if (yes) {
          await botSay({ text: "입력해주신 정보를 바탕으로\n맞춤형 예산 가이드를 준비했어요! 🎉", ...budgetResult(m.value) });
          await botSay({ text: budgetBreakdown(m.value) });
        } else {
          busy = false;
          await startBudget();
        }
      } else if (m.cid === "toBudget") {
        if (yes) {
          busy = false;
          await startBudget();
        } else {
          await botSay({ text: "알겠어요! 궁금한 게 생기면 언제든 불러주세요. 😊", kind: "cards" });
        }
      }
    } finally {
      busy = false;
    }
  }

  async function onSuggest(topic, index) {
    const item = TOPICS[topic].items[index];
    userSay(item.label);
    if (item.flow === "budget") return startBudget();
    await botSay({ text: item.answer });
  }

  /* ---------- 자유 질문 ---------- */
  const KEYWORDS = [
    { re: /예산|가계부|저축|절약|비상금|고정비/, run: () => botSay({ text: TOPICS.budget.intro, kind: "suggest", topic: "budget" }) },
    { re: /세금|연말정산|부가세|부가가치세|종합소득|소득세|공제|경비|홈택스/, run: () => botSay({ text: TOPICS.tax.intro, kind: "suggest", topic: "tax" }) },
    { re: /상품|적금|예금|투자|ETF|ISA|연금|CMA|파킹|금리/i, run: () => startProductQuiet() },
    { re: /지출|소비|분석|카드값|많이 썼/, run: () => startAnalysisQuiet() },
  ];

  async function startAnalysisQuiet() {
    setTab("analysis");
    await botSay({
      text: "지출 분석을 도와드릴게요!",
      kind: "question",
      qid: "spendCats",
      multi: true,
      question: "이번 달 지출이 많았던 항목을 모두 골라주세요.",
      options: SPEND_CATS.map(({ value, label }) => ({ value, label })),
    });
  }

  async function startProductQuiet() {
    setTab("product");
    await botSay({ text: "금융상품 추천을 도와드릴게요!", kind: "question", qid: "goal", question: "어떤 목적의 상품을 찾으세요?", options: GOALS });
  }

  async function fallbackAnswer(text) {
    const hit = KEYWORDS.find((k) => k.re.test(text));
    if (hit) return hit.run();
    await botSay({
      text: "제가 잘 도와드릴 수 있는 주제를 골라 주시면 더 정확하게 안내해 드릴게요!",
      kind: "cards",
    });
  }

  function historyForAi() {
    return messages
      .filter((m) => m.kind !== "typing" && (m.text || m.aiText))
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.aiText || m.text }))
      .slice(-12);
  }

  async function ask(text) {
    if (busy) return;
    busy = true;
    showChatView();
    closeSettings();
    setTab("chat");
    userSay(text);

    if (aiAvailable === false) {
      busy = false;
      return fallbackAnswer(text);
    }

    const typing = { id: newId(), kind: "typing", from: "bot" };
    messages.push(typing);
    upsert(typing);
    const removeTyping = () => {
      messages = messages.filter((x) => x !== typing);
      listEl.querySelector(`[data-id="${typing.id}"]`)?.remove();
    };

    try {
      const { reply } = await Api.request("chat", { method: "POST", body: { messages: historyForAi() } });
      aiAvailable = true;
      removeTyping();
      push({ text: reply });
    } catch (err) {
      removeTyping();
      if (err.code === "NO_AI") {
        aiAvailable = false;
        busy = false;
        return fallbackAnswer(text);
      }
      push({ text: `앗, ${err.message}` });
    } finally {
      busy = false;
    }
  }

  /* ---------- 설정 ---------- */
  async function openSettings() {
    setTab("settings");
    settingsEl.hidden = false;
    settingsEl.innerHTML = `
      <h3>설정</h3>
      <div class="moa-setting"><div>AI 자유 질문 답변<small>입력창에 쓴 질문을 AI가 답해요</small></div><span class="moa-status" data-ai-status>확인 중</span></div>
      <div class="moa-setting"><div>대화 내용 지우기<small>이 탭에 저장된 모아와의 대화를 모두 지워요</small></div><button type="button" class="btn btn-outline btn-xs" data-clear>지우기</button></div>
      <div class="moa-setting"><div>처음 화면으로<small>모아 소개 화면으로 돌아가요</small></div><button type="button" class="btn btn-outline btn-xs" data-home>이동</button></div>
      ${embedded ? "" : `<div class="moa-setting"><div>크게 보기<small>'AI 비서 모아' 메뉴 화면에서 넓게 대화해요</small></div><a class="btn btn-outline btn-xs" href="chat.html">열기</a></div>`}
      <p class="moa-disclaimer">모아의 안내는 일반적인 참고 정보예요. 세금 신고나 금융상품 가입 전에는 국세청 홈택스, 금융회사 설명서, 전문가를 통해 꼭 확인해 주세요. 주민등록번호·계좌 비밀번호 같은 개인정보는 입력하지 마세요.</p>`;

    const status = settingsEl.querySelector("[data-ai-status]");
    const show = (on) => {
      status.textContent = on ? "사용 중" : "기본 안내 모드";
      status.className = `moa-status ${on ? "is-on" : "is-off"}`;
    };
    if (aiAvailable !== null) return show(aiAvailable);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      aiAvailable = Boolean(data.env && data.env.AI_답변_설정됨);
      show(aiAvailable);
    } catch {
      status.textContent = "확인 불가";
    }
  }

  function closeSettings() {
    settingsEl.hidden = true;
  }

  async function clearChat() {
    const ok = await UI.confirm({
      icon: "trash",
      title: "대화 내용을 지울까요?",
      message: "모아와 나눈 대화가 모두 사라져요.",
      okText: "지우기",
    });
    if (!ok) return;
    messages = [];
    save();
    renderAll();
    goHome();
  }

  function goHome() {
    closeSettings();
    setTab("chat");
    chatEl.hidden = true;
    welcomeEl.hidden = false;
    welcomeEl.style.display = "";
  }

  /* =========================================================
   * 이벤트
   * ======================================================= */
  function openPanel() {
    panel.hidden = false;
    launcher.classList.add("is-open");
    document.querySelector(".moa-tip")?.remove();
    if (messages.length) {
      showChatView();
      renderAll();
      setTimeout(() => chatInput.focus(), 50);
    } else {
      setTimeout(() => welcomeEl.querySelector("input").focus(), 50);
    }
  }

  function closePanel() {
    panel.hidden = true;
    launcher.classList.remove("is-open");
    launcher.focus();
  }

  if (embedded) {
    openPanel(); // 전용 화면은 항상 열려 있음
  } else {
    launcher.addEventListener("click", openPanel);
    panel.querySelector(".moa-close").addEventListener("click", closePanel);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden && !document.querySelector(".modal-backdrop")) closePanel();
    });
  }

  panel.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    ask(text);
    setTimeout(() => chatInput.focus(), 30);
  });

  panel.addEventListener("click", (e) => {
    const t = e.target;
    const find = (sel) => t.closest(sel);
    const msgOf = (el) => messages.find((m) => m.id === el.closest(".moa-row")?.dataset.id);

    const service = find("[data-service]");
    if (service) return startService(service.dataset.service);

    const tab = find("[data-tab]");
    if (tab) {
      if (tab.dataset.tab === "settings") return openSettings();
      return startService(tab.dataset.tab);
    }

    const toggle = find("[data-toggle-suggest]");
    if (toggle) {
      const box = toggle.closest(".moa-suggest");
      box.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!box.classList.contains("is-collapsed")));
      return;
    }

    const suggest = find("[data-suggest]");
    if (suggest && !busy) {
      const [topic, index] = suggest.dataset.suggest.split(":");
      return onSuggest(topic, Number(index));
    }

    const chip = find("[data-chip]");
    if (chip && !chip.disabled) {
      const m = msgOf(chip);
      if (!m || m.answered) return;
      if (m.multi) {
        const sel = new Set(m.selected || []);
        sel.has(chip.dataset.chip) ? sel.delete(chip.dataset.chip) : sel.add(chip.dataset.chip);
        return update(m, { selected: [...sel] });
      }
      return onChoice(m, [chip.dataset.chip]);
    }

    const done = find("[data-multi-done]");
    if (done) {
      const m = msgOf(done);
      if (m && (m.selected || []).length) onChoice(m, m.selected);
      return;
    }

    const confirm = find("[data-confirm]");
    if (confirm && !confirm.disabled) {
      const m = msgOf(confirm);
      if (m && !m.answered) onConfirm(m, confirm.dataset.confirm === "yes");
      return;
    }

    const slideAction = find("[data-slide-action]");
    if (slideAction) {
      const m = msgOf(slideAction);
      if (slideAction.dataset.slideAction === "template") return downloadTemplate(m && m.income);
      if (slideAction.dataset.slideAction === "product") return startProduct();
    }

    if (find("[data-clear]")) return clearChat();
    if (find("[data-home]")) return goHome();
  });

  // 처음 한 번 말풍선 안내 (떠 있는 버튼일 때만)
  try {
    if (!embedded && !sessionStorage.getItem("moa.tipShown")) {
      sessionStorage.setItem("moa.tipShown", "1");
      const tip = document.createElement("div");
      tip.className = "moa-tip";
      tip.textContent = "모아에게 무엇이든 물어보세요! 💬";
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 6000);
    }
  } catch {
    /* 무시 */
  }
})();
