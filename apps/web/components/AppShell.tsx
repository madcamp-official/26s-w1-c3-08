"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Edit3, Inbox, Send, UserRound, UsersRound } from "lucide-react";

const navItems = [
  { href: "/write", label: "쓰기", icon: Edit3 },
  { href: "/inbox", label: "받은 마음", icon: Inbox },
  { href: "/sent", label: "보낸 마음", icon: Send },
  { href: "/friends", label: "친구", icon: UsersRound },
  { href: "/reports", label: "리포트", icon: BarChart3 },
  { href: "/my", label: "내 정보", icon: UserRound },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="border-b border-slate-200 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-md">
            <span className="relative block h-10 w-10 overflow-hidden rounded-md border border-violet-100 bg-white shadow-sm">
              <Image
                src="/images/maeari-mark.png"
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </span>
            <span className="text-lg font-semibold text-ink">매아리</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-6 border-t border-slate-200 bg-white md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-slate-700"
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
