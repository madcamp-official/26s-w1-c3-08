"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, QrCode, ShieldAlert, Trash2, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { QrShare } from "@/components/QrShare";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime, statusLabel } from "@/lib/format";

type MessageDetail = {
  id: string;
  title: string;
  content: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  theme?: string | null;
  thumbnail?: {
    source: "ATTACHMENT" | "DEFAULT";
    url: string;
  } | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  arrivalMode?: string | null;
  arrivalWindowStartAt?: string | null;
  arrivalWindowEndAt?: string | null;
  hintAt?: string | null;
  hintSentAt?: string | null;
  isReplyEnabled?: boolean;
  scheduledAt?: string | null;
  sentAt?: string | null;
  status: string;
  viewerRole: "SENDER" | "RECIPIENT";
  canCancel: boolean;
  canDeleteFromMailbox: boolean;
  senderName?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  attachments?: Array<{
    id: string;
    publicUrl: string;
    originalName?: string | null;
    mimeType: string;
    sizeBytes: number;
  }>;
  replies?: Array<{
    id: string;
    content: string;
    senderDisplayName?: string | null;
    isAnonymous: boolean;
    createdAt: string;
  }>;
  moderationNextRetryAt?: string | null;
  recipients?: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    type: string;
    deliveryStatus: string;
    deliveredAt?: string | null;
    readAt?: string | null;
    hasPublicLink: boolean;
    latestNotification?: {
      channel: string;
      status: string;
      errorCode?: string | null;
      errorMessage?: string | null;
      attemptedAt?: string | null;
      sentAt?: string | null;
    } | null;
  }>;
};

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  async function load() {
    try {
      const response = await apiFetch<{ message: MessageDetail }>(`/messages/${params.id}`);
      setMessage(response.message);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "메시지를 불러오지 못했어요.");
    }
  }

  async function copyPublicLink() {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${params.id}/public-link`, {
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
      setBusy(false);
    }
  }

  async function showPublicQr() {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${params.id}/public-link`, {
        method: "POST",
      });
      setQrUrl(toBrowserPublicUrl(response.publicUrl));
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "공개 QR을 만들지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelMessage() {
    setBusy(true);
    setNotice(null);

    try {
      await apiFetch(`/messages/${params.id}/cancel`, { method: "PATCH" });
      setNotice({ title: "예약을 취소했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "예약을 취소하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteFromMailbox() {
    setBusy(true);
    setNotice(null);

    try {
      await apiFetch(`/messages/${params.id}`, { method: "DELETE" });
      setNotice({ title: "보관함에서 삭제했어요.", tone: "success" });
      router.replace(message?.viewerRole === "RECIPIENT" ? "/inbox" : "/sent");
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "보관함에서 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reportMessage() {
    const reason = window.prompt("신고 사유를 입력해 주세요. 예: 욕설, 괴롭힘, 스팸");

    if (!reason) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await apiFetch(`/messages/${params.id}/reports`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setNotice({ title: "신고를 접수했어요.", tone: "success" });
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "신고를 접수하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id, router]);

  const detailCoverUrl = message ? message.thumbnail?.url ?? message.coverImageUrl ?? envelopeImageByTheme(message.theme) : null;
  const detailCoverAlt = message?.coverImageAlt ?? `${message?.title ?? "받은 마음"} 봉투 표지`;

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/sent" className="focus-ring maeari-action">
          보낸 마음
        </Link>
        <Link href="/inbox" className="focus-ring maeari-action">
          받은 마음
        </Link>
      </div>
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {!message && !error ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {message ? (
        <article className="figma-panel relative overflow-hidden p-5">
          {message.viewerRole === "RECIPIENT" && detailCoverUrl ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[312px] overflow-hidden">
              <img src={detailCoverUrl} alt={detailCoverAlt} className="h-full w-full object-cover object-top opacity-[0.32]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,252,255,0.14)_0%,rgba(255,252,255,0.58)_40%,rgba(255,252,255,0.95)_74%,rgba(255,252,255,1)_100%)]" />
            </div>
          ) : null}
          <div className="relative z-[1] mb-5 flex flex-wrap gap-2">
            <span className="maeari-badge bg-brand-gray text-[#6E738A]">
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
          <h1 className="relative z-[1] maeari-page-title">{message.title}</h1>
          <div className={`relative z-[1] mt-3 grid gap-1 text-sm text-[#A2A6BF] ${message.viewerRole === "RECIPIENT" ? "maeari-recipient-message-meta" : ""}`}>
            <p>보낸 사람: {message.senderName ?? "익명 발신"}</p>
            <p>예약 시간: {formatDateTime(message.scheduledAt)}</p>
            <p>도착 시간: {formatDateTime(message.sentAt)}</p>
            {message.status === "MODERATION_FAILED" ? (
              <p className="text-brand-accent">다음 검사: {formatDateTime(message.moderationNextRetryAt)}</p>
            ) : null}
            {message.arrivalMode === "RANDOM_WINDOW" ? (
              <p>
                랜덤 구간: {formatDateTime(message.arrivalWindowStartAt)} ~ {formatDateTime(message.arrivalWindowEndAt)}
              </p>
            ) : null}
            {message.hintAt ? (
              <p>
                힌트 알림: {formatDateTime(message.hintAt)}
                {message.hintSentAt ? ` 발송 완료 ${formatDateTime(message.hintSentAt)}` : ""}
              </p>
            ) : null}
          </div>
          {message.recipients && message.recipients.length > 0 ? (
            <div className="maeari-soft-panel relative z-[1] mt-5 p-4">
              <p className="text-sm font-semibold text-[#4E536B]">수신자</p>
              <div className="mt-3 grid gap-2 text-sm text-[#A2A6BF]">
                {message.recipients.map((recipient) => (
                  <div key={recipient.id} className="rounded-[8px] bg-[#F3EFF7] p-3">
                    <p>
                      {recipient.name ?? "수신자"} · {recipientTypeLabel(recipient.type)} ·{" "}
                      {statusLabel(recipient.deliveryStatus)}
                    </p>
                    <p className="mt-1 text-xs text-[#A2A6BF]">
                      {[recipient.email, recipient.phone].filter(Boolean).join(" · ") || "연락처 미입력"}
                    </p>
                    {recipient.deliveredAt ? (
                      <p className="mt-1 text-xs text-brand-sub">수신자 도착 시간: {formatDateTime(recipient.deliveredAt)}</p>
                    ) : null}
                    {recipient.latestNotification ? (
                      <div className="mt-2 rounded-[8px] border border-[#E3DEF0] bg-white p-2 text-xs">
                        <p className="font-semibold text-[#6E738A]">
                          외부 알림: {notificationStatusLabel(recipient.latestNotification.status)} ·{" "}
                          {notificationChannelLabel(recipient.latestNotification.channel)}
                        </p>
                        {recipient.latestNotification.errorMessage ? (
                          <p className="mt-1 text-rose-700">{recipient.latestNotification.errorMessage}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="relative z-[1] mt-8 whitespace-pre-wrap rounded-[8px] border border-[#E3DEF0] bg-[rgba(243,239,247,0.78)] p-4 leading-7 text-[#4E536B] backdrop-blur-[1.5px]">
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 ? (
            <div className="relative z-[1] mt-5 grid gap-3 md:grid-cols-2">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring block overflow-hidden rounded-[8px] border border-[#E3DEF0] bg-white"
                >
                  <img src={attachment.publicUrl} alt={attachment.originalName ?? ""} className="w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          {message.replies && message.replies.length > 0 ? (
            <div className="maeari-soft-panel relative z-[1] mt-6 p-4">
              <p className="text-sm font-semibold text-[#4E536B]">답장</p>
              <div className="mt-3 grid gap-2">
                {message.replies.map((reply) => (
                  <div key={reply.id} className="rounded-[8px] bg-[#F3EFF7] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#A2A6BF]">
                      <span>{reply.senderDisplayName ?? "익명 수신자"}</span>
                      <span>{formatDateTime(reply.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#4E536B]">{reply.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {["PENDING", "SENT"].includes(message.status) || message.canDeleteFromMailbox ? (
            <div className="relative z-[1] mt-6 flex flex-wrap gap-2">
              {["PENDING", "SENT"].includes(message.status) && message.viewerRole === "SENDER" ? (
                <>
                <button
                  type="button"
                  onClick={() => void copyPublicLink()}
                  disabled={busy}
                  className="focus-ring maeari-action maeari-action-primary disabled:opacity-50"
                >
                  <Copy size={16} />
                  공개 링크 복사
                </button>
                <button
                  type="button"
                  onClick={() => void showPublicQr()}
                  disabled={busy}
                  className="focus-ring maeari-action disabled:opacity-50"
                >
                  <QrCode size={16} />
                  QR 보기
                </button>
                </>
              ) : null}
              {message.canCancel ? (
                <button
                  type="button"
                  onClick={() => void cancelMessage()}
                  disabled={busy}
                  className="focus-ring maeari-action maeari-action-danger disabled:opacity-50"
                >
                  <XCircle size={16} />
                  예약 취소
                </button>
              ) : null}
              {message.canDeleteFromMailbox ? (
                <button
                  type="button"
                  onClick={() => void deleteFromMailbox()}
                  disabled={busy}
                  className="focus-ring maeari-action disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {message.viewerRole === "SENDER" ? senderDeleteLabel(message.status) : "받은 마음에서 삭제"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void reportMessage()}
                disabled={busy}
                className="focus-ring maeari-action disabled:opacity-50"
              >
                <ShieldAlert size={16} />
                신고
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
      {qrUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="figma-panel w-full max-w-sm p-4 shadow-[0_24px_60px_rgba(52,40,92,0.22)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-[#4E536B]">공개 도착 QR</p>
              <button type="button" onClick={() => setQrUrl(null)} className="focus-ring rounded-[8px] p-2" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <QrShare value={qrUrl} fileName={`maeari-message-${params.id}.png`} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function senderDeleteLabel(status: string) {
  if (["PENDING", "MODERATION_FAILED", "CANCELED"].includes(status)) {
    return "예약 삭제";
  }

  return "보낸 마음에서 삭제";
}

function envelopeImageByTheme(theme?: string | null) {
  const images: Record<string, string> = {
    LAVENDER: "/images/maeari-heart-letter.png",
    MOSS: "/images/maeari-card-letter.png",
    SUNSET: "/images/maeari-glow-envelope.png",
    MIDNIGHT: "/images/maeari-moon-letter.png",
    PAPER: "/images/maeari-star-letter.png",
  };

  return theme ? images[theme] ?? "/images/maeari-card-letter.png" : "/images/maeari-card-letter.png";
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

function notificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "대기",
    SENT: "발송 완료",
    FAILED: "발송 실패",
    SKIPPED: "발송 생략",
  };

  return labels[status] ?? status;
}

function notificationChannelLabel(channel: string) {
  const labels: Record<string, string> = {
    IN_APP: "서비스 내부",
    KAKAO_ALIMTALK: "카카오 알림톡",
    SMS: "문자",
    EMAIL: "이메일",
  };

  return labels[channel] ?? channel;
}

function recipientTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SELF: "미래의 나",
    FRIEND: "친구",
    OTHER: "연락처",
  };

  return labels[type] ?? type;
}
