"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, statusLabel } from "@/lib/format";

type EmotionCount = {
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  count: number;
};

type EmotionReport = {
  month: string;
  sent: {
    total: number;
    arrived: number;
    byEmotion: EmotionCount[];
    byStatus: Record<string, number>;
  };
  received: {
    total: number;
    read: number;
    byEmotion: EmotionCount[];
  };
};

export default function ReportsPage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<EmotionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ report: EmotionReport }>(`/reports/emotions?month=${encodeURIComponent(month)}`);
      setReport(response.report);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "감정 리포트를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  const statusRows = useMemo(() => Object.entries(report?.sent.byStatus ?? {}), [report]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#4E536B]">감정 리포트</h1>
          <p className="mt-2 text-sm text-[#A2A6BF]">이번 달에 남기고 받은 마음의 흐름을 확인해요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {report ? (
        <div className="grid gap-4">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric label="보낸 마음" value={report.sent.total} />
            <Metric label="도착 완료" value={report.sent.arrived} />
            <Metric label="받은 마음" value={report.received.total} />
            <Metric label="읽은 마음" value={report.received.read} />
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <ReportPanel title="보낸 마음 감정" items={report.sent.byEmotion} />
            <ReportPanel title="받은 마음 감정" items={report.received.byEmotion} />
          </section>
          <section className="rounded-lg border figma-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-brand-sub" />
              <h2 className="font-semibold text-[#4E536B]">보낸 마음 상태</h2>
            </div>
            <div className="grid gap-2">
              {statusRows.length > 0 ? (
                statusRows.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-lg bg-brand-gray px-3 py-2 text-sm">
                    <span>{statusLabel(status)}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A2A6BF]">아직 상태 데이터가 없어요.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border figma-panel p-4">
      <p className="text-xs font-semibold text-[#A2A6BF]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#4E536B]">{value}</p>
    </div>
  );
}

function ReportPanel({ title, items }: { title: string; items: EmotionCount[] }) {
  return (
    <section className="rounded-lg border figma-panel p-5">
      <h2 className="font-semibold text-[#4E536B]">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={`${item.emotionTag ?? "NONE"}:${item.customEmotionTag ?? ""}`}
              className="flex items-center justify-between rounded-lg bg-brand-gray px-3 py-2 text-sm"
            >
              <span>{emotionLabel(item.emotionTag, item.customEmotionTag)}</span>
              <span className="font-semibold">{item.count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#A2A6BF]">아직 감정 데이터가 없어요.</p>
        )}
      </div>
    </section>
  );
}
