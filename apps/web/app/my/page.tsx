"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LogOut, Plus, RefreshCw, ShieldCheck, Star, Trash2 } from "lucide-react";
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
};

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [contactType, setContactType] = useState<ContactType>("EMAIL");
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
      setContacts(response.contacts);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "발신 연락처를 불러오지 못했어요.");
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
          type: contactType,
          value: contactType === "PHONE" ? sanitizePhoneNumber(contactValue) : contactValue.trim(),
          label: contactLabel.trim() || undefined,
        }),
      });
      setContactValue("");
      setContactLabel("");
      setNotice({
        title: "인증번호를 보냈어요.",
        body: contactType === "PHONE" ? "문자로 받은 6자리 번호를 입력해 주세요." : "메일함에서 6자리 번호를 확인해 주세요.",
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
        title: caught instanceof ApiError ? caught.message : "인증번호를 보내지 못했어요.",
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
      setNotice({ title: "발신 연락처 인증이 완료됐어요.", tone: "success" });
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

  async function setPrimaryContact(contactId: string) {
    setBusyContactId(contactId);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ isPrimary: true }),
      });
      setNotice({ title: "기본 발신 연락처로 설정했어요.", tone: "success" });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "기본 연락처로 설정하지 못했어요.",
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
      setNotice({ title: "발신 연락처를 삭제했어요.", tone: "success" });
      await loadContacts();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "발신 연락처를 삭제하지 못했어요.",
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
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-ink">발신 연락처</h2>
            <p className="text-sm text-slate-500">마음을 예약할 때 사용할 이메일이나 전화번호를 인증해 주세요.</p>
          </div>

          <form onSubmit={createContact} className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_180px_auto]">
            <select
              value={contactType}
              onChange={(event) => {
                setContactType(event.target.value as ContactType);
                setContactValue("");
              }}
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="EMAIL">이메일</option>
              <option value="PHONE">전화번호</option>
            </select>
            <input
              required
              value={contactValue}
              type={contactType === "EMAIL" ? "email" : "tel"}
              inputMode={contactType === "EMAIL" ? "email" : "tel"}
              maxLength={contactType === "PHONE" ? 13 : undefined}
              onChange={(event) =>
                setContactValue(contactType === "PHONE" ? formatPhoneInput(event.target.value) : event.target.value)
              }
              placeholder={contactType === "PHONE" ? "010-1234-5678" : "name@example.com"}
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
            {loadingContacts ? <p className="text-sm text-slate-500">발신 연락처 확인 중</p> : null}
            {!loadingContacts && contacts.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                등록된 발신 연락처가 없어요.
              </p>
            ) : null}
            {contacts.map((contact) => {
              const isVerified = Boolean(contact.verifiedAt);
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
                        {contact.isPrimary ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                            <Star size={13} />
                            기본
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{contact.maskedValue}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isVerified && !contact.isPrimary ? (
                        <button
                          type="button"
                          onClick={() => void setPrimaryContact(contact.id)}
                          disabled={isBusy}
                          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                        >
                          <Star size={15} />
                          기본 설정
                        </button>
                      ) : null}
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
                      <button
                        type="button"
                        onClick={() => void deleteContact(contact.id)}
                        disabled={isBusy}
                        className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        삭제
                      </button>
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

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhoneInput(value: string) {
  const digits = sanitizePhoneNumber(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
