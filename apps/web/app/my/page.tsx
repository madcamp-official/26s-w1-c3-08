"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LogOut, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";

type Me = {
  id: string;
  nickname: string;
  email?: string | null;
  onboardingNote?: string | null;
  isAdmin?: boolean;
};

type ContactType = "EMAIL" | "PHONE";

type UserContact = {
  id: string;
  type: ContactType;
  maskedValue: string;
  label?: string | null;
  isPrimary: boolean;
  verifiedAt?: string | null;
  verificationSource?: string | null;
  createdAt: string;
  isWriteEligiblePhone?: boolean;
};

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [contactLabel, setContactLabel] = useState("");
  const [verificationCodes, setVerificationCodes] = useState<Record<string, string>>({});
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [creatingContact, setCreatingContact] = useState(false);
  const [busyContactId, setBusyContactId] = useState<string | null>(null);

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
    void loadContacts();
  }, [router]);

  async function loadContacts() {
    setLoadingContacts(true);

    try {
      const response = await apiFetch<{ contacts: UserContact[] }>("/me/contacts");
      setContacts(sortContacts(response.contacts));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "연락처 인증 정보를 불러오지 못했어요.");
    } finally {
      setLoadingContacts(false);
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingContact(true);
    setNotice(null);

    try {
      await apiFetch("/me/contacts", {
        method: "POST",
        body: JSON.stringify({
          type: "EMAIL",
          value: contactValue.trim(),
          label: contactLabel.trim() || undefined,
        }),
      });
      setContactValue("");
      setContactLabel("");
      setNotice({
        title: "인증번호를 보냈어요.",
        body: "메일함에서 6자리 번호를 확인해 주세요.",
        tone: "success",
      });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "연락처를 추가하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setCreatingContact(false);
    }
  }

  async function sendCode(contactId: string) {
    setBusyContactId(contactId);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${contactId}/send-code`, { method: "POST" });
      setNotice({ title: "인증번호를 다시 보냈어요.", tone: "success" });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: formatContactError(caught, "인증번호를 보내지 못했어요."),
        tone: "danger",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  async function verifyContact(contactId: string) {
    setBusyContactId(contactId);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${contactId}/verify`, {
        method: "POST",
        body: JSON.stringify({ code: verificationCodes[contactId] ?? "" }),
      });
      setVerificationCodes((previous) => ({ ...previous, [contactId]: "" }));
      setNotice({ title: "연락처 인증이 완료됐어요.", tone: "success" });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "인증번호를 확인하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  async function deleteContact(contactId: string) {
    setBusyContactId(contactId);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${contactId}`, { method: "DELETE" });
      setNotice({ title: "연락처를 삭제했어요.", tone: "success" });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "연락처를 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">내 정보</h1>
      </div>
      {error ? <Notice title={error} tone="danger" /> : null}
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

      <div className="grid gap-5">
        {user ? (
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">닉네임</dt>
                <dd className="mt-1 text-ink">{user.nickname}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">카카오 이메일</dt>
                <dd className="mt-1 text-ink">{user.email ?? "미제공"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">오늘 마음에 남은 한 줄</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">{formatOnboardingNote(user.onboardingNote)}</dd>
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
            {user.isAdmin ? (
              <Link
                href="/admin"
                className="focus-ring ml-2 mt-6 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                <ShieldCheck size={16} />
                관리자
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-ink">연락처 인증</h2>
            </div>
            <Link
              href="/phone-verification?next=/my"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <ShieldCheck size={15} />
              전화번호 인증/변경
            </Link>
          </div>

          <form onSubmit={createContact} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input
              required
              value={contactValue}
              type="email"
              inputMode="email"
              onChange={(event) => setContactValue(event.target.value)}
              placeholder="name@example.com"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              value={contactLabel}
              onChange={(event) => setContactLabel(event.target.value)}
              maxLength={40}
              placeholder="라벨"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={creatingContact}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={16} />
              {creatingContact ? "추가 중" : "추가"}
            </button>
          </form>

          <div className="mt-5 grid gap-3">
            {loadingContacts ? <p className="text-sm text-slate-500">연락처 인증 상태 확인 중</p> : null}
	            {!loadingContacts && contacts.length === 0 ? (
	              <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
	                등록된 연락처가 없어요.
	              </p>
	            ) : null}
            {contacts.map((contact) => {
              const isVerified = Boolean(contact.verifiedAt);
              const isVerifiedPhone = contact.type === "PHONE" && isVerified;
              const isBusy = busyContactId === contact.id;

              return (
                <article key={contact.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">
                          {contact.label ? `${contact.label} · ` : ""}
                          {formatContactType(contact.type)}
                        </p>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 size={13} />
                            인증됨
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            인증 대기
                          </span>
                        )}
	                      </div>
                      <p className="mt-2 text-sm text-slate-600">{contact.maskedValue}</p>
                      {isVerifiedPhone ? (
                        <p className="mt-2 text-xs text-slate-500">
                          인증된 전화번호는 삭제할 수 없고, 새 번호 인증이 완료되면 자동으로 변경돼요.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isVerified ? (
                        <button
                          type="button"
                          onClick={() => void sendCode(contact.id)}
                          disabled={isBusy}
                          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                        >
                          <RefreshCw size={15} />
                          재발송
                        </button>
                      ) : null}
                      {isVerifiedPhone ? (
                        <Link
                          href="/phone-verification?next=/my"
                          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          <ShieldCheck size={15} />
                          변경
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void deleteContact(contact.id)}
                          disabled={isBusy}
                          className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  {!isVerified ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-[180px_auto]">
                      <input
                        value={verificationCodes[contact.id] ?? ""}
                        onChange={(event) =>
                          setVerificationCodes((previous) => ({
                            ...previous,
                            [contact.id]: event.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6자리 인증번호"
                        className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => void verifyContact(contact.id)}
                        disabled={isBusy}
                        className="focus-ring rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        인증하기
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function formatOnboardingNote(note: string | null | undefined) {
  if (note === null || typeof note === "undefined") {
    return "아직 없음";
  }

  return note.length > 0 ? note : "건너뛰었어요.";
}

function formatContactType(type: ContactType) {
  return type === "PHONE" ? "전화번호" : "이메일";
}

function formatContactError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  if (error.code === "CONTACT_PHONE_INVALID") {
    return "휴대전화 번호만 인증할 수 있어요.";
  }

  if (error.code === "PHONE_VERIFICATION_IP_LOCKED" || error.code === "PHONE_VERIFICATION_CONTACT_LOCKED") {
    return "단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (error.code === "PHONE_LOOKUP_UNAVAILABLE") {
    return "번호 확인 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.";
  }

  return error.message;
}

function sortContacts(contacts: UserContact[]) {
  return [...contacts].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "PHONE" ? -1 : 1;
    }

    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    const leftVerifiedAt = left.verifiedAt ? new Date(left.verifiedAt).getTime() : 0;
    const rightVerifiedAt = right.verifiedAt ? new Date(right.verifiedAt).getTime() : 0;

    if (leftVerifiedAt !== rightVerifiedAt) {
      return rightVerifiedAt - leftVerifiedAt;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
