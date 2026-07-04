"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Me = {
  id: string;
  nickname: string;
  friendCode: string;
};

type Friend = {
  friendshipId: string;
  userId: string;
  nickname: string;
  profileImageUrl?: string | null;
  createdAt: string;
};

type FriendRequestUser = {
  id: string;
  nickname: string;
  profileImageUrl?: string | null;
};

type FriendRequests = {
  received: Array<{
    id: string;
    message?: string | null;
    expiresAt: string;
    createdAt: string;
    requester: FriendRequestUser;
  }>;
  sent: Array<{
    id: string;
    message?: string | null;
    expiresAt: string;
    createdAt: string;
    addressee: FriendRequestUser;
  }>;
};

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ received: [], sent: [] });
  const [friendCode, setFriendCode] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [meResponse, friendsResponse, requestsResponse] = await Promise.all([
        apiFetch<{ user: Me }>("/me"),
        apiFetch<{ friends: Friend[] }>("/friends"),
        apiFetch<{ requests: FriendRequests }>("/friends/requests"),
      ]);

      setMe(meResponse.user);
      setFriends(friendsResponse.friends);
      setRequests(requestsResponse.requests);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setNotice({ title: caught instanceof Error ? caught.message : "친구 정보를 불러오지 못했어요.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      await apiFetch("/friends/requests", {
        method: "POST",
        body: JSON.stringify({
          friendCode,
          message: requestMessage || undefined,
        }),
      });
      setFriendCode("");
      setRequestMessage("");
      setNotice({ title: "친구 요청을 보냈어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "친구 요청을 보내지 못했어요.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function act(path: string, method: "PATCH" | "DELETE", successTitle: string) {
    setNotice(null);

    try {
      await apiFetch(path, { method });
      setNotice({ title: successTitle, tone: "success" });
      await load();
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "요청을 처리하지 못했어요.", tone: "danger" });
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">친구</h1>
        <p className="mt-2 text-sm text-slate-600">친구로 연결된 사람에게 마음을 바로 보낼 수 있어요.</p>
      </div>

      <div className="grid gap-5">
        {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">내 친구 코드</h2>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <code className="rounded-md bg-slate-50 px-3 py-2 font-mono text-lg font-semibold tracking-wide text-ink">
              {me?.friendCode ?? (loading ? "불러오는 중" : "코드 없음")}
            </code>
            <button
              type="button"
              disabled={!me?.friendCode}
              onClick={() => me?.friendCode && void navigator.clipboard.writeText(me.friendCode)}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Copy size={16} />
              복사
            </button>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">친구 요청 보내기</h2>
          <form onSubmit={sendRequest} className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              required
              value={friendCode}
              onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
              placeholder="친구 코드"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              value={requestMessage}
              maxLength={120}
              onChange={(event) => setRequestMessage(event.target.value)}
              placeholder="짧은 메시지"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <UserPlus size={16} />
              요청
            </button>
          </form>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">받은 요청</h2>
          <div className="mt-4 grid gap-3">
            {requests.received.length === 0 ? <p className="text-sm text-slate-500">받은 친구 요청이 없어요.</p> : null}
            {requests.received.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-md bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-ink">{request.requester.nickname}</p>
                  <p className="mt-1 text-sm text-slate-500">{request.message || "메시지 없음"} · {formatDateTime(request.expiresAt)} 만료</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void act(`/friends/requests/${request.id}/accept`, "PATCH", "친구 요청을 수락했어요.")}
                    className="focus-ring rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white"
                  >
                    수락
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(`/friends/requests/${request.id}/reject`, "PATCH", "친구 요청을 거절했어요.")}
                    className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">보낸 요청</h2>
          <div className="mt-4 grid gap-3">
            {requests.sent.length === 0 ? <p className="text-sm text-slate-500">대기 중인 보낸 요청이 없어요.</p> : null}
            {requests.sent.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-md bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-ink">{request.addressee.nickname}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatDateTime(request.expiresAt)} 만료</p>
                </div>
                <button
                  type="button"
                  onClick={() => void act(`/friends/requests/${request.id}/cancel`, "PATCH", "친구 요청을 취소했어요.")}
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <X size={15} />
                  취소
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">친구 목록</h2>
          <div className="mt-4 grid gap-3">
            {friends.length === 0 ? <p className="text-sm text-slate-500">아직 친구가 없어요.</p> : null}
            {friends.map((friend) => (
              <div key={friend.friendshipId} className="flex flex-col gap-3 rounded-md bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-ink">{friend.nickname}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatDateTime(friend.createdAt)} 연결</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/write?friendshipId=${friend.friendshipId}&friendUserId=${friend.userId}`)}
                    className="focus-ring rounded-md bg-petal px-3 py-2 text-sm font-semibold text-white"
                  >
                    마음 쓰기
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(`/friends/${friend.friendshipId}`, "DELETE", "친구를 삭제했어요.")}
                    className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
