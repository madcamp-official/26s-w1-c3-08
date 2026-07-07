"use client";

import { useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type QrShareProps = {
  value: string;
  title?: string;
  fileName?: string;
};

export function QrShare({ value, title = "QR로 공유하기", fileName = "maeari-qr.png" }: QrShareProps) {
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
    <div className="rounded-[12px] border border-[#DAD4E8] bg-white p-4 text-center">
      <p className="text-sm font-semibold text-[#4E536B]">{title}</p>
      <div ref={qrRef} className="mt-3 inline-flex rounded-[10px] bg-white p-3 shadow-sm">
        <QRCodeCanvas value={value} size={176} includeMargin />
      </div>
      <p className="mt-3 break-all text-xs leading-5 text-[#8588A1]">{value}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#DAD4E8] bg-white px-3 text-xs font-semibold text-[#6D48DB]"
        >
          <Copy size={14} />
          {copied ? "복사됨" : "링크 복사"}
        </button>
        <button
          type="button"
          onClick={downloadQr}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#6D48DB] px-3 text-xs font-semibold text-white"
        >
          <Download size={14} />
          QR 저장
        </button>
      </div>
    </div>
  );
}
