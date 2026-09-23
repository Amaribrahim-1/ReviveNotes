import { pushSubscriptionSchema } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { NOT_FOUND } from "./label-messages.js";
import { prisma } from "./db.js";
import { issueMessage, msg } from "./request-locale.js";
import { readSignedInUser } from "./require-user.js";

function paramId(req: Request): string | null {
  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  return id;
}

export function vapidPublicKey(req: Request, res: Response) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    res.status(500).json({ error: msg(req, "push_vapid_missing") });
    return;
  }
  res.json({ public_key: publicKey });
}

export async function createPushSubscription(req: Request, res: Response) {
  const parsed = pushSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: {
        user_id: user.id,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
      select: { id: true },
    });
    res.json({ id: updated.id });
    return;
  }

  const created = await prisma.pushSubscription.create({
    data: {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    },
    select: { id: true },
  });
  res.status(201).json({ id: created.id });
}

export async function deletePushSubscription(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const existing = await prisma.pushSubscription.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  await prisma.pushSubscription.delete({ where: { id } });
  res.status(204).end();
}
