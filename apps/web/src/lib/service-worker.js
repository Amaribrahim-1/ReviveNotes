// Push and notification clicks only. This worker does not cache pages, API calls, or media.

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});

function readPayload(event) {
  if (!event.data) {
    return { title: "ريفايف نوتس", body: "0" };
  }
  const data = event.data.json();
  const title = typeof data.title === "string" ? data.title : "ريفايف نوتس";
  const body = typeof data.body === "string" ? data.body : "0";
  return { title, body };
}
