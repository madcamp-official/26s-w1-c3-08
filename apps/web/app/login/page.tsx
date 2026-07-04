import Image from "next/image";
import { LogIn } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const kakaoUrl = `${getApiBaseUrl()}/auth/kakao`;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="relative mb-6 aspect-[5/3] w-full overflow-hidden rounded-md bg-[#fbf7ff]">
          <Image
            src="/images/maeari-login-envelope.webp"
            alt="빛나는 마음 봉투"
            fill
            sizes="(min-width: 768px) 448px, calc(100vw - 56px)"
            className="object-cover"
            priority
          />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink">매아리</h1>
          <p className="mt-1 text-sm font-medium text-petal">매 순간 아껴둔 마음의 소리</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            오늘 남긴 마음이 가장 필요한 날 조용히 도착해요.
          </p>
        </div>
        <a
          href={kakaoUrl}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#fee500] px-4 py-3 text-sm font-semibold text-[#191600] hover:brightness-95"
        >
          <LogIn size={18} />
          카카오로 시작하기
        </a>
      </section>
    </main>
  );
}
