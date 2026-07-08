"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Inbox, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MessageAlbumCard } from "@/components/MessageAlbumCard";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime } from "@/lib/format";

type ArchivedMessage = {
  id: string;
  recipientId: string;
  title: string;
  thumbnail?: MessageThumbnail | null;
  preview: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  senderName?: string | null;
  arrivedAt?: string | null;
  readAt?: string | null;
  theme?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  attachmentCount?: number;
};

type MessageThumbnail = {
  source: "ATTACHMENT" | "DEFAULT";
  url: string;
};

export default function ArchivePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ title: string; tone?: "success" | "danger" | "default" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ messages: ArchivedMessage[] }>("/messages/archived");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "마음 보관함을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function unarchive(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/unarchive`, { method: "PATCH" });
      setNotice({ title: "보관함에서 뺐어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "되돌리지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function deleteMessage(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "마음 보관함에서 삭제했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "삭제하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function bulkDelete() {
    if (filteredMessages.length === 0 || !window.confirm("현재 보이는 마음 보관함의 마음을 모두 삭제할까요?")) {
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
  }, []);

  const filteredMessages = useMemo(() => {
    if (emotionFilter === "ALL") {
      return messages;
    }

    return messages.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
  }, [emotionFilter, messages]);

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
          <h1 className="maeari-page-title">마음 보관함</h1>
          <p className="maeari-page-copy mt-2">따로 간직하고 싶은 마음을 앨범처럼 모아두었어요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inbox" className="focus-ring maeari-action">
            <Inbox size={16} />
            받은 마음
          </Link>
          <button type="button" onClick={() => void load()} className="focus-ring maeari-action">
            <RefreshCw size={16} />
            새로고침
          </button>
          <button
            type="button"
            onClick={() => void bulkDelete()}
            disabled={bulkDeleting || filteredMessages.length === 0}
            className="focus-ring maeari-action disabled:opacity-50"
          >
            <Trash2 size={16} />
            일괄 삭제
          </button>
        </div>
      </div>

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

      {notice ? <Notice title={notice.title} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? <Notice title="보관한 마음이 없어요." body="간직하고 싶은 마음을 보관하면 이곳에서 앨범처럼 보여드릴게요." /> : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? <Notice title="선택한 감정의 마음이 없어요." /> : null}

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
              senderName: message.senderName,
              arrivedAtLabel: formatDateTime(message.arrivedAt),
              emotionLabel: emotionLabel(message.emotionTag, message.customEmotionTag),
              unread: !message.readAt,
              attachmentCount: message.attachmentCount,
            }}
            actions={
              <>
                <button type="button" onClick={() => void unarchive(message.id)} className="focus-ring maeari-action">
                  <ArchiveRestore size={16} />
                  보관함에서 빼기
                </button>
                <button type="button" onClick={() => void deleteMessage(message.id)} className="focus-ring maeari-action">
                  <Trash2 size={16} />
                  삭제
                </button>
              </>
            }
          />
        ))}
      </div>
    </AppShell>
  );
}
