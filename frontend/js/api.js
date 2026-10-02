/**
 * 서버(API) 호출 공통
 * - 로그인 토큰을 Authorization 헤더에 붙임
 * - 실패하면 서버가 준 메시지로 Error를 던짐
 * - 로그인이 만료(401)되면 로그인 화면으로 이동
 */
const Api = (() => {
  const SESSION_KEY = "gyeolsan.session";
  const AUTH_PAGES = /(login|signup|find-password)\.html$/;

  function token() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && s.token;
    } catch {
      return null;
    }
  }

  function offlineMessage() {
    return location.protocol === "file:"
      ? "파일로 직접 열면 서버에 연결할 수 없습니다. 배포 주소나 'npx vercel dev'로 실행하세요."
      : "서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.";
  }

  async function call(path, { method = "GET", body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const t = token();
    if (auth && t) headers.Authorization = `Bearer ${t}`;

    let res;
    try {
      res = await fetch(`/api/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error(offlineMessage());
    }
    return res;
  }

  function handleUnauthorized(res, auth) {
    if (res.status === 401 && auth) {
      sessionStorage.removeItem(SESSION_KEY);
      if (!AUTH_PAGES.test(location.pathname)) location.replace("login.html");
    }
  }

  async function request(path, options = {}) {
    const res = await call(path, options);
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* 본문 없음 */
    }
    handleUnauthorized(res, options.auth !== false);
    if (!res.ok) {
      if (res.status === 413) throw new Error("파일이 너무 큽니다. 첨부파일 합계를 3MB 이하로 줄여주세요.");
      const err = new Error((data && data.error) || `요청에 실패했습니다. (${res.status})`);
      err.status = res.status;
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  /** 파일 내려받기 (로그인 토큰이 필요해서 fetch → Blob → 다운로드) */
  async function download(path, filename) {
    const res = await call(path);
    handleUnauthorized(res, true);
    if (!res.ok) {
      let msg = `파일을 내려받지 못했습니다. (${res.status})`;
      try {
        msg = (await res.json()).error || msg;
      } catch {
        /* 무시 */
      }
      throw new Error(msg);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { SESSION_KEY, request, download };
})();
