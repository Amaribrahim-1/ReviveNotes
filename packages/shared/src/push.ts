import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string({ error: "عنوان الاشتراك ناقص" })
    .trim()
    .pipe(z.url({ error: "عنوان الاشتراك مش صحيح" })),
  p256dh: z
    .string({ error: "مفتاح الاشتراك ناقص" })
    .trim()
    .min(1, { error: "مفتاح الاشتراك ناقص" }),
  auth: z.string({ error: "سر الاشتراك ناقص" }).trim().min(1, { error: "سر الاشتراك ناقص" }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
