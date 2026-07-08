"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Archive, BarChart3, ChevronDown, Home, Inbox, Send, Sprout, UserRound, UsersRound } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { MaeariLoadingOverlay } from "@/components/MaeariLoadingOverlay";

const navItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/write", label: "마음 보내기", icon: Send },
  { href: "/sent", label: "보낸 마음", icon: Inbox },
  { href: "/archive", label: "마음 보관함", icon: Archive },
  { href: "/tree", label: "마음나무", icon: Sprout },
  { href: "/friends", label: "친구", icon: UsersRound },
  { href: "/reports", label: "리포트", icon: BarChart3 },
];

const mobileNavItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/write", label: "쓰기", icon: Send },
  { href: "/sent", label: "보낸 마음", icon: Inbox },
  { href: "/archive", label: "보관함", icon: Archive },
  { href: "/tree", label: "마음나무", icon: Sprout },
  { href: "/friends", label: "친구", icon: UsersRound },
];

type Me = {
  nickname: string;
  isAdmin?: boolean;
};

type DailyLine = {
  date: string;
  text: string;
  poemTitle?: string | null;
  poet?: string | null;
};

type DailyLineResponse = {
  dailyLine: DailyLine;
};

type LoadingWindow = Window & { __maeariPendingApiRequests?: number };

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dailyLine, setDailyLine] = useState<DailyLine | null>(null);
  const [pendingApiCount, setPendingApiCount] = useState(0);
  const [showGlobalLoading, setShowGlobalLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const response = await apiFetch<{ user: Me }>("/me");
        if (mounted) {
          setMe(response.user);
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          return;
        }
      }
    }

    void loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDailyLine() {
      try {
        const response = await apiFetch<DailyLineResponse>("/daily-line");
        if (mounted) {
          setDailyLine(response.dailyLine);
        }
      } catch {
        if (mounted) {
          setDailyLine(null);
        }
      }
    }

    void loadDailyLine();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function syncPendingApiCount() {
      const loadingWindow = window as LoadingWindow;
      setPendingApiCount(loadingWindow.__maeariPendingApiRequests ?? 0);
    }

    syncPendingApiCount();
    window.addEventListener("maeari:api-start", syncPendingApiCount);
    window.addEventListener("maeari:api-end", syncPendingApiCount);

    return () => {
      window.removeEventListener("maeari:api-start", syncPendingApiCount);
      window.removeEventListener("maeari:api-end", syncPendingApiCount);
    };
  }, []);

  useEffect(() => {
    if (pendingApiCount === 0) {
      setShowGlobalLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowGlobalLoading(true);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [pendingApiCount]);

  const dailyLineCredit = dailyLine ? [dailyLine.poemTitle, dailyLine.poet].filter(Boolean).join(", ") : "";
  const dailyLineDate = dailyLine?.date ? formatDailyLineDate(dailyLine.date) : "";

  return (
    <div className="min-h-screen bg-[#FBF9FC] text-[#4E536B]">
      <header className="fixed left-0 right-0 top-0 z-40 h-[74px] border-b border-[#EEE8F8] bg-[#FFFCFF]/92 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-5 lg:px-[25px]">
          <Link href="/" className="focus-ring flex h-[54px] items-center gap-3 rounded-[8px]">
            <Image
              src="/images/maeari_logo.png"
              alt="매아리"
              width={42}
              height={42}
              className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
              priority
            />
            <span className="maeari-logo-text text-[24px] text-[#6D48DB] sm:text-[25px]">매아리</span>
          </Link>

          <button
            type="button"
            onClick={() => router.push("/my")}
            className="focus-ring mr-1 inline-flex h-11 items-center gap-3 rounded-[8px] px-2 text-[15px] text-[#8588A1] transition hover:bg-[#F3EEFD]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB]">
              <UserRound size={18} />
            </span>
            <span className="hidden md:inline">{me?.nickname ? `${me.nickname}님` : "내 정보"}</span>
            <ChevronDown className="hidden text-[#6D48DB] md:block" size={15} />
          </button>
        </div>
      </header>

      <aside className="fixed left-0 top-[74px] z-30 hidden h-[calc(100vh-74px)] w-[221px] flex-col border-r border-[#EEE8F8] bg-[#FFFCFF]/88 backdrop-blur-xl lg:flex">
        <nav className="shrink-0 px-3 pt-[29px]" aria-label="주요 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring mb-2 flex h-[48px] items-center gap-[15px] rounded-[8px] px-[17px] text-sm transition ${
                  active
                    ? "bg-[#F3EEFD] font-bold text-[#6D48DB] shadow-[0_8px_20px_rgba(109,72,219,0.10)]"
                    : "font-normal text-[#A0A4B9] hover:bg-[#F8F5FD] hover:text-[#6D48DB]"
                }`}
              >
                <Icon size={18} strokeWidth={1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative mx-[15px] mb-5 mt-5 min-h-[168px] w-[185px] flex-1 overflow-hidden rounded-[8px] border border-[#D2B9EC] bg-[#8D55BE] shadow-[0_16px_34px_rgba(64,34,104,0.22)]">
          <Image src="/images/maeari-sidebar-sky.png" alt="" fill sizes="185px" className="scale-[1.08] object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#4D247F]/62 via-[#7A3FAE]/54 to-[#B46DD0]/50" />
          <div className="absolute inset-0 flex flex-col px-[16px] py-[15px] text-[#FBF3FF] drop-shadow-[0_1px_7px_rgba(57,31,88,0.22)]">
            <p className="maeari-sidebar-quote-title text-[17px] text-[#FFF6FF]">오늘의 한 줄🌙</p>
            <p className="maeari-sidebar-quote-body mt-3 whitespace-pre-line text-[clamp(11px,1.38vh,14px)] leading-[1.35] text-[#FFF0FF]">
              {dailyLine?.text ?? ""}
            </p>
            {dailyLineCredit ? (
              <p className="maeari-sidebar-quote-body mt-auto pt-3 text-[clamp(11px,1.26vh,13px)] text-[#FFF0FF]">/ {dailyLineCredit}</p>
            ) : null}
            {dailyLineDate ? (
              <p className="maeari-sidebar-quote-body mt-1 text-[clamp(10px,1.14vh,12px)] text-[#FFF0FF]">/ {dailyLineDate}</p>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="maeari-stage min-h-screen px-4 pb-24 pt-[92px] lg:ml-[221px] lg:min-h-screen lg:px-0 lg:pb-0 lg:pt-[74px]">
        <div className="mx-auto w-full lg:mx-0 lg:min-h-[calc(100vh-74px)] lg:px-[38px] lg:py-[31px]">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#EEE8F8] bg-white/95 backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] ${
                active ? "font-bold text-[#6D48DB]" : "font-medium text-[#A0A4B9]"
              }`}
            >
              <Icon size={18} strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {showGlobalLoading ? <MaeariLoadingOverlay overlay /> : null}
    </div>
  );
}

function formatDailyLineDate(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}
