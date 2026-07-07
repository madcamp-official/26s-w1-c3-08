"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Plus, Send, Sparkles, TreePine, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LetterThumb } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime } from "@/lib/format";

type SentMessage = {
  id: string;
  title: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  scheduledAt: string;
  status: string;
  receiver?: {
    name?: string | null;
    type: string;
  } | null;
};

type InboxMessage = {
  id: string;
  title: string;
  preview: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
};

export default function HomePage() {
  const router = useRouter();
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [kstNow, setKstNow] = useState(() => formatKstClock(new Date()));

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [sentResponse, receivedResponse] = await Promise.all([
          apiFetch<{ messages: SentMessage[] }>("/messages/sent"),
          apiFetch<{ messages: InboxMessage[] }>("/messages/received"),
        ]);

        if (!mounted) {
          return;
        }

        setSentMessages(sentResponse.messages);
        setReceivedMessages(receivedResponse.messages);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setKstNow(formatKstClock(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const upcomingLetters = useMemo(
    () =>
      sentMessages
        .filter((message) => message.status === "PENDING")
        .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
        .slice(0, 4),
    [sentMessages],
  );
  const recentLetters = useMemo(() => receivedMessages.slice(0, 4), [receivedMessages]);
  const timelineItems = useMemo(
    () => (upcomingLetters.length ? upcomingLetters.map(formatUpcomingMessage) : createTimelineFallback()),
    [upcomingLetters],
  );
  const recentLetterItems = useMemo(
    () => (recentLetters.length ? recentLetters.map(formatRecentMessage) : createRecentFallback(loading)),
    [loading, recentLetters],
  );

  return (
    <AppShell>
      <div className="grid max-w-[1190px] gap-[25px] xl:grid-cols-[minmax(0,1fr)_265px]">
        <section className="maeari-hero-card grid min-h-[520px] overflow-hidden p-6 sm:min-h-[430px] sm:p-[38px] lg:grid-cols-[minmax(0,1fr)_302px] lg:items-center xl:min-h-[380px] xl:p-[42px]">
          <div className="relative z-10">
            <p className="mb-4 inline-flex rounded-[8px] bg-[#F3EEFD] px-3 py-1 text-xs font-bold text-[#6D48DB]">
              매 순간 아껴둔 마음의 소리
            </p>
            <h1 className="max-w-[465px] break-keep text-[32px] font-extrabold leading-[1.24] text-[#3A3D8D] sm:text-[39px] sm:leading-[1.3]">
              오늘, 당신의 마음은
              <br />
              어떤 모습인가요?
            </h1>
            <p className="mt-5 max-w-[360px] break-keep text-[15px] leading-[24px] text-[#706C95] sm:text-base sm:leading-[25px]">
              지금의 마음을 미래의 누군가에게,
              <br />
              또는 미래의 나에게 전해보세요.
            </p>

            <div className="mt-7 flex w-full max-w-[342px] items-center gap-3 rounded-[8px] border border-[#E7DFF2] bg-white/78 px-4 py-3 shadow-[0_10px_24px_rgba(76,63,119,0.08)]">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB]">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#8C90AA]">현재 KST</p>
                <p className="mt-1 font-mono text-[17px] font-bold text-[#3A3D8D] tabular-nums">{kstNow}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-5">
              <Link
                href="/write"
                className="focus-ring maeari-action maeari-action-primary h-[51px] w-full text-sm sm:w-[160px]"
              >
                <Send size={18} />
                마음 보내기
              </Link>
              <Link
                href="/inbox"
                className="focus-ring maeari-action h-[49px] w-full bg-white text-sm text-[#6D48DB] shadow-[0_12px_24px_rgba(76,63,119,0.10)] sm:w-[167px]"
              >
                <Inbox size={17} />
                받은 마음 보기
              </Link>
            </div>
          </div>

          <div className="maeari-hero-visual relative mt-8 hidden h-[264px] overflow-hidden lg:block">
            <Image src="/images/maeari-hero-floral.png" alt="" fill sizes="302px" className="scale-[1.26] object-cover object-center" priority />
          </div>
        </section>

        <aside className="figma-panel hidden self-start px-[22px] py-[24px] xl:block">
          <h2 className="mb-6 text-[21px] font-bold text-[#555777]">곧 찾아갈 마음</h2>
          <ol className="relative ml-[12px] border-l border-[#E7E2F1] pl-[23px]">
            {timelineItems.map((item, index, items) => (
              <li key={item.id} className={index === items.length - 1 ? "relative pb-0" : "relative pb-[31px]"}>
                <span className="absolute -left-[30px] top-[5px] h-[14px] w-[14px] rounded-full bg-[#6D48DB]" />
                <p className="text-[15px] font-semibold text-[#8D79D6]">{item.date}</p>
                <p className="mt-2 break-keep text-sm leading-5 text-[#A8ABBD]">{item.label}</p>
                {index < items.length - 1 ? <div className="mt-[20px] h-px w-[165px] bg-[#EDE9F4]" /> : null}
              </li>
            ))}
          </ol>
        </aside>

        <section className="xl:col-span-1">
          <div className="mb-[17px] flex items-center justify-between px-[26px]">
            <h2 className="text-xl font-bold text-[#71738C]">최근 보관한 마음</h2>
            <Link
              href="/archive"
              className="focus-ring inline-flex h-[33px] items-center gap-2 rounded-[8px] border border-[#E4D9F0] bg-white px-4 text-xs text-[#9A9CB0]"
            >
              전체 보기
              <span>→</span>
            </Link>
          </div>
          <div className="grid gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
            {recentLetterItems.map((letter) => (
              <Link
                key={letter.id}
                href={letter.id.startsWith("fallback") ? "/inbox" : `/messages/${letter.id}`}
                className="focus-ring maeari-letter-surface relative h-[193px] p-4 transition hover:-translate-y-0.5 hover:border-[#CBBBFA]"
              >
                <div className="flex gap-[9px]">
                  <LetterThumb className="h-[84px] w-[63px] shrink-0" />
                  <div className="pt-1">
                    <p className="text-[15px] font-medium text-[#797A94]">{letter.title}</p>
                    <p className="mt-1 line-clamp-2 text-[15px] font-medium text-[#7B7D97]">{letter.body}</p>
                    <p className="mt-2 text-[11px] text-[#B3B5C5]">{letter.meta}</p>
                  </div>
                </div>
                <span className="absolute bottom-[51px] left-4 rounded-[8px] bg-[#EEE8FD] px-3 py-1 text-[11px] text-[#9A85E1]">
                  {letter.tag}
                </span>
                <span className="absolute bottom-5 right-4 grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#EEE8FD] text-[#6D48DB]">
                  <Plus size={14} />
                </span>
                <span className="absolute bottom-[25px] left-[73px] text-[10px] text-[#ADB0C2]">{letter.date}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-[14px] xl:col-span-2 xl:grid-cols-4">
          {[
            { href: "/write", label: "마음 쓰기", body: "새 예약 메시지를 남겨요.", icon: Send },
            { href: "/inbox", label: "받은 마음", body: "나에게 도착한 마음을 열어요.", icon: Inbox },
            { href: "/friends", label: "친구", body: "친구 연결과 요청을 관리해요.", icon: UsersRound },
            { href: "/tree", label: "마음나무", body: "링크로 마음을 모아요.", icon: TreePine },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href} className="focus-ring maeari-letter-surface group min-h-[126px] p-5 transition hover:-translate-y-0.5 hover:border-[#CBBBFA]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB] transition group-hover:bg-[#6D48DB] group-hover:text-white">
                  <Icon size={18} />
                </span>
                <h3 className="mt-5 text-[18px] font-bold text-[#4E536B]">{item.label}</h3>
                <p className="mt-2 text-sm text-[#9EA2B7]">{item.body}</p>
              </Link>
            );
          })}
        </section>

        <section className="xl:hidden">
          <div className="figma-panel p-5">
            <h2 className="mb-5 text-lg font-bold text-[#555777]">곧 찾아갈 마음</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {timelineItems.map((item) => (
                <div key={item.id} className="rounded-[8px] bg-[#F3EEFD] px-4 py-3">
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

function createTimelineFallback() {
  return [
    { id: "fallback-today", date: "오늘", label: "새 마음을 기다리는 중" },
    { id: "fallback-week", date: "1주 뒤", label: "미래의 나" },
    { id: "fallback-month", date: "1개월 뒤", label: "고마움" },
    { id: "fallback-tree", date: "마음나무", label: "링크로 모은 마음" },
  ];
}

function createRecentFallback(loading: boolean) {
  const title = loading ? "불러오는 중" : "아직 도착 전";
  const body = loading ? "마음을 정리하고 있어요" : "첫 마음이 도착하면 여기에 보여요";

  return Array.from({ length: 4 }, (_, index) => ({
    id: `fallback-${index}`,
    title,
    body,
    meta: "받은 마음",
    tag: "마음",
    date: loading ? "확인 중" : "기다리는 중",
  }));
}

function formatUpcomingMessage(message: SentMessage) {
  return {
    id: message.id,
    date: formatShortDate(message.scheduledAt),
    label: `${message.receiver?.name ?? receiverTypeLabel(message.receiver?.type)} · ${emotionLabel(
      message.emotionTag,
      message.customEmotionTag,
    )}`,
  };
}

function formatRecentMessage(message: InboxMessage) {
  return {
    id: message.id,
    title: message.title,
    body: message.preview || "도착한 마음을 열어보세요.",
    meta: message.isSenderHidden ? "누군가의 마음" : `보낸 사람 · ${message.senderName ?? "알 수 없음"}`,
    tag: emotionLabel(message.emotionTag, message.customEmotionTag),
    date: message.arrivedAt ? formatDateTime(message.arrivedAt) : "숨겨진 시간",
  };
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\.$/, "");
}

function formatKstClock(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(value)
    .replace(/\. /g, ". ")
    .replace(/\.$/, "");
}

function receiverTypeLabel(type?: string) {
  if (type === "SELF") {
    return "미래의 나";
  }

  if (type === "FRIEND") {
    return "친구";
  }

  return "연락처";
}
