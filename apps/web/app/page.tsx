"use client";

import Image from "next/image";
import Link from "next/link";
import { Inbox, Plus, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LetterThumb } from "@/components/ui";

const timeline = [
  { date: "오늘", label: "누군가의 마음" },
  { date: "12.25", label: "고마움" },
  { date: "01.01", label: "미래의 나" },
  { date: "03.14", label: "그리움" },
];

const letters = [
  { title: "괜찮아,", body: "잘하고 있어", target: "나에게" },
  { title: "괜찮아,", body: "잘하고 있어", target: "나에게" },
  { title: "괜찮아,", body: "잘하고 있어", target: "나에게" },
  { title: "괜찮아,", body: "잘하고 있어", target: "나에게" },
];

export default function HomePage() {
  return (
    <AppShell>
      <div className="grid max-w-[1190px] gap-[25px] xl:grid-cols-[881px_265px]">
        <section className="relative h-[380px] overflow-hidden rounded-[10px]">
          <Image src="/images/maeari-hero-night.png" alt="" fill sizes="881px" className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-[#352075]/35 via-transparent to-transparent" />
          <div className="absolute left-6 right-6 top-12 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] sm:left-[70px] sm:right-auto sm:top-[66px]">
            <h1 className="max-w-[430px] text-[32px] font-normal leading-[1.28] text-[#FAC9EB] sm:text-[37px] sm:leading-[1.35]">
              오늘, 당신의 마음은
              <br />
              어떤 모습인가요?
            </h1>
            <p className="mt-5 max-w-[330px] text-[15px] leading-[24px] sm:text-base sm:leading-[25px]">
              지금의 마음을 미래의 누군가에게,
              <br />
              또는 미래의 나에게 전해보세요.
            </p>
          </div>
          <div className="absolute bottom-9 left-6 right-6 flex flex-col gap-3 sm:bottom-[57px] sm:left-[70px] sm:right-auto sm:flex-row sm:gap-5">
            <Link
              href="/write"
              className="focus-ring inline-flex h-[51px] w-full items-center justify-center gap-3 rounded-[9px] border border-[#6D48DB] bg-[#6D48DB] text-sm text-white shadow-[0_4px_2px_rgba(33,22,67,0.38)] sm:w-[160px]"
            >
              <Send size={18} />
              마음 보내기
            </Link>
            <Link
              href="/inbox"
              className="focus-ring inline-flex h-[49px] w-full items-center justify-center gap-3 rounded-[9px] bg-white text-sm text-[#6D48DB] shadow-[0_4px_4px_rgba(0,0,0,0.25)] sm:w-[167px]"
            >
              <Inbox size={17} />
              받은 마음 보기
            </Link>
          </div>
        </section>

        <aside className="hidden h-[380px] pt-[12px] xl:block">
          <h2 className="mb-6 text-[21px] font-bold text-[#555777]">곧 찾아갈 마음</h2>
          <ol className="relative ml-[12px] border-l border-[#E7E2F1] pl-[23px]">
            {timeline.map((item, index) => (
              <li key={item.date} className={index === timeline.length - 1 ? "relative pb-0" : "relative pb-[43px]"}>
                <span className="absolute -left-[30px] top-[5px] h-[14px] w-[14px] rounded-full bg-[#6D48DB]" />
                <p className="text-base font-medium text-[#8D79D6]">{item.date}</p>
                <p className="mt-2 text-sm text-[#A8ABBD]">{item.label}</p>
                {index < timeline.length - 1 ? <div className="mt-[25px] h-px w-[165px] bg-[#EDE9F4]" /> : null}
              </li>
            ))}
          </ol>
        </aside>

        <section className="xl:col-span-1">
          <div className="mb-[17px] flex items-center justify-between px-[26px]">
            <h2 className="text-xl font-bold text-[#71738C]">최근 보관한 마음</h2>
            <Link
              href="/archive"
              className="focus-ring inline-flex h-[33px] items-center gap-2 rounded-full border border-[#E4D9F0] bg-white px-4 text-xs text-[#9A9CB0]"
            >
              전체 보기
              <span>→</span>
            </Link>
          </div>
          <div className="grid gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
            {letters.map((letter, index) => (
              <Link
                key={`${letter.title}-${index}`}
                href="/archive"
                className="focus-ring relative h-[193px] rounded-[15px] border border-[#F3F3F7] bg-white p-4"
              >
                <div className="flex gap-[9px]">
                  <LetterThumb className="h-[84px] w-[63px] shrink-0" />
                  <div className="pt-1">
                    <p className="text-[15px] font-medium text-[#797A94]">{letter.title}</p>
                    <p className="mt-1 text-[15px] font-medium text-[#7B7D97]">{letter.body}</p>
                    <p className="mt-2 text-[11px] text-[#B3B5C5]">받는 사람 · {letter.target}</p>
                  </div>
                </div>
                <span className="absolute bottom-[51px] left-4 rounded-[10px] bg-[#EEE8FD] px-3 py-1 text-[11px] text-[#9A85E1]">
                  {letter.target}
                </span>
                <span className="absolute bottom-5 right-4 grid h-[30px] w-[30px] place-items-center rounded-full border border-[#EEE8FD] text-[#6D48DB]">
                  <Plus size={14} />
                </span>
                <span className="absolute bottom-[25px] left-[73px] text-[10px] text-[#ADB0C2]">2025.05.22.23:48</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="xl:hidden">
          <div className="figma-panel p-5">
            <h2 className="mb-5 text-lg font-bold text-[#555777]">곧 찾아갈 마음</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {timeline.map((item) => (
                <div key={item.date} className="rounded-[10px] bg-[#F3EEFD] px-4 py-3">
                  <p className="font-semibold text-[#8D79D6]">{item.date}</p>
                  <p className="mt-1 text-sm text-[#A8ABBD]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
