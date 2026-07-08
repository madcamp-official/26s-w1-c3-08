"use client";

import { useEffect, useState } from "react";

const loadingMessages = [
  "소중한 마음이 잘 담겼는지 확인하는 중...",
  "잠시만 기다려주세요!",
  "마음을 열심히 포장하는 중...",
  "편지 봉투를 붙이는 중...",
  "별빛을 살짝 얹는 중...",
  "도착 시간을 조심스럽게 맞추는 중...",
  "마음의 결을 한 번 더 살피는 중...",
  "따뜻한 문장을 접어 넣는 중...",
  "봉투 안쪽을 보랏빛으로 채우는 중...",
  "받는 사람에게 닿을 길을 찾는 중...",
];

type MaeariLoadingOverlayProps = {
  label?: string;
  overlay?: boolean;
};

export function MaeariLoadingOverlay({ label, overlay = false }: MaeariLoadingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    setMessageIndex(Math.floor(Math.random() * loadingMessages.length));

    const timer = window.setInterval(() => {
      setMessageIndex((previous) => (previous + 1) % loadingMessages.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  const message = label ?? loadingMessages[messageIndex];

  return (
    <div className={overlay ? "maeari-loading-stage maeari-loading-stage-overlay" : "maeari-loading-stage"} aria-label="처리 중">
      <div className="maeari-loading-scene" role="status" aria-live="polite">
        <div className="maeari-loading-envelope" aria-hidden="true">
          <div className="maeari-loading-envelope-body" />
          <div className="maeari-loading-envelope-flap" />
          <div className="maeari-loading-wax-star">
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="maeari-loading-star-fill" x1="24" x2="24" y1="4" y2="46" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#EDE4FF" />
                  <stop offset="0.42" stopColor="#B99CF6" />
                  <stop offset="1" stopColor="#6842D6" />
                </linearGradient>
                <linearGradient id="maeari-loading-star-gloss" x1="18" x2="28" y1="9" y2="25" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.88" />
                  <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                fill="url(#maeari-loading-star-fill)"
                d="M24 4.2c1.4 0 2.6.8 3.1 2.1l3.8 9.5 10.2.8c1.4.1 2.6 1 3 2.3.4 1.4-.1 2.8-1.2 3.6l-8.1 6.4c-1.1.9-1.5 2.3-1.2 3.6l2.5 10c.4 1.4-.2 2.8-1.3 3.7-1.2.8-2.7.8-3.8 0l-8.4-5.7c-1.1-.8-2.6-.8-3.8 0l-8.4 5.7c-1.1.8-2.7.8-3.8 0-1.1-.8-1.7-2.3-1.3-3.7l2.5-10c.3-1.3-.1-2.7-1.2-3.6l-8.1-6.4c-1.1-.9-1.6-2.3-1.2-3.6.4-1.4 1.6-2.3 3-2.3l10.2-.8 3.8-9.5c.5-1.3 1.7-2.1 3.1-2.1Z"
              />
              <path
                fill="url(#maeari-loading-star-gloss)"
                d="M24.6 7.6c.6 0 1.1.4 1.4 1l2.2 5.5c.4 1-.1 2-1 2.4l-8.1 3.8c-1.6.8-3.2-.9-2.5-2.5L20.9 9c.7-1 2-1.4 3.7-1.4Z"
              />
            </svg>
          </div>
          <div className="maeari-loading-sparkle maeari-loading-sparkle-one" />
          <div className="maeari-loading-sparkle maeari-loading-sparkle-two" />
          <div className="maeari-loading-sparkle maeari-loading-sparkle-three" />
        </div>
        <p className="maeari-loading-copy">{message}</p>
      </div>
    </div>
  );
}
