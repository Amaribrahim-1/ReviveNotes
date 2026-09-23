import express, { type NextFunction, type Request, type Response } from "express";
import { login, logout, me, refresh, register } from "./auth-routes.js";
import { updateSettings } from "./settings-routes.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./category-routes.js";
import { createItem, deleteItem, getItem, listItems, postVoiceItem, streamItemFile, updateItem } from "./item-routes.js";
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

app.get("/categories", requireUser, listCategories);
app.post("/categories", requireUser, createCategory);
app.patch("/categories/:id", requireUser, updateCategory);
app.delete("/categories/:id", requireUser, deleteCategory);

app.get("/tags", requireUser, listTags);
app.post("/tags", requireUser, createTag);
app.patch("/tags/:id", requireUser, updateTag);
app.delete("/tags/:id", requireUser, deleteTag);

app.get("/items", requireUser, listItems);
app.post("/items", requireUser, createItem);
app.post("/items/voice", requireUser, postVoiceItem);
app.get("/items/:id/file", requireUser, streamItemFile);
app.get("/items/:id", requireUser, getItem);
app.patch("/items/:id", requireUser, updateItem);
app.delete("/items/:id", requireUser, deleteItem);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "حصل خطأ في السيرفر" });
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
