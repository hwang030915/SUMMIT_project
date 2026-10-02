/**
 * 서비스 워커 — 서버가 보낸 기한 알림을 SUMMIT 탭이 닫혀 있어도 운영체제 알림으로 띄웁니다.
 * 알림을 누르면 열려 있는 SUMMIT 창으로 이동하고, 없으면 새 창을 엽니다.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "SUMMIT", {
      body: data.body || "",
      tag: data.tag || "summit",
      renotify: true, // 같은 tag여도 다시 알림 (매일 알림)
      lang: "ko",
      data: { url: data.url || "/main.html" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/main.html", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        await win.focus();
        return win.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
