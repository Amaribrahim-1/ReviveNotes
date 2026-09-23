import type { Request } from "express";
import { parseLocale, tMsg, zodErrorMessage, type Locale, type MsgKey } from "@revivenotes/shared";

export function localeFrom(req: Request): Locale {
  return parseLocale(req.header("accept-language"));
}

export function msg(req: Request, key: MsgKey): string {
  return tMsg(localeFrom(req), key);
}

export function issueMessage(req: Request, issues: { message: string }[]): string {
  return zodErrorMessage(issues, localeFrom(req));
}
