"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock3, Copy, Link2, MessageCircle, QrCode, RefreshCw, Send, Trash2, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { QrShare } from "@/components/QrShare";
import { LetterThumb } from "@/components/ui";
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
  { value: "PENDING", label: "예약함" },
  { value: "SENT", label: "전달 완료" },
  { value: "FAILED", label: "전달 실패" },
] as const;

const periodFilters = [
  { value: "ALL", label: "전체 기간" },
  { value: "7D", label: "최근 7일" },
  { value: "30D", label: "최근 30일" },
  { value: "90D", label: "최근 90일" },
] as const;

export default function SentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [replies, setReplies] = useState<SentReply[]>([]);
  const [viewMode, setViewMode] = useState<"MESSAGES" | "REPLIES">("MESSAGES");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]["value"]>("ALL");
  const [periodFilter, setPeriodFilter] = useState<(typeof periodFilters)[number]["value"]>("ALL");
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
      next = next.filter((message) => matchesSentStatusFilter(message.status, statusFilter));
    }

    if (periodFilter !== "ALL") {
      const days = periodFilter === "7D" ? 7 : periodFilter === "30D" ? 30 : 90;
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      next = next.filter((message) => new Date(message.sentAt ?? message.scheduledAt).getTime() >= since);
    }

    if (emotionFilter !== "ALL") {
      next = next.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
    }

    return next;
  }, [emotionFilter, messages, periodFilter, statusFilter]);

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

  const summary = useMemo(() => createSentSummary(messages), [messages]);

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="maeari-page-title">보낸 마음</h1>
          <p className="maeari-page-copy mt-2">예약한 마음과 도착한 마음을 확인해요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[8px] border border-[#E6E0F1] bg-white p-1">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`focus-ring h-8 min-w-[74px] rounded-[6px] px-3 text-xs transition ${
                  statusFilter === filter.value ? "bg-[#F3EEFD] text-[#6D48DB]" : "text-[#9EA2B7] hover:bg-[#F9F7FD] hover:text-[#6D48DB]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as (typeof periodFilters)[number]["value"])}
            className="focus-ring maeari-input h-10 rounded-[8px] px-3 text-xs text-[#7A7F99]"
          >
            {periodFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadMessages()}
            className="focus-ring maeari-action h-10"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>

      <section className="figma-panel mb-5 grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item, index) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className={`flex items-center gap-4 ${index > 0 ? "xl:border-l xl:border-[#EEE8F8] xl:pl-5" : ""}`}>
              <span className={`grid h-12 w-12 place-items-center rounded-full ${item.iconBg} ${item.iconText}`}>
                <Icon size={22} strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-xs text-[#9EA2B7]">{item.label}</p>
                <p className="mt-1 text-[22px] leading-none text-[#4E5391]">
                  {item.count}
                  <span className="ml-1 text-xs text-[#A9ADBE]">개</span>
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="maeari-filterbar mb-5">
        <button
          type="button"
          onClick={() => setViewMode("MESSAGES")}
          className={`focus-ring maeari-chip ${viewMode === "MESSAGES" ? "maeari-chip-active" : ""}`}
        >
          <Link2 size={15} />
          보낸 마음
        </button>
        <button
          type="button"
          onClick={() => setViewMode("REPLIES")}
          className={`focus-ring maeari-chip ${viewMode === "REPLIES" ? "maeari-chip-active" : ""}`}
        >
          <MessageCircle size={15} />
          답장함
          {replies.some((reply) => !reply.senderReadAt) ? (
            <span className="rounded-[8px] bg-white/20 px-2 py-0.5 text-[11px]">{replies.filter((reply) => !reply.senderReadAt).length}</span>
          ) : null}
        </button>
      </div>
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {viewMode === "MESSAGES" ? (
        <>
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
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 보낸 마음이 없어요." body="첫 마음을 남겨보세요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
        <Notice title="이 상태의 마음이 없어요." />
      ) : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.id} className="maeari-letter-surface p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-1 gap-4">
                <LetterThumb className="hidden h-[92px] w-[69px] shrink-0 sm:block" />
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="maeari-badge bg-[#F3EFF7] text-[#6E738A]">
                      {statusLabel(message.status)}
                    </span>
                    <span className="maeari-badge bg-[#F3EEFD] text-[#6D48DB]">
                      {emotionLabel(message.emotionTag, message.customEmotionTag)}
                    </span>
                    {message.isSenderHidden ? (
                      <span className="maeari-badge bg-[#EEE8FD] text-[#6D48DB]">
                        발신인 숨김
                      </span>
                    ) : null}
                    {message.isDateHidden ? (
                      <span className="maeari-badge bg-[#F3EFF7] text-[#8588A1]">
                        도착일 숨김
                      </span>
                    ) : null}
                  </div>
                  <Link href={`/messages/${message.id}`} className="focus-ring rounded-[8px] text-lg font-semibold text-[#4E536B] hover:text-[#6D48DB]">
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
                    <p className="mt-2 text-sm text-[#9A85E1]">도착 시간: {formatDateTime(message.sentAt)}</p>
                  ) : null}
                  {message.status === "MODERATION_FAILED" ? (
                    <p className="mt-2 text-sm text-[#6D48DB]">
                      다음 검사: {formatDateTime(message.moderationNextRetryAt)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/messages/${message.id}`} className="focus-ring maeari-action">
                  상세
                </Link>
                {["PENDING", "SENT"].includes(message.status) ? (
                  <>
                  <button
                    type="button"
                    onClick={() => void copyPublicLink(message.id)}
                    disabled={linkingId === message.id}
                    className="focus-ring maeari-action disabled:opacity-50"
                  >
                    {message.hasPublicLink ? <Copy size={16} /> : <Link2 size={16} />}
                    {linkingId === message.id ? "생성 중" : "링크 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void showPublicQr(message.id)}
                    disabled={linkingId === message.id}
                    className="focus-ring maeari-action disabled:opacity-50"
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
                    className="focus-ring maeari-action maeari-action-danger"
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
                    className="focus-ring maeari-action disabled:opacity-50"
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
            <article key={reply.replyId} className="maeari-letter-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className={`maeari-badge ${reply.senderReadAt ? "bg-brand-gray text-[#6E738A]" : "bg-[#6D48DB] text-white"}`}>
                      {reply.senderReadAt ? "읽음" : "새 답장"}
                    </span>
                    <span className="maeari-badge bg-[#EEE8FD] text-[#6D48DB]">
                      {reply.senderDisplayName ?? "익명 답장"}
                    </span>
                  </div>
                  <Link
                    href={`/messages/${reply.messageId}`}
                    onClick={() => void markReplyRead(reply.replyId)}
                    className="focus-ring rounded-[8px] text-lg font-semibold text-[#4E536B]"
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
                    className="focus-ring maeari-action"
                  >
                    확인
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteReply(reply.replyId)}
                    className="focus-ring maeari-action"
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
          <div className="figma-panel w-full max-w-sm p-4 shadow-[0_24px_60px_rgba(52,40,92,0.22)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-[#4E536B]">공개 도착 QR</p>
              <button type="button" onClick={() => setQrUrl(null)} className="focus-ring rounded-[8px] p-2" aria-label="닫기">
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

function matchesSentStatusFilter(status: string, filter: (typeof statusFilters)[number]["value"]) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "FAILED") {
    return ["FAILED", "BLOCKED", "MODERATION_FAILED"].includes(status);
  }

  return status === filter;
}

function createSentSummary(messages: SentMessage[]) {
  const reserved = messages.filter((message) => message.status === "PENDING").length;
  const completed = messages.filter((message) => message.status === "SENT").length;
  const failed = messages.filter((message) => ["FAILED", "BLOCKED", "MODERATION_FAILED"].includes(message.status)).length;

  return [
    {
      label: "전체",
      count: messages.length,
      icon: Send,
      iconBg: "bg-[#EEE8FD]",
      iconText: "text-[#6D48DB]",
    },
    {
      label: "예약함",
      count: reserved,
      icon: Send,
      iconBg: "bg-[#E4F3FF]",
      iconText: "text-[#4BA5F5]",
    },
    {
      label: "전달 완료",
      count: completed,
      icon: Check,
      iconBg: "bg-[#E3F7DE]",
      iconText: "text-[#24B53E]",
    },
    {
      label: "전달 실패",
      count: failed,
      icon: Clock3,
      iconBg: "bg-[#FFE2E2]",
      iconText: "text-[#EF5757]",
    },
  ];
}

function senderDeleteLabel(status: string) {
  if (["PENDING", "MODERATION_FAILED", "CANCELED"].includes(status)) {
    return "예약 삭제";
  }

  return "보낸 마음에서 삭제";
}
