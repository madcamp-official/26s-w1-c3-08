"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";

type UserContact = {
  id: string;
  type: "EMAIL" | "PHONE";
  maskedValue: string;
  verifiedAt?: string | null;
  isWriteEligiblePhone?: boolean;
};

type ContactsResponse = {
  contacts: UserContact[];
  writerEligibility?: {
    hasVerifiedStrictPhone: boolean;
  };
};

type CreateContactResponse = {
  contact: UserContact;
  verificationSent: boolean;
};

export default function PhoneVerificationPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [phoneValue, setPhoneValue] = useState("");
  const [code, setCode] = useState("");
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);

  const nextPath = useMemo(() => getSafeNextPath(), []);
  const verifiedPhone = contacts.find((contact) => contact.type === "PHONE" && contact.isWriteEligiblePhone);
  const pendingPhone = contacts.find((contact) => contact.id === pendingContactId);

  useEffect(() => {
    void loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);

    try {
      const response = await apiFetch<ContactsResponse>("/me/contacts");
      setContacts(response.contacts);
      const latestPending = response.contacts.find((contact) => contact.type === "PHONE" && !contact.verifiedAt);
      setPendingContactId((current) => current ?? latestPending?.id ?? null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setNotice({
        title: caught instanceof Error ? caught.message : "전화번호 인증 상태를 불러오지 못했어요.",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setNotice(null);

    try {
      const response = await apiFetch<CreateContactResponse>("/me/contacts", {
        method: "POST",
        body: JSON.stringify({
          type: "PHONE",
          value: phoneValue.trim(),
        }),
      });

      setPendingContactId(response.contact.id);
      setPhoneValue("");
      setCode("");
      setNotice({
        title: response.verificationSent ? "인증번호를 보냈어요." : "이미 인증된 전화번호예요.",
        body: response.verificationSent ? "문자로 받은 6자리 번호를 입력해 주세요." : undefined,
        tone: "success",
      });
      await loadContacts();

      if (!response.verificationSent && response.contact.isWriteEligiblePhone) {
        router.replace(nextPath);
      }
    } catch (caught) {
      setNotice({
        title: formatPhoneVerificationError(caught, "인증번호를 보내지 못했어요."),
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  async function resendCode() {
    if (!pendingContactId) {
      return;
    }

    setSending(true);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${pendingContactId}/send-code`, { method: "POST" });
      setNotice({ title: "인증번호를 다시 보냈어요.", tone: "success" });
    } catch (caught) {
      setNotice({
        title: formatPhoneVerificationError(caught, "인증번호를 다시 보내지 못했어요."),
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingContactId) {
      setNotice({ title: "먼저 전화번호로 인증번호를 받아 주세요.", tone: "danger" });
      return;
    }

    setVerifying(true);
    setNotice(null);

    try {
      await apiFetch(`/me/contacts/${pendingContactId}/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setNotice({ title: "전화번호 인증이 완료됐어요.", tone: "success" });
      setCode("");
      await loadContacts();
      router.replace(nextPath);
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "인증번호를 확인하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AppShell>
      <div className="maeari-hero-card mb-6 grid min-h-[190px] overflow-hidden p-[28px] md:grid-cols-[1fr_260px] md:items-center">
        <div>
          <h1 className="maeari-page-title">전화번호 인증</h1>
          <p className="maeari-page-copy mt-2">계정 사용을 시작하려면 010 휴대전화 번호를 인증해 주세요.</p>
        </div>
        <div className="maeari-hero-visual relative mt-6 hidden h-[150px] overflow-hidden md:mt-0 md:block">
          <Image src="/images/maeari-moon-letter.png" alt="" fill sizes="260px" className="scale-[1.08] object-cover object-center" />
        </div>
      </div>

      <div className="grid gap-5">
        {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

        {loading ? <Notice title="전화번호 인증 상태를 확인하고 있어요." tone="default" /> : null}

        {!loading && verifiedPhone ? (
          <section className="figma-panel border-[#D9C8FF] bg-[#F3EEFD]/90 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#6D48DB]">
                  <CheckCircle2 size={20} />
                  <h2 className="text-base font-semibold">전화번호 인증 완료</h2>
                </div>
                <p className="mt-2 text-sm text-[#7A6BAE]">인증이 완료됐어요. 이제 매아리를 이어갈 수 있어요.</p>
              </div>
              <button
                type="button"
                onClick={() => router.replace(nextPath)}
                className="focus-ring maeari-action maeari-action-primary"
              >
                {nextPath === "/write" ? "마음 쓰러 가기" : "계속하기"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="figma-panel p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-sub" />
            <h2 className="text-base font-semibold text-[#4E536B]">인증번호 받기</h2>
          </div>
          <form onSubmit={sendCode} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              required
              type="tel"
              inputMode="tel"
              value={phoneValue}
              maxLength={16}
              onChange={(event) => setPhoneValue(formatPhoneInput(event.target.value))}
              placeholder="010-1234-5678"
              className="focus-ring maeari-input px-3 py-2"
            />
            <button
              type="submit"
              disabled={sending}
              className="focus-ring maeari-action maeari-action-primary disabled:opacity-50"
            >
              {sending ? "발송 중" : "인증번호 발송"}
            </button>
          </form>
        </section>

        <section className="figma-panel p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#4E536B]">인증번호 입력</h2>
              <p className="mt-1 text-sm text-[#A2A6BF]">
                {pendingPhone ? "문자로 받은 6자리 번호를 입력해 주세요." : "먼저 인증번호를 발송해 주세요."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={!pendingContactId || sending}
              className="focus-ring maeari-action disabled:opacity-50"
            >
              <RefreshCw size={15} />
              재발송
            </button>
          </div>

          <form onSubmit={verifyCode} className="mt-4 grid gap-3 md:grid-cols-[180px_auto]">
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 인증번호"
              className="focus-ring maeari-input px-3 py-2"
            />
            <button
              type="submit"
              disabled={!pendingContactId || verifying}
              className="focus-ring maeari-action maeari-action-primary disabled:opacity-50"
            >
              {verifying ? "확인 중" : "인증 완료"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function getSafeNextPath() {
  if (typeof window === "undefined") {
    return "/write";
  }

  const value = new URLSearchParams(window.location.search).get("next") ?? "/write";
  const allowedPathPattern =
    /^\/(?:$|write|my|auth\/callback|onboarding|inbox|archive|sent|friends(?:\/.*)?|tree(?:\/.*)?|reports|messages\/[^/?#]+)(?:[?#].*)?$/;

  return allowedPathPattern.test(value) ? value : "/write";
}

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneInput(value: string) {
  const digits = sanitizePhoneNumber(value);

  if (value.trim().startsWith("+") || digits.startsWith("82")) {
    return value.replace(/[^\d+]/g, "").slice(0, 16);
  }

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

function formatPhoneVerificationError(error: unknown, fallback: string) {
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
