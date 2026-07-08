"use client";

import Image from "next/image";
import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type MeteorTrail = {
  id: number;
  points: Array<{ x: number; y: number }>;
  settled: boolean;
};

type ArrivalStar = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
};

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
  const [meteorTrail, setMeteorTrail] = useState<MeteorTrail | null>(null);
  const arrivalStars = useMemo(createArrivalStars, []);
  const meteorIdRef = useRef(0);
  const activeTrailIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastTrailSampleAtRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const clearTrailTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
      if (clearTrailTimerRef.current) {
        window.clearTimeout(clearTrailTimerRef.current);
      }
    };
  }, []);

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

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    const nextPoint = { x: event.clientX, y: event.clientY };
    const previous = lastPointerRef.current;
    lastPointerRef.current = nextPoint;

    if (!previous) {
      lastTrailSampleAtRef.current = performance.now();
      return;
    }

    const now = performance.now();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    const length = Math.hypot(dx, dy);

    if (length < 16 || now - lastTrailSampleAtRef.current < 95) {
      return;
    }

    lastTrailSampleAtRef.current = now;

    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }
    if (clearTrailTimerRef.current) {
      window.clearTimeout(clearTrailTimerRef.current);
    }

    if (!activeTrailIdRef.current) {
      activeTrailIdRef.current = meteorIdRef.current + 1;
      meteorIdRef.current = activeTrailIdRef.current;
    }

    const trailId = activeTrailIdRef.current;
    setMeteorTrail((current) => {
      const points = current?.id === trailId ? current.points : [previous];

      return {
        id: trailId,
        points: [...points.slice(-34), nextPoint],
        settled: false,
      };
    });

    settleTimerRef.current = window.setTimeout(() => {
      setMeteorTrail((current) => (current?.id === trailId ? { ...current, settled: true } : current));
      clearTrailTimerRef.current = window.setTimeout(() => {
        setMeteorTrail((current) => (current?.id === trailId ? null : current));
        if (activeTrailIdRef.current === trailId) {
          activeTrailIdRef.current = null;
          lastPointerRef.current = null;
          lastTrailSampleAtRef.current = 0;
        }
      }, 2200);
    }, 240);
  }

  const arrivalCoverUrl = message ? getFirstImageAttachment(message)?.publicUrl ?? null : null;
  const trailEndPoint = meteorTrail?.points.at(-1);
  const trailSegments = meteorTrail ? createTrailSegments(meteorTrail.points) : [];

  return (
    <main className="maeari-public-stage maeari-arrival-night-stage text-[#4E536B]" onPointerMove={handlePointerMove}>
      <div className="maeari-arrival-meteor-layer" aria-hidden="true">
        {arrivalStars.map((star) => (
          <span
            key={star.id}
            className="maeari-arrival-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
            }}
          />
        ))}
        {meteorTrail ? (
          <svg className={`maeari-arrival-trail ${meteorTrail.settled ? "maeari-arrival-trail-settled" : ""}`}>
            {trailSegments.map((segment, index) => (
              <line
                key={`${meteorTrail.id}-${index}`}
                className="maeari-arrival-trail-segment"
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                style={{
                  animationDelay: meteorTrail.settled ? `${index * 70}ms` : "0ms",
                  opacity: Math.min(1, 0.35 + index / Math.max(trailSegments.length, 1)),
                }}
              />
            ))}
            {trailEndPoint ? (
              <circle
                cx={trailEndPoint.x}
                cy={trailEndPoint.y}
                r={meteorTrail.settled ? 4.2 : 2.4}
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <header className="relative z-20 h-[74px] border-b border-[#EEE8F8] bg-white/92 px-5 backdrop-blur-xl">
        <div className="flex h-full items-center">
          <Link href="/" className="focus-ring flex items-center rounded-[8px]">
          <Image
            src="/images/maeari_logo.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="maeari-logo-text ml-3 text-[25px] text-[#6D48DB]">매아리</span>
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[760px] px-4 py-10">

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
        <section className="maeari-arrival-gate-card relative overflow-hidden rounded-[8px] border border-white/70 text-center shadow-[0_24px_58px_rgba(55,39,105,0.16)]">
          <Image
            src="/images/maeari-arrival-letter.png"
            alt=""
            fill
            sizes="(min-width: 768px) 760px, calc(100vw - 32px)"
            className="object-cover"
            priority
          />
          {arrivalCoverUrl ? <img src={arrivalCoverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.12]" /> : null}
          <div className="absolute inset-0 bg-white/10" />
          <div className="relative z-10 flex min-h-[310px] flex-col items-center px-5 py-7 sm:min-h-[340px]">
            <p className="maeari-arrival-gate-eyebrow">남겨둔 마음이 도착했어요</p>
            <Gift className="mt-3 text-brand-accent" size={31} />
            <h1 className="maeari-page-title mt-6 text-[#3D3E91]">지금, 열어볼까요?</h1>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="focus-ring maeari-action maeari-action-primary h-10 min-w-[220px] px-6 text-sm"
            >
              마음 열어보기
            </button>
            <p className="mt-3 text-xs font-semibold text-[#7E6BCB]">지금 바로 도착한 마음을 열어볼 수 있어요.</p>
          </div>
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
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring maeari-polaroid-frame"
                >
                  <span className="maeari-polaroid-photo">
                    <img src={attachment.publicUrl} alt={attachment.originalName ?? ""} />
                  </span>
                  <span className="maeari-polaroid-caption">{attachment.originalName ?? "첨부 사진"}</span>
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
          <div className="maeari-soft-panel mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            {message.linked ? (
              <p className="text-sm font-medium text-[#6E738A]">이미 매아리 수신함에 보관된 마음이에요.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-[#6E738A]">
                  이 마음을 오래 보관하고 싶다면 매아리에 저장해 보세요.
                </p>
                <a
                  href={`${getApiBaseUrl()}/auth/kakao`}
                  className="focus-ring inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-[8px] bg-[#fee500] px-4 text-sm font-semibold text-[#191600] shadow-[0_10px_22px_rgba(55,43,13,0.10)]"
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

function getFirstImageAttachment(message: PublicMessage) {
  return message.attachments?.find((attachment) => attachment.mimeType.startsWith("image/")) ?? null;
}

function createArrivalStars() {
  let seed = 92821;
  const stars: ArrivalStar[] = [];

  for (let index = 0; index < 58; index += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const x = (seed / 4294967296) * 100;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const y = 10 + (seed / 4294967296) * 86;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const size = 1.2 + (seed / 4294967296) * 2.6;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const opacity = 0.22 + (seed / 4294967296) * 0.58;

    stars.push({ id: index, x, y, size, opacity });
  }

  return stars;
}

function createTrailSegments(points: Array<{ x: number; y: number }>) {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (previous && current) {
      segments.push({
        x1: previous.x,
        y1: previous.y,
        x2: current.x,
        y2: current.y,
      });
    }
  }

  return segments;
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
