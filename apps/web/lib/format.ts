export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "숨겨진 시간";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "예약 대기",
    SENT: "도착 완료",
    FAILED: "발송 실패",
    BLOCKED: "검사 차단",
    MODERATION_FAILED: "검사 대기",
    CANCELED: "취소됨",
    WAITING: "발송 대기",
  };

  return labels[status] ?? status;
}

export function emotionLabel(value?: string | null, custom?: string | null) {
  if (value === "CUSTOM") {
    return custom ?? "마음";
  }

  const labels: Record<string, string> = {
    THANKS: "고마움",
    CHEER: "응원",
    CELEBRATION: "축하",
    COMFORT: "위로",
    LONGING: "그리움",
    LOVE: "사랑",
  };

  return value ? labels[value] ?? value : "마음";
}
