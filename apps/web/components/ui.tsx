import Image from "next/image";
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
    primary: "border-[#6D48DB] bg-[#6D48DB] text-white shadow-[0_4px_6px_rgba(64,39,135,0.24)] hover:bg-[#5f3ed0]",
    secondary: "border-[#D9C8FF] bg-white text-[#6D48DB] hover:bg-[#F3EEFD]",
    ghost: "border-transparent bg-transparent text-[#8588A1] hover:bg-[#F3EEFD]",
    danger: "border-[#FBBABA] bg-white text-[#EF777C] hover:bg-rose-50",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return `focus-ring inline-flex items-center justify-center gap-2 rounded-[9px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant ?? "primary"]} ${sizes[size ?? "md"]}`;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`focus-ring maeari-input h-10 rounded-[4px] px-3 text-sm ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`focus-ring maeari-input rounded-[4px] px-3 py-2 text-sm ${className}`} {...props} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`focus-ring maeari-input h-10 rounded-[4px] px-3 text-sm ${className}`} {...props} />;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.01em] text-[#3A3D8D]">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-[#A2A6BF]">{description}</p> : null}
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
      ? "bg-emerald-50 text-emerald-700"
      : status === "FAILED" || status === "BLOCKED"
        ? "bg-rose-50 text-rose-700"
        : status === "CANCELED"
          ? "bg-brand-gray text-[#A2A6BF]"
          : "bg-brand-main text-brand-accent";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{statusLabel(status)}</span>;
}

export function EmotionPill({ value, custom }: { value?: string | null; custom?: string | null }) {
  return (
    <span className="rounded-full bg-[#EEE8FD] px-2.5 py-1 text-xs font-semibold text-[#9A85E1]">
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

export function LetterThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[10px] bg-[#F3EEFD] ${className}`}>
      <Image src="/images/maeari-card-letter.png" alt="" fill sizes="96px" className="object-cover" />
    </div>
  );
}
