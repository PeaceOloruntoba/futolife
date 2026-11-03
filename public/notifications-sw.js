self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data?.target;
  const target = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//")
    ? new URL(requested, self.location.origin).href
    : new URL("/community", self.location.origin).href;

  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});

// This listener supports push payloads if server push is added later.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { body: event.data?.text() ?? "" }; }
  const target = typeof payload.target === "string" && payload.target.startsWith("/") && !payload.target.startsWith("//") ? payload.target : "/community";
  event.waitUntil(self.registration.showNotification(payload.title ?? "FUTO Life", {
    body: payload.body ?? "You have a new notification.",
    data: { target },
    tag: payload.tag ?? "futolife-notification",
  }));
});
