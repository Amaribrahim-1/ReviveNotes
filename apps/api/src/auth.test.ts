import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { hashRefreshToken, readRefreshCookie } from "./session.js";

const password = "password-ok";
const emails: string[] = [];

function nextEmail(label: string): string {
  const email = `t2-${label}-${randomUUID()}@example.com`;
  emails.push(email);
  return email;
}

function cookieHeader(response: { headers: { "set-cookie"?: string | string[] } }): string {
  const header = response.headers["set-cookie"];
  if (!header) {
    throw new Error("expected Set-Cookie");
  }
  const lines = Array.isArray(header) ? header : [header];
  return lines.map((line) => line.split(";")[0] ?? "").join("; ");
}

function postRegister(email: string, timezone = "Africa/Cairo", plainPassword = password) {
  return request(app).post("/auth/register").send({ email, password: plainPassword, timezone });
}

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("auth", () => {
  it("registers, stores a lowercased email, and opens a session", async () => {
    const email = nextEmail("register");
    const paddedEmail = `  ${email.toUpperCase()}  `;
    emails.push(paddedEmail);
    const response = await postRegister(paddedEmail);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email,
      timezone: "Africa/Cairo",
      day_start_time: 0,
      reminders_enabled: false,
      reminder_times: [],
    });
    expect(response.body.password_hash).toBeUndefined();
    expect(response.body.access_token).toBeUndefined();
    expect(response.body.refresh_token).toBeUndefined();

    const setCookie = (response.headers["set-cookie"] ?? []).join(" ");
    expect(setCookie).toContain("access_token=");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=none");

    const me = await request(app).get("/me").set("Cookie", cookieHeader(response));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
    expect(me.body.password_hash).toBeUndefined();
  });

  it("returns the same error for an unknown email and a wrong password", async () => {
    const email = nextEmail("login");
    const created = await postRegister(email);
    expect(created.status).toBe(201);

    const wrongPassword = await request(app).post("/auth/login").send({
      email,
      password: "password-no",
    });
    const unknownEmail = await request(app).post("/auth/login").send({
      email: nextEmail("missing"),
      password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: "البريد أو كلمة السر غير صحيحة" });
    expect(unknownEmail.body).toEqual(wrongPassword.body);

    const loggedIn = await request(app).post("/auth/login").send({ email, password });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.email).toBe(email);
    expect(loggedIn.body.access_token).toBeUndefined();
    expect(loggedIn.body.password_hash).toBeUndefined();
  });

  it("logs out one browser and leaves the other browser logged in", async () => {
    const email = nextEmail("logout");
    const first = await postRegister(email);
    const second = await request(app).post("/auth/login").send({ email, password });
    const firstCookies = cookieHeader(first);
    const secondCookies = cookieHeader(second);

    const loggedOut = await request(app).post("/auth/logout").set("Cookie", firstCookies);
    expect(loggedOut.status).toBe(204);

    const firstMe = await request(app).get("/me").set("Cookie", firstCookies);
    const secondMe = await request(app).get("/me").set("Cookie", secondCookies);
    expect(firstMe.status).toBe(401);
    expect(secondMe.status).toBe(200);
    expect(secondMe.body.email).toBe(email);
  });

  it("revokes the whole browser session when a rotated refresh token is used again", async () => {
    const email = nextEmail("reuse");
    const first = await postRegister(email);
    const otherBrowser = await request(app).post("/auth/login").send({ email, password });
    const oldCookies = cookieHeader(first);

    const rotated = await request(app).post("/auth/refresh").set("Cookie", oldCookies);
    expect(rotated.status).toBe(200);
    const newCookies = cookieHeader(rotated);

    const reused = await request(app).post("/auth/refresh").set("Cookie", oldCookies);
    expect(reused.status).toBe(401);

    const meAfterReuse = await request(app).get("/me").set("Cookie", newCookies);
    expect(meAfterReuse.status).toBe(401);

    const otherMe = await request(app).get("/me").set("Cookie", cookieHeader(otherBrowser));
    expect(otherMe.status).toBe(200);
    expect(otherMe.body.email).toBe(email);
  });

  it("does not log out the other browser when refresh is missing, bad, or expired", async () => {
    const email = nextEmail("refresh-fail");
    const first = await postRegister(email);
    const second = await request(app).post("/auth/login").send({ email, password });
    const firstCookies = cookieHeader(first);
    const secondCookies = cookieHeader(second);

    const missing = await request(app).post("/auth/refresh");
    expect(missing.status).toBe(401);

    const bad = await request(app)
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=not-a-real-token");
    expect(bad.status).toBe(401);

    const stillThere = await request(app).get("/me").set("Cookie", firstCookies);
    const otherStillThere = await request(app).get("/me").set("Cookie", secondCookies);
    expect(stillThere.status).toBe(200);
    expect(otherStillThere.status).toBe(200);

    const refreshToken = readRefreshCookie(firstCookies);
    await prisma.refreshSession.update({
      where: { token_hash: hashRefreshToken(refreshToken ?? "") },
      data: { expires_at: new Date(Date.now() - 60_000) },
    });

    const expired = await request(app).post("/auth/refresh").set("Cookie", firstCookies);
    expect(expired.status).toBe(401);

    const otherAfterExpiry = await request(app).get("/me").set("Cookie", secondCookies);
    expect(otherAfterExpiry.status).toBe(200);
    expect(otherAfterExpiry.body.email).toBe(email);
  });

  it.each([
    {
      label: "7 characters",
      password: "1234567",
      message: "كلمة السر لازم تكون 8 حروف على الأقل",
    },
    {
      label: "73 bytes",
      password: "a".repeat(73),
      message: "كلمة السر أطول من المسموح",
    },
  ])("rejects a password of $label", async ({ password: plainPassword, message }) => {
    const response = await postRegister(nextEmail("password"), "Africa/Cairo", plainPassword);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: message });
  });

  it("rejects a second register for the same email", async () => {
    const email = nextEmail("taken");
    const first = await postRegister(email);
    expect(first.status).toBe(201);

    const paddedEmail = `  ${email.toUpperCase()}  `;
    emails.push(paddedEmail);
    const second = await postRegister(paddedEmail);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: "البريد مستخدم بالفعل" });
  });

  it("returns 429 on the 6th register or login attempt for the same IP and email", async () => {
    const email = nextEmail("rate");

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post("/auth/login").send({ email, password });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app).post("/auth/login").send({ email, password });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "محاولات كتير. استنى شوية وحاول تاني." });
  });

  it("does not return user A from user B's cookie", async () => {
    const emailA = nextEmail("user-a");
    const emailB = nextEmail("user-b");
    await postRegister(emailA);
    const userB = await postRegister(emailB);

    const me = await request(app).get("/me").set("Cookie", cookieHeader(userB));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(emailB);
    expect(me.body.email).not.toBe(emailA);
  });

  it("allows only the configured web origin", async () => {
    process.env.WEB_ORIGIN = "http://localhost:3000";

    const allowed = await request(app).get("/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["access-control-allow-origin"]).not.toBe("*");

    const blocked = await request(app).get("/health").set("Origin", "http://evil.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();

    const preflight = await request(app)
      .options("/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
