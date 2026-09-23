"use client";

import { loginSchema } from "@revivenotes/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
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

type LoginFields = {
  email: string;
  password: string;
};

export default function LoginPage() {
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
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading("بندخل...");
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
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    }

    const share = await createRememberedShare();
    if (share === "error") {
      const message = "الدخول تم، والرابط لسه محفوظ. اضغط دخول تاني عشان نسجله.";
      setError(message);
      toast.error(message, { id: toastId });
      return;
    }

    toast.success("اتسجل دخولك", { id: toastId });
    window.location.assign("/inbox");
  }

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`mb-1 text-sm ${mutedClass}`}>ريفايف نوتس</p>
          <h1 className={titleClass}>دخول</h1>
        </div>
        <ThemeToggle />
      </div>
      {holdingShare ? (
        <p role="status" className={`${surfacePanelClass} text-sm`}>
          فيه رابط مستني. هيتحفظ في الوارد بعد الدخول.
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
            البريد
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
            كلمة السر
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
          {form.formState.isSubmitting ? "بندخل..." : "دخول"}
        </button>
      </form>
      <p className={mutedClass}>
        <Link href="/register" className={linkClass}>
          حساب جديد
        </Link>
      </p>
    </main>
  );
}
