"use client";

import { updateSettingsSchema, type PublicUser, type UpdateSettingsInput } from "@revivenotes/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiError } from "@/lib/api";

const fieldClass =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

const timeZones = Intl.supportedValuesOf("timeZone");
const dayStartHours = Array.from({ length: 24 }, (_, hour) => hour);

export default function SettingsForm() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    retry: false,
    enabled: typeof window !== "undefined",
    queryFn: async (): Promise<PublicUser> => {
      const response = await api("/me");
      if (!response.ok) {
        throw new Error("no-session");
      }
      return response.json() as Promise<PublicUser>;
    },
  });
  const form = useForm<UpdateSettingsInput>({
    defaultValues: {
      timezone: me.data?.timezone ?? "",
      day_start_time: me.data?.day_start_time ?? 0,
    },
  });
  const appliedUserId = useRef<string | null>(me.data?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!me.data) {
      return;
    }
    if (appliedUserId.current === me.data.id) {
      return;
    }
    appliedUserId.current = me.data.id;
    form.reset({
      timezone: me.data.timezone,
      day_start_time: me.data.day_start_time,
    });
  }, [me.data, form]);

  async function onSubmit(values: UpdateSettingsInput) {
    setError(null);
    setSaved(false);
    const parsed = updateSettingsSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api("/me", {
        method: "PATCH",
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

    setSaved(true);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  if (me.isPending || !me.data) {
    return <p>بنحمّل الإعدادات...</p>;
  }

  const zones = timeZones.includes(me.data.timezone) ? timeZones : [me.data.timezone, ...timeZones];

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-col gap-4" method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="settings-timezone">
            المنطقة الزمنية
          </label>
          <select id="settings-timezone" className={fieldClass} {...form.register("timezone")}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="settings-day-start">
            ساعة بداية اليوم
          </label>
          <select
            id="settings-day-start"
            className={fieldClass}
            aria-describedby="settings-day-start-hint"
            {...form.register("day_start_time", { valueAsNumber: true })}
          >
            {dayStartHours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <p id="settings-day-start-hint" className="mt-1 text-sm text-neutral-600">
            0 يعني منتصف الليل.
          </p>
        </div>
        {error ? (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? <p role="status">اتحفظت الإعدادات.</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
          {form.formState.isSubmitting ? "بنحفظ..." : "حفظ"}
        </button>
      </form>
      <section className="flex flex-col gap-2 border-t border-neutral-200 pt-6" aria-labelledby="settings-reminders">
        <h2 id="settings-reminders" className="text-xl font-semibold">
          التذكيرات
        </h2>
      </section>
    </div>
  );
}
