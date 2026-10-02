/**
 * /api/requests  (모두 로그인 필요)
 *  GET                         → { items: [...] }   전체 결산 요청 (첨부파일은 이름·크기만)
 *  POST  { month, title, department, deadline, requestMemo, attachments: [{ name, type, data(base64) }] }
 *                              → { item }
 *  PATCH ?id=...  { action: "submit", submitter, submitMemo, submittedDate }
 *                 { action: "cancel" }
 *                              → { item }
 * 여러 사용자가 같은 행을 바꾸면 마지막으로 저장된 변경이 적용됩니다 (PRD 4장).
 */
import { ObjectId } from "mongodb";
import { getDb, toRequest } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";
import { handle, body, str, HttpError } from "./_lib/http.js";
import {
  DEPARTMENTS,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_FILE,
  isValidDate,
  isValidMonth,
  todayKST,
} from "./_lib/rules.js";

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

export default handle({ GET: list, POST: create, PATCH: update });
