"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Inbox, Plus, Send, Sparkles } from "lucide-react";
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
  const recentLetterItems = useMemo(() => recentLetters.map(formatRecentMessage), [recentLetters]);
  const hasRecentLetters = recentLetterItems.length > 0;

  return (
    <AppShell>
      <div className="grid w-full gap-[25px] xl:grid-cols-[minmax(0,1fr)_265px]">
        <section className="maeari-hero-card maeari-hero-night relative min-h-[520px] overflow-hidden p-6 sm:min-h-[430px] sm:p-[38px] xl:min-h-[380px] xl:p-[42px]">
          <Image src="/images/maeari-hero-night.png" alt="" fill sizes="(min-width: 1280px) 1200px, calc(100vw - 32px)" className="object-cover object-bottom" priority />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(38,29,91,0.54)_0%,rgba(75,47,132,0.28)_48%,rgba(57,38,111,0.04)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_54%,rgba(255,215,236,0.2),transparent_35%)]" />

          <div className="relative z-10 flex min-h-[472px] max-w-[520px] flex-col justify-center sm:min-h-[354px] xl:min-h-[296px]">
            <p className="mb-4 inline-flex w-fit rounded-[8px] bg-white/10 px-3 py-1 text-xs font-bold text-[#D8C6FF] shadow-[0_8px_22px_rgba(22,16,58,0.10)] backdrop-blur">
              매 순간 아껴둔 마음의 소리
            </p>
            <h1 className="maeari-display-title max-w-[465px] break-keep text-[34px] leading-[1.24] text-[#FFE1EE] drop-shadow-[0_3px_12px_rgba(32,20,78,0.34)] sm:text-[43px] sm:leading-[1.3]">
              오늘, 당신의 마음은
              <br />
              어떤 모습인가요?
            </h1>
            <p className="mt-5 max-w-[360px] break-keep text-[15px] leading-[24px] text-[#FFF7FB] drop-shadow-[0_2px_8px_rgba(32,20,78,0.32)] sm:text-base sm:leading-[25px]">
              지금의 마음을 미래의 누군가에게,
              <br />
              또는 미래의 나에게 전해보세요.
            </p>

            <div className="mt-7 flex w-full max-w-[342px] items-center gap-3 rounded-[8px] border border-white/22 bg-white/18 px-4 py-3 text-white shadow-[0_14px_30px_rgba(22,16,58,0.18)] backdrop-blur">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-white/18 text-[#F2DDFF]">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="maeari-kst-time text-[12px] text-white/76">현재 KST</p>
                <p className="maeari-kst-time mt-1 text-[17px] text-white">{kstNow}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-5">
              <Link
                href="/write"
                className="focus-ring maeari-action maeari-action-primary h-[51px] w-full border-[#6D48DB] text-sm shadow-[0_16px_34px_rgba(35,24,84,0.28)] sm:w-[160px]"
              >
                <Send size={18} />
                마음 보내기
              </Link>
              <Link
                href="/inbox"
                className="focus-ring maeari-action h-[49px] w-full border-white/70 bg-white/92 text-sm text-[#6D48DB] shadow-[0_14px_30px_rgba(35,24,84,0.22)] sm:w-[167px]"
              >
                <Heart size={17} />
                받은 마음 보기
              </Link>
            </div>
          </div>
        </section>

        <aside className="figma-panel hidden self-stretch px-[22px] py-[24px] xl:block">
          <h2 className="maeari-display-title mb-6 text-[24px] text-[#555777]">곧 찾아갈 마음</h2>
          <ol className="relative ml-[12px] border-l border-[#E7E2F1] pl-[23px]">
            {timelineItems.map((item, index, items) => (
              <li key={item.id} className={index === items.length - 1 ? "relative pb-0" : "relative pb-[31px]"}>
                <span className="absolute -left-[30px] top-[5px] h-[14px] w-[14px] rounded-full bg-[#6D48DB]" />
                <p className="text-[15px] font-semibold text-[#8D79D6]">{item.date}</p>
                <p className="mt-2 break-keep text-sm leading-5 text-[#A8ABBD]">{item.label}</p>
                {index < items.length - 1 ? <div className="mt-[20px] h-px w-full bg-[#EDE9F4]" /> : null}
              </li>
            ))}
          </ol>
        </aside>

        <section className="xl:hidden">
          <div className="figma-panel p-5">
            <h2 className="maeari-display-title mb-5 text-[22px] text-[#555777]">곧 찾아갈 마음</h2>
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

        <section className="xl:col-span-2">
          <div className="mb-[17px] flex items-center justify-between">
            <h2 className="maeari-display-title text-[24px] text-[#555777]">최근 보관한 마음</h2>
            <Link
              href="/archive"
              className="focus-ring inline-flex h-[33px] items-center gap-2 rounded-[8px] border border-[#E4D9F0] bg-white px-4 text-xs text-[#9A9CB0]"
            >
              전체 보기
              <span>→</span>
            </Link>
          </div>
          {hasRecentLetters ? (
            <div className="grid gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
              {recentLetterItems.map((letter) => (
                <Link
                  key={letter.id}
                  href={`/messages/${letter.id}`}
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
          ) : (
            <div className="maeari-letter-surface flex min-h-[150px] items-center gap-4 p-6">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB]">
                <Inbox size={24} />
              </span>
              <div>
                <p className="text-[18px] font-bold text-[#555777]">
                  {loading ? "마음을 불러오고 있어요." : "아직 첫 마음이 도착하지 않았어요."}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#9EA2B7]">
                  {loading ? "최근 보관한 마음을 확인하는 중이에요." : "첫 마음이 도착하면 이곳에서 가장 최근에 보관한 마음을 보여드릴게요."}
                </p>
              </div>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}

function createTimelineFallback() {
  return [
    { id: "fallback-tree", date: "마음나무", label: "직접 모은 마음을 기다리고 있어요" },
  ];
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
