/**
 * /api/push  (모두 로그인 필요) — 이 브라우저의 기한 알림 켜기/끄기
 *  GET                                   → { enabled, publicKey }
 *  POST  { subscription }                → { ok }   알림 켜기 (같은 브라우저는 마지막 로그인 사용자 것으로 갱신)
 *  POST ?action=test                     → { sent } 내 브라우저들로 시험 알림
 *  DELETE { endpoint }                   → { ok }   알림 끄기
 */
import { getDb } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";
import { handle, body, str, HttpError } from "./_lib/http.js";
import { pushConfig, sendPush } from "./_lib/push.js";

function requireEnabled() {
  if (!pushConfig().enabled) throw new HttpError(503, "알림 기능이 아직 설정되지 않았습니다. 관리자에게 문의하세요. (VAPID 키 없음)");
}

async function info(req) {
  const db = await getDb();
  await requireUser(req, db);
  const { enabled, publicKey } = pushConfig();
  return { enabled, publicKey: enabled ? publicKey : "" };
}

async function subscribe(req) {
  requireEnabled();
  const db = await getDb();
  const { user } = await requireUser(req, db);

  if (str(req.query.action) === "test") {
    const result = await sendPush(db, [user._id], {
      title: "SUMMIT 알림이 켜졌습니다",
      body: "제출 기한 3일 전부터 지연될 때까지 매일 아침 이렇게 알려드립니다.",
      url: "/main.html",
      tag: "summit-test",
    });
    return { sent: result.sent };
  }

  const sub = body(req).subscription || {};
  const endpoint = str(sub.endpoint);
  const keys = { p256dh: str(sub.keys && sub.keys.p256dh), auth: str(sub.keys && sub.keys.auth) };
  if (!/^https:\/\//.test(endpoint) || !keys.p256dh || !keys.auth) throw new HttpError(400, "알림 구독 정보가 올바르지 않습니다.");

  const now = new Date();
  await db.collection("pushSubscriptions").updateOne(
    { endpoint },
    { $set: { userId: user._id, keys, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return { ok: true };
}

async function unsubscribe(req) {
  const db = await getDb();
  const { user } = await requireUser(req, db);
  const endpoint = str(body(req).endpoint);
  if (endpoint) await db.collection("pushSubscriptions").deleteOne({ endpoint, userId: user._id });
  return { ok: true };
}

export default handle({ GET: info, POST: subscribe, DELETE: unsubscribe });
