import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { emotionLabel, statusLabel } from "@/lib/format";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ className = "", variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  children,
  className = "",
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <Link href={href} className={`${buttonClasses(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

function buttonClasses(variant: ButtonProps["variant"], size: ButtonProps["size"]) {
  const variants = {
    primary: "border-[#6D48DB] bg-[#6D48DB] text-white shadow-[0_10px_22px_rgba(109,72,219,0.18)] hover:bg-[#5f3ed0]",
    secondary: "border-[#D9C8FF] bg-white text-[#6D48DB] hover:bg-[#F3EEFD]",
    ghost: "border-transparent bg-transparent text-[#8588A1] hover:bg-[#F3EEFD]",
    danger: "border-[#FBBABA] bg-white text-[#EF777C] hover:bg-[#FFF4F6]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return `focus-ring inline-flex items-center justify-center gap-2 rounded-[8px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant ?? "primary"]} ${sizes[size ?? "md"]}`;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`focus-ring maeari-input h-10 rounded-[8px] px-3 text-sm ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`focus-ring maeari-input rounded-[8px] px-3 py-2 text-sm ${className}`} {...props} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`focus-ring maeari-input h-10 rounded-[8px] px-3 text-sm ${className}`} {...props} />;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="maeari-page-title">{title}</h1>
        {description ? <p className="maeari-page-copy mt-2">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionPanel({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`figma-panel p-5 ${className}`}>
      {(title || description || action) ? (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#64687D]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-[#A2A6BF]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "SENT"
      ? "bg-[#F3EEFD] text-[#6D48DB]"
      : status === "FAILED" || status === "BLOCKED"
        ? "bg-[#FFF4F6] text-[#D44E6B]"
        : status === "CANCELED"
          ? "bg-brand-gray text-[#A2A6BF]"
          : "bg-brand-main text-brand-accent";

  return <span className={`maeari-badge ${tone}`}>{statusLabel(status)}</span>;
}

export function EmotionPill({ value, custom }: { value?: string | null; custom?: string | null }) {
  return (
    <span className="maeari-badge bg-[#EEE8FD] text-[#9A85E1]">
      {emotionLabel(value, custom)}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="figma-panel px-5 py-10 text-center">
      <p className="text-base font-semibold text-[#6E738A]">{title}</p>
      {body ? <p className="mt-2 text-sm text-[#B3B6C4]">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LetterThumb({ className = "", src = "/images/maeari-envelope-theme-lavender.png" }: { className?: string; src?: string | null }) {
  return (
    <div className={`relative overflow-hidden rounded-[8px] bg-[#F3EEFD] ${className}`}>
      <img src={src ?? "/images/maeari-envelope-theme-lavender.png"} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}
