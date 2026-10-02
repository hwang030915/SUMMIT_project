/**
 * /api/chat  (로그인 필요) — AI 금융 비서 '모아'의 자유 질문 답변
 *  POST { messages: [{ role: "user"|"assistant", content: string }] } → { reply }
 *
 * Vercel 환경 변수 ANTHROPIC_API_KEY가 없으면 503 { code: "NO_AI" }를 돌려주고,
 * 화면은 키워드 기반 기본 답변으로 대신합니다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";
import { handle, body, str, HttpError, send } from "./_lib/http.js";
import { todayKST } from "./_lib/rules.js";

const MODEL = "claude-opus-5-5";
const MAX_HISTORY = 12; // 최근 대화만 전달
const MAX_CHARS = 1000; // 메시지 1개 최대 길이
const HOURLY_LIMIT = 30; // 사용자당 시간당 질문 수 (API 비용 보호)

const SYSTEM_PROMPT = `당신은 'SUMMIT'의 AI 금융 비서 '모아'입니다. SUMMIT은 회사의 월말 결산 자료 요청·제출을 관리하는 웹 서비스이고, 모아는 사용자의 지출 관리, 예산 상담, 세금, 금융상품 질문을 돕습니다.

답변 방식
- 한국어 존댓말로, 친근하고 밝은 말투로 답합니다 ("~해요" 체).
- 채팅 창에서 읽기 좋게 짧게 답합니다: 핵심 2~5문장, 필요하면 "- " 글머리 목록을 최대 5개까지 씁니다. 표, 제목(#), 코드 블록은 쓰지 않습니다. 강조는 **굵게**만 씁니다.
- 숫자 예시는 원 단위로 구체적으로 보여줍니다.
- 사용자의 상황(수입, 지출 등)을 모르면 추측하지 말고 한 가지를 되물어 봅니다.

지켜야 할 것
- 세금: 일반적인 제도와 일정만 안내하고, 금액·공제 요건은 해마다 바뀔 수 있으니 국세청 홈택스나 세무 전문가 확인을 권합니다.
- 금융상품: 특정 금융회사의 특정 상품을 권유하지 않고 상품 유형(예금, 적금, CMA, ISA, 연금저축 등)으로 설명합니다. 투자는 원금 손실 가능성을 함께 알립니다. 비교는 금융감독원 '금융상품 한눈에'(finlife.fss.or.kr)를 안내합니다.
- 주민등록번호, 계좌 비밀번호 같은 민감 정보는 입력하지 말라고 안내합니다.
- 금융·회계·결산과 관계없는 질문에는 모아가 도울 수 있는 주제(지출 분석, 예산, 세금, 금융상품)를 짧게 안내합니다.
- SUMMIT 사용법 질문: 결산 현황(진행률·필터·검색), 결산 요청 등록(첨부파일 3MB), 제출 체크(제출 완료·취소) 화면이 있습니다.`;

const AI_RETRY_MS = 10 * 60 * 1000; // 크레딧 부족·키 오류 후 10분 뒤 다시 시도
let aiDisabledUntil = 0;

let client = null;
const getClient = () => (client ||= new Anthropic()); // ANTHROPIC_API_KEY를 환경 변수에서 읽음

/** 화면에서 받은 대화를 API 형식으로 정리: user로 시작, 역할 교대, 길이 제한 */
function toMessages(raw) {
  if (!Array.isArray(raw)) throw new HttpError(400, "대화 형식이 올바르지 않습니다.");
  const cleaned = raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && str(m.content).trim())
    .map((m) => ({ role: m.role, content: str(m.content).trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_HISTORY);

  // 같은 역할이 연속되면 하나로 합치고, 첫 메시지는 user가 되도록
  const merged = [];
  for (const m of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  if (!merged.length || merged[merged.length - 1].role !== "user") {
    throw new HttpError(400, "질문을 입력해주세요.");
  }
  return merged;
}

async function checkRateLimit(db, user) {
  const since = new Date(Date.now() - 3600 * 1000);
  const used = await db.collection("chat_usage").countDocuments({ userId: user._id, createdAt: { $gt: since } });
  if (used >= HOURLY_LIMIT) {
    throw new HttpError(429, "질문이 많아 잠시 쉬어갈게요. 1시간 뒤에 다시 물어봐 주세요.");
  }
  await db.collection("chat_usage").insertOne({
    userId: user._id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 3600 * 1000), // TTL로 자동 삭제
  });
}

async function chat(req, res) {
  const db = await getDb();
  const { user } = await requireUser(req, db);
  const messages = toMessages(body(req).messages);

  if (!process.env.ANTHROPIC_API_KEY) {
    send(res, 503, { code: "NO_AI", error: "AI 답변이 설정되지 않았습니다." });
    return;
  }
  // 최근에 크레딧 부족·키 오류가 났으면 한동안 호출하지 않음 (불필요한 실패 호출 방지)
  if (Date.now() < aiDisabledUntil) {
    send(res, 503, { code: "NO_AI", error: "AI 답변을 잠시 사용할 수 없어 기본 안내로 도와드릴게요." });
    return;
  }
  await checkRateLimit(db, user);

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 2048, // 채팅 창용 짧은 답변 + 사용자당 비용 상한
      output_config: { effort: "low" }, // 대화형 응답: 빠르고 저렴하게
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // 안전 분류기가 거절하면 서버에서 다른 모델로 재시도
      system: `${SYSTEM_PROMPT}\n\n오늘 날짜(한국 시간): ${todayKST()}\n사용자: ${user.name} (${user.department} · ${user.role})`,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "이 질문은 제가 답변드리기 어려워요. 지출, 예산, 세금, 금융상품에 관해 물어봐 주시면 도와드릴게요!" };
    }
    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!reply) throw new HttpError(502, "답변을 만들지 못했어요. 다시 질문해 주세요.");
    return { reply: response.stop_reason === "max_tokens" ? `${reply}…` : reply };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // 키가 틀렸거나 권한이 없거나 크레딧이 없으면: 키가 없을 때처럼 기본 안내 모드로 전환
    const reason =
      err instanceof Anthropic.AuthenticationError
        ? "API 키가 올바르지 않습니다"
        : err instanceof Anthropic.PermissionDeniedError
          ? "API 키에 사용 권한이 없습니다"
          : err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)
            ? "Claude API 크레딧이 부족합니다"
            : null;
    if (reason) {
      console.error(`[chat] AI 비활성화: ${reason}`);
      aiDisabledUntil = Date.now() + AI_RETRY_MS;
      send(res, 503, { code: "NO_AI", error: `${reason}. 기본 안내로 도와드릴게요.` });
      return;
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(429, "지금 질문이 몰리고 있어요. 잠시 후 다시 시도해 주세요.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[chat]", err.status, err.message);
      throw new HttpError(502, "AI 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    throw err;
  }
}

export default handle({ POST: chat });
