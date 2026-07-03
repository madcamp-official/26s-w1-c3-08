import Link from "next/link";
import { Notice } from "@/components/Notice";

export default function LinkFailedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <Notice title="마음을 보관하지 못했어요." body="링크 상태를 확인한 뒤 다시 시도해 주세요." tone="danger" />
        <div className="mt-5 flex gap-3">
          <Link href="/login" className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            로그인
          </Link>
          <Link href="/write" className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            마음 쓰기
          </Link>
        </div>
      </section>
    </main>
  );
}
