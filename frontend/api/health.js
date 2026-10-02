/**
 * /api/health — DB 연결 진단 (브라우저에서 바로 열어 확인)
 * 주소나 비밀번호 같은 비밀값은 보여주지 않습니다.
 */
import { getDb, readUri, diagnose } from "./_lib/db.js";
import { send } from "./_lib/http.js";
import { mailConfig } from "./_lib/mail.js";

export default async function handler(req, res) {
  const uri = readUri();
  const env = {
    MONGODB_URI_설정됨: Boolean(uri),
    주소_형식: uri.startsWith("mongodb+srv://") ? "mongodb+srv" : uri.startsWith("mongodb://") ? "mongodb" : uri ? "올바르지 않음" : "-",
    자리표시자_남아있음: /<[^>]*>/.test(uri),
    앞뒤_따옴표_공백_제거함: Boolean(process.env.MONGODB_URI) && process.env.MONGODB_URI !== uri,
    Vercel_환경: process.env.VERCEL_ENV || "local",
    메일_발송_설정됨: mailConfig().enabled,
    AI_답변_설정됨: Boolean(process.env.ANTHROPIC_API_KEY),
    메일_서버: mailConfig().enabled ? `${mailConfig().host}:${mailConfig().port}` : "-",
  };

  try {
    const db = await getDb();
    const [users, requests] = await Promise.all([
      db.collection("users").estimatedDocumentCount(),
      db.collection("requests").estimatedDocumentCount(),
    ]);
    send(res, 200, { ok: true, 데이터베이스: db.databaseName, 사용자_수: users, 결산요청_수: requests, env });
  } catch (err) {
    const { code, hint } = err.diag || diagnose(err, uri);
    send(res, 503, { ok: false, 원인: code, 해결방법: hint, 오류: err.detail ?? String(err.message).slice(0, 300), env });
  }
}
