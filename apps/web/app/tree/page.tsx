"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Sprout, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { QrShare } from "@/components/QrShare";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Collection = {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  status: string;
  deliveredAt?: string | null;
  createdAt: string;
  submissionCount: number;
  collectionUrl?: string | null;
  submissions?: Array<{
    id: string;
    senderDisplayName?: string | null;
    content: string;
    createdAt: string;
    deliveredAt?: string | null;
  }>;
};

export default function TreePage() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [createdUrl, setCreatedUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDatetimeLocal());
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Collection | null>(null);

  useEffect(() => {
    void loadCollections();
  }, []);

  async function loadCollections() {
    try {
      const response = await apiFetch<{ collections: Collection[] }>("/message-collections");
      setCollections(response.collections);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setNotice({ title: caught instanceof Error ? caught.message : "마음나무를 불러오지 못했어요.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setCreatedUrl("");

    try {
      const response = await apiFetch<{ collection: Collection }>("/message-collections", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      setTitle("");
      setDescription("");
      setScheduledAt(defaultDatetimeLocal());
      setCreatedUrl(toBrowserPublicUrl(response.collection.collectionUrl ?? ""));
      setNotice({ title: "마음나무 링크를 만들었어요.", tone: "success" });
      setPendingCancel(null);
      await loadCollections();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "SENDER_PHONE_VERIFICATION_REQUIRED") {
        router.push("/phone-verification?next=/tree");
        return;
      }
      setNotice({ title: caught instanceof ApiError ? caught.message : "마음나무를 만들지 못했어요.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function openCollection(collectionId: string) {
    try {
      const response = await apiFetch<{ collection: Collection }>(`/message-collections/${collectionId}`);
      setSelected(response.collection);
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "마음나무를 열지 못했어요.", tone: "danger" });
    }
  }

  async function cancelCollection(collectionId: string) {
    try {
      await apiFetch(`/message-collections/${collectionId}`, { method: "DELETE" });
      setPendingCancel(null);
      setNotice({ title: "마음나무를 닫았어요.", tone: "success" });
      await loadCollections();
      if (selected?.id === collectionId) {
        setSelected(null);
      }
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "마음나무를 닫지 못했어요.", tone: "danger" });
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="maeari-page-title">마음나무</h1>
          <p className="maeari-page-copy mt-2">링크를 열어둔 뒤, 정한 시간에 모인 마음을 한 번에 받아요.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadCollections()}
          className="focus-ring maeari-action"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className="figma-panel p-5">
          <h2 className="text-lg font-semibold text-[#4E536B]">새 마음나무 만들기</h2>
          <form className="mt-4 grid gap-3" onSubmit={(event) => void createCollection(event)}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              placeholder="마음나무 이름"
              className="focus-ring maeari-input h-11 rounded-[8px] px-3 text-sm"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="받고 싶은 마음을 짧게 적어주세요"
              className="focus-ring maeari-input rounded-[8px] px-3 py-3 text-sm"
            />
            <input
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              type="datetime-local"
              required
              className="focus-ring maeari-input h-11 rounded-[8px] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring maeari-action maeari-action-primary h-11 disabled:opacity-50"
            >
              <Plus size={16} />
              {submitting ? "생성 중" : "링크 만들기"}
            </button>
          </form>
          {createdUrl ? (
            <div className="mt-5">
              <QrShare value={createdUrl} title="마음나무 QR" fileName="maeari-tree.png" />
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
          {!loading && collections.length === 0 ? (
            <div className="maeari-letter-surface flex min-h-[180px] items-center justify-center p-6 text-center">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB]">
                  <Sprout size={30} strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-lg font-bold text-[#4E536B]">마음나무를 심어주세요.</p>
                <p className="mt-2 text-sm text-[#A2A6BF]">링크를 만들면 이곳에서 심어둔 마음나무를 확인할 수 있어요.</p>
              </div>
            </div>
          ) : null}
          {collections.map((collection) => (
            <article key={collection.id} className="maeari-letter-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="maeari-badge bg-[#F3EEFD] text-[#6D48DB]">
                      {collectionStatusLabel(collection.status)}
                    </span>
                    <span className="maeari-badge bg-brand-gray text-[#6E738A]">
                      {collection.submissionCount}개
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#4E536B]">{collection.title}</h3>
                  <p className="mt-2 text-sm text-[#A2A6BF]">도착 시점: {formatDateTime(collection.scheduledAt)}</p>
                  {collection.description ? <p className="mt-2 text-sm text-[#6E738A]">{collection.description}</p> : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void openCollection(collection.id)}
                    className="focus-ring maeari-action"
                  >
                    열기
                  </button>
                  {collection.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => setPendingCancel(collection)}
                      className="focus-ring maeari-action maeari-action-danger"
                    >
                      <Trash2 size={16} />
                      닫기
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {selected ? (
            <section className="figma-panel p-5">
              <h2 className="text-lg font-semibold text-[#4E536B]">{selected.title}</h2>
              <p className="mt-2 text-sm text-[#A2A6BF]">
                {selected.status === "DELIVERED"
                  ? `${selected.submissionCount}개의 마음이 도착했어요.`
                  : "마음이 오는 중이에요. 도착까지 기다려 주세요."}
              </p>
              {selected.submissions && selected.submissions.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {selected.submissions.map((submission) => (
                    <div key={submission.id} className="rounded-[8px] bg-[#F3EFF7] p-4">
                      <div className="mb-2 flex flex-wrap gap-2 text-xs text-[#8588A1]">
                        <span>{submission.senderDisplayName ?? "익명"}</span>
                        <span>{formatDateTime(submission.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#4E536B]">{submission.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </div>
      {pendingCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="figma-panel w-full max-w-md p-5 shadow-[0_24px_60px_rgba(52,40,92,0.22)]">
            <p className="text-lg font-bold text-[#4E536B]">마음나무를 닫을까요?</p>
            <p className="mt-3 break-keep text-sm leading-6 text-[#6E738A]">
              해당 마음나무는 {formatDateTime(pendingCancel.scheduledAt)}까지 자랄 예정입니다. 지금 닫으시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingCancel(null)} className="focus-ring maeari-action">
                계속 열어두기
              </button>
              <button
                type="button"
                onClick={() => void cancelCollection(pendingCancel.id)}
                className="focus-ring maeari-action maeari-action-danger"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function defaultDatetimeLocal() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return toDatetimeLocal(date);
}

function toDatetimeLocal(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function collectionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "수집 중",
    DELIVERED: "도착 완료",
    CANCELED: "닫힘",
  };

  return labels[status] ?? status;
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
