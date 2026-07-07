"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { LetterThumb } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime, statusLabel } from "@/lib/format";

type SentMessage = {
  id: string;
  title: string;
  thumbnail?: MessageThumbnail | null;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  scheduledAt: string;
  sentAt?: string | null;
  status: string;
  receiver?: {
    type: string;
    name?: string | null;
  } | null;
};

type MessageThumbnail = {
  source: "ATTACHMENT" | "DEFAULT";
  url: string;
};

export default function FutureSelfPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ messages: SentMessage[] }>("/messages/sent");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "미래의 나에게 쓴 마음을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selfMessages = useMemo(() => messages.filter((message) => message.receiver?.type === "SELF"), [messages]);
  const filteredMessages = useMemo(() => {
    if (emotionFilter === "ALL") {
      return selfMessages;
    }

    return selfMessages.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
  }, [emotionFilter, selfMessages]);
  const emotionFilters = useMemo(() => {
    const seen = new Set<string>();

    return selfMessages.flatMap((message) => {
      const value = `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}`;

      if (seen.has(value)) {
        return [];
      }

      seen.add(value);

      return [
        {
          value,
          label: emotionLabel(message.emotionTag, message.customEmotionTag),
        },
      ];
    });
  }, [selfMessages]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="maeari-page-title">미래의 나</h1>
          <p className="maeari-page-copy mt-2">내가 나에게 맡겨둔 마음만 모아봤어요.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring maeari-action"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && selfMessages.length === 0 ? (
        <Notice title="아직 미래의 나에게 맡긴 마음이 없어요." body="마음 쓰기에서 수신 대상을 미래의 나로 선택해 보세요." />
      ) : null}
      {emotionFilters.length > 0 ? (
        <div className="maeari-filterbar mb-5">
          <button
            type="button"
            onClick={() => setEmotionFilter("ALL")}
            className={`focus-ring maeari-chip ${emotionFilter === "ALL" ? "maeari-chip-active" : ""}`}
          >
            모든 감정
          </button>
          {emotionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setEmotionFilter(filter.value)}
              className={`focus-ring maeari-chip ${emotionFilter === filter.value ? "maeari-chip-active" : ""}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {!loading && selfMessages.length > 0 && filteredMessages.length === 0 ? <Notice title="이 감정의 마음이 없어요." /> : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <Link
            key={message.id}
            href={`/messages/${message.id}`}
            className="focus-ring maeari-letter-surface flex gap-4 p-4 transition hover:-translate-y-0.5 hover:border-[#6D48DB]"
          >
            <LetterThumb src={message.thumbnail?.url} className="hidden h-[92px] w-[69px] shrink-0 sm:block" />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="maeari-badge bg-[#F3EFF7] text-[#6E738A]">
                  {statusLabel(message.status)}
                </span>
                <span className="maeari-badge bg-[#F3EEFD] text-[#6D48DB]">
                  {emotionLabel(message.emotionTag, message.customEmotionTag)}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-[#4E536B]">{message.title}</h2>
              <p className="mt-2 text-sm text-[#A2A6BF]">도착 예정: {formatDateTime(message.scheduledAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
