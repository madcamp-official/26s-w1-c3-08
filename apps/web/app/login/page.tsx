import Image from "next/image";
import { LogIn } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const kakaoUrl = `${getApiBaseUrl()}/auth/kakao`;

  return (
    <main className="maeari-public-stage text-[#4E536B]">
      <header className="h-[74px] border-b border-[#EEE8F8] bg-white/92 px-5 backdrop-blur-xl">
        <div className="flex h-full items-center">
          <Image
            src="/images/maeari_logo.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[8px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="maeari-logo-text ml-3 text-[25px] text-[#6D48DB]">매아리</span>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-74px)] w-full max-w-[1190px] gap-[25px] px-4 py-[31px] lg:grid-cols-[1fr_360px] lg:px-[38px]">
        <div className="relative order-2 min-h-[420px] overflow-hidden rounded-[8px] border border-[#E8DFF3] bg-[#F3EEFD] shadow-[0_24px_54px_rgba(74,54,116,0.13)] sm:min-h-[500px] lg:order-1 lg:min-h-[520px]">
          <Image src="/images/maeari-hero-floral.png" alt="" fill sizes="780px" className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-white/82 via-white/50 to-white/8" />
          <div className="absolute left-8 top-10 sm:left-[70px] sm:top-[66px]">
            <p className="inline-flex rounded-[8px] bg-white/70 px-3 py-1 text-sm font-semibold text-[#6D48DB] shadow-[0_8px_20px_rgba(109,72,219,0.10)] backdrop-blur">매 순간 아껴둔 마음의 소리</p>
            <h1 className="mt-5 break-keep text-[30px] font-extrabold leading-[1.34] text-[#3A3D8D] sm:text-[37px] sm:leading-[1.35]">
              오늘 남긴 마음이
              <br />
              가장 필요한 순간에 도착해요.
            </h1>
            <p className="mt-5 max-w-[360px] break-keep text-base leading-[25px] text-[#706C95]">
              미래의 나와 소중한 사람에게, 조용히 도착할 마음을 예약해 보세요.
            </p>
          </div>
        </div>

        <aside className="figma-panel order-1 flex min-h-[360px] flex-col justify-between p-[31px] sm:min-h-[430px] lg:order-2 lg:min-h-[520px]">
          <div>
            <div className="relative mb-[38px] h-[64px] w-[64px] overflow-hidden rounded-[8px] border border-[#F1EEF8] bg-[#F3EEFD]">
              <Image src="/images/maeari_logo.png" alt="" fill sizes="64px" className="object-cover" priority />
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
            className="focus-ring inline-flex h-[51px] w-full items-center justify-center gap-3 rounded-[8px] bg-[#FEE500] px-4 text-sm font-bold text-[#191600] shadow-[0_12px_24px_rgba(55,43,13,0.12)] transition hover:brightness-95"
          >
            <LogIn size={18} />
            카카오로 시작하기
          </a>
        </aside>
      </section>
    </main>
  );
}
