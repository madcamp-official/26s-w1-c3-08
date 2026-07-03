import { LogIn } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const kakaoUrl = `${getApiBaseUrl()}/auth/kakao`;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-petal text-sm font-bold text-white">
            마음
          </div>
          <h1 className="text-2xl font-semibold text-ink">마음도착</h1>
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
