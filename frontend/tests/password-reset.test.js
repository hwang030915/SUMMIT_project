import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as http from "../api/_lib/http.js";
import * as auth from "../api/_lib/auth.js";
import * as rules from "../api/_lib/rules.js";
import * as crypto from "node:crypto";

// Execute the actual handlers with only external DB/SMTP boundaries replaced.
async function load(relative, dependencies, env = {}) {
  const context = createContext({ console: { error() {} }, process: { env }, Date });
  const module = new SourceTextModule(await readFile(new URL(relative, import.meta.url), "utf8"), { context });
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

async function fixture({ configured = true, fail = false } = {}) {
  const user = { _id: "user-1", name: "테스터", email: "test@example.test", passwordHash: await auth.hashPassword("Oldpass1!") };
  const records = [];
  const mails = [];
  let sessionsDeleted = 0;
  const match = (doc, query) => Object.entries(query).every(([key, value]) =>
    value && typeof value === "object" && "$gt" in value ? doc[key] > value.$gt : doc[key] === value);
  const resets = {
    async findOne(q) { return records.find(r => match(r, q)) || null; },
    async insertOne(doc) { doc._id = crypto.randomUUID(); records.push(doc); return { insertedId: doc._id }; },
    async deleteMany(q) { for (let i = records.length - 1; i >= 0; i--) if (match(records[i], q)) records.splice(i, 1); },
    async deleteOne(q) { return this.deleteMany(q); },
    async updateOne(q, update) {
      const row = await this.findOne(q);
      if (row) {
        Object.assign(row, update.$set || {});
        for (const [key, amount] of Object.entries(update.$inc || {})) row[key] += amount;
      }
    },
  };
  const db = { collection(name) {
    if (name === "resets") return resets;
    if (name === "users") return {
      async findOne(q) { return match(user, q) ? user : null; },
      async updateOne(q, update) { Object.assign(user, update.$set); },
    };
    if (name === "sessions") return { async deleteMany() { sessionsDeleted++; } };
    throw new Error(name);
  } };
  const module = await load("../api/auth.js", {
    "./_lib/db.js": { getDb: async () => db },
    "./_lib/http.js": http,
    "./_lib/auth.js": auth,
    "./_lib/rules.js": rules,
    "node:crypto": crypto,
    "./_lib/mail.js": {
      mailConfig: () => ({ enabled: configured }),
      sendResetCodeMail: async mail => {
        if (fail) throw Object.assign(new Error("SMTP failed"), { code: "EAUTH" });
        mails.push(mail);
      },
      describeMailError: () => "발송 실패",
    },
  });
  async function call(action, body = {}) {
    const res = { setHeader() {}, end(text) { this.data = JSON.parse(text); this.writableEnded = true; } };
    await module.default({ method: "POST", query: { action }, headers: {}, body: { email: user.email, name: user.name, ...body } }, res);
    return { status: res.statusCode, data: res.data };
  }
  return { call, records, mails, user, sessionsDeleted: () => sessionsDeleted };
}

test("mail-only reset: code hidden, hash stored, password changed, old sessions invalidated", async () => {
  const f = await fixture();
  const sent = await f.call("reset-request");
  assert.equal(sent.status, 200);
  assert.deepEqual(Object.keys(sent.data).sort(), ["expiresAt", "retryAt"]);
  assert.match(f.mails[0].code, /^\d{6}$/);
  assert.equal(await auth.verifyPassword(f.mails[0].code, f.records[0].codeHash), true);
  assert.equal(f.records[0].delivery, "email");
  assert.equal((await f.call("reset-request")).status, 429);
  assert.equal((await f.call("reset-verify", { code: "wrong" })).status, 400);
  const verified = await f.call("reset-verify", { code: f.mails[0].code });
  assert.equal(verified.status, 200);
  const result = await f.call("reset-confirm", { resetToken: verified.data.resetToken, newPassword: "Newpass2!" });
  assert.equal(result.status, 200);
  assert.equal(await auth.verifyPassword("Newpass2!", f.user.passwordHash), true);
  assert.equal(await auth.verifyPassword("Oldpass1!", f.user.passwordHash), false);
  assert.equal(f.sessionsDeleted(), 1);
  assert.equal(f.records.length, 0);
  assert.equal((await f.call("reset-confirm", { resetToken: verified.data.resetToken, newPassword: "Nextpass3!" })).status, 400);
});

test("missing SMTP fails closed without creating or revealing a code", async () => {
  const f = await fixture({ configured: false });
  assert.equal((await f.call("reset-request")).status, 503);
  assert.equal(f.records.length, 0);
  assert.equal(f.mails.length, 0);
});

test("SMTP failure invalidates the code and permits retry", async () => {
  const f = await fixture({ fail: true });
  assert.equal((await f.call("reset-request")).status, 502);
  assert.equal(f.records.length, 0);
  assert.equal((await f.call("reset-request")).status, 502);
});

test("old demo records and expired codes cannot verify or reset a password", async () => {
  const f = await fixture();
  await f.call("reset-request");
  f.records[0].delivery = "demo";
  assert.equal((await f.call("reset-verify", { code: f.mails[0].code })).status, 400);
  Object.assign(f.records[0], { verified: true, resetToken: "old-demo-token" });
  assert.equal((await f.call("reset-confirm", { resetToken: "old-demo-token", newPassword: "Newpass2!" })).status, 400);
  f.records[0].delivery = "email";
  f.records[0].expiresAt = new Date(0);
  assert.equal((await f.call("reset-verify", { code: f.mails[0].code })).status, 400);
});

test("five incorrect attempts block even the correct code", async () => {
  const f = await fixture();
  await f.call("reset-request");
  for (let i = 0; i < 5; i++) assert.equal((await f.call("reset-verify", { code: "wrong" })).status, 400);
  assert.equal((await f.call("reset-verify", { code: f.mails[0].code })).status, 429);
});

test("SMTP adapter sends reset and reminder mail with TLS and rejects non-acceptance", async () => {
  let options, message;
  let accepted = true;
  const mail = await load("../api/_lib/mail.js", {
    nodemailer: { default: { createTransport(config) {
      options = config;
      return { async sendMail(payload) {
        message = payload;
        return accepted ? { accepted: [payload.to], rejected: [] } : { accepted: [], rejected: [payload.to] };
      } };
    } } },
  }, { SMTP_USER: "sender@example.test", SMTP_PASS: "test-secret", SMTP_PORT: "587" });
  await mail.sendResetCodeMail({ to: "recipient@example.test", name: "테스터", code: "123456", minutes: 3 });
  assert.equal(options.requireTLS, true);
  assert.equal(message.to, "recipient@example.test");
  assert.ok(message.text.includes("123456"));
  assert.ok(message.html.includes("테스터"));

  await mail.sendReminderMail({
    to: "department@example.test",
    name: "이구매",
    heading: "결산 자료 제출 요청",
    intro: "9월 결산 자료를 확인해 주세요.",
    note: "오늘 중 확인 부탁드립니다.",
    replyTo: "finance@example.test",
    subject: "[SUMMIT] 구매팀 독촉",
    link: "https://summit.example.test/submit.html",
    items: [{ title: "미지급 내역", department: "구매팀", month: "2026-09", deadline: "2026-09-30", dday: -2 }],
  });
  assert.equal(message.to, "department@example.test");
  assert.equal(message.replyTo, "finance@example.test");
  assert.equal(message.subject, "[SUMMIT] 구매팀 독촉");
  assert.ok(message.text.includes("미지급 내역"));
  assert.ok(message.html.includes("오늘 중 확인 부탁드립니다."));
  accepted = false;
  await assert.rejects(mail.sendResetCodeMail({ to: "recipient@example.test", name: "테스터", code: "123456", minutes: 3 }), { code: "EENVELOPE" });
});
