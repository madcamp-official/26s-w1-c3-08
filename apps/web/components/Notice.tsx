type NoticeProps = {
  title: string;
  body?: string;
  tone?: "default" | "danger" | "success";
};

export function Notice({ title, body, tone = "default" }: NoticeProps) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-md border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm opacity-85">{body}</p> : null}
    </div>
  );
}
