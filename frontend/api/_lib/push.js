/**
 * 웹 푸시 알림 (web-push, VAPID)
 * 브라우저가 SUMMIT 탭이 닫혀 있어도 운영체제 알림(Windows 작업표시줄 위)으로 띄웁니다.
 *
 * Vercel 환경 변수 — 키는 `npx web-push generate-vapid-keys`로 한 번 만들어 둡니다.
 *  VAPID_PUBLIC_KEY   공개 키   — 필수
 *  VAPID_PRIVATE_KEY  비밀 키   — 필수 (외부에 공개하지 말 것)
 *  VAPID_SUBJECT      연락처, 기본값 mailto:<SMTP_USER>
 */
import webpush from "web-push";

const clean = (v) => (v || "").trim().replace(/^["']+|["']+$/g, "").trim();

export function pushConfig() {
  const publicKey = clean(process.env.VAPID_PUBLIC_KEY);
  const privateKey = clean(process.env.VAPID_PRIVATE_KEY);
  const smtpUser = clean(process.env.SMTP_USER);
  const subject = clean(process.env.VAPID_SUBJECT) || `mailto:${smtpUser || "admin@summit.app"}`;
  return { publicKey, privateKey, subject, enabled: Boolean(publicKey && privateKey) };
}

/**
 * 사용자들의 모든 구독(브라우저)에 알림 보내기. 만료된 구독은 지웁니다.
 * @param {import("mongodb").Db} db
 * @param {import("mongodb").ObjectId[]} userIds
 * @param {{ title: string, body: string, url: string, tag?: string }} payload
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function sendPush(db, userIds, payload) {
  const cfg = pushConfig();
  if (!cfg.enabled || !userIds.length) return { sent: 0, failed: 0 };
  const subs = await db.collection("pushSubscriptions").find({ userId: { $in: userIds } }).toArray();
  let sent = 0;
  let failed = 0;
  const gone = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), {
        vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
        TTL: 24 * 3600, // 브라우저가 꺼져 있으면 하루 동안 보관했다가 켜질 때 전달
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) gone.push(s._id); // 알림 해제·브라우저 삭제
      else console.error("[push]", err.statusCode, err.body || err.message);
    }
  }
  if (gone.length) await db.collection("pushSubscriptions").deleteMany({ _id: { $in: gone } });
  return { sent, failed };
}
