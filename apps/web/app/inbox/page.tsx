"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MessageAlbumCard } from "@/components/MessageAlbumCard";
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
  thumbnail?: MessageThumbnail | null;
  theme?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  attachmentCount?: number;
};

type MessageThumbnail = {
  source: "ATTACHMENT" | "DEFAULT";
  url: string;
};

const readFilters = [
  { value: "ALL", label: "전체" },
  { value: "UNREAD", label: "읽지 않은 마음" },
  { value: "READ", label: "읽은 마음" },
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
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await apiFetch<{ messages: InboxMessage[] }>("/messages/received");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "받은 마음을 불러오지 못했어요.");
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

  async function archiveMessage(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/archive`, { method: "PATCH" });
      setNotice({ title: "마음 보관함에 담았어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "보관하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function bulkDeleteVisible() {
    if (filteredMessages.length === 0 || !window.confirm("현재 보이는 받은 마음을 모두 삭제할까요?")) {
      return;
    }

    setBulkDeleting(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ deletedCount: number; failedCount: number }>("/messages/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ messageIds: filteredMessages.map((message) => message.id) }),
      });
      setNotice({
        title: `${response.deletedCount}개를 삭제했어요.${response.failedCount ? ` 실패 ${response.failedCount}개` : ""}`,
        tone: response.failedCount ? "default" : "success",
      });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "일괄 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBulkDeleting(false);
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
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="maeari-page-title">받은 마음</h1>
          <p className="maeari-page-copy mt-2">누군가가 전한 따뜻한 마음을 확인해 보세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="focus-ring maeari-action">
            <RefreshCw size={16} />
            새로고침
          </button>
          <Link href="/archive" className="focus-ring maeari-action">
            <Archive size={16} />
            마음 보관함
          </Link>
          <button
            type="button"
            onClick={() => void bulkDeleteVisible()}
            disabled={bulkDeleting || filteredMessages.length === 0}
            className="focus-ring maeari-action disabled:opacity-50"
          >
            <Trash2 size={16} />
            일괄 삭제
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="maeari-filterbar">
          {readFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setReadFilter(filter.value)}
              className={`focus-ring maeari-chip ${readFilter === filter.value ? "maeari-chip-active" : ""}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {emotionFilters.length > 0 ? (
          <div className="maeari-filterbar">
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
      </div>

      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 도착한 마음이 없어요." body="첫 마음이 도착하면 이곳에서 앨범처럼 보여드릴게요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? <Notice title="조건에 맞는 마음이 없어요." /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredMessages.map((message) => (
          <MessageAlbumCard
            key={message.recipientId}
            href={`/messages/${message.id}`}
            message={{
              id: message.id,
              title: message.title,
              preview: message.preview,
              coverUrl: message.thumbnail?.url ?? message.coverImageUrl,
              coverAlt: message.coverImageAlt ?? message.title,
              senderName: message.isSenderHidden ? "익명" : message.senderName,
              arrivedAtLabel: message.isDateHidden ? "숨겨진 도착일" : formatDateTime(message.arrivedAt),
              emotionLabel: emotionLabel(message.emotionTag, message.customEmotionTag),
              unread: !message.readAt,
              attachmentCount: message.attachmentCount,
            }}
            actions={
              <>
                <button type="button" onClick={() => void archiveMessage(message.id)} className="focus-ring maeari-action">
                  <Archive size={16} />
                  보관
                </button>
                <button
                  type="button"
                  onClick={() => void deleteFromInbox(message.id)}
                  disabled={deletingId === message.id}
                  className="focus-ring maeari-action disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {deletingId === message.id ? "삭제 중" : "삭제"}
                </button>
              </>
            }
          />
        ))}
      </div>
    </AppShell>
  );
}
