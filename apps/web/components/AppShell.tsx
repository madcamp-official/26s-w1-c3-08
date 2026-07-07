"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, Heart, Home, Inbox, Send, TreePine, UserRound, UsersRound } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";

const navItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/write", label: "마음 보내기", icon: Send },
  { href: "/sent", label: "보낸 마음", icon: Inbox },
  { href: "/inbox", label: "받은 마음", icon: Heart },
  { href: "/tree", label: "마음나무", icon: TreePine },
  { href: "/friends", label: "친구", icon: UsersRound },
  { href: "/reports", label: "리포트", icon: BarChart3 },
];

type Me = {
  nickname: string;
  isAdmin?: boolean;
};

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

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

  return (
    <div className="min-h-screen bg-white text-[#4E536B]">
      <header className="fixed left-0 right-0 top-0 z-40 h-[74px] border-b border-[#F1EEF8] bg-white">
        <div className="flex h-full items-center justify-between px-5">
          <Link href="/" className="focus-ring flex h-[54px] items-center gap-3 rounded-lg">
            <Image
              src="/images/maeari-app-icon.png"
              alt="매아리"
              width={42}
              height={42}
              className="h-[42px] w-[42px] rounded-[10px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
              priority
            />
            <span className="text-[25px] font-medium tracking-[0.02em] text-[#9A85E1]">매아리</span>
          </Link>

          <button
            type="button"
            onClick={() => router.push("/my")}
            className="focus-ring mr-1 inline-flex h-11 items-center gap-3 rounded-full px-2 text-[15px] text-[#8588A1] transition hover:bg-[#F3EEFD]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F3EEFD] text-[#6D48DB]">
              <UserRound size={18} />
            </span>
            <span className="hidden md:inline">{me?.nickname ? `${me.nickname}님` : "내 정보"}</span>
            <ChevronDown className="hidden text-[#6D48DB] md:block" size={15} />
          </button>
        </div>
      </header>

      <aside className="fixed left-0 top-[74px] z-30 hidden h-[calc(100vh-74px)] w-[221px] border-r border-[#F1EEF8] bg-white lg:block">
        <nav className="px-3 pt-[29px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring mb-3 flex h-[51px] items-center gap-[17px] rounded-[10px] px-[18px] text-sm transition ${
                  active ? "bg-[#F3EEFD] font-bold text-[#6D48DB]" : "font-normal text-[#A0A4B9] hover:bg-[#F8F5FD] hover:text-[#6D48DB]"
                }`}
              >
                <Icon size={18} strokeWidth={1.7} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-9 left-[15px] h-[168px] w-[132px] overflow-hidden rounded-[13px] bg-[#F0D9FF] shadow-[0_20px_45px_rgba(122,90,184,0.16)] md:h-[237px] md:w-[185px] md:rounded-[20px]">
          <Image src="/images/maeari-sidebar-sky.png" alt="" fill sizes="185px" className="object-cover object-bottom" />
          <div className="absolute inset-0 px-[18px] py-[22px] text-[#4B405E]">
            <p className="text-[13px] font-medium md:text-base">오늘의 한 줄</p>
            <p className="mt-5 whitespace-pre-line text-[10px] leading-[15px] text-[#636363] md:text-[11px]">
              꽃이 피었다고 너에게 쓰고{"\n"}꽃이 졌다고 너에게 쓴다.{"\n"}너에게 쓴 마음이{"\n"}벌써 길이 되었다
            </p>
            <p className="mt-3 text-[10px] text-[#636363] md:text-[11px]">/ 너에게 쓴다, 천양희</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen bg-[#FBF9FC] px-4 pb-24 pt-[92px] lg:ml-[221px] lg:min-h-screen lg:px-0 lg:pb-0 lg:pt-[74px]">
        <div className="mx-auto w-full max-w-[1190px] lg:mx-0 lg:min-h-[calc(100vh-74px)] lg:px-[38px] lg:py-[31px]">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#F1EEF8] bg-white/95 backdrop-blur lg:hidden">
        {navItems.slice(0, 5).map((item) => {
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
