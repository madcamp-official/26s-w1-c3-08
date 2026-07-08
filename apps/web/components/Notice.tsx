type NoticeProps = {
  title: string;
  body?: string;
  tone?: "default" | "danger" | "success" | "warning";
};

export function Notice({ title, body, tone = "default" }: NoticeProps) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50/95 text-rose-900"
      : tone === "success"
        ? "border-[#D9C8FF] bg-[#F3EEFD]/95 text-[#6D48DB]"
        : tone === "warning"
          ? "border-[#D9C8FF] bg-[#F3EEFD]/95 text-[#6D48DB]"
          : "border-[#E4DBF4] bg-white/90 text-[#4E536B]";

  return (
    <div className={`rounded-[8px] border px-4 py-3 shadow-[0_18px_38px_rgba(76,63,119,0.12)] ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm opacity-85">{body}</p> : null}
    </div>
  );
}
