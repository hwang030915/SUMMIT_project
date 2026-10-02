/**
 * 메일 발송 (SMTP, nodemailer)
 *
 * Vercel 환경 변수
 *  SMTP_USER   보내는 메일 계정 (예: summit.team@gmail.com)        — 필수
 *  SMTP_PASS   메일 계정 앱 비밀번호 (Gmail: 16자리 앱 비밀번호)     — 필수
 *  SMTP_HOST   기본값 smtp.gmail.com  (네이버: smtp.naver.com)
 *  SMTP_PORT   기본값 465 (SSL)
 *  MAIL_FROM   보내는 사람 표시, 기본값 "SUMMIT <SMTP_USER>"
 */
import nodemailer from "nodemailer";

const cache = (globalThis.__summitMail ||= { transport: null });

/** 메일 속 'SUMMIT에서 확인하기' 링크 주소 (APP_URL > Vercel 운영 주소 > 기본 배포 주소) */
export function appUrl() {
  const url = (process.env.APP_URL || "").trim();
  if (url) return url.replace(/\/+$/, "");
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "https://summit-eight-tau.vercel.app";
}

const clean = (v) => (v || "").trim().replace(/^["']+|["']+$/g, "").trim();

export function mailConfig() {
  const user = clean(process.env.SMTP_USER);
  // Gmail 앱 비밀번호는 'abcd efgh ijkl mnop'처럼 띄어 쓰여 보이므로 공백 제거
  const pass = clean(process.env.SMTP_PASS).replace(/\s+/g, "");
  const host = clean(process.env.SMTP_HOST) || "smtp.gmail.com";
  const port = Number(clean(process.env.SMTP_PORT)) || 465;
  const from = clean(process.env.MAIL_FROM) || `SUMMIT <${user}>`;
  return { user, pass, host, port, from, enabled: Boolean(user && pass) };
}

function transport(cfg) {
  if (!cache.transport) {
    cache.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      requireTLS: cfg.port !== 465,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return cache.transport;
}

/** 메일 발송 실패 원인을 사람이 읽을 수 있게 */
export function describeMailError(err) {
  const text = `${err && err.code} ${err && err.responseCode} ${err && err.message}`;
  if (/EAUTH|535|534|Invalid login|Username and Password not accepted/i.test(text)) {
    return "메일 계정 로그인 실패: SMTP_USER/SMTP_PASS를 확인하세요. Gmail은 일반 비밀번호가 아니라 '앱 비밀번호'가 필요합니다.";
  }
  if (/ETIMEDOUT|ECONNECTION|ESOCKET|ENOTFOUND|ECONNREFUSED/i.test(text)) {
    return "메일 서버에 접속할 수 없습니다: SMTP_HOST/SMTP_PORT를 확인하세요.";
  }
  if (/EENVELOPE|550|553|recipient/i.test(text)) {
    return "받는 메일 주소로 보낼 수 없습니다.";
  }
  return "메일을 보내지 못했습니다.";
}

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** D-day 표시: 기한이 지나면 'D+n' */
const ddayLabel = (n) => (n > 0 ? `D-${n}` : n === 0 ? "D-day" : `D+${-n}`);

/**
 * 제출 기한 알림 메일
 * @param {{ to: string, name: string, heading: string, intro: string,
 *           items: { title: string, department: string, month: string, deadline: string, dday: number }[],
 *           link: string, note?: string, replyTo?: string, subject?: string }} p
 *   note: 보내는 사람이 덧붙인 말 (독촉 메일), replyTo: 답장 받을 주소, subject: 제목 직접 지정
 */
export async function sendReminderMail({ to, name, heading, intro, items, link, note = "", replyTo, subject: customSubject }) {
  const cfg = mailConfig();
  const lateCount = items.filter((it) => it.dday < 0).length;
  const subject =
    customSubject ||
    (lateCount
      ? `[SUMMIT] 기한이 지난 결산 자료 ${lateCount}건 포함 · 미제출 ${items.length}건`
      : `[SUMMIT] 제출 기한이 다가온 결산 자료 ${items.length}건`);

  const rows = items
    .map((it) => {
      const late = it.dday < 0;
      const badge = `<span style="display:inline-block;min-width:52px;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:700;text-align:center;background:${
        late ? "#fde8e8" : "#fff1ea"
      };color:${late ? "#d92d20" : "#e04d21"};">${ddayLabel(it.dday)}</span>`;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eef0f3;">
            <div style="font-size:15px;font-weight:700;color:#111827;">${escapeHtml(it.title)}</div>
            <div style="margin-top:2px;font-size:12px;color:#6b7280;">${escapeHtml(it.department)} · ${escapeHtml(it.month)} 결산 · 기한 ${escapeHtml(it.deadline)}</div>
          </td>
          <td align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid #eef0f3;white-space:nowrap;">${badge}</td>
        </tr>`;
    })
    .join("");

  const result = await transport(cfg).sendMail({
    from: cfg.from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text: [
      `${name}님, 안녕하세요.`,
      "",
      intro,
      ...(note ? ["", note] : []),
      "",
      ...items.map((it) => `- [${ddayLabel(it.dday)}] ${it.title} (${it.department}, ${it.month} 결산, 기한 ${it.deadline})`),
      "",
      `SUMMIT에서 확인하기: ${link}`,
      "",
      "놓치기 쉬운 결산, 빠짐없이 SUMMIT",
    ].join("\n"),
    html: `
<!doctype html>
<html lang="ko"><body style="margin:0;padding:32px 16px;background:#fbe3d7;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:40px;height:40px;border-radius:10px;background:#ff6a3d;color:#fff;font-size:22px;font-weight:800;text-align:center;line-height:40px;">✓</td>
          <td style="padding-left:12px;">
            <div style="font-size:22px;font-weight:800;color:#111827;">SUMMIT</div>
            <div style="font-size:12px;color:#6b7280;">놓치기 쉬운 결산, 빠짐없이 <b style="color:#ff6a3d;">SUMMIT</b></div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px 0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(name)}님, ${escapeHtml(intro)}</p>
        ${
          note
            ? `<p style="margin:12px 0 0;padding:12px 14px;border-left:3px solid #ff6a3d;border-radius:8px;background:#fff6f1;font-size:14px;line-height:1.6;color:#374151;white-space:pre-line;">${escapeHtml(note)}</p>`
            : ""
        }
      </td></tr>
      <tr><td style="padding:12px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 28px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:#ff6a3d;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">SUMMIT에서 확인하기</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw Object.assign(new Error("SMTP recipient rejected"), { code: "EENVELOPE" });
  }
}

export async function sendResetCodeMail({ to, name, code, minutes }) {
  const cfg = mailConfig();
  if (!cfg.enabled) throw Object.assign(new Error("SMTP is not configured"), { code: "EAUTH" });
  const safeName = String(name).replace(/[<>&"]/g, "");
  const digits = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:40px;height:52px;line-height:52px;margin:0 3px;border-radius:10px;background:#fff1ea;color:#e04d21;font-size:28px;font-weight:800;text-align:center;">${d}</span>`
    )
    .join("");

  const result = await transport(cfg).sendMail({
    from: cfg.from,
    to,
    subject: `[SUMMIT] 비밀번호 재설정 인증번호 ${code}`,
    text: [
      `${safeName}님, 안녕하세요.`,
      "",
      `SUMMIT 비밀번호 재설정 인증번호: ${code}`,
      `인증번호는 ${minutes}분 동안 유효합니다.`,
      "",
      "본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.",
      "",
      "놓치기 쉬운 결산, 빠짐없이 SUMMIT",
    ].join("\n"),
    html: `
<!doctype html>
<html lang="ko"><body style="margin:0;padding:32px 16px;background:#fbe3d7;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:40px;height:40px;border-radius:10px;background:#ff6a3d;color:#fff;font-size:22px;font-weight:800;text-align:center;line-height:40px;">✓</td>
          <td style="padding-left:12px;">
            <div style="font-size:22px;font-weight:800;color:#111827;">SUMMIT</div>
            <div style="font-size:12px;color:#6b7280;">놓치기 쉬운 결산, 빠짐없이 <b style="color:#ff6a3d;">SUMMIT</b></div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px 0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">비밀번호 재설정 인증번호</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${safeName}님, 아래 인증번호를 비밀번호 찾기 화면에 입력해주세요.</p>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px;">${digits}</td></tr>
      <tr><td style="padding:0 32px 28px;">
        <p style="margin:0;padding:14px 16px;border-radius:10px;background:#f7f8fa;font-size:13px;line-height:1.6;color:#6b7280;">
          인증번호는 <b style="color:#111827;">${minutes}분 동안</b> 유효합니다.<br />
          본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw Object.assign(new Error("SMTP recipient rejected"), { code: "EENVELOPE" });
  }
}
