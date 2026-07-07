"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Link2, UserPlus, X } from "lucide-react";
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

type FriendCandidate = {
  userId: string;
  nickname: string;
  friendCode: string;
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

type FriendInvite = {
  id: string;
  tokenPreview?: string | null;
  expiresAt: string;
  maxClaims: number;
  claimCount: number;
  revokedAt?: string | null;
  createdAt: string;
};

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ received: [], sent: [] });
  const [activeInvites, setActiveInvites] = useState<FriendInvite[]>([]);
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<FriendCandidate[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [meResponse, friendsResponse, requestsResponse, invitesResponse] = await Promise.all([
        apiFetch<{ user: Me }>("/me"),
        apiFetch<{ friends: Friend[] }>("/friends"),
        apiFetch<{ requests: FriendRequests }>("/friends/requests"),
        apiFetch<{ invites: FriendInvite[] }>("/friends/invites/active"),
      ]);

      setMe(meResponse.user);
      setFriends(friendsResponse.friends);
      setRequests(requestsResponse.requests);
      setActiveInvites(invitesResponse.invites);
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
    await createRequest(friendCode, requestMessage || undefined);
  }

  async function createRequest(code: string, message?: string) {
    setSubmitting(true);
    setNotice(null);

    try {
      await apiFetch("/friends/requests", {
        method: "POST",
        body: JSON.stringify({
          friendCode: code,
          message,
        }),
      });
      setFriendCode("");
      setRequestMessage("");
      setCandidates((current) => current.filter((candidate) => candidate.friendCode !== code));
      setNotice({ title: "친구 요청을 보냈어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "친구 요청을 보내지 못했어요.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function createInviteLink() {
    setCreatingInvite(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ invite: FriendInvite; inviteUrl: string }>("/friends/invites", {
        method: "POST",
      });
      setCreatedInviteUrl(response.inviteUrl);
      setNotice({ title: "친구 초대 링크를 만들었어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "초대 링크를 만들지 못했어요.", tone: "danger" });
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyInviteLink() {
    if (!createdInviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(createdInviteUrl);
    setNotice({ title: "초대 링크를 복사했어요.", tone: "success" });
  }

  async function revokeInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    setNotice(null);

    try {
      await apiFetch(`/friends/invites/${inviteId}`, { method: "DELETE" });
      if (activeInvites.some((invite) => invite.id === inviteId && createdInviteUrl.includes(invite.tokenPreview ?? ""))) {
        setCreatedInviteUrl("");
      }
      setNotice({ title: "초대 링크를 폐기했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "초대 링크를 폐기하지 못했어요.", tone: "danger" });
    } finally {
      setBusyInviteId(null);
    }
  }

  async function searchCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ candidates: FriendCandidate[] }>(
        `/friends/search?q=${encodeURIComponent(searchQuery)}`,
      );
      setCandidates(response.candidates);
    } catch (caught) {
      setNotice({ title: caught instanceof ApiError ? caught.message : "친구를 찾지 못했어요.", tone: "danger" });
    } finally {
      setSearching(false);
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
      <div className="max-w-[1146px]">
        <header className="figma-panel mb-[24px] grid min-h-[190px] overflow-hidden p-[28px] md:grid-cols-[1fr_260px] md:items-center">
          <div>
            <h1 className="text-[34px] font-bold leading-tight text-[#3A3D8D]">친구</h1>
            <p className="mt-2 text-sm leading-6 text-[#A2A6BF]">친구로 연결된 사람에게 빠르게 마음을 보낼 수 있어요.</p>
          </div>
          <div className="relative mt-6 hidden h-[150px] overflow-hidden rounded-[10px] bg-[#F3EEFD] md:mt-0 md:block">
            <Image src="/images/maeari-heart-letter.png" alt="" fill sizes="260px" className="object-cover object-center" />
          </div>
        </header>

        {notice ? (
          <div className="mb-4">
            <Notice title={notice.title} body={notice.body} tone={notice.tone} />
          </div>
        ) : null}

        <section className="mb-5 grid gap-4 lg:grid-cols-[378px_558px]">
          <div className="rounded-[10px] bg-white p-[18px]">
            <p className="text-[15px] text-[#6A6F88]">내 친구 코드</p>
            <div className="mt-[10px] flex h-[41px] items-center bg-[#F9F5FD]">
              <code className="min-w-0 flex-1 px-4 font-mono text-[20px] font-bold text-[#9478E7]">
                {me?.friendCode ?? (loading ? "불러오는 중" : "코드 없음")}
              </code>
              <button
                type="button"
                disabled={!me?.friendCode}
                onClick={() => me?.friendCode && void navigator.clipboard.writeText(me.friendCode)}
                className="focus-ring mr-1 inline-flex h-[33px] w-[93px] items-center justify-center gap-2 rounded-[6px] border border-[#B499FD] bg-[#F7F6FD] text-[13px] text-[#A18CE8] disabled:opacity-50"
              >
                <Copy size={15} />
                복사
              </button>
            </div>
          </div>

          <form onSubmit={sendRequest} className="rounded-[10px] bg-white p-[18px]">
            <p className="text-[16px] text-[#626781]">친구 요청 보내기</p>
            <div className="mt-[11px] grid gap-2 md:grid-cols-[1fr_1fr_79px]">
              <input
                required
                value={friendCode}
                onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
                placeholder="친구 코드 입력"
                className="focus-ring maeari-input h-[38px] rounded-none px-3 text-sm"
              />
              <input
                value={requestMessage}
                maxLength={120}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="짧은 메시지"
                className="focus-ring maeari-input h-[38px] rounded-none px-3 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="focus-ring inline-flex h-[36px] items-center justify-center gap-2 rounded-[10px] bg-[#6B45DA] text-sm text-white disabled:opacity-50"
              >
                <UserPlus size={15} />
                요청
              </button>
            </div>
          </form>
        </section>

        <section className="mb-5 rounded-[10px] bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <p className="text-[15px] text-[#686D87]">친구 찾기</p>
              <form onSubmit={searchCandidates} className="mt-3 flex gap-2">
                <input
                  required
                  minLength={2}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="닉네임 또는 친구 코드"
                  className="focus-ring maeari-input h-[38px] min-w-0 flex-1 rounded-none px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="focus-ring h-[36px] rounded-[10px] bg-[#6B45DA] px-5 text-sm text-white disabled:opacity-50"
                >
                  {searching ? "찾는 중" : "찾기"}
                </button>
              </form>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void createInviteLink()}
                disabled={creatingInvite}
                className="focus-ring inline-flex h-[36px] items-center gap-2 rounded-[10px] border border-[#DAD4E8] bg-white px-3 text-sm text-[#9478E7] disabled:opacity-50"
              >
                <Link2 size={15} />
                {creatingInvite ? "만드는 중" : "초대 링크 만들기"}
              </button>
              {createdInviteUrl ? (
                <button
                  type="button"
                  onClick={() => void copyInviteLink()}
                  className="focus-ring inline-flex h-[36px] items-center gap-2 rounded-[10px] bg-[#9478E7] px-3 text-sm text-white"
                >
                  <Copy size={15} />
                  링크 복사
                </button>
              ) : null}
            </div>
          </div>

          {createdInviteUrl ? (
            <p className="mt-3 break-all rounded-[8px] bg-[#F3EEFD] p-3 text-xs text-[#6D48DB]">{createdInviteUrl}</p>
          ) : null}
          {activeInvites.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {activeInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#F9F7FD] px-3 py-2 text-sm">
                  <span className="text-[#8588A1]">
                    초대 링크 {invite.tokenPreview ? `#${invite.tokenPreview}` : ""} · {formatDateTime(invite.expiresAt)} 만료
                  </span>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(invite.id)}
                    disabled={busyInviteId === invite.id}
                    className="focus-ring inline-flex items-center gap-1 text-[#EF777C] disabled:opacity-50"
                  >
                    <X size={14} />
                    폐기
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {candidates.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {candidates.map((candidate) => (
                <div key={candidate.userId} className="flex items-center justify-between rounded-[8px] bg-[#F9F7FD] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#6A6F87]">{candidate.nickname}</p>
                    <p className="mt-1 font-mono text-xs text-[#A2A6BF]">{candidate.friendCode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void createRequest(candidate.friendCode)}
                    disabled={submitting}
                    className="focus-ring h-8 rounded-[8px] bg-[#6B45DA] px-3 text-xs text-white disabled:opacity-50"
                  >
                    요청
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mb-5 rounded-[10px] bg-white p-5">
          <h2 className="text-[15px] text-[#686D87]">받은 요청</h2>
          <div className="mt-4 grid gap-2">
            {requests.received.length === 0 ? (
              <EmptyFriendBlock title="받은 친구 요청이 없어요." body="새로운 친구 요청을 기다려보세요!" />
            ) : null}
            {requests.received.map((request) => (
              <FriendRow
                key={request.id}
                title={request.requester.nickname}
                body={`${request.message || "메시지 없음"} · ${formatDateTime(request.expiresAt)} 만료`}
                action={
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void act(`/friends/requests/${request.id}/accept`, "PATCH", "친구 요청을 수락했어요.")} className="focus-ring h-8 rounded-[8px] bg-[#9478E7] px-3 text-xs text-white">
                      수락
                    </button>
                    <button type="button" onClick={() => void act(`/friends/requests/${request.id}/reject`, "PATCH", "친구 요청을 거절했어요.")} className="focus-ring h-8 rounded-[8px] border border-[#DAD4E8] px-3 text-xs text-[#8588A1]">
                      거절
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-[10px] bg-white p-5">
          <h2 className="text-[15px] text-[#686D87]">보낸 요청</h2>
          <div className="mt-4 grid gap-2">
            {requests.sent.length === 0 ? (
              <EmptyFriendBlock title="대기 중인 보낸 요청이 없어요." body="새로운 친구에게 마음을 전해보세요!" />
            ) : null}
            {requests.sent.map((request) => (
              <FriendRow
                key={request.id}
                title={request.addressee.nickname}
                body={`${formatDateTime(request.expiresAt)} 만료`}
                action={
                  <button type="button" onClick={() => void act(`/friends/requests/${request.id}/cancel`, "PATCH", "친구 요청을 취소했어요.")} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#DAD4E8] px-3 text-xs text-[#8588A1]">
                    <X size={13} />
                    취소
                  </button>
                }
              />
            ))}
          </div>
        </section>

        <section className="rounded-[10px] bg-white p-5">
          <h2 className="text-[16px] font-bold text-[#72768D]">친구 목록</h2>
          <div className="mt-4 divide-y divide-[#F3EFF7]">
            {friends.length === 0 ? <EmptyFriendBlock title="아직 친구가 없어요." body="친구 코드를 보내고 마음을 나눠보세요." /> : null}
            {friends.map((friend) => (
              <FriendRow
                key={friend.friendshipId}
                title={friend.nickname}
                body={`${formatDateTime(friend.createdAt)} 연결`}
                action={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/write?friendshipId=${friend.friendshipId}&friendUserId=${friend.userId}`)}
                      className="focus-ring inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#9478E7] px-3 text-xs text-[#9478E7]"
                    >
                      마음 쓰기
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(`/friends/${friend.friendshipId}`, "DELETE", "친구를 삭제했어요.")}
                      className="focus-ring h-8 rounded-[8px] border border-[#DAD4E8] px-3 text-xs text-[#8588A1]"
                    >
                      삭제
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function EmptyFriendBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] bg-[#FDFDFD] px-4 py-7 text-center">
      <p className="text-sm text-[#6E738A]">{title}</p>
      <p className="mt-1 text-xs text-[#B3B6C4]">{body}</p>
    </div>
  );
}

function FriendRow({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-[#E9D8FF]" />
        <div>
          <p className="text-base text-[#696E86]">{title}</p>
          <p className="mt-1 text-xs text-[#BABDC9]">{body}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
