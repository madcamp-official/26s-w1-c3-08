"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BellOff, Clock3, Gift, LogIn, RefreshCw } from "lucide-react";
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
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  linked: boolean;
  canSuppressEmailNotification: boolean;
  canSuppressSmsNotification: boolean;
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

  async function handleSuppressNotifications(channel: SuppressionChannel) {
    setSuppressingChannel(channel);
    setSuppressionNotices((previous) => ({ ...previous, [channel]: undefined }));

    try {
      await apiFetch<{ suppressed: true }>("/public/notification-suppressions", {
        method: "POST",
        body: JSON.stringify({
          token: params.token,
          channel,
        }),
      });
      setSuppressionNotices((previous) => ({
        ...previous,
        [channel]: {
          title:
            channel === "SMS"
              ? "이 전화번호로는 매아리 문자 알림을 다시 보내지 않을게요."
              : "이 이메일 주소로는 매아리 이메일 알림을 다시 보내지 않을게요.",
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

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="relative block h-10 w-10 overflow-hidden rounded-md border border-violet-100 bg-white shadow-sm">
          <Image src="/images/maeari-mark.png" alt="" fill sizes="40px" className="object-cover" priority />
        </span>
        <span className="text-lg font-semibold text-ink">매아리</span>
      </div>

      {error ? <Notice title={error} tone="danger" /> : null}
      {!message && !error && !gate ? <p className="text-sm text-slate-600">도착한 마음을 확인하고 있어요.</p> : null}
      {gate ? (
        <section className="rounded-md border border-slate-200 bg-white p-6 text-center shadow-soft">
          <div className="relative mx-auto mb-5 aspect-square w-28 overflow-hidden rounded-md bg-[#fbf7ff]">
            <Image
              src="/images/maeari-public-envelope.webp"
              alt="보관 중인 마음 봉투"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <Clock3 className="mx-auto mb-4 text-moss" size={32} />
          <h1 className="text-2xl font-semibold text-ink">아직 보관 중인 마음이에요.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {gate.scheduledAt
              ? `${formatDateTime(gate.scheduledAt)} 이후에 열어볼 수 있어요.`
              : "도착 시간이 될 때까지 조금 더 기다려 주세요."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="focus-ring mt-6 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw size={16} />
            다시 확인
          </button>
        </section>
      ) : null}
      {message && !opened ? (
        <section className="rounded-md border border-slate-200 bg-white p-6 text-center shadow-soft">
          <div className="relative mx-auto mb-5 aspect-square w-36 overflow-hidden rounded-md bg-[#fbf7ff]">
            <Image
              src="/images/maeari-public-envelope.webp"
              alt="도착한 마음 봉투"
              fill
              sizes="144px"
              className="object-cover"
              priority
            />
          </div>
          <Gift className="mx-auto mb-4 text-petal" size={32} />
          <h1 className="text-2xl font-semibold text-ink">오늘, 누군가의 마음이 도착했어요.</h1>
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="focus-ring mt-6 rounded-md bg-petal px-5 py-3 text-sm font-semibold text-white"
          >
            열어보기
          </button>
        </section>
      ) : null}
      {message && opened ? (
        <article className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {emotionLabel(message.emotionTag, message.customEmotionTag)}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {message.senderName ?? "누군가의 마음"}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">{message.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{formatDateTime(message.arrivedAt)}</p>
          <div className="mt-8 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 leading-7 text-slate-800">
            {message.content}
          </div>
          <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
            {message.linked ? (
              <p className="text-sm font-medium text-slate-700">이미 매아리 수신함에 보관된 마음이에요.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">
                  이 마음을 오래 보관하고 싶다면 매아리에 저장해 보세요.
                </p>
                <a
                  href={`${getApiBaseUrl()}/auth/kakao`}
                  className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md bg-[#fee500] px-4 py-2 text-sm font-semibold text-[#191600]"
                >
                  <LogIn size={16} />
                  카카오로 시작하기
                </a>
              </>
            )}
          </div>
          {message.canSuppressEmailNotification || message.canSuppressSmsNotification ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                이 링크로 받은 알림을 앞으로 받고 싶지 않다면 채널별로 멈출 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {message.canSuppressEmailNotification ? (
                  <SuppressionButton
                    channel="EMAIL"
                    label="이 이메일 알림 다시 받지 않기"
                    notice={suppressionNotices.EMAIL}
                    suppressingChannel={suppressingChannel}
                    onSuppress={handleSuppressNotifications}
                  />
                ) : null}
                {message.canSuppressSmsNotification ? (
                  <SuppressionButton
                    channel="SMS"
                    label="이 문자 알림 다시 받지 않기"
                    notice={suppressionNotices.SMS}
                    suppressingChannel={suppressingChannel}
                    onSuppress={handleSuppressNotifications}
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
    </main>
  );
}

function SuppressionButton({
  channel,
  label,
  notice,
  suppressingChannel,
  onSuppress,
}: {
  channel: SuppressionChannel;
  label: string;
  notice?: { title: string; tone: "success" | "danger" };
  suppressingChannel: SuppressionChannel | null;
  onSuppress: (channel: SuppressionChannel) => Promise<void>;
}) {
  const isSuppressing = suppressingChannel === channel;

  return (
    <button
      type="button"
      onClick={() => void onSuppress(channel)}
      disabled={Boolean(suppressingChannel) || notice?.tone === "success"}
      className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
    >
      <BellOff size={16} />
      {isSuppressing ? "저장 중" : label}
    </button>
  );
}
