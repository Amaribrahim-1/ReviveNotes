"use client";

import { registerSchema } from "@revivenotes/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiError } from "@/lib/api";
import { createRememberedShare, hasRememberedShare } from "@/lib/pending-share";

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
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      return;
    }

    const share = await createRememberedShare();
    if (share === "error") {
      setError("التسجيل تم، والرابط لسه محفوظ. اضغط تسجيل تاني عشان نسجله.");
      return;
    }

    window.location.assign("/inbox");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold">حساب جديد</h1>
      {holdingShare ? <p role="status">فيه رابط مستني. هيتحفظ في الوارد بعد التسجيل.</p> : null}
      <form className="flex flex-col gap-4" method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="register-email">
            البريد
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            className="w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            {...form.register("email")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="register-password">
            كلمة السر
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            {...form.register("password")}
          />
        </div>
        {error ? (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
        >
          {form.formState.isSubmitting ? "بنسجل..." : "تسجيل"}
        </button>
      </form>
      <p>
        <Link
          href="/login"
          className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          عندك حساب؟ ادخل
        </Link>
      </p>
    </main>
  );
}
