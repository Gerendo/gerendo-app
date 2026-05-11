self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Gerendo", body: event.data.text() };
  }
  const { title, body, actions, tag, data: notifData } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/Gerendo-Favicon.png",
      tag: tag ?? "gerendo",
      actions: actions ?? [],
      data: notifData ?? {},
    }).catch((err) => {
      console.error("[sw] showNotification failed:", err);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { action } = event;
  const { findingId, confirmUrl, dismissUrl } = event.notification.data ?? {};

  let targetUrl = "/ask";

  if (action === "confirm" && confirmUrl) {
    targetUrl = confirmUrl;
  } else if (action === "dismiss" && dismissUrl) {
    targetUrl = dismissUrl;
  } else if (action === "edit" && findingId) {
    targetUrl = `/ask?finding=${findingId}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.postMessage({ type: "PUSH_ACTION", action, findingId, targetUrl });
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
