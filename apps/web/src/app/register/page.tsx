"use client";

import { registerSchema } from "@revivenotes/shared";
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
import { useRedirectIfSignedIn } from "@/lib/use-redirect-if-signed-in";
import { translateIssue, useT } from "@/lib/use-t";

// Every account starts on Cairo time. The API still accepts any IANA zone for other clients.
const REGISTER_TIMEZONE = "Africa/Cairo";

type RegisterFields = {
  email: string;
  password: string;
};

export default function RegisterPage() {
  const { t, locale } = useT();
  const form = useForm<RegisterFields>({
    defaultValues: { email: "", password: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [holdingShare, setHoldingShare] = useState(false);
  const showPage = useRedirectIfSignedIn();

  useEffect(() => {
    setHoldingShare(hasRememberedShare());
  }, []);

  async function onSubmit(values: RegisterFields) {
    setError(null);
    const parsed = registerSchema.safeParse({
      email: values.email,
      password: values.password,
      timezone: REGISTER_TIMEZONE,
    });
    if (!parsed.success) {
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading(t("registering"));
    try {
      const response = await api("/auth/register", {
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
      const message = t("share_register_retry");
      setError(message);
      toast.error(message, { id: toastId });
      return;
    }

    toast.success(t("account_created"), { id: toastId });
    window.location.assign("/inbox");
  }

  if (!showPage) {
    return (
      <main className={authPageClass}>
        <p role="status" className={mutedClass}>
          {t("confirming_session")}
        </p>
      </main>
    );
  }

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`mb-1 text-sm ${mutedClass}`}>{t("app_name")}</p>
          <h1 className={titleClass}>{t("register")}</h1>
        </div>
        <HeaderToggles />
      </div>
      {holdingShare ? (
        <p role="status" className={`${surfacePanelClass} text-sm`}>
          {t("share_holding_register")}
        </p>
      ) : null}
      <form
        className={`${surfacePanelClass} flex flex-col gap-4`}
        method="post"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div>
          <label className={labelClass} htmlFor="register-email">
            {t("email")}
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            className={fieldClass}
            {...form.register("email")}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="register-password">
            {t("password")}
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
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
          {form.formState.isSubmitting ? t("registering") : t("register_submit")}
        </button>
      </form>
      <p className={mutedClass}>
        <Link href="/login" className={linkClass}>
          {t("have_account")}
        </Link>
      </p>
    </main>
  );
}
