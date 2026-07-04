"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime } from "@/lib/format";

type InboxMessage = {
  id: string;
  recipientId: string;
  title: string;
  preview: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  readAt?: string | null;
  linkedAt?: string | null;
};

const readFilters = [
  { value: "ALL", label: "전체" },
  { value: "UNREAD", label: "미열람" },
  { value: "READ", label: "읽음" },
] as const;

export default function InboxPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<(typeof readFilters)[number]["value"]>("ALL");
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const response = await apiFetch<{ messages: InboxMessage[] }>("/messages/received");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "수신함을 불러오지 못했어요.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function deleteFromInbox(id: string) {
    setDeletingId(id);
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "받은 마음에서 삭제했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "받은 마음에서 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 20000);

    return () => window.clearInterval(timer);
  }, [router]);

  const filteredMessages = useMemo(() => {
    let next = messages;

    if (readFilter === "UNREAD") {
      next = next.filter((message) => !message.readAt);
    } else if (readFilter === "READ") {
      next = next.filter((message) => message.readAt);
    }

    if (emotionFilter !== "ALL") {
      next = next.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
    }

    return next;
  }, [emotionFilter, messages, readFilter]);

  const emotionFilters = useMemo(() => {
    const seen = new Set<string>();

    return messages.flatMap((message) => {
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
  }, [messages]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">받은 마음</h1>
          <p className="mt-2 text-sm text-slate-600">나에게 도착한 마음을 모아두었어요.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {readFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setReadFilter(filter.value)}
            className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
              readFilter === filter.value
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {emotionFilters.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEmotionFilter("ALL")}
            className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
              emotionFilter === "ALL" ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            모든 감정
          </button>
          {emotionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setEmotionFilter(filter.value)}
              className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
                emotionFilter === filter.value
                  ? "border-ink bg-ink text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 도착한 마음이 없어요." body="미래의 나에게 먼저 남겨보세요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
        <Notice title="이 조건의 마음이 없어요." />
      ) : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.recipientId} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <Link href={`/messages/${message.id}`} className="focus-ring block min-w-0 rounded-md hover:text-petal">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {emotionLabel(message.emotionTag, message.customEmotionTag)}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {message.senderName ?? "누군가의 마음"}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    {message.readAt ? "읽음" : "미열람"}
                  </span>
                  {message.linkedAt ? (
                    <span className="rounded-md bg-moss/10 px-2 py-1 text-xs font-semibold text-moss">
                      자동 보관
                    </span>
                  ) : null}
                  {message.isSenderHidden ? (
                    <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                      발신인 숨김
                    </span>
                  ) : null}
                  {message.isDateHidden ? (
                    <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                      도착일 숨김
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold text-ink">{message.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{message.preview}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">{formatDateTime(message.arrivedAt)}</p>
              </Link>
              <button
                type="button"
                onClick={() => void deleteFromInbox(message.id)}
                disabled={deletingId === message.id}
                className="focus-ring inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {deletingId === message.id ? "삭제 중" : "삭제"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
