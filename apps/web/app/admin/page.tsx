"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime, statusLabel } from "@/lib/format";

type AdminOverview = {
  users: number;
  messages: number;
  pendingMessages: number;
  failedModerationMessages: number;
  blockedMessages: number;
  pendingNotifications: number;
  failedNotifications: number;
  visibleReplies: number;
  pendingReports: number;
  notificationStats: {
    total: number;
    dueRetries: number;
    scheduledRetries: number;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byChannel: Array<{
      channel: string;
      status: string;
      count: number;
    }>;
    byProvider: Array<{
      provider: string;
      status: string;
      count: number;
    }>;
    failureCodes: Array<{
      errorCode: string;
      count: number;
    }>;
  };
  recipientDeliveryStats: Array<{
    status: string;
    count: number;
  }>;
};

type ModerationLog = {
  id: string;
  messageId: string;
  status: string;
  feedback?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  checkedAt: string;
  message: {
    title: string;
    status: string;
    senderName: string;
  };
};

type NotificationLog = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  provider?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptedAt?: string | null;
  sentAt?: string | null;
  recipient: {
    name?: string | null;
    contactMasked?: string | null;
    messageTitle: string;
  };
};

type ReplyItem = {
  id: string;
  messageId: string;
  status: string;
  contentPreview: string;
  createdAt: string;
  message: {
    title: string;
    senderName: string;
    recipientName?: string | null;
  };
};

type ReportItem = {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporterName: string;
  message: {
    title: string;
    senderId: string;
    senderName: string;
    senderSuspendedAt?: string | null;
  };
};

export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; tone?: "success" | "danger" | "default" } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [overviewResponse, moderationResponse, notificationResponse, replyResponse, reportResponse] = await Promise.all([
        apiFetch<{ overview: AdminOverview }>("/admin/overview"),
        apiFetch<{ logs: ModerationLog[] }>("/admin/moderation-logs"),
        apiFetch<{ logs: NotificationLog[] }>("/admin/notification-logs"),
        apiFetch<{ replies: ReplyItem[] }>("/admin/replies"),
        apiFetch<{ reports: ReportItem[] }>("/admin/reports"),
      ]);
      setOverview(overviewResponse.overview);
      setModerationLogs(moderationResponse.logs);
      setNotificationLogs(notificationResponse.logs);
      setReplies(replyResponse.replies);
      setReports(reportResponse.reports);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof ApiError ? caught.message : "관리자 데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function hideReply(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/admin/replies/${id}/hide`, {
        method: "PATCH",
        body: JSON.stringify({ reason: "관리자 화면에서 숨김" }),
      });
      setNotice({ title: "답장을 숨겼어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "답장을 숨기지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function reviewReport(id: string, status: "REVIEWED" | "DISMISSED") {
    setNotice(null);

    try {
      await apiFetch(`/admin/reports/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice({ title: "신고 상태를 변경했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "신고 상태를 변경하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function toggleSuspend(report: ReportItem) {
    const suspended = Boolean(report.message.senderSuspendedAt);
    const reason = suspended ? null : window.prompt("계정 정지 사유를 입력해 주세요.", report.reason);

    if (!suspended && !reason) {
      return;
    }

    setNotice(null);

    try {
      await apiFetch(`/admin/users/${report.message.senderId}/${suspended ? "unsuspend" : "suspend"}`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      setNotice({ title: suspended ? "계정 정지를 해제했어요." : "계정을 정지했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "계정 상태를 바꾸지 못했어요.",
        tone: "danger",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#4E536B]">관리자</h1>
          <p className="mt-2 text-sm text-[#A2A6BF]">검사, 발송, 답장 상태를 확인해요.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>
      {notice ? <Notice title={notice.title} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {overview ? (
        <div className="grid gap-4">
          <section className="grid gap-3 md:grid-cols-4">
            {overviewKpis(overview).map(([key, value]) => (
              <div key={key} className="rounded-lg border figma-panel p-4">
                <p className="text-xs font-semibold text-[#A2A6BF]">{overviewLabel(key)}</p>
                <p className="mt-2 text-2xl font-semibold text-[#4E536B]">{value}</p>
              </div>
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <LogSection title="Notification Dashboard">
              <div className="grid gap-2 md:grid-cols-3">
                <MetricPill label="전체 알림" value={overview.notificationStats.total} />
                <MetricPill label="지금 재시도" value={overview.notificationStats.dueRetries} />
                <MetricPill label="예약된 재시도" value={overview.notificationStats.scheduledRetries} />
              </div>
              <GroupedRows
                title="상태별"
                rows={overview.notificationStats.byStatus.map((row) => ({
                  label: notificationStatusLabel(row.status),
                  count: row.count,
                }))}
              />
              <GroupedRows
                title="채널별"
                rows={overview.notificationStats.byChannel.map((row) => ({
                  label: `${channelLabel(row.channel)} · ${notificationStatusLabel(row.status)}`,
                  count: row.count,
                }))}
              />
            </LogSection>
            <LogSection title="Provider & Retry">
              <GroupedRows
                title="Provider"
                rows={overview.notificationStats.byProvider.map((row) => ({
                  label: `${row.provider} · ${notificationStatusLabel(row.status)}`,
                  count: row.count,
                }))}
                emptyText="provider 기록이 없어요."
              />
              <GroupedRows
                title="실패 코드"
                rows={overview.notificationStats.failureCodes.map((row) => ({
                  label: row.errorCode,
                  count: row.count,
                }))}
                emptyText="최근 실패 코드가 없어요."
              />
              <GroupedRows
                title="수신자 발송 상태"
                rows={overview.recipientDeliveryStats.map((row) => ({
                  label: statusLabel(row.status),
                  count: row.count,
                }))}
              />
            </LogSection>
          </section>
          <LogSection title="Moderation Logs">
            {moderationLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-brand-gray p-3 text-sm">
                <p className="font-semibold text-[#4E536B]">
                  {log.message.title} · {log.status} · {statusLabel(log.message.status)}
                </p>
                <p className="mt-1 text-[#A2A6BF]">
                  {log.message.senderName} · {formatDateTime(log.checkedAt)}
                </p>
                {log.feedback || log.errorMessage ? (
                  <p className="mt-1 text-rose-700">{log.feedback ?? log.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </LogSection>
          <LogSection title="Notification Logs">
            {notificationLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-brand-gray p-3 text-sm">
                <p className="font-semibold text-[#4E536B]">
                  {log.recipient.messageTitle} · {log.eventType} · {log.channel} · {log.status}
                </p>
                <p className="mt-1 text-[#A2A6BF]">
                  {log.recipient.name ?? "수신자"} · {log.recipient.contactMasked ?? "연락처 없음"} ·{" "}
                  {log.provider ?? "provider 없음"}
                </p>
                {log.errorMessage ? <p className="mt-1 text-rose-700">{log.errorMessage}</p> : null}
              </div>
            ))}
          </LogSection>
          <LogSection title="Replies">
            {replies.map((reply) => (
              <div key={reply.id} className="rounded-lg bg-brand-gray p-3 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-[#4E536B]">
                      {reply.message.title} · {reply.status}
                    </p>
                    <p className="mt-1 text-[#A2A6BF]">{formatDateTime(reply.createdAt)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-[#4E536B]">{reply.contentPreview}</p>
                  </div>
                  {reply.status === "VISIBLE" ? (
                    <button
                      type="button"
                      onClick={() => void hideReply(reply.id)}
                      className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                    >
                      숨김
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </LogSection>
          <LogSection title="Reports">
            {reports.map((report) => (
              <div key={report.id} className="rounded-lg bg-brand-gray p-3 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-[#4E536B]">
                      {report.message.title} · {report.reason} · {report.status}
                    </p>
                    <p className="mt-1 text-[#A2A6BF]">
                      신고자: {report.reporterName} · 발신자: {report.message.senderName} · {formatDateTime(report.createdAt)}
                    </p>
                    {report.details ? <p className="mt-2 whitespace-pre-wrap text-[#4E536B]">{report.details}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void reviewReport(report.id, "REVIEWED")}
                          className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                        >
                          검토 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewReport(report.id, "DISMISSED")}
                          className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                        >
                          기각
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleSuspend(report)}
                      className="focus-ring rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
                    >
                      {report.message.senderSuspendedAt ? "정지 해제" : "발신자 정지"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </LogSection>
        </div>
      ) : null}
    </AppShell>
  );
}

function LogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border figma-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand-sub" />
        <h2 className="font-semibold text-[#4E536B]">{title}</h2>
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-brand-gray px-3 py-2">
      <p className="text-xs font-semibold text-[#A2A6BF]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#4E536B]">{value}</p>
    </div>
  );
}

function GroupedRows({
  title,
  rows,
  emptyText = "표시할 데이터가 없어요.",
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  emptyText?: string;
}) {
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-[#4E536B]">{title}</h3>
      <div className="mt-2 grid gap-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${title}:${row.label}`} className="flex items-center justify-between rounded-lg bg-brand-gray px-3 py-2 text-sm">
              <span className="text-[#6E738A]">{row.label}</span>
              <span className="font-semibold text-[#4E536B]">{row.count}</span>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-brand-gray px-3 py-2 text-sm text-[#A2A6BF]">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function overviewKpis(overview: AdminOverview): Array<[string, number]> {
  return [
    ["users", overview.users],
    ["messages", overview.messages],
    ["pendingMessages", overview.pendingMessages],
    ["failedModerationMessages", overview.failedModerationMessages],
    ["blockedMessages", overview.blockedMessages],
    ["pendingNotifications", overview.pendingNotifications],
    ["failedNotifications", overview.failedNotifications],
    ["visibleReplies", overview.visibleReplies],
    ["pendingReports", overview.pendingReports],
  ];
}

function overviewLabel(key: string) {
  const labels: Record<string, string> = {
    users: "사용자",
    messages: "전체 메시지",
    pendingMessages: "예약 대기",
    failedModerationMessages: "검사 대기",
    blockedMessages: "차단",
    pendingNotifications: "발송 재시도",
    failedNotifications: "발송 실패",
    visibleReplies: "답장",
    pendingReports: "대기 신고",
  };

  return labels[key] ?? key;
}

function notificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "발송 대기",
    SENT: "발송 완료",
    FAILED: "발송 실패",
    SKIPPED: "발송 생략",
  };

  return labels[status] ?? status;
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    IN_APP: "서비스 내",
    EMAIL: "이메일",
    SMS: "문자",
    KAKAO_ALIMTALK: "카카오 알림톡",
  };

  return labels[channel] ?? channel;
}
