"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, BellOff, Clock3, Gift, LogIn, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { ApiError, apiFetch, getApiBaseUrl } from "@/lib/api";
import { Notice } from "@/components/Notice";
import { emotionLabel, formatDateTime } from "@/lib/format";

const PENDING_TOKEN_KEY = "maeari.pendingArrivalToken";

type PublicMessage = {
  id: string;
  title: string;
  content: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  theme?: string | null;
  attachments?: Array<{
    id: string;
    publicUrl: string;
    originalName?: string | null;
    mimeType: string;
    sizeBytes: number;
  }>;
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  linked: boolean;
  canReply: boolean;
  canSuppressEmailNotification: boolean;
  canSuppressSmsNotification: boolean;
  isEmailNotificationSuppressed: boolean;
  isSmsNotificationSuppressed: boolean;
};

type ArrivalGate = {
  scheduledAt?: string | null;
};

type SuppressionChannel = "EMAIL" | "SMS";

export default function ArrivalPage() {
  const params = useParams<{ token: string }>();
  const [message, setMessage] = useState<PublicMessage | null>(null);
  const [gate, setGate] = useState<ArrivalGate | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppressingChannel, setSuppressingChannel] = useState<SuppressionChannel | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyNotice, setReplyNotice] = useState<{ title: string; tone: "success" | "danger" } | null>(null);
  const [suppressionNotices, setSuppressionNotices] = useState<Partial<Record<SuppressionChannel, {
    title: string;
    tone: "success" | "danger";
  }>>>({});

  useEffect(() => {
    sessionStorage.setItem(PENDING_TOKEN_KEY, params.token);

    async function load() {
      try {
        const response = await apiFetch<{ message: PublicMessage }>(`/public/messages/${params.token}`);
        setMessage(response.message);
        setGate(null);
        setError(null);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "MESSAGE_NOT_ARRIVED") {
          setGate((caught.details ?? {}) as ArrivalGate);
          setError(null);
          return;
        }

        setGate(null);
        setError(caught instanceof ApiError ? caught.message : "도착한 마음을 찾지 못했어요.");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [params.token]);

  async function handleToggleSuppression(channel: SuppressionChannel, suppressed: boolean) {
    setSuppressingChannel(channel);
    setSuppressionNotices((previous) => ({ ...previous, [channel]: undefined }));

    try {
      const response = await apiFetch<{ channel: SuppressionChannel; suppressed: boolean }>("/public/notification-suppressions", {
        method: suppressed ? "DELETE" : "POST",
        body: JSON.stringify({
          token: params.token,
          channel,
        }),
      });
      setMessage((previous) => {
        if (!previous) {
          return previous;
        }

        if (response.channel === "EMAIL") {
          return { ...previous, isEmailNotificationSuppressed: response.suppressed };
        }

        return { ...previous, isSmsNotificationSuppressed: response.suppressed };
      });
      setSuppressionNotices((previous) => ({
        ...previous,
        [channel]: {
          title: createSuppressionNoticeTitle(channel, response.suppressed),
          tone: "success",
        },
      }));
    } catch (caught) {
      setSuppressionNotices((previous) => ({
        ...previous,
        [channel]: {
          title: caught instanceof ApiError ? caught.message : "수신거부를 저장하지 못했어요.",
          tone: "danger",
        },
      }));
    } finally {
      setSuppressingChannel(null);
    }
  }

  async function sendReply() {
    setReplying(true);
    setReplyNotice(null);

    try {
      await apiFetch(`/public/messages/${params.token}/replies`, {
        method: "POST",
        body: JSON.stringify({
          content: replyContent,
          isAnonymous: true,
        }),
      });
      setReplyContent("");
      setReplyNotice({ title: "익명 답장을 보냈어요.", tone: "success" });
    } catch (caught) {
      setReplyNotice({
        title: caught instanceof ApiError ? caught.message : "답장을 보내지 못했어요.",
        tone: "danger",
      });
    } finally {
      setReplying(false);
    }
  }

  async function reportMessage() {
    const reason = window.prompt("신고 사유를 입력해 주세요. 예: 욕설, 괴롭힘, 스팸");

    if (!reason) {
      return;
    }

    try {
      await apiFetch(`/public/messages/${params.token}/reports`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReplyNotice({ title: "신고를 접수했어요.", tone: "success" });
    } catch (caught) {
      setReplyNotice({
        title: caught instanceof ApiError ? caught.message : "신고를 접수하지 못했어요.",
        tone: "danger",
      });
    }
  }

  return (
    <main className="maeari-public-stage text-[#4E536B]">
      <header className="h-[74px] border-b border-[#EEE8F8] bg-white/92 px-5 backdrop-blur-xl">
        <div className="flex h-full items-center">
          <Image
            src="/images/maeari-app-icon.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="ml-3 text-[25px] font-semibold tracking-[0.01em] text-[#6D48DB]">매아리</span>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-4 py-10">

      {error ? <Notice title={error} tone="danger" /> : null}
      {!message && !error && !gate ? <p className="text-sm text-[#A2A6BF]">도착한 마음을 확인하고 있어요.</p> : null}
      {gate ? (
        <section className="figma-panel p-6 text-center">
          <div className="relative mx-auto mb-5 aspect-square w-28 overflow-hidden rounded-[8px] bg-[#fbf7ff]">
            <Image
              src="/images/maeari-moon-letter.png"
              alt="보관 중인 마음 봉투"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <Clock3 className="mx-auto mb-4 text-brand-sub" size={32} />
          <h1 className="maeari-page-title">아직 보관 중인 마음이에요.</h1>
          <p className="maeari-page-copy mt-3">
            {gate.scheduledAt
              ? `${formatDateTime(gate.scheduledAt)} 이후에 열어볼 수 있어요.`
              : "도착 시간이 될 때까지 조금 더 기다려 주세요."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring maeari-action mt-6"
          >
            <RefreshCw size={16} />
            다시 확인
          </button>
        </section>
      ) : null}
      {message && !opened ? (
        <section className="figma-panel p-6 text-center">
          <div className="relative mx-auto mb-5 aspect-square w-36 overflow-hidden rounded-[8px] bg-[#fbf7ff]">
            <Image
              src="/images/maeari-heart-letter.png"
              alt="도착한 마음 봉투"
              fill
              sizes="144px"
              className="object-cover"
              priority
            />
          </div>
          <Gift className="mx-auto mb-4 text-brand-accent" size={32} />
          <h1 className="maeari-page-title">오늘, 누군가의 마음이 도착했어요.</h1>
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="focus-ring maeari-action maeari-action-primary mt-6 h-11 px-5"
          >
            열어보기
          </button>
        </section>
      ) : null}
      {message && opened ? (
        <article className={`figma-panel p-6 ${themeClass(message.theme)}`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="maeari-badge bg-[#F3EEFD] text-[#6D48DB]">
              {emotionLabel(message.emotionTag, message.customEmotionTag)}
            </span>
            <span className="maeari-badge bg-brand-gray text-[#6E738A]">
              {message.senderName ?? "누군가의 마음"}
            </span>
          </div>
          <h1 className="maeari-page-title">{message.title}</h1>
          <p className="maeari-page-copy mt-2">{formatDateTime(message.arrivedAt)}</p>
          <div className="mt-8 whitespace-pre-wrap rounded-[8px] border border-[#E3DEF0] bg-[#F3EFF7]/70 p-4 leading-7 text-[#4E536B]">
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
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
          {message.canReply ? (
            <div className="maeari-soft-panel mt-6 p-4">
              <p className="text-sm font-semibold text-[#4E536B]">익명 답장</p>
              <textarea
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="보낸 사람에게 짧은 답장을 남겨보세요."
                className="focus-ring maeari-input mt-3 w-full resize-y px-3 py-2 text-sm"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={replying || replyContent.trim().length === 0}
                  className="focus-ring maeari-action maeari-action-primary disabled:opacity-50"
                >
                  <Send size={16} />
                  {replying ? "보내는 중" : "답장 보내기"}
                </button>
                <p className="text-xs text-[#A2A6BF]">답장 내용도 안전 검사를 통과한 뒤 저장돼요.</p>
              </div>
              {replyNotice ? <Notice title={replyNotice.title} tone={replyNotice.tone} /> : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void reportMessage()}
            className="focus-ring maeari-action mt-4"
          >
            <ShieldAlert size={16} />
            신고
          </button>
          <div className="maeari-soft-panel mt-6 p-4">
            {message.linked ? (
              <p className="text-sm font-medium text-[#6E738A]">이미 매아리 수신함에 보관된 마음이에요.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-[#6E738A]">
                  이 마음을 오래 보관하고 싶다면 매아리에 저장해 보세요.
                </p>
                <a
                  href={`${getApiBaseUrl()}/auth/kakao`}
                  className="focus-ring mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-[8px] bg-[#fee500] px-4 text-sm font-semibold text-[#191600] shadow-[0_10px_22px_rgba(55,43,13,0.10)]"
                >
                  <LogIn size={16} />
                  카카오로 시작하기
                </a>
              </>
            )}
          </div>
          {message.canSuppressEmailNotification || message.canSuppressSmsNotification ? (
            <div className="mt-4 rounded-[8px] border border-[#E3DEF0] bg-[#F3EFF7]/70 p-4">
              <p className="text-sm text-[#A2A6BF]">
                이 링크로 받은 알림을 앞으로 받고 싶지 않다면 채널별로 멈출 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {message.canSuppressEmailNotification ? (
                  <SuppressionButton
                    channel="EMAIL"
                    suppressed={message.isEmailNotificationSuppressed}
                    suppressingChannel={suppressingChannel}
                    onToggle={handleToggleSuppression}
                  />
                ) : null}
                {message.canSuppressSmsNotification ? (
                  <SuppressionButton
                    channel="SMS"
                    suppressed={message.isSmsNotificationSuppressed}
                    suppressingChannel={suppressingChannel}
                    onToggle={handleToggleSuppression}
                  />
                ) : null}
              </div>
              <div className="mt-3 grid gap-2">
                {suppressionNotices.EMAIL ? (
                  <Notice title={suppressionNotices.EMAIL.title} tone={suppressionNotices.EMAIL.tone} />
                ) : null}
                {suppressionNotices.SMS ? (
                  <Notice title={suppressionNotices.SMS.title} tone={suppressionNotices.SMS.tone} />
                ) : null}
              </div>
            </div>
          ) : null}
        </article>
      ) : null}
      </div>
    </main>
  );
}

function themeClass(theme?: string | null) {
  const classes: Record<string, string> = {
    LAVENDER: "bg-[#F7F3FD]/90",
    MOSS: "bg-[#F4FBF6]/90",
    SUNSET: "bg-[#FFF8EA]/90",
    MIDNIGHT: "bg-[#2E2456] text-white",
    PAPER: "bg-[#FFFCF7]/90",
  };

  return theme ? classes[theme] ?? "" : "";
}

function SuppressionButton({
  channel,
  suppressed,
  suppressingChannel,
  onToggle,
}: {
  channel: SuppressionChannel;
  suppressed: boolean;
  suppressingChannel: SuppressionChannel | null;
  onToggle: (channel: SuppressionChannel, suppressed: boolean) => Promise<void>;
}) {
  const isSuppressing = suppressingChannel === channel;
  const label =
    channel === "SMS"
      ? suppressed
        ? "이 문자 알림 다시 받기"
        : "이 문자 알림 다시 받지 않기"
      : suppressed
        ? "이 이메일 알림 다시 받기"
        : "이 이메일 알림 다시 받지 않기";

  return (
    <button
      type="button"
      onClick={() => void onToggle(channel, suppressed)}
      disabled={Boolean(suppressingChannel)}
      className="focus-ring maeari-action disabled:opacity-50"
    >
      {suppressed ? <Bell size={16} /> : <BellOff size={16} />}
      {isSuppressing ? "저장 중" : label}
    </button>
  );
}

function createSuppressionNoticeTitle(channel: SuppressionChannel, suppressed: boolean) {
  if (channel === "SMS") {
    return suppressed
      ? "이 전화번호로는 매아리 문자 알림을 다시 보내지 않을게요."
      : "이 전화번호로 매아리 문자 알림을 다시 받을 수 있어요.";
  }

  return suppressed
    ? "이 이메일 주소로는 매아리 이메일 알림을 다시 보내지 않을게요."
    : "이 이메일 주소로 매아리 이메일 알림을 다시 받을 수 있어요.";
}
