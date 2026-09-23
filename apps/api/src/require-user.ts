import type { PublicUser } from "@revivenotes/shared";
import type { NextFunction, Request, Response } from "express";
import { LOGIN_REQUIRED } from "./auth-messages.js";
import { prisma } from "./db.js";
import { publicUserSelect, toPublicUser } from "./public-user.js";
import { msg } from "./request-locale.js";
import { readAccessCookie, readAccessToken } from "./session.js";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = readAccessCookie(req.header("cookie"));
  if (!token) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  const access = readAccessToken(token);
  if (!access) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  const liveSession = await prisma.refreshSession.findFirst({
    where: {
      session_id: access.sessionId,
      user_id: access.userId,
      replaced_at: null,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!liveSession) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: access.userId },
    select: publicUserSelect,
  });

  if (!user) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  res.locals.user = toPublicUser(user);
  next();
}

export function readSignedInUser(res: Response): PublicUser {
  const user: unknown = res.locals.user;
  if (!isPublicUser(user)) {
    throw new Error("requireUser did not set a user");
  }
  return user;
}

function isPublicUser(value: unknown): value is PublicUser {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return false;
  }
  return typeof value.id === "string" && value.id.length > 0;
}
