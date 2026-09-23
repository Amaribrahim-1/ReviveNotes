import express, { type NextFunction, type Request, type Response } from "express";
import { login, logout, me, refresh, register } from "./auth-routes.js";
import { createPushSubscription, deletePushSubscription, vapidPublicKey } from "./push-routes.js";
import { dispatchReminders } from "./reminder-routes.js";
import { updateSettings } from "./settings-routes.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./category-routes.js";
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  listRevival,
  postImageItem,
  postVoiceItem,
  reviveItem,
  streamItemFile,
  updateItem,
} from "./item-routes.js";
import { getTodayProgress } from "./progress-routes.js";
import { msg } from "./request-locale.js";
import { requireUser } from "./require-user.js";
import { createTag, deleteTag, listTags, updateTag } from "./tag-routes.js";

export const app = express();

app.use(allowWebOrigin);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/auth/refresh", refresh);
app.post("/auth/logout", logout);
app.get("/me", requireUser, me);
app.patch("/me", requireUser, updateSettings);
app.get("/push/vapid-public-key", requireUser, vapidPublicKey);
app.post("/push-subscriptions", requireUser, createPushSubscription);
app.delete("/push-subscriptions/:id", requireUser, deletePushSubscription);
app.post("/reminders/dispatch", dispatchReminders);

app.get("/categories", requireUser, listCategories);
app.post("/categories", requireUser, createCategory);
app.patch("/categories/:id", requireUser, updateCategory);
app.delete("/categories/:id", requireUser, deleteCategory);

app.get("/tags", requireUser, listTags);
app.post("/tags", requireUser, createTag);
app.patch("/tags/:id", requireUser, updateTag);
app.delete("/tags/:id", requireUser, deleteTag);

app.get("/progress/today", requireUser, getTodayProgress);
app.get("/revival", requireUser, listRevival);
app.get("/items", requireUser, listItems);
app.post("/items", requireUser, createItem);
app.post("/items/voice", requireUser, postVoiceItem);
app.post("/items/image", requireUser, postImageItem);
app.get("/items/:id/file", requireUser, streamItemFile);
app.get("/items/:id", requireUser, getItem);
app.patch("/items/:id", requireUser, updateItem);
app.post("/items/:id/revive", requireUser, reviveItem);
app.delete("/items/:id", requireUser, deleteItem);

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: msg(req, "server_error") });
});

function allowWebOrigin(req: Request, res: Response, next: NextFunction) {
  const allowedOrigin = process.env.WEB_ORIGIN;
  const requestOrigin = req.header("origin");

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept-Language");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
