"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";

type CreateMessageResponse = {
  message: {
    id: string;
    status: string;
    moderationNextRetryAt?: string | null;
  };
  publicUrl: string | null;
  notice?: string;
};

const emotionOptions = [
  ["THANKS", "고마움"],
  ["CHEER", "응원"],
  ["CELEBRATION", "축하"],
  ["COMFORT", "위로"],
  ["LONGING", "그리움"],
  ["LOVE", "사랑"],
  ["CUSTOM", "직접 입력"],
];

export default function WritePage() {
  const router = useRouter();
  const [receiverType, setReceiverType] = useState<"SELF" | "OTHER">("SELF");
  const [receiverName, setReceiverName] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [emotionTag, setEmotionTag] = useState("THANKS");
  const [customEmotionTag, setCustomEmotionTag] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSenderHidden, setIsSenderHidden] = useState(false);
  const [isDateHidden, setIsDateHidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setPublicUrl(null);

    try {
      const response = await apiFetch<CreateMessageResponse>("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverInfo: {
            type: receiverType,
            name: receiverType === "SELF" ? "미래의 나" : receiverName,
            email: receiverEmail || undefined,
          },
          title,
          content,
          emotionTag,
          customEmotionTag: emotionTag === "CUSTOM" ? customEmotionTag : undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          isSenderHidden,
          isDateHidden,
        }),
      });

      if (response.publicUrl) {
        setPublicUrl(response.publicUrl);
        setNotice({ title: "예약이 완료됐어요.", body: "마음이 도착할 때까지 조용히 보관할게요.", tone: "success" });
      } else {
        setNotice({ title: "안전 검사를 잠시 완료하지 못했어요.", body: response.notice, tone: "default" });
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setNotice({
        title: caught instanceof ApiError ? caught.message : "메시지를 예약하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">마음 쓰기</h1>
          <p className="mt-2 text-sm text-slate-600">지금의 마음을 미래의 순간에 남겨요.</p>
        </div>
        <CalendarClock className="hidden text-moss md:block" />
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5">
        {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
        {publicUrl ? (
          <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center md:justify-between">
            <code className="break-all text-sm text-emerald-950">{publicUrl}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(publicUrl)}
              className="focus-ring rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white"
            >
              링크 복사
            </button>
          </div>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">수신 대상</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-md border border-slate-200 p-3">
              <input
                type="radio"
                name="receiverType"
                checked={receiverType === "SELF"}
                onChange={() => setReceiverType("SELF")}
                className="mr-2"
              />
              미래의 나
            </label>
            <label className="rounded-md border border-slate-200 p-3">
              <input
                type="radio"
                name="receiverType"
                checked={receiverType === "OTHER"}
                onChange={() => setReceiverType("OTHER")}
                className="mr-2"
              />
              타인
            </label>
          </div>
          {receiverType === "OTHER" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                required
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder="수신자 이름"
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                value={receiverEmail}
                onChange={(event) => setReceiverEmail(event.target.value)}
                placeholder="수신자 이메일"
                type="email"
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">내용</h2>
          <div className="grid gap-3">
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="제목"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <textarea
              required
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
              rows={10}
              placeholder="본문"
              className="focus-ring resize-y rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={emotionTag}
                onChange={(event) => setEmotionTag(event.target.value)}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              >
                {emotionOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {emotionTag === "CUSTOM" ? (
                <input
                  value={customEmotionTag}
                  onChange={(event) => setCustomEmotionTag(event.target.value)}
                  placeholder="감정 태그"
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">도착 설정</h2>
          <div className="grid gap-4">
            <input
              required
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-md border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={isSenderHidden}
                  onChange={(event) => setIsSenderHidden(event.target.checked)}
                  className="mr-2"
                />
                발신인 숨기기
              </label>
              <label className="rounded-md border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={isDateHidden}
                  onChange={(event) => setIsDateHidden(event.target.checked)}
                  className="mr-2"
                />
                도착일 숨기기
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/sent")}
            className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            발신함
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send size={17} />
            {submitting ? "검사 중" : "예약하기"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
