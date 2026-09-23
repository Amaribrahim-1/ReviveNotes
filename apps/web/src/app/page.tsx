import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { authPageClass, buttonClass, linkClass, mutedClass, titleClass } from "@/lib/ui-classes";

export default function HomePage() {
  return (
    <main className={`${authPageClass} min-h-screen justify-center`}>
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-rn-accent">ملاحظات بترجع</p>
        <h1 className={`${titleClass} text-4xl leading-tight md:text-5xl`}>ريفايف نوتس</h1>
        <p className={`text-lg leading-relaxed ${mutedClass}`}>
          سجّل اللي عالق في راسك، ورجّعه للحياة قبل ما ينسى.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/register" className={`${buttonClass} text-center`}>
          حساب جديد
        </Link>
        <Link href="/login" className={`${buttonClass} bg-rn-surface text-center text-rn-ink ring-1 ring-rn-border`}>
          دخول
        </Link>
      </div>
      <p className={`text-sm ${mutedClass}`}>
        أو روح على{" "}
        <Link href="/inbox" className={linkClass}>
          الوارد
        </Link>{" "}
        لو أنت داخل أصلاً.
      </p>
    </main>
  );
}
