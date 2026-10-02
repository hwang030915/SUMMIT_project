/** API 공통: 오류 형식과 응답 도우미 */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

/** 핸들러를 감싸 오류를 { error } JSON으로 돌려줌 */
export function handle(methods) {
  return async (req, res) => {
    try {
      const fn = methods[req.method];
      if (!fn) throw new HttpError(405, "지원하지 않는 요청 방식입니다.");
      const result = await fn(req, res);
      if (!res.writableEnded) send(res, 200, result ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      send(res, status, {
        error: status === 500 ? "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요." : err.message,
      });
    }
  };
}

export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") {
    try {
      return JSON.parse(b);
    } catch {
      throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    }
  }
  return b;
}

export const str = (v) => (typeof v === "string" ? v : "");
