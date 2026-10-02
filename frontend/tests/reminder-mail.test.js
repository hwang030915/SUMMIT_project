import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as http from "../api/_lib/http.js";
import * as rules from "../api/_lib/rules.js";

async function loadRequests(dependencies) {
  const context = createContext({ console: { error() {} }, process: { env: {} }, Date, Buffer });
  const module = new SourceTextModule(await readFile(new URL("../api/requests.js", import.meta.url), "utf8"), { context });
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
      },
      { context }
    );
  });
  await module.evaluate();
  return module.namespace.default;
}

function cursor(rows) {
  return {
    sort() {
      return this;
    },
    async toArray() {
      return rows;
    },
  };
}

async function fixture({ configured = true, failingAddress = "" } = {}) {
  const sender = { _id: "sender-1", name: "김재무", email: "finance@example.test", department: "재무팀" };
  const requests = [
    { _id: "request-1", month: "2026-09", title: "미지급 내역", department: "구매팀", deadline: "2026-09-29", status: "pending" },
    { _id: "request-2", month: "2026-09", title: "완료 자료", department: "구매팀", deadline: "2026-09-28", status: "done" },
  ];
  const recipients = [
    { _id: "user-1", name: "이구매", email: "buy@example.test", department: "구매팀" },
    { _id: "user-2", name: "박구매", email: "buyer2@example.test", department: "구매팀" },
  ];
  const mails = [];
  const logs = [];
  const db = {
    collection(name) {
      if (name === "requests") {
        return {
          find(query) {
            return cursor(
              requests.filter(
                (item) =>
                  item.month === query.month &&
                  item.department === query.department &&
                  item.status !== query.status.$ne
              )
            );
          },
          async distinct() {
            return ["2026-09"];
          },
        };
      }
      if (name === "users") return { find: () => cursor(recipients) };
      if (name === "remind_logs") {
        return {
          async findOne() {
            return null;
          },
          async insertOne(doc) {
            logs.push(doc);
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };

  const handler = await loadRequests({
    mongodb: { ObjectId: class ObjectId { static isValid() { return true; } } },
    "./_lib/db.js": { getDb: async () => db, toRequest: (value) => value },
    "./_lib/auth.js": { requireUser: async () => ({ user: sender }) },
    "./_lib/http.js": http,
    "./_lib/rules.js": rules,
    "./_lib/mail.js": {
      mailConfig: () => ({ enabled: configured }),
      appUrl: () => "https://summit.example.test",
      describeMailError: () => "테스트 발송 실패",
      async sendReminderMail(message) {
        if (message.to === failingAddress) throw Object.assign(new Error("SMTP failed"), { code: "EAUTH" });
        mails.push(message);
      },
    },
  });

  async function call(body = {}) {
    const res = { setHeader() {}, end(text) { this.data = JSON.parse(text); this.writableEnded = true; } };
    await handler({ method: "POST", query: { action: "remind" }, headers: {}, body: { department: "구매팀", month: "2026-09", ...body } }, res);
    return { status: res.statusCode, data: res.data };
  }

  return { call, mails, logs, sender };
}

test("chat reminder endpoint sends pending items to every department member", async () => {
  const f = await fixture();
  const result = await f.call({ note: "오늘 중 확인 부탁드립니다." });

  assert.equal(result.status, 200);
  assert.equal(result.data.sent.length, 2);
  assert.equal(result.data.items, 1);
  assert.equal(f.mails.length, 2);
  assert.equal(f.mails[0].replyTo, f.sender.email);
  assert.equal(f.mails[0].items.length, 1);
  assert.equal(f.mails[0].items[0].title, "미지급 내역");
  assert.equal(f.mails[0].note, "오늘 중 확인 부탁드립니다.");
  assert.equal(f.logs.length, 1);
  assert.deepEqual(Array.from(f.logs[0].to), ["buy@example.test", "buyer2@example.test"]);
});

test("chat reminder endpoint reports partial SMTP failures and logs only accepted recipients", async () => {
  const f = await fixture({ failingAddress: "buyer2@example.test" });
  const result = await f.call();

  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.sent, (recipient) => recipient.email), ["buy@example.test"]);
  assert.deepEqual(Array.from(result.data.failed, (recipient) => recipient.email), ["buyer2@example.test"]);
  assert.deepEqual(Array.from(f.logs[0].to), ["buy@example.test"]);
});

test("chat reminder endpoint fails closed when SMTP is not configured", async () => {
  const f = await fixture({ configured: false });
  const result = await f.call();

  assert.equal(result.status, 503);
  assert.equal(f.mails.length, 0);
  assert.equal(f.logs.length, 0);
  assert.match(result.data.error, /SMTP_USER/);
});
