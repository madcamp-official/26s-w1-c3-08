"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice } from "@/components/Notice";

const PENDING_TOKEN_KEY = "maeari.pendingArrivalToken";

export default function LinkFailedPage() {
  const [arrivalToken, setArrivalToken] = useState<string | null>(null);

  useEffect(() => {
    setArrivalToken(sessionStorage.getItem(PENDING_TOKEN_KEY));
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <Notice
          title="마음을 보관하지 못했어요."
          body="도착 시간이 아직 아니거나 이미 다른 계정에 보관된 마음일 수 있어요."
          tone="danger"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          {arrivalToken ? (
            <Link
              href={`/arrival/${arrivalToken}`}
              className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              공개 메시지로 돌아가기
            </Link>
          ) : (
            <Link href="/login" className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              다시 로그인
            </Link>
          )}
          <Link href="/write" className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            마음 쓰기
          </Link>
        </div>
      </section>
    </main>
  );
}
