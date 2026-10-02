/**
 * MongoDB 연결 (Vercel 환경 변수 MONGODB_URI)
 * 서버리스 함수가 다시 호출될 때 연결을 재사용하도록 전역에 보관합니다.
 * 처음 연결할 때 인덱스를 만들고, 비어 있으면 시연용 가상 데이터를 넣습니다.
 */
import { MongoClient } from "mongodb";
import { HttpError } from "./http.js";
import { hashPassword } from "./auth.js";
import { todayKST, addDays, addMonths, lastMonthKST } from "./rules.js";

const cache = (globalThis.__summitDb ||= { client: null, ready: null });

function dbNameFrom(uri) {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  try {
    const name = new URL(uri).pathname.replace(/^\//, "");
    if (name) return decodeURIComponent(name);
  } catch {
    /* 주소에 DB 이름이 없으면 기본값 */
  }
  return "summit";
}

/** 환경 변수 값 정리: 붙여 넣을 때 섞여 들어간 앞뒤 공백·따옴표 제거 */
export function readUri() {
  return (process.env.MONGODB_URI || "").trim().replace(/^["']+|["']+$/g, "").trim();
}

/**
 * 연결 실패 원인을 분류해 해결 방법을 알려줌 (주소·비밀번호 같은 비밀값은 포함하지 않음)
 * @returns {{ code: string, hint: string }}
 */
export function diagnose(err, uri = readUri()) {
  const text = `${err && err.name} ${err && err.message} ${err && err.cause ? err.cause.message : ""} ${
    err && err.reason ? JSON.stringify([...(err.reason.servers?.values?.() || [])].map((s) => s.error?.message)) : ""
  }`;

  if (!uri) {
    return { code: "NO_ENV", hint: "MONGODB_URI 환경 변수가 없습니다. Vercel → Settings → Environment Variables에서 Production 환경에 추가한 뒤 재배포하세요." };
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    return { code: "BAD_SCHEME", hint: "MONGODB_URI는 mongodb+srv:// 또는 mongodb:// 로 시작해야 합니다. Atlas의 Connect → Drivers에서 주소를 다시 복사하세요." };
  }
  if (/<[^>]*>/.test(uri)) {
    return { code: "PLACEHOLDER", hint: "주소에 <db_password> 같은 자리표시자가 그대로 남아 있습니다. 꺾쇠(<>)까지 지우고 실제 DB 사용자 비밀번호로 바꾸세요." };
  }
  const authority = uri.replace(/^mongodb(\+srv)?:\/\//, "").split("/")[0];
  if ((authority.match(/@/g) || []).length > 1) {
    return { code: "PARSE", hint: "비밀번호에 @ 문자가 그대로 들어 있습니다. 비밀번호 안의 @는 %40으로 바꾸세요 (: → %3A, / → %2F, # → %23)." };
  }
  if (/MongoParseError|URI|Invalid scheme|malformed|Password contains unescaped/i.test(text) && !/Server selection/i.test(text)) {
    return { code: "PARSE", hint: "주소 형식이 올바르지 않습니다. 비밀번호에 @ : / ? # % 같은 특수문자가 있으면 URL 인코딩(예: @ → %40)해야 합니다." };
  }
  if (/bad auth|Authentication failed|AuthenticationFailed|auth error|code: 18|SCRAM/i.test(text)) {
    return { code: "AUTH", hint: "아이디 또는 비밀번호가 틀렸습니다. Atlas → Database Access의 'DB 사용자' 이름·비밀번호인지 확인하세요 (Atlas 로그인 계정 비밀번호가 아닙니다)." };
  }
  if (/ENOTFOUND|querySrv|EAI_AGAIN|ENODATA|getaddrinfo/i.test(text)) {
    return { code: "DNS", hint: "클러스터 주소를 찾을 수 없습니다. 주소의 호스트 이름(cluster0.xxxxx.mongodb.net)에 오타가 없는지, 클러스터가 삭제되지 않았는지 확인하세요." };
  }
  if (/not authorized|Unauthorized|requires authentication/i.test(text)) {
    return { code: "PERMISSION", hint: "DB 사용자에게 쓰기 권한이 없습니다. Atlas → Database Access에서 해당 사용자를 'Read and write to any database'로 바꾸세요." };
  }
  if (/timed out|ETIMEDOUT|Server selection|ECONNREFUSED|ECONNRESET|ssl|tls|alert|socket/i.test(text)) {
    return { code: "NETWORK", hint: "접속 시간 초과입니다. 가장 흔한 원인은 IP 차단입니다. Atlas → Network Access에 0.0.0.0/0(Allow access from anywhere)을 추가하세요. 클러스터가 일시 중지(Paused)되었는지도 확인하세요." };
  }
  return { code: "UNKNOWN", hint: "알 수 없는 연결 오류입니다. Vercel 배포의 Logs에서 자세한 내용을 확인하세요." };
}

function dbError(err) {
  console.error("[MongoDB]", err);
  const diag = diagnose(err);
  const httpErr = new HttpError(503, `데이터베이스에 연결할 수 없습니다. (${diag.code}) ${diag.hint}`);
  httpErr.diag = diag;
  httpErr.detail = String((err && err.message) || "").slice(0, 300);
  return httpErr;
}

export async function connect() {
  const uri = readUri();
  // 주소 자체가 잘못된 경우는 접속을 시도하지 않고 바로 알려줌
  const early = diagnose(new Error(""), uri);
  if (["NO_ENV", "BAD_SCHEME", "PLACEHOLDER", "PARSE"].includes(early.code)) throw dbError(new Error("invalid MONGODB_URI"));

  if (!cache.client) {
    try {
      cache.client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
    } catch (err) {
      throw dbError(err); // 주소 형식 오류는 생성 시점에 바로 발생
    }
  }
  try {
    return { client: await cache.client, uri };
  } catch (err) {
    cache.client = null; // 다음 요청에서 다시 연결 시도
    throw dbError(err);
  }
}

export async function getDb() {
  const { client, uri } = await connect();
  const db = client.db(dbNameFrom(uri));
  if (!cache.ready) {
    cache.ready = setup(db).catch((err) => {
      cache.ready = null;
      throw err;
    });
  }
  try {
    await cache.ready;
  } catch (err) {
    throw dbError(err); // 권한 부족 등으로 인덱스·초기 데이터 생성 실패
  }
  return db;
}

async function setup(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("resets").createIndex({ email: 1 }),
    db.collection("resets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("requests").createIndex({ month: 1, deadline: 1 }),
    db.collection("attachments").createIndex({ requestId: 1 }),
  ]);
  await seedUsers(db);
  await seedRequests(db);
}

/* ---------- 시연용 가상 데이터 (실제 회사 정보 아님) ---------- */
async function seedUsers(db) {
  if ((await db.collection("users").estimatedDocumentCount()) > 0) return;
  const users = [
    { name: "김재무", email: "finance@gyeolsan.com", department: "재무팀", role: "재무 담당자" },
    { name: "이구매", email: "buy@gyeolsan.com", department: "구매팀", role: "부서 담당자" },
    { name: "박팀장", email: "leader@gyeolsan.com", department: "재무팀", role: "팀장" },
  ];
  const now = new Date();
  const docs = await Promise.all(
    users.map(async (u) => ({ ...u, passwordHash: await hashPassword("1234"), createdAt: now }))
  );
  await db.collection("users").insertMany(docs).catch(() => {}); // 동시 실행으로 중복되면 무시
}

async function seedRequests(db) {
  if ((await db.collection("requests").estimatedDocumentCount()) > 0) return;
  const today = todayKST();
  const month = lastMonthKST();
  const prevMonth = addMonths(month, -1);
  const now = Date.now();

  // [결산월, 자료명, 부서, 기한(오늘+n일), 요청 메모, 제출자, 제출 메모, 제출일(오늘+n일)]
  const rows = [
    [month, "미지급 내역", "구매팀", -3, "거래처별 정리"],
    [month, "인건비 내역", "인사팀", -1, "9월 급여"],
    [month, "사무용품 비용", "총무팀", 0, "영수증 정리"],
    [month, "매출 내역", "영업팀", 2, "월별 매출 집계"],
    [month, "생산 비용", "생산팀", 4, "원자재, 인건비 포함", "김생산", "ERP 제출 완료", -1],
    [month, "연구비 집행", "연구소", 4, "프로젝트별 정리", "이연구", "9/30 제출", -1],
    [month, "세금계산서 내역", "구매팀", 6, "9월 발행분"],
    [month, "계약 현황", "총무팀", 9, "계약서 사본", "박총무", "9/29 완료", -2],
    [month, "광고비 집행", "영업팀", 11, "매체별 집행 내역"],
    [month, "복리후생비", "인사팀", 14, "부서별 사용 내역", "최인사", "ERP 첨부 완료", 0],
    [month, "재고 실사표", "생산팀", 5, "창고별 실사 결과", "김생산", "", -1],
    [month, "외주 가공비", "생산팀", 7, "업체별 정산", "정생산", "세금계산서 포함", 0],
    [month, "퇴직급여 충당금", "인사팀", 8, "", "최인사", "", -2],
    [month, "법인카드 사용 내역", "총무팀", 3, "카드별 정리", "박총무", "영수증 첨부", -1],
    [month, "매출채권 잔액", "영업팀", 10, "거래처별 잔액", "한영업", "", 0],
    [month, "시험 장비 감가상각", "연구소", 12, "", "이연구", "ERP 등록", -2],
    [prevMonth, "미지급 내역", "구매팀", -27, "거래처별 정리", "이구매", "", -28],
    [prevMonth, "인건비 내역", "인사팀", -26, "8월 급여", "최인사", "", -27],
    [prevMonth, "매출 내역", "영업팀", -25, "월별 매출 집계", "한영업", "", -25],
  ];

  const docs = rows.map(([m, title, department, offset, requestMemo, submitter, submitMemo, submittedOffset], i) => {
    const done = Boolean(submitter);
    const submittedDate = done ? addDays(today, submittedOffset) : null;
    return {
      month: m,
      title,
      department,
      deadline: addDays(today, offset),
      requestMemo: requestMemo || "",
      status: done ? "done" : "pending",
      submitter: submitter || "",
      submitMemo: submitMemo || "",
      submittedDate,
      submittedAt: done ? new Date(`${submittedDate}T09:00:00+09:00`) : null,
      attachments: [],
      // 이번 결산월 첫 행이 가장 최근 등록 (최근 등록한 요청 목록 순서)
      createdAt: new Date(now - (m === month ? i + 1 : 1000 + i) * 3600000),
    };
  });
  await db.collection("requests").insertMany(docs);
}

/** MongoDB 문서를 화면용 형식으로 (_id → id) */
export function toRequest(doc) {
  return {
    id: String(doc._id),
    month: doc.month,
    title: doc.title,
    department: doc.department,
    deadline: doc.deadline,
    requestMemo: doc.requestMemo || "",
    status: doc.status,
    submitter: doc.submitter || "",
    submitMemo: doc.submitMemo || "",
    submittedDate: doc.submittedDate || null,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    attachments: (doc.attachments || []).map((a) => ({ id: String(a.id), name: a.name, size: a.size, type: a.type })),
    createdBy: doc.createdBy || null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}
