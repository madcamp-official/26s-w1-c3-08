"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Link2, MessageCircle, QrCode, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { QrShare } from "@/components/QrShare";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime, statusLabel } from "@/lib/format";

type SentMessage = {
  id: string;
  title: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  scheduledAt: string;
  sentAt?: string | null;
  status: string;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  moderationNextRetryAt?: string | null;
  receiver?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    type: string;
    deliveryStatus: string;
    deliveredAt?: string | null;
  } | null;
  receiverCount?: number;
  hasPublicLink: boolean;
};

type SentReply = {
  replyId: string;
  messageId: string;
  messageTitle: string;
  senderDisplayName?: string | null;
  isAnonymous: boolean;
  preview: string;
  createdAt: string;
  senderReadAt?: string | null;
  receiverName?: string | null;
  receiverType: string;
};

const statusFilters = [
  { value: "ALL", label: "전체" },
  { value: "PENDING", label: "예약 대기" },
  { value: "SENT", label: "도착 완료" },
  { value: "MODERATION_FAILED", label: "검사 대기" },
  { value: "BLOCKED", label: "검사 차단" },
  { value: "FAILED", label: "실패" },
  { value: "CANCELED", label: "취소" },
] as const;

export default function SentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [replies, setReplies] = useState<SentReply[]>([]);
  const [viewMode, setViewMode] = useState<"MESSAGES" | "REPLIES">("MESSAGES");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]["value"]>("ALL");
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<{ messageId: string; url: string } | null>(null);

  async function loadMessages(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await apiFetch<{ messages: SentMessage[] }>("/messages/sent");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "발신함을 불러오지 못했어요.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function loadReplies() {
    try {
      const response = await apiFetch<{ replies: SentReply[] }>("/messages/sent/replies");
      setReplies(response.replies);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setNotice({ title: caught instanceof Error ? caught.message : "답장함을 불러오지 못했어요.", tone: "danger" });
    }
  }

  async function cancel(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/cancel`, { method: "PATCH" });
      setNotice({ title: "예약을 취소했어요.", tone: "success" });
      await loadMessages();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "예약을 취소하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function copyPublicLink(messageId: string) {
    setLinkingId(messageId);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${messageId}/public-link`, {
        method: "POST",
      });
      const url = toBrowserPublicUrl(response.publicUrl);
      await navigator.clipboard.writeText(url);
      setNotice({ title: "공개 링크를 복사했어요.", body: url, tone: "success" });
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "공개 링크를 만들지 못했어요.",
        tone: "danger",
      });
    } finally {
      setLinkingId(null);
    }
  }

  async function showPublicQr(messageId: string) {
    setLinkingId(messageId);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${messageId}/public-link`, {
        method: "POST",
      });
      setQrUrl({ messageId, url: toBrowserPublicUrl(response.publicUrl) });
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "공개 QR을 만들지 못했어요.",
        tone: "danger",
      });
    } finally {
      setLinkingId(null);
    }
  }

  async function deleteFromMailbox(id: string) {
    setDeletingId(id);
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "보낸 마음에서 삭제했어요.", tone: "success" });
      await loadMessages();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "보낸 마음에서 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function markReplyRead(replyId: string) {
    await apiFetch(`/messages/replies/${replyId}/read`, { method: "PATCH" });
    setReplies((current) =>
      current.map((reply) =>
        reply.replyId === replyId ? { ...reply, senderReadAt: reply.senderReadAt ?? new Date().toISOString() } : reply,
      ),
    );
  }

  async function deleteReply(replyId: string) {
    try {
      await apiFetch(`/messages/replies/${replyId}`, { method: "DELETE" });
      setReplies((current) => current.filter((reply) => reply.replyId !== replyId));
      setNotice({ title: "답장을 답장함에서 삭제했어요.", tone: "success" });
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "답장을 삭제하지 못했어요.", tone: "danger" });
    }
  }

  useEffect(() => {
    void loadMessages();
    void loadReplies();
    const timer = window.setInterval(() => {
      void loadMessages({ silent: true });
      void loadReplies();
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredMessages = useMemo(() => {
    let next = messages;

    if (statusFilter !== "ALL") {
      next = next.filter((message) => message.status === statusFilter);
    }

    if (emotionFilter !== "ALL") {
      next = next.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
    }

    return next;
  }, [emotionFilter, messages, statusFilter]);

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#4E536B]">보낸 마음</h1>
          <p className="mt-2 text-sm text-[#A2A6BF]">예약한 마음과 도착한 마음을 확인해요.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMessages()}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode("MESSAGES")}
          className={`focus-ring inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
            viewMode === "MESSAGES" ? "border-brand-accent bg-[#6D48DB] text-white" : "border-[#DAD4E8] bg-white text-[#6E738A]"
          }`}
        >
          <Link2 size={15} />
          보낸 마음
        </button>
        <button
          type="button"
          onClick={() => setViewMode("REPLIES")}
          className={`focus-ring inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
            viewMode === "REPLIES" ? "border-brand-accent bg-[#6D48DB] text-white" : "border-[#DAD4E8] bg-white text-[#6E738A]"
          }`}
        >
          <MessageCircle size={15} />
          답장함
          {replies.some((reply) => !reply.senderReadAt) ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{replies.filter((reply) => !reply.senderReadAt).length}</span>
          ) : null}
        </button>
      </div>
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {viewMode === "MESSAGES" ? (
        <>
      <div className="mb-5 flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              statusFilter === filter.value
                ? "border-brand-accent bg-[#6D48DB] text-white"
                : "border-[#DAD4E8] bg-white text-[#6E738A]"
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
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              emotionFilter === "ALL" ? "border-brand-accent bg-[#6D48DB] text-white" : "border-[#DAD4E8] bg-white text-[#6E738A]"
            }`}
          >
            모든 감정
          </button>
          {emotionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setEmotionFilter(filter.value)}
              className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
                emotionFilter === filter.value
                  ? "border-brand-accent bg-[#6D48DB] text-white"
                  : "border-[#DAD4E8] bg-white text-[#6E738A]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 보낸 마음이 없어요." body="첫 마음을 남겨보세요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
        <Notice title="이 상태의 마음이 없어요." />
      ) : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.id} className="rounded-lg border figma-panel p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-brand-gray px-2 py-1 text-xs font-semibold text-[#6E738A]">
                    {statusLabel(message.status)}
                  </span>
                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {emotionLabel(message.emotionTag, message.customEmotionTag)}
                  </span>
                  {message.isSenderHidden ? (
                    <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                      발신인 숨김
                    </span>
                  ) : null}
                  {message.isDateHidden ? (
                    <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                      도착일 숨김
                    </span>
                  ) : null}
                </div>
                <Link href={`/messages/${message.id}`} className="focus-ring rounded-lg text-lg font-semibold text-[#4E536B]">
                  {message.title}
                </Link>
                <p className="mt-2 text-sm text-[#A2A6BF]">
                  {message.receiverCount && message.receiverCount > 1
                    ? `${message.receiverCount}명`
                    : message.receiver?.name ?? "수신자"}{" "}
                  · {formatDateTime(message.scheduledAt)}
                </p>
                {message.receiver ? (
                  <p className="mt-1 text-xs text-[#A2A6BF]">
                    {[message.receiver.email, message.receiver.phone].filter(Boolean).join(" · ") || "연락처 미입력"} ·{" "}
                    {statusLabel(message.receiver.deliveryStatus)}
                  </p>
                ) : null}
                {message.status === "PENDING" ? (
                  <p className="mt-2 text-sm text-[#A2A6BF]">
                    예약 시간이 지나면 보통 1분 안에 도착 완료로 바뀌어요.
                  </p>
                ) : null}
                {message.status === "SENT" && message.sentAt ? (
                  <p className="mt-2 text-sm text-brand-sub">도착 시간: {formatDateTime(message.sentAt)}</p>
                ) : null}
                {message.status === "MODERATION_FAILED" ? (
                  <p className="mt-2 text-sm text-brand-accent">
                    다음 검사: {formatDateTime(message.moderationNextRetryAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/messages/${message.id}`}
                  className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                >
                  상세
                </Link>
                {["PENDING", "SENT"].includes(message.status) ? (
                  <>
                  <button
                    type="button"
                    onClick={() => void copyPublicLink(message.id)}
                    disabled={linkingId === message.id}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {message.hasPublicLink ? <Copy size={16} /> : <Link2 size={16} />}
                    {linkingId === message.id ? "생성 중" : "링크 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void showPublicQr(message.id)}
                    disabled={linkingId === message.id}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <QrCode size={16} />
                    QR 보기
                  </button>
                  </>
                ) : null}
                {["PENDING", "MODERATION_FAILED"].includes(message.status) ? (
                  <button
                    type="button"
                    onClick={() => void cancel(message.id)}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                  >
                    <XCircle size={16} />
                    취소
                  </button>
                ) : null}
                {isSenderDeletableStatus(message.status) ? (
                  <button
                    type="button"
                    onClick={() => void deleteFromMailbox(message.id)}
                    disabled={deletingId === message.id}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold text-[#6E738A] disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {deletingId === message.id ? "삭제 중" : senderDeleteLabel(message.status)}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
        </>
      ) : (
        <div className="grid gap-3">
          {replies.length === 0 ? <Notice title="아직 도착한 답장이 없어요." /> : null}
          {replies.map((reply) => (
            <article key={reply.replyId} className="rounded-lg border figma-panel p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${reply.senderReadAt ? "bg-brand-gray text-[#6E738A]" : "bg-[#6D48DB] text-white"}`}>
                      {reply.senderReadAt ? "읽음" : "새 답장"}
                    </span>
                    <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                      {reply.senderDisplayName ?? "익명 답장"}
                    </span>
                  </div>
                  <Link
                    href={`/messages/${reply.messageId}`}
                    onClick={() => void markReplyRead(reply.replyId)}
                    className="focus-ring rounded-lg text-lg font-semibold text-[#4E536B]"
                  >
                    {reply.messageTitle}
                  </Link>
                  <p className="mt-2 text-sm text-[#A2A6BF]">
                    {reply.receiverName ?? "수신자"} · {formatDateTime(reply.createdAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#4E536B]">{reply.preview}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/messages/${reply.messageId}`}
                    onClick={() => void markReplyRead(reply.replyId)}
                    className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                  >
                    확인
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteReply(reply.replyId)}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold text-[#6E738A]"
                  >
                    <Trash2 size={16} />
                    삭제
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {qrUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-[16px] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-[#4E536B]">공개 도착 QR</p>
              <button type="button" onClick={() => setQrUrl(null)} className="focus-ring rounded-lg p-2" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <QrShare value={qrUrl.url} fileName={`maeari-message-${qrUrl.messageId}.png`} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function toBrowserPublicUrl(publicUrl: string) {
  try {
    const parsed = new URL(publicUrl);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return publicUrl;
  } catch {
    return publicUrl;
  }
}

function isSenderDeletableStatus(status: string) {
  return ["PENDING", "MODERATION_FAILED", "CANCELED", "SENT", "FAILED"].includes(status);
}

function senderDeleteLabel(status: string) {
  if (["PENDING", "MODERATION_FAILED", "CANCELED"].includes(status)) {
    return "예약 삭제";
  }

  return "보낸 마음에서 삭제";
}
