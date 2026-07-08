"use client";

import { useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type QrShareProps = {
  value: string;
  title?: string;
  fileName?: string;
  size?: number;
  compact?: boolean;
};

export function QrShare({ value, title = "QR로 공유하기", fileName = "maeari-qr.png", size = 176, compact = false }: QrShareProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = fileName;
    link.click();
  }

  return (
    <div className={`figma-panel text-center ${compact ? "p-3" : "p-4"}`}>
      <p className="text-sm font-semibold text-[#4E536B]">{title}</p>
      <div ref={qrRef} className={`inline-flex rounded-[8px] border border-[#E4DBF4] bg-white shadow-sm ${compact ? "mt-2 p-2" : "mt-3 p-3"}`}>
        <QRCodeCanvas value={value} size={size} includeMargin />
      </div>
      <p className={`break-all text-xs leading-5 text-[#8588A1] ${compact ? "mt-2" : "mt-3"}`}>{value}</p>
      <div className={`flex flex-wrap justify-center gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="focus-ring maeari-chip h-9 text-xs text-[#6D48DB]"
        >
          <Copy size={14} />
          {copied ? "복사됨" : "링크 복사"}
        </button>
        <button
          type="button"
          onClick={downloadQr}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#6D48DB] px-3 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(109,72,219,0.18)]"
        >
          <Download size={14} />
          QR 저장
        </button>
      </div>
    </div>
  );
}
