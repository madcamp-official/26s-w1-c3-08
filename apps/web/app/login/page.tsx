import Image from "next/image";
import { LogIn } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const kakaoUrl = `${getApiBaseUrl()}/auth/kakao`;

  return (
    <main className="min-h-screen bg-[#FBF9FC] text-[#4E536B]">
      <header className="h-[74px] border-b border-[#F1EEF8] bg-white px-5">
        <div className="flex h-full items-center">
          <Image
            src="/images/maeari-app-icon.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[10px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="ml-3 text-[25px] font-medium tracking-[0.02em] text-[#9A85E1]">매아리</span>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-74px)] w-full max-w-[1190px] gap-[25px] px-4 py-[31px] lg:grid-cols-[1fr_360px] lg:px-[38px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-[10px]">
          <Image src="/images/maeari-hero-night.png" alt="" fill sizes="780px" className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2C1B72]/55 via-[#352075]/18 to-transparent" />
          <div className="absolute left-8 top-10 text-white sm:left-[70px] sm:top-[66px]">
            <p className="text-sm font-semibold text-[#FAC9EB]">매 순간 아껴둔 마음의 소리</p>
            <h1 className="mt-5 text-[34px] font-normal leading-[1.35] text-[#FAC9EB] sm:text-[37px]">
              오늘 남긴 마음이
              <br />
              가장 필요한 순간에 도착해요.
            </h1>
            <p className="mt-5 max-w-[360px] text-base leading-[25px] text-white/90">
              미래의 나와 소중한 사람에게, 조용히 도착할 마음을 예약해 보세요.
            </p>
          </div>
        </div>

        <aside className="figma-panel flex min-h-[520px] flex-col justify-between p-[31px]">
          <div>
            <div className="relative mb-[38px] h-[64px] w-[64px] overflow-hidden rounded-[13px] border border-[#F1EEF8] bg-[#F3EEFD]">
              <Image src="/images/maeari-app-icon.png" alt="" fill sizes="64px" className="object-cover" priority />
            </div>
            <p className="text-sm font-bold text-[#6D48DB]">카카오로 시작하기</p>
            <h2 className="mt-[17px] text-[30px] font-bold leading-[1.32] text-[#3A3D8D]">
              매아리에
              <br />
              돌아오신 걸 환영해요.
            </h2>
            <p className="mt-[18px] text-sm leading-[24px] text-[#A2A6BF]">
              받은 마음, 보낸 마음, 친구 연결과 연락처 인증을 한 곳에서 이어갈 수 있어요.
            </p>
          </div>

          <a
            href={kakaoUrl}
            className="focus-ring inline-flex h-[51px] w-full items-center justify-center gap-3 rounded-[9px] bg-[#FEE500] px-4 text-sm font-bold text-[#191600] shadow-[0_4px_4px_rgba(0,0,0,0.16)] transition hover:brightness-95"
          >
            <LogIn size={18} />
            카카오로 시작하기
          </a>
        </aside>
      </section>
    </main>
  );
}
