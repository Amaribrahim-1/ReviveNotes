"use client";

import { loginSchema } from "@revivenotes/shared";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiError } from "@/lib/api";

type LoginFields = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const form = useForm<LoginFields>({
    defaultValues: { email: "", password: "" },
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: LoginFields) {
    setError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api("/auth/login", {
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

    window.location.assign("/inbox");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold">دخول</h1>
      <form className="flex flex-col gap-4" method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="login-email">
            البريد
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            {...form.register("email")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="login-password">
            كلمة السر
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
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
          {form.formState.isSubmitting ? "بندخل..." : "دخول"}
        </button>
      </form>
      <p>
        <Link
          href="/register"
          className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          حساب جديد
        </Link>
      </p>
    </main>
  );
}
