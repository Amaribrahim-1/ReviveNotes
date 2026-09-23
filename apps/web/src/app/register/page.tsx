"use client";

import { registerSchema } from "@revivenotes/shared";
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

type RegisterFields = {
  email: string;
  password: string;
};

export default function RegisterPage() {
  const form = useForm<RegisterFields>({
    defaultValues: { email: "", password: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [holdingShare, setHoldingShare] = useState(false);

  useEffect(() => {
    setHoldingShare(hasRememberedShare());
  }, []);

  async function onSubmit(values: RegisterFields) {
    setError(null);
    const parsed = registerSchema.safeParse({
      email: values.email,
      password: values.password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading("بنسجل...");
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
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    }

    const share = await createRememberedShare();
    if (share === "error") {
      const message = "التسجيل تم، والرابط لسه محفوظ. اضغط تسجيل تاني عشان نسجله.";
      setError(message);
      toast.error(message, { id: toastId });
      return;
    }

    toast.success("اتعمل الحساب", { id: toastId });
    window.location.assign("/inbox");
  }

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`mb-1 text-sm ${mutedClass}`}>ريفايف نوتس</p>
          <h1 className={titleClass}>حساب جديد</h1>
        </div>
        <ThemeToggle />
      </div>
      {holdingShare ? (
        <p role="status" className={`${surfacePanelClass} text-sm`}>
          فيه رابط مستني. هيتحفظ في الوارد بعد التسجيل.
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
            البريد
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
            كلمة السر
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
          {form.formState.isSubmitting ? "بنسجل..." : "تسجيل"}
        </button>
      </form>
      <p className={mutedClass}>
        <Link href="/login" className={linkClass}>
          عندك حساب؟ ادخل
        </Link>
      </p>
    </main>
  );
}
