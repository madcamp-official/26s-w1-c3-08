"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiFetch("/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify({ note }),
      });
      router.replace("/write");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "답변을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    setError(null);

    try {
      await apiFetch("/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify({ note: "" }),
      });
      router.replace("/write");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "온보딩을 건너뛰지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <form onSubmit={save} className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <PenLine className="text-petal" />
          <div>
            <h1 className="text-2xl font-semibold text-ink">오늘 마음에 남은 한 줄</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              첫 마음을 남기기 전에 지금의 감정을 짧게 붙잡아둘게요.
            </p>
          </div>
        </div>
        {error ? <Notice title={error} tone="danger" /> : null}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="지금 마음에 남은 문장을 적어보세요."
          className="focus-ring min-h-36 w-full resize-y rounded-md border border-slate-300 px-3 py-2"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => void skip()}
            disabled={saving}
            className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            건너뛰기
          </button>
          <button
            type="submit"
            disabled={saving}
            className="focus-ring rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "저장 중" : "마음 남기기"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
