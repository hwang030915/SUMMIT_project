/**
 * /api/requests  (모두 로그인 필요)
 *  GET                         → { items: [...] }   전체 결산 요청 (첨부파일은 이름·크기만)
 *  POST  { month, title, department, deadline, requestMemo, attachments: [{ name, type, data(base64) }] }
 *                              → { item }
 *  POST  ?action=remind  { department, month?, note? }
 *                              → { sent: [{ name, email }], failed: [...], items }   부서 담당자에게 독촉 메일 발송
 *  PATCH ?id=...  { action: "submit", submitter, submitMemo, submittedDate }
 *                 { action: "cancel" }
 *                              → { item }
 * 여러 사용자가 같은 행을 바꾸면 마지막으로 저장된 변경이 적용됩니다 (PRD 4장).
 */
import { ObjectId } from "mongodb";
import { getDb, toRequest } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";
import { handle, body, str, HttpError } from "./_lib/http.js";
import { mailConfig, sendReminderMail, describeMailError, appUrl } from "./_lib/mail.js";
import {
  DEPARTMENTS,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_FILE,
  isValidDate,
  isValidMonth,
  todayKST,
  lastMonthKST,
  diffDays,
} from "./_lib/rules.js";

const REMIND_COOLDOWN_MIN = 10; // 같은 부서에는 10분에 한 번만 (메일 폭주 방지)

function parseId(req) {
  const id = str(req.query.id);
  if (!ObjectId.isValid(id)) throw new HttpError(400, "요청 번호가 올바르지 않습니다.");
  return new ObjectId(id);
}

function validate(b) {
  const value = {
    month: str(b.month).trim(),
    title: str(b.title).trim(),
    department: str(b.department),
    deadline: str(b.deadline),
    requestMemo: str(b.requestMemo).trim(),
  };
  if (!isValidMonth(value.month)) throw new HttpError(400, "결산월을 선택하세요.");
  if (!value.title) throw new HttpError(400, "자료명을 입력하세요.");
  if (value.title.length > 50) throw new HttpError(400, "자료명은 50자 이내로 입력하세요.");
  if (!DEPARTMENTS.includes(value.department)) throw new HttpError(400, "담당 부서를 선택하세요.");
  if (!isValidDate(value.deadline)) throw new HttpError(400, "제출 기한이 올바른 날짜가 아닙니다.");
  if (value.requestMemo.length > 300) throw new HttpError(400, "요청 메모는 300자 이내로 입력하세요.");
  return value;
}

function decodeFiles(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_FILES) throw new HttpError(400, `첨부파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`);
  let total = 0;
  return list.map((f) => {
    const name = str(f.name).trim().slice(0, 200);
    if (!name || !ALLOWED_FILE.test(name)) throw new HttpError(400, `'${name || "이름 없음"}'은(는) 첨부할 수 없는 형식입니다.`);
    const data = Buffer.from(str(f.data), "base64");
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw new HttpError(413, "첨부파일은 합계 3MB까지 올릴 수 있습니다.");
    return { name, type: str(f.type).slice(0, 100) || "application/octet-stream", size: data.length, data };
  });
}

async function list(req) {
  const db = await getDb();
  await requireUser(req, db);
  const docs = await db.collection("requests").find().sort({ deadline: 1, createdAt: 1 }).toArray();
  return { items: docs.map(toRequest) };
}

async function create(req) {
  const db = await getDb();
  const { user } = await requireUser(req, db);
  const b = body(req);
  const value = validate(b);
  const files = decodeFiles(b.attachments);

  const _id = new ObjectId();
  const attachments = files.map((f) => ({ id: new ObjectId(), name: f.name, size: f.size, type: f.type }));
  if (files.length) {
    await db.collection("attachments").insertMany(
      files.map((f, i) => ({ _id: attachments[i].id, requestId: _id, ...f, createdAt: new Date() }))
    );
  }

  const doc = {
    _id,
    ...value,
    status: "pending",
    submitter: "",
    submitMemo: "",
    submittedDate: null,
    submittedAt: null,
    attachments,
    createdBy: user.name,
    createdAt: new Date(),
  };
  await db.collection("requests").insertOne(doc);
  return { item: toRequest(doc) };
}

async function update(req) {
  const db = await getDb();
  await requireUser(req, db);
  const _id = parseId(req);
  const b = body(req);
  let $set;

  if (b.action === "submit") {
    const submitter = str(b.submitter).trim();
    if (!submitter) throw new HttpError(400, "제출자를 입력하세요.");
    if (submitter.length > 20) throw new HttpError(400, "제출자는 20자 이내로 입력하세요.");
    const submitMemo = str(b.submitMemo).trim();
    if (submitMemo.length > 500) throw new HttpError(400, "제출 메모는 500자 이내로 입력하세요.");
    const submittedDate = str(b.submittedDate) || todayKST();
    if (!isValidDate(submittedDate)) throw new HttpError(400, "제출 일자가 올바르지 않습니다.");
    if (submittedDate > todayKST()) throw new HttpError(400, "제출 일자는 오늘 이후로 선택할 수 없습니다.");
    $set = { status: "done", submitter, submitMemo, submittedDate, submittedAt: new Date() };
  } else if (b.action === "cancel") {
    $set = { status: "pending", submitter: "", submitMemo: "", submittedDate: null, submittedAt: null };
  } else {
    throw new HttpError(400, "알 수 없는 작업입니다.");
  }

  const doc = await db.collection("requests").findOneAndUpdate({ _id }, { $set }, { returnDocument: "after" });
  if (!doc) throw new HttpError(404, "요청을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.");
  return { item: toRequest(doc) };
}

/* ---------- 독촉 메일 (챗봇 '독촉 메시지 만들기' → 메일 바로 보내기) ---------- */
async function remind(req) {
  const db = await getDb();
  const { user: sender } = await requireUser(req, db);
  const b = body(req);
  const department = str(b.department);
  if (!DEPARTMENTS.includes(department)) throw new HttpError(400, "독촉할 부서를 선택하세요.");
  const note = str(b.note).trim().slice(0, 500);

  if (!mailConfig().enabled) {
    throw new HttpError(503, "메일 발송이 설정되지 않았습니다. 관리자에게 SMTP_USER·SMTP_PASS 환경 변수 설정을 요청하세요.");
  }

  // 결산월: 지정값 > 지난달 > 가장 최근 결산월
  let month = str(b.month);
  if (!isValidMonth(month)) {
    const months = await db.collection("requests").distinct("month");
    month = months.includes(lastMonthKST()) ? lastMonthKST() : months.sort().pop();
  }

  const today = todayKST();
  const items = await db
    .collection("requests")
    .find({ month, department, status: { $ne: "done" } }, { projection: { attachments: 0 } })
    .sort({ deadline: 1 })
    .toArray();
  if (!items.length) throw new HttpError(400, `${department}에는 ${month} 결산 미제출 자료가 없습니다.`);

  const recipients = await db.collection("users").find({ department }, { projection: { name: 1, email: 1 } }).toArray();
  if (!recipients.length) {
    throw new HttpError(404, `${department}에 가입한 SUMMIT 사용자가 없어 메일을 보낼 수 없습니다. 메시지를 복사해 직접 전달해 주세요.`);
  }

  const since = new Date(Date.now() - REMIND_COOLDOWN_MIN * 60 * 1000);
  const recent = await db.collection("remind_logs").findOne({ department, month, createdAt: { $gt: since } });
  if (recent) {
    const wait = Math.max(1, Math.ceil((recent.createdAt.getTime() + REMIND_COOLDOWN_MIN * 60 * 1000 - Date.now()) / 60000));
    throw new HttpError(429, `${department}에는 방금 독촉 메일을 보냈어요. ${wait}분 뒤에 다시 보낼 수 있습니다.`);
  }

  const mailItems = items.map((i) => ({
    title: i.title,
    department: i.department,
    month: i.month,
    deadline: i.deadline,
    dday: diffDays(today, i.deadline),
  }));
  const lateCount = mailItems.filter((i) => i.dday < 0).length;

  const sent = [];
  const failed = [];
  for (const r of recipients) {
    try {
      await sendReminderMail({
        to: r.email,
        name: r.name,
        heading: "결산 자료 제출 요청",
        intro: `${sender.department} ${sender.name}님이 ${month} 결산 자료 제출을 요청했습니다. 아래 자료를 메일 또는 ERP로 제출하신 뒤, SUMMIT '제출 체크'에서 제출 완료로 표시해 주세요.`,
        note,
        items: mailItems,
        link: `${appUrl()}/submit.html`,
        replyTo: sender.email,
        subject: `[SUMMIT] ${month} 결산 자료 제출 요청 · ${department} 미제출 ${items.length}건${lateCount ? ` (지연 ${lateCount}건)` : ""}`,
      });
      sent.push({ name: r.name, email: r.email });
    } catch (err) {
      console.error("[remind]", r.email, err);
      failed.push({ name: r.name, email: r.email, reason: describeMailError(err) });
    }
  }

  if (!sent.length) throw new HttpError(502, `독촉 메일을 보내지 못했습니다. ${failed[0].reason}`);

  await db.collection("remind_logs").insertOne({
    department,
    month,
    senderId: sender._id,
    to: sent.map((r) => r.email),
    itemIds: items.map((i) => i._id),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30일 뒤 자동 삭제
  });
  return { sent, failed, month, items: items.length };
}

const post = (req) => (str(req.query.action) === "remind" ? remind(req) : create(req));

export default handle({ GET: list, POST: post, PATCH: update });
