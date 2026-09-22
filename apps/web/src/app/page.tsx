import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-10">
      <h1 className="text-3xl font-semibold">ريفايف نوتس</h1>
      <p className="text-lg">صفحة مؤقتة. الاتجاه من اليمين لليسار.</p>
      <p className="flex gap-4">
        <Link
          href="/register"
          className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          حساب جديد
        </Link>
        <Link
          href="/login"
          className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          دخول
        </Link>
      </p>
    </main>
  );
}
