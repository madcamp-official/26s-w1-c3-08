import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function OnboardingPage() {
  return (
    <AppShell>
      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">오늘 마음에 남은 한 줄</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          지금 떠오른 마음을 첫 편지로 남겨보세요.
        </p>
        <Link
          href="/write"
          className="focus-ring mt-6 inline-flex rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white"
        >
          마음 남기기
        </Link>
      </section>
    </AppShell>
  );
}
