/**
 * 기한 알림(웹 푸시) 켜기/끄기 — 상단 종 버튼
 * - 켜면 이 브라우저에 알림 권한을 받고 서버에 구독을 저장합니다.
 * - 서버가 매일 아침 D-3 ~ 지연된 미제출 자료를 운영체제 알림으로 보냅니다 (SUMMIT 탭이 닫혀 있어도).
 */
const Push = (() => {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let button = null;
  let busy = false;

  /** VAPID 공개 키(base64url) → Uint8Array */
  function keyBytes(base64url) {
    const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  async function registration() {
    return navigator.serviceWorker.register("/sw.js");
  }

  async function currentSubscription() {
    if (!supported) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? reg.pushManager.getSubscription() : null;
  }

  function render(state) {
    if (!button) return;
    const labels = {
      on: "기한 알림 켜짐 — 누르면 끕니다",
      off: "기한 알림 켜기",
      denied: "브라우저에서 알림이 차단되어 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔주세요.",
      unsupported: "이 브라우저는 알림을 지원하지 않습니다.",
    };
    button.innerHTML = Icons.get(state === "on" ? "bellFill" : state === "off" ? "bell" : "bellOff");
    button.classList.toggle("is-on", state === "on");
    button.classList.toggle("is-blocked", state === "denied" || state === "unsupported");
    button.title = labels[state];
    button.setAttribute("aria-label", labels[state]);
    button.setAttribute("aria-pressed", String(state === "on"));
  }

  async function refresh() {
    if (!supported) return render("unsupported");
    if (Notification.permission === "denied") return render("denied");
    render((await currentSubscription()) ? "on" : "off");
  }

  async function enable() {
    const { enabled, publicKey } = await Api.request("push");
    if (!enabled) throw new Error("알림 기능이 아직 설정되지 않았습니다. 관리자에게 문의하세요.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      await refresh();
      throw new Error("알림 권한을 허용해야 기한 알림을 받을 수 있습니다.");
    }
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    await Api.request("push", { method: "POST", body: { subscription: sub.toJSON() } });
    await Api.request("push?action=test", { method: "POST" }); // 켜졌는지 바로 보이도록 시험 알림
    UI.toast("기한 알림을 켰습니다. 매일 아침 D-3부터 지연된 자료까지 알려드립니다.");
  }

  async function disable() {
    const sub = await currentSubscription();
    if (sub) {
      await Api.request("push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    UI.toast("기한 알림을 껐습니다.");
  }

  async function onClick() {
    if (busy) return;
    if (!supported) return UI.toast("이 브라우저는 알림을 지원하지 않습니다. Chrome이나 Edge를 사용해주세요.", "error");
    if (Notification.permission === "denied") return UI.toast(button.title, "error");
    busy = true;
    try {
      if (await currentSubscription()) await disable();
      else await enable();
    } catch (err) {
      UI.toast(err.message || "알림 설정에 실패했습니다.", "error");
    } finally {
      busy = false;
      refresh();
    }
  }

  /** Layout이 헤더를 그린 뒤 종 버튼을 연결 */
  function bind(btn) {
    button = btn;
    button.addEventListener("click", onClick);
    refresh();
    // 이미 켠 사용자는 서비스 워커를 최신으로 유지하고, 구독을 지금 로그인한 사용자 것으로 갱신
    if (supported && Notification.permission === "granted") {
      currentSubscription()
        .then((sub) => sub && Api.request("push", { method: "POST", body: { subscription: sub.toJSON() } }))
        .catch(() => {});
      registration().catch(() => {});
    }
  }

  return { bind };
})();
