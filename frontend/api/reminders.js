/**
 * /api/reminders — 제출 기한 자동 알림 (Vercel Cron이 매일 09:00 KST에 호출, vercel.json)
 *
 * 미제출 요청 중 기한이 3일 이내(D-3 ~ D-day)이거나 이미 지난 건을 찾아 매일 알립니다.
 *  - 부서 담당자: 자기 부서의 해당 요청 목록
 *  - 재무 담당자: 기한이 지난 요청 전체 요약 (독촉 대상)
 * 알림 경로: 이메일 + 웹 푸시(알림을 켠 브라우저에 운영체제 알림). 설정된 것만 보냅니다.
 * 같은 요청은 하루에 한 번만 알립니다 (remindedOn).
 *
 * Vercel 환경 변수
 *  CRON_SECRET  임의의 긴 문자열 — 필수. Vercel Cron이 Authorization: Bearer <값>으로 보내며,
 *               다른 사람이 주소를 호출해 알림을 보내지 못하게 막습니다.
 *  APP_URL      알림의 'SUMMIT에서 확인하기' 주소, 기본값 https://<Vercel 운영 도메인>
 *  (메일 설정은 _lib/mail.js, 푸시 설정은 _lib/push.js 참고)
 *
 * 직접 확인: GET /api/reminders?dry=1  (Authorization: Bearer <CRON_SECRET>) → 보내지 않고 대상만 보여줌
 */
import { getDb } from "./_lib/db.js";
import { handle, str, HttpError } from "./_lib/http.js";
import { mailConfig, sendReminderMail, describeMailError, appUrl } from "./_lib/mail.js";
import { pushConfig, sendPush } from "./_lib/push.js";
import { todayKST, addDays, diffDays } from "./_lib/rules.js";

const DAYS_BEFORE = 3; // 기한 며칠 전부터 알릴지 (D-3)

function authorize(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) throw new HttpError(503, "CRON_SECRET 환경 변수가 없습니다. Vercel → Settings → Environment Variables에 추가한 뒤 재배포하세요.");
  if ((req.headers.authorization || "") !== `Bearer ${secret}`) throw new HttpError(401, "권한이 없습니다.");
}

const byDeadline = (a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title);
const ddayLabel = (n) => (n > 0 ? `D-${n}` : n === 0 ? "D-day" : `D+${-n}`);

/** 푸시 알림 본문: 건수 요약 + 기한이 급한 자료 3건 */
function pushPayload(notice) {
  const late = notice.items.filter((it) => it.dday < 0).length;
  const head = notice.forFinance
    ? `기한이 지난 미제출 자료 ${notice.items.length}건`
    : `${notice.department} 미제출 ${notice.items.length}건${late ? ` (지연 ${late}건)` : ""}`;
  const top = notice.items.slice(0, 3).map((it) => `${ddayLabel(it.dday)} ${it.title}${notice.forFinance ? `(${it.department})` : ""}`);
  const more = notice.items.length > 3 ? ` 외 ${notice.items.length - 3}건` : "";
  return { title: "SUMMIT 결산 기한 알림", body: `${head}\n${top.join(" · ")}${more}`, url: notice.path, tag: "summit-reminder" };
}

async function run(req) {
  authorize(req);
  const dry = str(req.query.dry) === "1";
  const mailOn = mailConfig().enabled;
  const pushOn = pushConfig().enabled;
  if (!dry && !mailOn && !pushOn) {
    throw new HttpError(503, "알림 경로가 설정되지 않았습니다. 메일(SMTP_USER/SMTP_PASS) 또는 푸시(VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) 환경 변수를 확인하세요.");
  }

  const db = await getDb();
  const today = todayKST();
  const docs = await db
    .collection("requests")
    .find({ status: "pending", deadline: { $lte: addDays(today, DAYS_BEFORE) }, remindedOn: { $ne: today } })
    .toArray();
  if (!docs.length) return { ok: true, today, dry, 대상_요청: 0, 메일: 0, 푸시: 0 };

  const items = docs
    .map((d) => ({ _id: d._id, title: d.title, department: d.department, month: d.month, deadline: d.deadline, dday: diffDays(today, d.deadline) }))
    .sort(byDeadline);
  const late = items.filter((it) => it.dday < 0);
  const departments = [...new Set(items.map((it) => it.department))];

  const users = await db
    .collection("users")
    .find({ $or: [{ department: { $in: departments } }, { role: "재무 담당자" }] }, { projection: { name: 1, email: 1, department: 1, role: 1 } })
    .toArray();

  // 사용자별로 받을 알림 하나씩
  const notices = [];
  for (const u of users) {
    const mine = items.filter((it) => it.department === u.department);
    if (mine.length) {
      notices.push({
        user: u,
        department: u.department,
        heading: "결산 자료 제출 기한 알림",
        intro: `${u.department}에 제출 기한이 다가왔거나 지난 결산 자료가 ${mine.length}건 있습니다. 제출 후 SUMMIT에서 완료를 표시해주세요.`,
        items: mine,
        path: "/submit.html",
      });
    } else if (u.role === "재무 담당자" && late.length) {
      notices.push({
        user: u,
        forFinance: true,
        heading: "기한이 지난 결산 자료",
        intro: `제출 기한이 지났는데 아직 제출되지 않은 자료가 ${late.length}건 있습니다. 해당 부서에 확인을 요청해주세요.`,
        items: late,
        path: "/main.html",
      });
    }
  }

  const noRecipient = departments.filter((dep) => !users.some((u) => u.department === dep));
  if (dry) {
    return {
      ok: true,
      today,
      dry,
      메일_설정됨: mailOn,
      푸시_설정됨: pushOn,
      대상_요청: items.map(({ _id, ...it }) => it),
      받는_사람: notices.map((n) => ({ 이름: n.user.name, 건수: n.items.length })),
      담당자_없는_부서: noRecipient,
    };
  }

  // 하루 중복 발송 방지: 보내기 전에 먼저 표시 (크론이 다시 실행돼도 같은 날 재발송하지 않음)
  await db.collection("requests").updateMany({ _id: { $in: items.map((it) => it._id) } }, { $set: { remindedOn: today } });

  const link = appUrl();
  const result = { 메일: 0, 메일_실패: [], 푸시: 0, 푸시_실패: 0 };
  for (const n of notices) {
    if (mailOn) {
      try {
        await sendReminderMail({ to: n.user.email, name: n.user.name, heading: n.heading, intro: n.intro, items: n.items, link: link + n.path });
        result.메일 += 1;
      } catch (err) {
        console.error("[reminders]", n.user.email, err);
        result.메일_실패.push({ 이름: n.user.name, 원인: describeMailError(err) });
      }
    }
    if (pushOn) {
      const { sent, failed } = await sendPush(db, [n.user._id], pushPayload(n));
      result.푸시 += sent;
      result.푸시_실패 += failed;
    }
  }
  return { ok: true, today, dry, 대상_요청: items.length, ...result, 담당자_없는_부서: noRecipient };
}

export default handle({ GET: run });
