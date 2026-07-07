type NoticeProps = {
  title: string;
  body?: string;
  tone?: "default" | "danger" | "success" | "warning";
};

export function Notice({ title, body, tone = "default" }: NoticeProps) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-brand-line bg-white text-[#4E536B]";

  return (
    <div className={`rounded-lg border px-4 py-3  ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm opacity-85">{body}</p> : null}
    </div>
  );
}
