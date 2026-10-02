/**
 * /api/auth?action=...
 *  POST login           { email, password }            → { token, user }
 *  POST signup          { name, email, department, password }
 *  POST logout          (로그인 필요)
 *  GET  me              (로그인 필요)                  → { user }
 *  PATCH profile        { role } (로그인 필요)          → { user }
 *  POST password        { newPassword } (로그인 필요)
 *  POST reset-request   { name, email }                → { expiresAt, demoCode }
 *  POST reset-verify    { email, code }                → { resetToken }
 *  POST reset-confirm   { email, resetToken, newPassword }
 */
import { getDb } from "./_lib/db.js";
import { handle, body, str, HttpError } from "./_lib/http.js";
import { hashPassword, verifyPassword, createSession, requireUser, publicUser, randomToken } from "./_lib/auth.js";
import { EMAIL_PATTERN, PASSWORD_PATTERN, PASSWORD_HINT, ROLES } from "./_lib/rules.js";

const RESET_MINUTES = 3;
const RESET_MAX_TRIES = 5;
const normEmail = (v) => str(v).trim().toLowerCase();

function checkNewPassword(pw) {
  if (!PASSWORD_PATTERN.test(str(pw))) throw new HttpError(400, PASSWORD_HINT);
}

const actions = {
  async login(req, db) {
    const { email, password } = body(req);
    const user = await db.collection("users").findOne({ email: normEmail(email) });
    if (!user || !(await verifyPassword(str(password), user.passwordHash))) {
      throw new HttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    const token = await createSession(db, user);
    return { token, user: publicUser(user) };
  },

  async signup(req, db) {
    const b = body(req);
    const name = str(b.name).trim();
    const email = normEmail(b.email);
    const department = str(b.department).trim();
    if (!name || name.length > 20) throw new HttpError(400, "이름을 20자 이내로 입력하세요.");
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, "올바른 이메일 형식이 아닙니다.");
    if (!department || department.length > 20) throw new HttpError(400, "소속 부서를 입력하세요.");
    checkNewPassword(b.password);

    try {
      const doc = {
        name,
        email,
        department,
        role: department === "재무팀" ? "재무 담당자" : "부서 담당자",
        passwordHash: await hashPassword(b.password),
        createdAt: new Date(),
      };
      const { insertedId } = await db.collection("users").insertOne(doc);
      return { user: publicUser({ ...doc, _id: insertedId }) };
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, "이미 가입된 이메일입니다.");
      throw err;
    }
  },

  async logout(req, db) {
    const { token } = await requireUser(req, db);
    await db.collection("sessions").deleteOne({ token });
    return { ok: true };
  },

  async me(req, db) {
    const { user } = await requireUser(req, db);
    return { user: publicUser(user) };
  },

  async profile(req, db) {
    const { user } = await requireUser(req, db);
    const role = str(body(req).role);
    if (!ROLES.includes(role)) throw new HttpError(400, "올바른 역할이 아닙니다.");
    await db.collection("users").updateOne({ _id: user._id }, { $set: { role } });
    return { user: publicUser({ ...user, role }) };
  },

  async password(req, db) {
    const { user, token } = await requireUser(req, db);
    const { newPassword } = body(req);
    checkNewPassword(newPassword);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword) } });
    // 다른 기기의 로그인은 종료 (지금 기기는 유지)
    await db.collection("sessions").deleteMany({ userId: user._id, token: { $ne: token } });
    return { ok: true };
  },

  /* ---------- 비밀번호 찾기 ---------- */
  async "reset-request"(req, db) {
    const b = body(req);
    const email = normEmail(b.email);
    const user = await db.collection("users").findOne({ email, name: str(b.name).trim() });
    if (!user) throw new HttpError(404, "입력하신 이름과 이메일로 가입된 계정이 없습니다.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await db.collection("resets").deleteMany({ email });
    await db.collection("resets").insertOne({
      email,
      codeHash: await hashPassword(code),
      tries: 0,
      verified: false,
      expiresAt,
    });
    // 메일 발송 서비스가 아직 없어 시연용으로 인증번호를 응답에 포함합니다.
    // 실제 운영 시 SHOW_RESET_CODE=false로 끄고 메일 발송으로 바꿔야 합니다.
    const demoCode = process.env.SHOW_RESET_CODE === "false" ? null : code;
    return { expiresAt: expiresAt.toISOString(), demoCode };
  },

  async "reset-verify"(req, db) {
    const b = body(req);
    const email = normEmail(b.email);
    const reset = await db.collection("resets").findOne({ email, expiresAt: { $gt: new Date() } });
    if (!reset) throw new HttpError(400, "인증번호가 만료되었거나 요청 기록이 없습니다. 다시 받아주세요.");
    if (reset.tries >= RESET_MAX_TRIES) throw new HttpError(429, "인증 시도 횟수를 넘었습니다. 인증번호를 다시 받아주세요.");

    if (!(await verifyPassword(str(b.code).trim(), reset.codeHash))) {
      await db.collection("resets").updateOne({ _id: reset._id }, { $inc: { tries: 1 } });
      throw new HttpError(400, "인증번호가 일치하지 않습니다.");
    }
    const resetToken = randomToken();
    await db.collection("resets").updateOne({ _id: reset._id }, { $set: { verified: true, resetToken } });
    return { resetToken };
  },

  async "reset-confirm"(req, db) {
    const b = body(req);
    const email = normEmail(b.email);
    checkNewPassword(b.newPassword);
    const reset = await db.collection("resets").findOne({
      email,
      verified: true,
      resetToken: str(b.resetToken),
      expiresAt: { $gt: new Date() },
    });
    if (!reset) throw new HttpError(400, "인증이 만료되었습니다. 처음부터 다시 진행해주세요.");

    const user = await db.collection("users").findOne({ email });
    if (!user) throw new HttpError(404, "계정을 찾을 수 없습니다.");
    await db.collection("users").updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(b.newPassword) } });
    await db.collection("sessions").deleteMany({ userId: user._id });
    await db.collection("resets").deleteMany({ email });
    return { ok: true };
  },
};

const METHOD_OF = { me: "GET", profile: "PATCH" };

async function run(req) {
  const action = str(req.query.action);
  const fn = actions[action];
  if (!fn) throw new HttpError(404, "알 수 없는 요청입니다.");
  if ((METHOD_OF[action] || "POST") !== req.method) throw new HttpError(405, "지원하지 않는 요청 방식입니다.");
  return fn(req, await getDb());
}

export default handle({ GET: run, POST: run, PATCH: run });
