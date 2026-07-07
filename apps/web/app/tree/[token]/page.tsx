"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Send } from "lucide-react";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type PublicCollection = {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  status: string;
  canSubmit: boolean;
};

export default function PublicTreePage() {
  const params = useParams<{ token: string }>();
  const [collection, setCollection] = useState<PublicCollection | null>(null);
  const [senderDisplayName, setSenderDisplayName] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch<{ collection: PublicCollection }>(`/public/message-collections/${params.token}`);
        setCollection(response.collection);
      } catch (caught) {
        setNotice({ title: caught instanceof ApiError ? caught.message : "마음나무를 불러오지 못했어요.", tone: "danger" });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      await apiFetch(`/public/message-collections/${params.token}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          senderDisplayName,
          content,
        }),
      });
      setSenderDisplayName("");
      setContent("");
      setNotice({ title: "마음나무에 마음을 남겼어요.", body: "도착 시간이 되면 한 번에 전달돼요.", tone: "success" });
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "마음을 남기지 못했어요.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="maeari-public-stage px-4 py-8 text-[#4E536B]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/images/maeari_logo.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="maeari-logo-text text-xl text-[#6D48DB]">매아리 마음나무</span>
        </div>

        {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
        {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}

        {collection ? (
          <section className="figma-panel p-5">
            <div className="mb-5">
              <span className="maeari-badge bg-[#F3EEFD] text-[#6D48DB]">
                {collection.canSubmit ? "수집 중" : "닫힘"}
              </span>
              <h1 className="maeari-page-title mt-4">{collection.title}</h1>
              {collection.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#6E738A]">{collection.description}</p> : null}
              <p className="mt-3 text-sm text-[#A2A6BF]">도착 시점: {formatDateTime(collection.scheduledAt)}</p>
            </div>

            {collection.canSubmit ? (
              <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
                <input
                  value={senderDisplayName}
                  onChange={(event) => setSenderDisplayName(event.target.value)}
                  maxLength={80}
                  placeholder="이름 또는 별명 (선택)"
                  className="focus-ring maeari-input h-11 rounded-[8px] px-3 text-sm"
                />
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={9}
                  maxLength={2000}
                  required
                  placeholder="남기고 싶은 마음을 적어주세요"
                  className="focus-ring maeari-input rounded-[8px] px-3 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={submitting || content.trim().length === 0}
                  className="focus-ring maeari-action maeari-action-primary h-11 disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? "전달 중" : "마음 남기기"}
                </button>
              </form>
            ) : (
              <Notice title="이 마음나무는 더 이상 편지를 받을 수 없어요." />
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
