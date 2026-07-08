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
            <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="maeari-loading-star-fill" x1="32" x2="32" y1="4" y2="61" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#F2EAFF" />
                  <stop offset="0.45" stopColor="#A98CF2" />
                  <stop offset="1" stopColor="#5D38C7" />
                </linearGradient>
              </defs>
              <path
                fill="url(#maeari-loading-star-fill)"
                d="M32 4c2 0 3.7 1.2 4.4 3.1l4.7 12.3c0.4 1.1 1.4 1.8 2.6 1.9l13.1 0.8c2.1 0.1 3.8 1.6 4.4 3.6c0.7 2 0 4.1 -1.6 5.4L49.3 39.4c-0.9 0.7 -1.3 1.9 -1 3l3.3 12.7c0.5 2.1 -0.3 4.2 -2 5.4c-1.7 1.3 -4 1.3 -5.8 0.1l-9.9 -7c-1.1 -0.7 -2.5 -0.7 -3.6 0l-10.1 7c-1.8 1.2 -4.1 1.2 -5.8 -0.1c-1.7 -1.2 -2.5 -3.3 -2 -5.4l3.3 -12.7c0.3 -1.1 -0.1 -2.3 -1 -3L4.4 31.1c-1.6 -1.3 -2.3 -3.4 -1.6 -5.4c0.6 -2 2.3 -3.5 4.4 -3.6l13.1 -0.8c1.2 -0.1 2.2 -0.8 2.6 -1.9l4.7 -12.3C28.3 5.2 30 4 32 4Z"
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
