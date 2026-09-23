import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string({ error: "push_endpoint_required" })
    .trim()
    .pipe(z.url({ error: "push_endpoint_invalid" })),
  p256dh: z
    .string({ error: "push_p256dh_required" })
    .trim()
    .min(1, { error: "push_p256dh_required" }),
  auth: z
    .string({ error: "push_auth_required" })
    .trim()
    .min(1, { error: "push_auth_required" }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
