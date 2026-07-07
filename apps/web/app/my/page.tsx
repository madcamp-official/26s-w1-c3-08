"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
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
      <div className="max-w-[1110px]">
        <header className="figma-panel mb-[24px] grid min-h-[190px] overflow-hidden p-[28px] md:grid-cols-[1fr_260px] md:items-center">
          <div>
            <h1 className="text-[29px] font-medium text-[#4E536B]">내 정보</h1>
            <p className="mt-2 text-[15px] leading-6 text-[#9FA2B4]">내 계정 정보를 확인하고 관리할 수 있어요.</p>
          </div>
          <div className="relative mt-6 hidden h-[150px] overflow-hidden rounded-[10px] bg-[#F3EEFD] md:mt-0 md:block">
            <Image src="/images/maeari-star-letter.png" alt="" fill sizes="260px" className="object-cover object-center" />
          </div>
        </header>

        {error ? (
          <div className="mb-4">
            <Notice title={error} tone="danger" />
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4">
            <Notice title={notice.title} body={notice.body} tone={notice.tone} />
          </div>
        ) : null}

        {user ? (
          <section className="mb-[15px] bg-white px-[28px] py-[36px]">
            <div className="grid gap-8 lg:grid-cols-[171px_1fr]">
              <div className="relative h-[171px] w-[171px] overflow-hidden rounded-[24px] bg-[#F3EEFD]">
                <Image src="/images/maeari-app-icon.png" alt="" fill sizes="171px" className="object-cover" />
              </div>
              <div className="min-w-0 pt-[18px]">
                <div className="grid grid-cols-[160px_1fr] border-b border-[#F0EEF7] py-4 text-[15px]">
                  <span className="text-[#6F7487]">이름</span>
                  <span className="text-[#9599AB]">{user.nickname}</span>
                </div>
                <div className="grid grid-cols-[160px_1fr] border-b border-[#F0EEF7] py-4 text-[15px]">
                  <span className="text-[#6D7285]">이메일</span>
                  <span className="truncate text-[#9598AB]">{user.email ?? "미제공"}</span>
                </div>
                <div className="grid grid-cols-[160px_1fr] py-4 text-[15px]">
                  <span className="text-[#6F7487]">오늘 마음에 남은 한 줄</span>
                  <span className="whitespace-pre-wrap text-[#999DAE]">{formatOnboardingNote(user.onboardingNote)}</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-[15px] bg-white px-[28px] py-[24px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-[17px] text-[#64687D]">연락처 인증</h2>
            <Link
              href="/phone-verification?next=/my"
              className="focus-ring inline-flex h-[35px] items-center justify-center gap-2 rounded-[13px] border-2 border-[#DBCEFB] bg-white px-4 text-sm text-[#9F88E6]"
            >
              <ShieldCheck size={15} />
              전화번호 인증/변경
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {loadingContacts ? <p className="text-sm text-[#8588A1]">연락처 인증 상태 확인 중</p> : null}
            {!loadingContacts && contacts.length === 0 ? (
              <p className="rounded-[8px] bg-[#F9F7FD] p-4 text-sm text-[#8588A1]">등록된 연락처가 없어요.</p>
            ) : null}
            {contacts.map((contact) => {
              const isVerified = Boolean(contact.verifiedAt);
              const isVerifiedPhone = contact.type === "PHONE" && isVerified;
              const isBusy = busyContactId === contact.id;

              return (
                <article key={contact.id} className="border-t border-[#F3EFF7] py-4 first:border-t-0">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] text-[#6D7285]">
                          {formatContactType(contact.type)}
                          {contact.label ? ` · ${contact.label}` : ""}
                        </p>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#EEFBEF] px-2 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} />
                            인증됨
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">인증 대기</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-[#9598AB]">{contact.maskedValue}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isVerified ? (
                        <button
                          type="button"
                          onClick={() => void sendCode(contact.id)}
                          disabled={isBusy}
                          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#DAD4E8] bg-white px-3 text-sm text-[#8588A1] disabled:opacity-50"
                        >
                          <RefreshCw size={15} />
                          재발송
                        </button>
                      ) : null}
                      {isVerifiedPhone ? (
                        <Link
                          href="/phone-verification?next=/my"
                          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#DAD4E8] bg-white px-3 text-sm text-[#8588A1]"
                        >
                          <ShieldCheck size={15} />
                          변경
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void deleteContact(contact.id)}
                          disabled={isBusy}
                          className="focus-ring inline-flex h-9 items-center gap-2 rounded-[9px] border border-rose-200 bg-white px-3 text-sm text-rose-700 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  {!isVerified ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[180px_auto]">
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
                        className="focus-ring maeari-input h-9 rounded-[7px] px-3"
                      />
                      <button
                        type="button"
                        onClick={() => void verifyContact(contact.id)}
                        disabled={isBusy}
                        className="focus-ring h-9 rounded-[8px] bg-[#6D48DB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        인증하기
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <form onSubmit={createContact} className="mt-5 grid gap-3 border-t border-[#F3EFF7] pt-5 md:grid-cols-[1fr_180px_auto]">
            <input
              required
              value={contactValue}
              type="email"
              inputMode="email"
              onChange={(event) => setContactValue(event.target.value)}
              placeholder="name@example.com"
              className="focus-ring maeari-input h-10 rounded-[7px] px-3"
            />
            <input
              value={contactLabel}
              onChange={(event) => setContactLabel(event.target.value)}
              maxLength={40}
              placeholder="라벨"
              className="focus-ring maeari-input h-10 rounded-[7px] px-3"
            />
            <button
              type="submit"
              disabled={creatingContact}
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#9A85E1] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={16} />
              {creatingContact ? "추가 중" : "이메일 추가"}
            </button>
          </form>
        </section>

        <section className="mb-[15px] bg-white px-[28px] py-[24px]">
          <div className="flex items-center justify-between border-b border-[#F9F9FA] pb-4">
            <h2 className="text-[17px] text-[#64687D]">기타</h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[15px] text-[#9195A7]">로그아웃</p>
            <div className="flex flex-wrap gap-2">
              {user?.isAdmin ? (
                <Link
                  href="/admin"
                  className="focus-ring inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#DAD4E8] bg-white px-4 text-sm text-[#8588A1]"
                >
                  <ShieldCheck size={16} />
                  관리자
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void logout()}
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#FBBABA] bg-white px-4 text-sm text-[#F18E90]"
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F1FD] px-[28px] py-[18px]">
          <p className="text-[15px] text-[#8E70E1]">개인정보는 소중하게 보호돼요.</p>
          <p className="mt-2 text-sm text-[#B6AADE]">
            계정 정보는 카카오 계정 정보를 기반으로 관리되며, 비밀번호는 카카오에서 안전하게 관리합니다.
          </p>
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
