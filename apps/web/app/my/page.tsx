"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";

type Me = {
  id: string;
  nickname: string;
  email?: string | null;
};

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch<{ user: Me }>("/me");
        setUser(response.user);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "내 정보를 불러오지 못했어요.");
      }
    }

    void load();
  }, [router]);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">내 정보</h1>
      </div>
      {error ? <Notice title={error} tone="danger" /> : null}
      {user ? (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-500">닉네임</dt>
              <dd className="mt-1 text-ink">{user.nickname}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">이메일</dt>
              <dd className="mt-1 text-ink">{user.email ?? "미제공"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void logout()}
            className="focus-ring mt-6 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </section>
      ) : null}
    </AppShell>
  );
}
