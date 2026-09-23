import webpush from "web-push";

type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// "gone" means the push service returned 404 or 410. The caller deletes that row.
export async function sendWebPush(target: PushTarget, body: string): Promise<"sent" | "gone"> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are required");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: {
          p256dh: target.p256dh,
          auth: target.auth,
        },
      },
      JSON.stringify({ title: "ريفايف نوتس", body }),
    );
    return "sent";
  } catch (error) {
    if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      return "gone";
    }
    throw error;
  }
}
