"use client";

import { loginSchema } from "@revivenotes/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import HeaderToggles from "@/components/HeaderToggles";
import { api, apiError } from "@/lib/api";
import { createRememberedShare, hasRememberedShare } from "@/lib/pending-share";
import {
  alertClass,
  authPageClass,
  buttonClass,
  fieldClass,
  labelClass,
  linkClass,
  mutedClass,
  surfacePanelClass,
  titleClass,
} from "@/lib/ui-classes";
import { translateIssue, useT } from "@/lib/use-t";

type LoginFields = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const { t, locale } = useT();
  const form = useForm<LoginFields>({
    defaultValues: { email: "", password: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [holdingShare, setHoldingShare] = useState(false);

  useEffect(() => {
    setHoldingShare(hasRememberedShare());
  }, []);

  async function onSubmit(values: LoginFields) {
    setError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading(t("signing_in"));
    try {
      const response = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    }

    const share = await createRememberedShare();
    if (share === "error") {
      const message = t("share_login_retry");
      setError(message);
      toast.error(message, { id: toastId });
      return;
    }

    toast.success(t("signed_in"), { id: toastId });
    window.location.assign("/inbox");
  }

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`mb-1 text-sm ${mutedClass}`}>{t("app_name")}</p>
          <h1 className={titleClass}>{t("login")}</h1>
        </div>
        <HeaderToggles />
      </div>
      {holdingShare ? (
        <p role="status" className={`${surfacePanelClass} text-sm`}>
          {t("share_holding_login")}
        </p>
      ) : null}
      <form
        className={`${surfacePanelClass} flex flex-col gap-4`}
        method="post"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div>
          <label className={labelClass} htmlFor="login-email">
            {t("email")}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className={fieldClass}
            {...form.register("email")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="login-password">
            {t("password")}
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className={fieldClass}
            {...form.register("password")}
          />
        </div>
        {error ? (
          <p className={alertClass} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
          {form.formState.isSubmitting ? t("signing_in") : t("login")}
        </button>
      </form>
      <p className={mutedClass}>
        <Link href="/register" className={linkClass}>
          {t("register")}
        </Link>
      </p>
    </main>
  );
}
