import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { Response } from "express";
import type { JwtPayload, SignOptions, VerifyOptions } from "jsonwebtoken";
import { prisma } from "./db.js";

const require = createRequire(import.meta.url);

// jsonwebtoken is CommonJS. Node refuses a named import from this ES module file.
const jwt = require("jsonwebtoken") as {
  sign: (payload: object, secret: string, options: SignOptions) => string;
  verify: (token: string, secret: string, options: VerifyOptions) => JwtPayload | string;
};

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

// 15 minutes and 30 days. These are fixed. They are not env settings.
const ACCESS_SECONDS = 15 * 60;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

// The web app and the API are different sites (different ports, and later
// Vercel and Render). SameSite=None is required for the browser to send
// these cookies. Secure stays on because Chromium treats http://localhost
// as a secure context.
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
};

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing. Add it to apps/api/.env.");
  }
  return secret;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  const parts = header.split(";");
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

function signAccessToken(userId: string, sessionId: string): string {
  // sid lets /me reject this cookie after the session is revoked,
  // even while the JWT itself is still inside 15 minutes.
  return jwt.sign({ sub: userId, sid: sessionId }, accessSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_SECONDS,
  });
}

export function readAccessToken(token: string): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, accessSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string") {
      return null;
    }
    const body = payload;
    if (typeof body.sub !== "string" || typeof body.sid !== "string") {
      return null;
    }
    return { userId: body.sub, sessionId: body.sid };
  } catch {
    return null;
  }
}

async function storeRefreshToken(userId: string, sessionId: string, res: Response) {
  const refreshToken = randomBytes(32).toString("base64url");
  await prisma.refreshSession.create({
    data: {
      user_id: userId,
      session_id: sessionId,
      token_hash: hashRefreshToken(refreshToken),
      expires_at: new Date(Date.now() + REFRESH_MS),
    },
  });
  setAuthCookies(res, signAccessToken(userId, sessionId), refreshToken);
}

export async function openSession(userId: string, res: Response) {
  await storeRefreshToken(userId, randomUUID(), res);
}

export async function rotateSession(
  userId: string,
  sessionId: string,
  oldRowId: string,
  res: Response,
) {
  const refreshToken = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: oldRowId },
      data: { replaced_at: now },
    }),
    prisma.refreshSession.create({
      data: {
        user_id: userId,
        session_id: sessionId,
        token_hash: hashRefreshToken(refreshToken),
        expires_at: new Date(now.getTime() + REFRESH_MS),
      },
    }),
  ]);

  setAuthCookies(res, signAccessToken(userId, sessionId), refreshToken);
}

export function readRefreshCookie(header: string | undefined): string | null {
  return readCookie(header, REFRESH_COOKIE);
}

export function readAccessCookie(header: string | undefined): string | null {
  return readCookie(header, ACCESS_COOKIE);
}
