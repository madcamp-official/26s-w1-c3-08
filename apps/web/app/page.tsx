"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, CalendarClock, Edit3, Inbox, Send, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const actions = [
  {
    href: "/write",
    title: "마음 쓰기",
    body: "새 예약 메시지를 남겨요.",
    icon: Edit3,
    tone: "bg-petal text-white",
  },
  {
    href: "/sent",
    title: "보낸 마음",
    body: "예약과 도착 상태를 확인해요.",
    icon: Send,
    tone: "bg-moss text-white",
  },
  {
    href: "/inbox",
    title: "받은 마음",
    body: "나에게 도착한 마음을 열어봐요.",
    icon: Inbox,
    tone: "bg-slate-800 text-white",
  },
  {
    href: "/friends",
    title: "친구",
    body: "친구 코드와 요청을 관리해요.",
    icon: UsersRound,
    tone: "bg-white text-ink border border-slate-200",
  },
  {
    href: "/reports",
    title: "감정 리포트",
    body: "남기고 받은 마음의 흐름을 확인해요.",
    icon: BarChart3,
    tone: "bg-white text-ink border border-slate-200",
  },
  {
    href: "/future",
    title: "미래의 나",
    body: "나에게 맡겨둔 마음을 모아봐요.",
    icon: Sparkles,
    tone: "bg-white text-ink border border-slate-200",
  },
];

export default function HomePage() {
  const [kstNow, setKstNow] = useState("KST 시간 확인 중");

  useEffect(() => {
    function tick() {
      setKstNow(formatKstNow(new Date()));
    }

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px] md:items-center">
            <div>
              <p className="text-sm font-semibold text-petal">매 순간 아껴둔 마음의 소리</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">오늘의 마음을 도착할 시간에 맞춰요.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                매아리에서 예약한 마음, 받은 마음, 친구 연결을 한 곳에서 확인할 수 있어요.
              </p>
              <div className="mt-5 inline-flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <CalendarClock className="text-moss" size={22} />
                <div>
                  <p className="text-xs font-semibold text-slate-500">현재 KST</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-ink">{kstNow}</p>
                </div>
              </div>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-md bg-[#f8f4ff]">
              <Image
                src="/images/maeari-main-envelope.webp"
                alt="빛나는 봉투 일러스트"
                fill
                sizes="(min-width: 768px) 280px, 80vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="focus-ring rounded-md border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={`inline-grid h-10 w-10 place-items-center rounded-md ${action.tone}`}>
                  <Icon size={19} />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">{action.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{action.body}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

function formatKstNow(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
