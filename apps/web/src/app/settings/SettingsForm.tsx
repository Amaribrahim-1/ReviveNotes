"use client";

import { updateSettingsSchema, type PublicUser } from "@revivenotes/shared";
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
const extraTimeDefaults = ["09:00", "12:00", "18:00"];
const bravePushHint =
  "Brave بيقفل إشعارات المواقع. افتح brave://settings/privacy وشغّل Use Google services for push messaging، وبعدين اقفل المتصفح وافتحه واضغط الزر تاني.";

type SettingsValues = {
  timezone: string;
  day_start_time: number;
  reminders_enabled: boolean;
  reminder_times: string[];
};

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
  const form = useForm<SettingsValues>({
    defaultValues: {
      timezone: me.data?.timezone ?? "",
      day_start_time: me.data?.day_start_time ?? 0,
      reminders_enabled: me.data?.reminders_enabled ?? false,
      reminder_times: me.data?.reminder_times.length ? me.data.reminder_times : ["09:00"],
    },
  });
  const appliedUserId = useRef<string | null>(me.data?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushReady, setPushReady] = useState(false);
  const [pushWorking, setPushWorking] = useState(false);
  const [braveBrowser, setBraveBrowser] = useState(false);
  const remindersEnabled = form.watch("reminders_enabled");
  const reminderTimes = form.watch("reminder_times");

  useEffect(() => {
    const browser = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    if (!browser.brave?.isBrave) {
      return;
    }
    let active = true;
    browser.brave
      .isBrave()
      .then((value) => {
        if (active) {
          setBraveBrowser(value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
      reminders_enabled: me.data.reminders_enabled,
      reminder_times: me.data.reminder_times.length > 0 ? me.data.reminder_times : ["09:00"],
    });
  }, [me.data, form]);

  async function onSubmit(values: SettingsValues) {
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
    await queryClient.invalidateQueries({ queryKey: ["progress"] });
  }

  function setTime(index: number, value: string) {
    const next = reminderTimes.slice();
    next[index] = value.slice(0, 5);
    form.setValue("reminder_times", next);
  }

  function addTime() {
    if (reminderTimes.length >= 3) {
      return;
    }
    const nextDefault = extraTimeDefaults.find((time) => !reminderTimes.includes(time)) ?? "09:00";
    form.setValue("reminder_times", [...reminderTimes, nextDefault]);
  }

  function removeTime(index: number) {
    form.setValue(
      "reminder_times",
      reminderTimes.filter((_, timeIndex) => timeIndex !== index),
    );
  }

  async function allowNotifications() {
    setPushError(null);
    setPushReady(false);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushError("المتصفح ده مش بيدعم الإشعارات");
      return;
    }

    setPushWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("المتصفح رفض الإشعارات");
        return;
      }

      await navigator.serviceWorker.register(new URL("../../lib/service-worker.js", import.meta.url), {
        scope: "/",
        updateViaCache: "none",
      });
      const ready = await navigator.serviceWorker.ready;
      const keyResponse = await api("/push/vapid-public-key");
      if (!keyResponse.ok) {
        setPushError(await apiError(keyResponse));
        return;
      }
      const keyBody = (await keyResponse.json()) as { public_key?: string };
      if (!keyBody.public_key) {
        setPushError("مفتاح الإشعار ناقص");
        return;
      }

      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyBody.public_key),
      });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) {
        setPushError("مش قادرين نسجل الإشعارات");
        return;
      }

      const stored = await api("/push-subscriptions", {
        method: "POST",
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });
      if (!stored.ok) {
        setPushError(await apiError(stored));
        return;
      }
      setPushReady(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (detail.includes("push service")) {
        setPushError(braveBrowser ? bravePushHint : "المتصفح مش قادر يوصل لخدمة الإشعارات.");
        return;
      }
      setPushError("مش قادرين نفعّل الإشعارات");
    } finally {
      setPushWorking(false);
    }
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
        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6" aria-labelledby="settings-reminders">
          <h2 id="settings-reminders" className="text-xl font-semibold">
            التذكيرات
          </h2>
          <p className="text-sm text-neutral-600">هيوصلك عدد الملاحظات المفتوحة بس.</p>
          <label className="flex items-center gap-2" htmlFor="settings-reminders-enabled">
            <input
              id="settings-reminders-enabled"
              type="checkbox"
              checked={remindersEnabled}
              onChange={(event) => {
                form.setValue("reminders_enabled", event.target.checked);
                if (event.target.checked && reminderTimes.length === 0) {
                  form.setValue("reminder_times", ["09:00"]);
                }
              }}
            />
            تشغيل التذكير
          </label>
          {remindersEnabled ? (
            <div className="flex flex-col gap-3">
              {reminderTimes.map((time, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" htmlFor={`settings-reminder-time-${index}`}>
                      الوقت {index + 1}
                    </label>
                    <input
                      id={`settings-reminder-time-${index}`}
                      type="time"
                      dir="ltr"
                      lang="en"
                      step={60}
                      value={time}
                      onChange={(event) => setTime(index, event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  {reminderTimes.length > 1 ? (
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => removeTime(index)}
                      aria-label={`إزالة الوقت ${index + 1}`}
                    >
                      إزالة
                    </button>
                  ) : null}
                </div>
              ))}
              <button type="button" className={buttonClass} onClick={addTime} disabled={reminderTimes.length >= 3}>
                إضافة وقت
              </button>
              {braveBrowser ? <p className="text-sm text-neutral-600">{bravePushHint}</p> : null}
              <button type="button" className={buttonClass} onClick={allowNotifications} disabled={pushWorking}>
                {pushWorking ? "بنفعّل الإشعارات..." : "السماح بالإشعارات"}
              </button>
              {pushError ? (
                <p className="text-red-700" role="alert">
                  {pushError}
                </p>
              ) : null}
              {pushReady ? <p role="status">الإشعارات مسموحة.</p> : null}
            </div>
          ) : null}
        </section>
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
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}
