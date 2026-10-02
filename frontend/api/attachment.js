/**
 * /api/attachment?id=...  (로그인 필요)
 *  GET → 첨부파일 내려받기
 */
import { ObjectId } from "mongodb";
import { getDb } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";
import { handle, str, HttpError } from "./_lib/http.js";

async function download(req, res) {
  const id = str(req.query.id);
  if (!ObjectId.isValid(id)) throw new HttpError(400, "파일 번호가 올바르지 않습니다.");

  const db = await getDb();
  await requireUser(req, db);
  const file = await db.collection("attachments").findOne({ _id: new ObjectId(id) });
  if (!file) throw new HttpError(404, "파일을 찾을 수 없습니다.");

  const data = Buffer.from(file.data.buffer ?? file.data);
  res.statusCode = 200;
  res.setHeader("Content-Type", file.type || "application/octet-stream");
  res.setHeader("Content-Length", String(data.length));
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.end(data);
}

export default handle({ GET: download });
