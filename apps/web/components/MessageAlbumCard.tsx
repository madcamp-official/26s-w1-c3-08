import Link from "next/link";
import type { ReactNode } from "react";
import { MoreHorizontal, Paperclip, Star } from "lucide-react";

export type MessageAlbumCardData = {
  id: string;
  title: string;
  preview?: string | null;
  coverUrl?: string | null;
  coverAlt?: string | null;
  senderName?: string | null;
  arrivedAtLabel: string;
  emotionLabel: string;
  unread?: boolean;
  attachmentCount?: number;
};

const fallbackCover = "/images/maeari-card-letter.png";

export function MessageAlbumCard({
  message,
  href,
  actions,
}: {
  message: MessageAlbumCardData;
  href: string;
  actions: ReactNode;
}) {
  const coverUrl = message.coverUrl ?? fallbackCover;

  return (
    <article className="group relative min-h-[168px] overflow-hidden rounded-[8px] border border-[#E3DEF0] bg-[#F6F2FD] shadow-[0_14px_30px_rgba(76,63,119,0.08)] transition hover:-translate-y-0.5 hover:border-[#CBBBFA] hover:shadow-[0_18px_34px_rgba(76,63,119,0.13)]">
      <img
        src={coverUrl}
        alt={message.coverAlt ?? ""}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1E1935]/72 via-[#1E1935]/18 to-white/0" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1E1935]/18 via-transparent to-transparent" />

      <Link href={href} className="focus-ring absolute inset-0 rounded-[8px]" aria-label={`${message.title} 자세히 보기`} />

      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2">
        {message.unread ? <span className="h-2 w-2 rounded-full bg-[#6D48DB]" aria-hidden="true" /> : null}
        <Star size={20} strokeWidth={1.7} className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="mb-3 flex min-h-[40px] items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-1 text-[15px] font-semibold drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">{message.title}</h2>
            {message.preview ? (
              <p className="mt-1 line-clamp-1 text-xs text-white/78 drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">{message.preview}</p>
            ) : null}
          </div>
          <MoreHorizontal size={19} className="shrink-0 text-white/90" />
        </div>

        <div className="flex items-center justify-between gap-3 text-[12px] text-white/76">
          <p className="min-w-0 truncate">
            {message.arrivedAtLabel} · 보낸 사람: {message.senderName ?? "알 수 없음"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {message.attachmentCount && message.attachmentCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-[8px] bg-white/18 px-2 py-1 text-[11px] text-white">
                <Paperclip size={12} />
                {message.attachmentCount}
              </span>
            ) : null}
            <span className="rounded-[8px] bg-white/18 px-2 py-1 text-[11px] text-white">{message.emotionLabel}</span>
          </div>
        </div>
      </div>

      <div className="absolute left-3 top-3 z-10 flex gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        {actions}
      </div>
    </article>
  );
}
