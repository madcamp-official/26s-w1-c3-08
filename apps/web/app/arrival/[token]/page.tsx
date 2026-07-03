"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gift, LogIn } from "lucide-react";
import { ApiError, apiFetch, getApiBaseUrl } from "@/lib/api";
import { Notice } from "@/components/Notice";
import { emotionLabel, formatDateTime } from "@/lib/format";

const PENDING_TOKEN_KEY = "maeum.pendingArrivalToken";

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
};

export default function ArrivalPage() {
  const params = useParams<{ token: string }>();
  const [message, setMessage] = useState<PublicMessage | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem(PENDING_TOKEN_KEY, params.token);

    async function load() {
      try {
        const response = await apiFetch<{ message: PublicMessage }>(`/public/messages/${params.token}`);
        setMessage(response.message);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "도착한 마음을 찾지 못했어요.");
      }
    }

    void load();
  }, [params.token]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-petal text-sm font-bold text-white">
          마음
        </span>
        <span className="text-lg font-semibold text-ink">마음도착</span>
      </div>

      {error ? <Notice title={error} tone="danger" /> : null}
      {!message && !error ? <p className="text-sm text-slate-600">도착한 마음을 확인하고 있어요.</p> : null}
      {message && !opened ? (
        <section className="rounded-md border border-slate-200 bg-white p-6 text-center shadow-soft">
          <Gift className="mx-auto mb-4 text-petal" size={36} />
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
            <p className="text-sm font-medium text-slate-700">
              이 마음을 오래 보관하고 싶다면 마음도착에 저장해 보세요.
            </p>
            <a
              href={`${getApiBaseUrl()}/auth/kakao`}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md bg-[#fee500] px-4 py-2 text-sm font-semibold text-[#191600]"
            >
              <LogIn size={16} />
              카카오로 시작하기
            </a>
          </div>
        </article>
      ) : null}
    </main>
  );
}
