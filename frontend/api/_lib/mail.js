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

export async function sendResetCodeMail({ to, name, code, minutes }) {
  const cfg = mailConfig();
  const safeName = String(name).replace(/[<>&"]/g, "");
  const digits = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:40px;height:52px;line-height:52px;margin:0 3px;border-radius:10px;background:#fff1ea;color:#e04d21;font-size:28px;font-weight:800;text-align:center;">${d}</span>`
    )
    .join("");

  await transport(cfg).sendMail({
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
}
