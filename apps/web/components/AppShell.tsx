"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Archive, BarChart3, ChevronDown, Home, Inbox, Send, Sprout, UserRound, UsersRound } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type { MeResponse } from "@maeari/shared";

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
  { href: "/write", label: "쓰기", icon: Send },
  { href: "/sent", label: "보낸 마음", icon: Inbox },
  { href: "/friends", label: "친구", icon: UsersRound },
  { href: "/my", label: "내 정보", icon: UserRound },
];

type Me = MeResponse["user"];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const response = await apiFetch<MeResponse>("/me");
        if (mounted) {
          setMe(response.user);
        }

        if (
          response.accountSetup.requiresSignupPhoneVerification &&
          pathname !== "/phone-verification"
        ) {
          const currentPath =
            typeof window === "undefined"
              ? pathname
              : `${window.location.pathname}${window.location.search}${window.location.hash}`;
          router.replace(`/phone-verification?next=${encodeURIComponent(currentPath || "/write")}`);
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
  }, [pathname, router]);

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

        <div className="relative mx-[15px] mb-5 mt-5 min-h-[168px] w-[185px] flex-1 overflow-hidden rounded-[8px] border border-[#E6DDF3] bg-[#F0D9FF] shadow-[0_16px_34px_rgba(122,90,184,0.12)]">
          <Image src="/images/maeari-sidebar-sky.png" alt="" fill sizes="185px" className="scale-[1.08] object-cover object-center" />
          <div className="absolute inset-0 bg-white/8" />
          <div className="absolute inset-0 flex flex-col px-[16px] py-[15px] text-[#4B405E]">
            <p className="maeari-sidebar-quote-title text-[14px] text-[#4B405E]">오늘의 한 줄🌙</p>
            <p className="maeari-sidebar-quote-body mt-3 whitespace-pre-line text-[clamp(9px,1.15vh,12px)] leading-[1.35] text-[#636363]">
              꽃이 피었다고 너에게 쓰고{"\n"}꽃이 졌다고 너에게 쓴다.{"\n"}너에게 쓴 마음이 벌써 길이 되었다
            </p>
            <p className="maeari-sidebar-quote-body mt-auto pt-3 text-[clamp(9px,1.05vh,11px)] text-[#636363]">/ 너에게 쓴다, 천양희</p>
          </div>
        </div>
      </aside>

      <main className="maeari-stage min-h-screen px-4 pb-24 pt-[92px] lg:ml-[221px] lg:min-h-screen lg:px-0 lg:pb-0 lg:pt-[74px]">
        <div className="mx-auto w-full lg:mx-0 lg:min-h-[calc(100vh-74px)] lg:px-[38px] lg:py-[31px]">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#EEE8F8] bg-white/95 backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${
                active ? "font-bold text-[#6D48DB]" : "font-medium text-[#A0A4B9]"
              }`}
            >
              <Icon size={18} strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
