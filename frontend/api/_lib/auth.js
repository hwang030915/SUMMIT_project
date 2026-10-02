/**
 * 비밀번호 해시와 로그인 세션
 * - 비밀번호: Node 내장 scrypt (salt 포함)
 * - 세션: 무작위 토큰을 sessions 컬렉션에 저장, 12시간 뒤 자동 삭제(TTL)
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./http.js";

const scrypt = promisify(scryptCb);
const SESSION_HOURS = 12;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [, salt, hex] = String(stored || "").split("$");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export const randomToken = () => randomBytes(32).toString("hex");

export function publicUser(u) {
  return { id: String(u._id), name: u.name, email: u.email, department: u.department, role: u.role };
}

export async function createSession(db, user) {
  const token = randomToken();
  await db.collection("sessions").insertOne({
    token,
    userId: user._id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000),
  });
  return token;
}

function tokenFrom(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** 로그인한 사용자 확인. 없으면 401 */
export async function requireUser(req, db) {
  const token = tokenFrom(req);
  if (!token) throw new HttpError(401, "로그인이 필요합니다.");
  const session = await db.collection("sessions").findOne({ token, expiresAt: { $gt: new Date() } });
  if (!session) throw new HttpError(401, "로그인이 만료되었습니다. 다시 로그인하세요.");
  const user = await db.collection("users").findOne({ _id: session.userId });
  if (!user) throw new HttpError(401, "계정을 찾을 수 없습니다. 다시 로그인하세요.");
  return { user, token };
}
