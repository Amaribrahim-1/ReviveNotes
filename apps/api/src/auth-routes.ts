import { createRequire } from "node:module";
import type { LoginInput, PublicUser, RegisterInput } from "@revivenotes/shared";
import { loginSchema, registerSchema } from "@revivenotes/shared";
import type { Request, Response } from "express";

const require = createRequire(import.meta.url);

// bcrypt is CommonJS. Node refuses a named import from this ES module file.
const bcrypt = require("bcrypt") as {
  hash: (data: string, rounds: number) => Promise<string>;
  compare: (data: string, hash: string) => Promise<boolean>;
};
import {
  EMAIL_IN_USE,
  LOGIN_FAILED,
  LOGIN_REQUIRED,
  TOO_MANY_ATTEMPTS,
} from "./auth-messages.js";
import { prisma } from "./db.js";
import { publicUserSelect, toPublicUser } from "./public-user.js";
import { tooManyAttempts } from "./rate-limit.js";
import { issueMessage, msg } from "./request-locale.js";
import {
  clearAuthCookies,
  hashRefreshToken,
  openSession,
  readRefreshCookie,
  rotateSession,
} from "./session.js";

const BCRYPT_COST = 12;

let dummyHash: string | null = null;

function requestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isEmailTakenError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function passwordIsCorrect(password: string, passwordHash: string | null): Promise<boolean> {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash("revive-notes-dummy-password", BCRYPT_COST);
  }

  const matches = await bcrypt.compare(password, passwordHash ?? dummyHash);
  if (!passwordHash) {
    return false;
  }
  return matches;
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  if (tooManyAttempts(requestIp(req), parsed.data.email)) {
    res.status(429).json({ error: msg(req, TOO_MANY_ATTEMPTS) });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: msg(req, EMAIL_IN_USE) });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);

  try {
    const user = await createUser(parsed.data, passwordHash);
    await openSession(user.id, res);
    res.status(201).json(toPublicUser(user));
  } catch (error) {
    if (isEmailTakenError(error)) {
      res.status(409).json({ error: msg(req, EMAIL_IN_USE) });
      return;
    }
    throw error;
  }
}

async function createUser(input: RegisterInput, passwordHash: string): Promise<PublicUser> {
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password_hash: passwordHash,
      timezone: input.timezone,
      day_start_time: 0,
      reminders_enabled: false,
      reminder_times: [],
    },
    select: publicUserSelect,
  });
  return toPublicUser(user);
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  if (tooManyAttempts(requestIp(req), parsed.data.email)) {
    res.status(429).json({ error: msg(req, TOO_MANY_ATTEMPTS) });
    return;
  }

  await startLogin(req, parsed.data, res);
}

async function startLogin(req: Request, input: LoginInput, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  const matches = await passwordIsCorrect(input.password, user?.password_hash ?? null);
  if (!user || !matches) {
    res.status(401).json({ error: msg(req, LOGIN_FAILED) });
    return;
  }

  await openSession(user.id, res);
  res.json(
    toPublicUser({
      id: user.id,
      email: user.email,
      timezone: user.timezone,
      day_start_time: user.day_start_time,
      reminders_enabled: user.reminders_enabled,
      reminder_times: user.reminder_times,
    }),
  );
}

export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req.header("cookie"));
  if (!token) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  const row = await prisma.refreshSession.findUnique({
    where: { token_hash: hashRefreshToken(token) },
  });

  if (!row) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  // Reuse of a rotated or revoked token kills this browser's session only.
  if (row.replaced_at || row.revoked_at) {
    await prisma.refreshSession.updateMany({
      where: { session_id: row.session_id },
      data: { revoked_at: new Date() },
    });
    clearAuthCookies(res);
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  if (row.expires_at.getTime() <= Date.now()) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: row.user_id },
    select: publicUserSelect,
  });
  if (!user) {
    res.status(401).json({ error: msg(req, LOGIN_REQUIRED) });
    return;
  }

  await rotateSession(user.id, row.session_id, row.id, res);
  res.json(toPublicUser(user));
}

export async function logout(req: Request, res: Response) {
  const token = readRefreshCookie(req.header("cookie"));
  if (token) {
    const row = await prisma.refreshSession.findUnique({
      where: { token_hash: hashRefreshToken(token) },
    });
    if (row) {
      await prisma.refreshSession.updateMany({
        where: { session_id: row.session_id },
        data: { revoked_at: new Date() },
      });
    }
  }

  clearAuthCookies(res);
  res.status(204).end();
}

export function me(_req: Request, res: Response) {
  // requireUser stored the public user here before this handler runs.
  const user = res.locals.user as PublicUser;
  res.json(user);
}
