"use client";

import Image from "next/image";
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
    <main className="maeari-public-stage text-[#4E536B]">
      <header className="h-[74px] border-b border-[#EEE8F8] bg-white/92 px-5 backdrop-blur-xl">
        <div className="flex h-full items-center">
          <Image
            src="/images/maeari-app-icon.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="ml-3 text-[25px] font-semibold tracking-[0.01em] text-[#6D48DB]">매아리</span>
        </div>
      </header>

      <section className="figma-panel mx-auto mt-[31px] w-[calc(100%-32px)] max-w-md p-6">
        <Notice
          title="마음을 보관하지 못했어요."
          body="도착 시간이 아직 아니거나 이미 다른 계정에 보관된 마음일 수 있어요."
          tone="danger"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          {arrivalToken ? (
            <Link
              href={`/arrival/${arrivalToken}`}
              className="focus-ring maeari-action maeari-action-primary"
            >
              공개 메시지로 돌아가기
            </Link>
          ) : (
            <Link href="/login" className="focus-ring maeari-action maeari-action-primary">
              다시 로그인
            </Link>
          )}
          <Link href="/write" className="focus-ring maeari-action">
            마음 쓰기
          </Link>
        </div>
      </section>
    </main>
  );
}
