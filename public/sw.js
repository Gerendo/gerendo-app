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
  const { findingId, confirmUrl, dismissUrl, targetUrl: dataTargetUrl } = event.notification.data ?? {};

  // Background-action: POST and show a follow-up notification with the result.
  if (action === "confirm" && confirmUrl) {
    event.waitUntil(
      fetch(confirmUrl, { method: "POST", credentials: "same-origin" })
        .then(async (res) => {
          let payload = {};
          try { payload = await res.json(); } catch {}
          const ok = res.ok && (payload.status === "accepted" || payload.status === "already-resolved");
          const taskLinked = payload.task_linked !== false;
          if (ok && !taskLinked) {
            return self.registration.showNotification("Decision recorded, no match", {
              body: "No matching Asana task. Tap to create a new project.",
              icon: "/Gerendo-Favicon.png",
              tag: `gerendo-result-${findingId}`,
              data: { targetUrl: "/drift/pending" },
            });
          }
          return self.registration.showNotification(
            ok ? "Updated" : "Could not update",
            {
              body: ok ? "Asana task updated and team notified." : "Open Gerendo to retry.",
              icon: "/Gerendo-Favicon.png",
              tag: `gerendo-result-${findingId}`,
            }
          );
        })
        .catch(() =>
          self.registration.showNotification("Could not update", {
            body: "Open Gerendo to retry.",
            icon: "/Gerendo-Favicon.png",
            tag: `gerendo-result-${findingId}`,
          })
        )
    );
    return;
  }

  if (action === "dismiss" && dismissUrl) {
    event.waitUntil(
      fetch(dismissUrl, { method: "POST", credentials: "same-origin" }).catch(() => {})
    );
    return;
  }

  // Default: focus or open the app at a target URL.
  let targetUrl = dataTargetUrl || "/ask";
  if (action === "edit" && findingId) {
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
