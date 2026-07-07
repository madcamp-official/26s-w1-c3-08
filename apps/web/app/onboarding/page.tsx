"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PenLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button, SectionPanel, TextArea } from "@/components/ui";
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
      <form onSubmit={save} className="max-w-[920px]">
        <SectionPanel className="overflow-hidden p-0">
          <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-[#F3EEFD] text-[#6D48DB]">
                  <PenLine size={19} />
                </span>
                <div>
                  <h1 className="maeari-page-title text-[28px]">오늘 마음에 남은 한 줄</h1>
                  <p className="maeari-page-copy mt-2">첫 마음을 남기기 전에 지금의 감정을 짧게 붙잡아둘게요.</p>
                </div>
              </div>
              {error ? <Notice title={error} tone="danger" /> : null}
              <TextArea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={6}
                placeholder="지금 마음에 남은 문장을 적어보세요."
                className="min-h-36 w-full resize-y"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => void skip()}
                  disabled={saving}
                  variant="secondary"
                >
                  건너뛰기
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "저장 중" : "마음 남기기"}
                </Button>
              </div>
            </div>
            <div className="relative hidden min-h-[360px] bg-[#F3EEFD] md:block">
              <Image src="/images/maeari-hero-night.png" alt="" fill sizes="260px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#F3EEFD]/35 to-transparent" />
            </div>
          </div>
        </SectionPanel>
      </form>
    </AppShell>
  );
}
