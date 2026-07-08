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
          <div className="maeari-loading-wax-star" />
          <div className="maeari-loading-sparkle maeari-loading-sparkle-one" />
          <div className="maeari-loading-sparkle maeari-loading-sparkle-two" />
          <div className="maeari-loading-sparkle maeari-loading-sparkle-three" />
        </div>
        <p className="maeari-loading-copy">{message}</p>
      </div>
    </div>
  );
}
