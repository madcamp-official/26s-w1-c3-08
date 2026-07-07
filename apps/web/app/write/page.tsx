"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Home, ImagePlus, Plus, RotateCcw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { QrShare } from "@/components/QrShare";
import { ApiError, apiFetch } from "@/lib/api";

type CreateMessageResponse = {
  message: {
    id: string;
    status: string;
    scheduledAt?: string;
    moderationNextRetryAt?: string | null;
  };
  publicUrl: string | null;
  notice?: string;
};

type ServerTimeResponse = {
  serverNow: string;
  defaultScheduledAt: string;
};

type Friend = {
  friendshipId: string;
  userId: string;
  nickname: string;
};

type SenderContact = {
  id: string;
  type: "EMAIL" | "PHONE";
  maskedValue: string;
  label?: string | null;
  isPrimary: boolean;
  verifiedAt?: string | null;
  isWriteEligiblePhone?: boolean;
};

type ContactsResponse = {
  contacts: SenderContact[];
  writerEligibility?: {
    hasVerifiedStrictPhone: boolean;
  };
};

type ReceiverType = "SELF" | "FRIEND" | "OTHER";
type PreferredChannel = "AUTO" | "EMAIL" | "SMS";
type ArrivalMode = "FIXED" | "RANDOM_WINDOW";
type MessageTheme = "LAVENDER" | "MOSS" | "SUNSET" | "MIDNIGHT" | "PAPER";
type HintPreset = "NONE" | "ONE_HOUR" | "ONE_DAY";

type ReceiverInfoPayload = {
  type: ReceiverType;
  friendshipId?: string;
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  preferredChannel?: PreferredChannel;
};

type RecipientDraft = {
  id: string;
  label: string;
  payload: ReceiverInfoPayload;
};

type AttachmentDraft = {
  id: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  file: File;
  previewUrl: string;
};

type CompletedMessage = {
  id: string;
  title: string;
  receiverLabel: string;
  scheduledAt: Date;
  publicUrl: string | null;
};

type WriteNotice = {
  title: string;
  body?: string;
  tone?: "danger" | "success" | "default";
};

const emotionOptions = [
  ["THANKS", "고마움"],
  ["CHEER", "응원"],
  ["CELEBRATION", "축하"],
  ["COMFORT", "위로"],
  ["LONGING", "그리움"],
  ["LOVE", "사랑"],
  ["CUSTOM", "직접 입력"],
] as const;

const presetOptions = [
  ["todayNight", "오늘 밤 9시"],
  ["tomorrowMorning", "내일 아침 9시"],
  ["tomorrowNight", "내일 밤 9시"],
  ["nextWeek", "1주 뒤"],
  ["nextMonth", "1개월 뒤"],
] as const;

const quarterMinuteOptions = ["00", "15", "30", "45"];
const maxAttachmentCount = 3;
const maxAttachmentBytes = 2 * 1024 * 1024;
const maxAttachmentTotalBytes = maxAttachmentCount * maxAttachmentBytes;
const allowedAttachmentMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const themeOptions: Array<[MessageTheme, string]> = [
  ["LAVENDER", "보라빛 봉투"],
  ["MOSS", "차분한 초록"],
  ["SUNSET", "저녁 노을"],
  ["MIDNIGHT", "한밤의 별"],
  ["PAPER", "종이 편지"],
];

export default function WritePage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [hasVerifiedStrictPhone, setHasVerifiedStrictPhone] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [serverTimeLoading, setServerTimeLoading] = useState(true);
  const [serverTimeError, setServerTimeError] = useState<string | null>(null);
  const [serverDefaultScheduledAt, setServerDefaultScheduledAt] = useState<string | null>(null);
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [receiverType, setReceiverType] = useState<ReceiverType>("SELF");
  const [selectedFriendshipId, setSelectedFriendshipId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>("AUTO");
  const [recipientDrafts, setRecipientDrafts] = useState<RecipientDraft[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [emotionTag, setEmotionTag] = useState("THANKS");
  const [customEmotionTag, setCustomEmotionTag] = useState("");
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode>("FIXED");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [randomEndDate, setRandomEndDate] = useState("");
  const [randomEndTime, setRandomEndTime] = useState("");
  const [hintPreset, setHintPreset] = useState<HintPreset>("NONE");
  const [theme, setTheme] = useState<MessageTheme>("LAVENDER");
  const [isSenderHidden, setIsSenderHidden] = useState(false);
  const [isDateHidden, setIsDateHidden] = useState(false);
  const [isReplyEnabled, setIsReplyEnabled] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const attachmentsRef = useRef<AttachmentDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<WriteNotice | null>(null);
  const [completedMessage, setCompletedMessage] = useState<CompletedMessage | null>(null);
  const [kstNow, setKstNow] = useState("KST 시간 확인 중");

  const selectedFriend = friends.find((friend) => friend.friendshipId === selectedFriendshipId);
  const scheduledAtDate = useMemo(() => {
    if (!arrivalTouched && serverDefaultScheduledAt) {
      return new Date(serverDefaultScheduledAt);
    }

    return toDateFromKstInput(arrivalDate, arrivalTime);
  }, [arrivalDate, arrivalTime, arrivalTouched, serverDefaultScheduledAt]);
  const minArrivalDate = useMemo(() => toKstDateInput(new Date()), []);
  const loadServerDefaultSchedule = useCallback(async () => {
    setServerTimeLoading(true);
    setServerTimeError(null);

    try {
      const response = await fetchServerTimeWithRetry();
      const defaultDate = new Date(response.defaultScheduledAt);

      setServerDefaultScheduledAt(response.defaultScheduledAt);
      setArrivalTouched(false);
      setArrivalFromDate(defaultDate, false);
      setRandomEndFromDate(new Date(defaultDate.getTime() + 24 * 60 * 60 * 1000));
    } catch (caught) {
      setServerTimeError(caught instanceof Error ? caught.message : "서버 시간을 불러오지 못했어요.");
    } finally {
      setServerTimeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServerDefaultSchedule();
  }, [loadServerDefaultSchedule]);

  useEffect(() => {
    function tick() {
      setKstNow(formatKstNow(new Date()));
    }

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, []);

  useEffect(() => {
    async function loadFriends() {
      try {
        const response = await apiFetch<{ friends: Friend[] }>("/friends");
        setFriends(response.friends);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
        }
      }
    }

    void loadFriends();
  }, [router]);

  useEffect(() => {
    async function loadContacts() {
      setContactsLoading(true);
      setContactsError(null);

      try {
        const response = await apiFetch<ContactsResponse>("/me/contacts");
        setHasVerifiedStrictPhone(
          response.writerEligibility?.hasVerifiedStrictPhone ??
            response.contacts.some((contact) => Boolean(contact.isWriteEligiblePhone)),
        );
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setContactsError(caught instanceof Error ? caught.message : "전화번호 인증 상태를 불러오지 못했어요.");
      } finally {
        setContactsLoading(false);
      }
    }

    void loadContacts();
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const friendshipId = params.get("friendshipId");

    if (friendshipId && friends.some((friend) => friend.friendshipId === friendshipId)) {
      setReceiverType("FRIEND");
      setSelectedFriendshipId(friendshipId);
    }
  }, [friends]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setCompletedMessage(null);

    try {
      const randomEndAtDate = toDateFromKstInput(randomEndDate, randomEndTime);

      if (serverTimeLoading || serverTimeError || !serverDefaultScheduledAt) {
        setNotice({
          title: "서버 시간을 확인한 뒤 예약할 수 있어요.",
          body: "시간 확인에 실패했다면 다시 시도해 주세요.",
          tone: "danger",
        });
        return;
      }

      if (!scheduledAtDate || scheduledAtDate.getTime() <= Date.now()) {
        setNotice({ title: "도착 시간은 현재보다 뒤로 골라 주세요.", tone: "danger" });
        return;
      }

      if (arrivalMode === "RANDOM_WINDOW" && (!randomEndAtDate || randomEndAtDate.getTime() <= scheduledAtDate.getTime())) {
        setNotice({ title: "랜덤 도착 종료 시간은 시작 시간보다 뒤로 골라 주세요.", tone: "danger" });
        return;
      }

      if (!hasVerifiedStrictPhone) {
        setNotice({
          title: "전화번호 인증이 필요해요.",
          body: "마음을 예약하려면 먼저 전화번호 인증을 완료해 주세요.",
          tone: "danger",
        });
        return;
      }

      const recipients = recipientDrafts.length ? recipientDrafts.map((draft) => draft.payload) : [createReceiverInfo()];

      if (!recipients.length || !validateCurrentReceiverIfNeeded(recipientDrafts.length === 0)) {
        return;
      }

      const hintAt = createHintAt(scheduledAtDate);
      const scheduledAtIso =
        !arrivalTouched && serverDefaultScheduledAt ? serverDefaultScheduledAt : scheduledAtDate.toISOString();

      if (hintAt && hintAt.getTime() <= Date.now()) {
        setNotice({ title: "힌트 알림 시간은 현재보다 뒤여야 해요.", tone: "danger" });
        return;
      }

      const payload = {
          receiverInfo: recipients[0],
          recipients,
          title,
          content,
          emotionTag,
          customEmotionTag: emotionTag === "CUSTOM" ? customEmotionTag : undefined,
          scheduledAt: arrivalMode === "FIXED" ? scheduledAtIso : undefined,
          arrivalMode,
          arrivalWindowStartAt: arrivalMode === "RANDOM_WINDOW" ? scheduledAtIso : undefined,
          arrivalWindowEndAt: arrivalMode === "RANDOM_WINDOW" ? randomEndAtDate?.toISOString() : undefined,
          hintAt: hintAt?.toISOString(),
          theme,
          isReplyEnabled,
          isSenderHidden,
          isDateHidden,
        };
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      attachments.forEach((attachment) => {
        formData.append("attachments", attachment.file, attachment.fileName);
      });

      const response = await apiFetch<CreateMessageResponse>("/messages", {
        method: "POST",
        body: formData,
      });

      if (response.publicUrl) {
        const browserPublicUrl = toBrowserPublicUrl(response.publicUrl);
        setCompletedMessage({
          id: response.message.id,
          title,
          receiverLabel: recipientDrafts.length ? `${recipientDrafts.length}명` : getReceiverLabel(),
          scheduledAt: response.message.scheduledAt ? new Date(response.message.scheduledAt) : scheduledAtDate,
          publicUrl: browserPublicUrl,
        });
        setNotice({ title: "예약이 완료됐어요.", body: "발신함과 상세 화면에서 저장된 예약을 확인할 수 있어요.", tone: "success" });
      } else {
        setNotice({ title: "안전 검사를 잠시 완료하지 못했어요.", body: response.notice, tone: "default" });
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      if (caught instanceof ApiError && caught.code === "SENDER_PHONE_VERIFICATION_REQUIRED") {
        router.push("/phone-verification?next=/write");
        return;
      }

      setNotice({
        title: caught instanceof ApiError ? caught.message : "메시지를 예약하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function createReceiverInfo(): ReceiverInfoPayload {
    if (receiverType === "FRIEND" && selectedFriend) {
      return {
        type: "FRIEND",
        friendshipId: selectedFriend.friendshipId,
        userId: selectedFriend.userId,
      };
    }

    if (receiverType === "OTHER") {
      return {
        type: "OTHER",
        name: receiverName,
        email: receiverEmail || undefined,
        phone: sanitizePhoneNumber(receiverPhone) || undefined,
        preferredChannel,
      };
    }

    return {
      type: "SELF",
      name: "미래의 나",
    };
  }

  function validateCurrentReceiverIfNeeded(shouldValidate: boolean) {
    if (!shouldValidate) {
      return true;
    }

    if (receiverType === "FRIEND" && !selectedFriend) {
      setNotice({ title: "마음을 받을 친구를 선택해 주세요.", tone: "danger" });
      return false;
    }

    const sanitizedPhone = sanitizePhoneNumber(receiverPhone);

    if (receiverType === "OTHER" && receiverPhone.trim() && !isDomesticPhoneNumber(sanitizedPhone)) {
      setNotice({ title: "전화번호는 국내 번호 10~11자리로 입력해 주세요.", tone: "danger" });
      return false;
    }

    if (receiverType === "OTHER" && !receiverName.trim()) {
      setNotice({ title: "연락처 수신자는 이름이 필요해요.", tone: "danger" });
      return false;
    }

    if (receiverType === "OTHER" && preferredChannel === "EMAIL" && !receiverEmail.trim()) {
      setNotice({ title: "이메일 알림을 보내려면 수신자 이메일이 필요해요.", tone: "danger" });
      return false;
    }

    if (receiverType === "OTHER" && preferredChannel === "SMS" && !sanitizedPhone) {
      setNotice({ title: "문자 알림을 보내려면 수신자 전화번호가 필요해요.", tone: "danger" });
      return false;
    }

    if (receiverType === "OTHER" && preferredChannel === "AUTO" && !receiverEmail.trim() && !sanitizedPhone) {
      setNotice({ title: "연락처로 보내려면 이메일이나 전화번호 중 하나가 필요해요.", tone: "danger" });
      return false;
    }

    return true;
  }

  function addRecipientDraft() {
    setNotice(null);

    if (!validateCurrentReceiverIfNeeded(true)) {
      return;
    }

    const payload = createReceiverInfo();
    const key = JSON.stringify(payload);

    if (recipientDrafts.some((draft) => JSON.stringify(draft.payload) === key)) {
      setNotice({ title: "이미 추가한 수신자예요.", tone: "default" });
      return;
    }

    setRecipientDrafts((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        label: getReceiverLabel(),
        payload,
      },
    ]);
  }

  function removeRecipientDraft(id: string) {
    setRecipientDrafts((previous) => previous.filter((draft) => draft.id !== id));
  }

  function getReceiverLabel() {
    if (receiverType === "FRIEND") {
      return selectedFriend?.nickname ?? "친구";
    }

    if (receiverType === "OTHER") {
      return receiverName || receiverEmail || receiverPhone || "연락처 수신자";
    }

    return "미래의 나";
  }

  function resetForm() {
    setReceiverType("SELF");
    setSelectedFriendshipId("");
    setReceiverName("");
    setReceiverEmail("");
    setReceiverPhone("");
    setPreferredChannel("AUTO");
    setRecipientDrafts([]);
    setTitle("");
    setContent("");
    setEmotionTag("THANKS");
    setCustomEmotionTag("");
    setArrivalMode("FIXED");
    setRandomEndDate("");
    setRandomEndTime("");
    setHintPreset("NONE");
    setTheme("LAVENDER");
    setIsSenderHidden(false);
    setIsDateHidden(false);
    setIsReplyEnabled(true);
    clearAttachments();
    setCompletedMessage(null);
    setNotice(null);
    void loadServerDefaultSchedule();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyPreset(key: (typeof presetOptions)[number][0]) {
    setArrivalTouched(true);
    setArrivalFromDate(createPresetDate(key));
  }

  function setArrivalFromDate(date: Date, markTouched = true) {
    if (markTouched) {
      setArrivalTouched(true);
    }

    setArrivalDate(toKstDateInput(date));
    setArrivalTime(toKstTimeInput(date));
  }

  function setRandomEndFromDate(date: Date) {
    setRandomEndDate(toKstDateInput(date));
    setRandomEndTime(toKstTimeInput(date));
  }

  function applyQuarterMinute(minute: string) {
    const hour = arrivalTime.split(":")[0] || "09";
    setArrivalTouched(true);
    setArrivalTime(`${hour.padStart(2, "0")}:${minute}`);
  }

  function createHintAt(reference: Date) {
    if (hintPreset === "ONE_HOUR") {
      return new Date(reference.getTime() - 60 * 60 * 1000);
    }

    if (hintPreset === "ONE_DAY") {
      return new Date(reference.getTime() - 24 * 60 * 60 * 1000);
    }

    return null;
  }

  async function handleAttachmentChange(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    try {
      const remainingSlots = maxAttachmentCount - attachments.length;
      if (remainingSlots <= 0) {
        throw new Error("이미지는 최대 3개까지 첨부할 수 있어요.");
      }

      const files = Array.from(fileList).slice(0, remainingSlots);
      const next: AttachmentDraft[] = [];

      try {
        files.forEach((file) => next.push(createAttachmentDraft(file)));
      } catch (caught) {
        next.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
        throw caught;
      }

      const totalBytes =
        attachments.reduce((total, attachment) => total + attachment.sizeBytes, 0) +
        next.reduce((total, attachment) => total + attachment.sizeBytes, 0);

      if (totalBytes > maxAttachmentTotalBytes) {
        next.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
        throw new Error("이미지는 최대 3개, 전체 6MB 이하로 첨부해 주세요.");
      }

      setAttachments((previous) => [...previous, ...next].slice(0, maxAttachmentCount));
    } catch (caught) {
      setNotice({
        title: caught instanceof Error ? caught.message : "이미지를 첨부하지 못했어요.",
        tone: "danger",
      });
    }
  }

  function removeAttachment(id: string) {
    setAttachments((previous) => {
      const removed = previous.find((attachment) => attachment.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return previous.filter((attachment) => attachment.id !== id);
    });
  }

  function clearAttachments() {
    setAttachments((previous) => {
      previous.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
  }

  return (
    <AppShell>
      <div className="relative max-w-[1190px]">
        <div className="pointer-events-none absolute left-[434px] top-[-86px] hidden h-[263px] w-[395px] overflow-hidden lg:block">
          <Image src="/images/maeari-cloud-envelope.png" alt="" fill sizes="395px" className="object-cover" />
        </div>

        <div className="mb-[14px] pl-[5px]">
          <h1 className="maeari-page-title">새로운 마음 보내기</h1>
          <p className="maeari-page-copy mt-2">당신의 마음이 가장 필요한 순간에 도착해요.</p>
        </div>

        {notice ? (
          <WriteNoticeDialog
            notice={notice}
            completedMessage={notice.tone === "success" ? completedMessage : null}
            onClose={() => setNotice(null)}
            onViewDetail={(messageId) => router.push(`/messages/${messageId}`)}
            onViewSent={() => router.push("/sent")}
            onReset={resetForm}
            onHome={() => router.push("/")}
          />
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-[29px] xl:grid-cols-[minmax(0,1fr)_minmax(320px,340px)] xl:items-start">
          <section className="figma-panel min-h-[578px] px-[21px] py-[24px]">
            <div className="px-[1px]">
              <p className="maeari-kst-time text-sm text-[#7B7FAA]">현재 시각 (KST)</p>
              <p className="maeari-kst-time mt-[13px] border-b border-[#F1EEF8] pb-[13px] text-[24px] text-[#4E5391]">
                {kstNow}
              </p>
            </div>

            <div className="mt-[13px]">
              <p className="mb-[10px] text-sm font-bold text-[#868CB2]">받는 사람</p>
              <div className="grid min-h-[36px] grid-cols-3 overflow-hidden rounded-[8px] border border-[#D7CCF8] bg-white">
                {[
                  ["SELF", "미래의 나"],
                  ["FRIEND", "친구선택"],
                  ["OTHER", "연락처"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={`focus-ring flex cursor-pointer items-center justify-center border-[#E3E5EF] text-[13px] transition ${
                      value !== "SELF" ? "border-l" : ""
                    } ${receiverType === value ? "bg-[#F2EDFD] font-medium text-[#9B84F8]" : "bg-white text-[#999EB9]"}`}
                  >
                    <input
                      type="radio"
                      name="receiverType"
                      checked={receiverType === value}
                      onChange={() => setReceiverType(value as ReceiverType)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-[18px]">
                {receiverType === "FRIEND" ? (
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <select
                      value={selectedFriendshipId}
                      onChange={(event) => setSelectedFriendshipId(event.target.value)}
                      className="focus-ring maeari-input h-[36px] px-3 text-xs text-[#8E93AC]"
                    >
                      <option value="">친구 이름을 검색하거나 선택하세요</option>
                      {friends.map((friend) => (
                        <option key={friend.friendshipId} value={friend.friendshipId}>
                          {friend.nickname}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => router.push("/friends")}
                      className="focus-ring maeari-action h-[36px] px-3 text-xs"
                    >
                      친구 관리
                    </button>
                  </div>
                ) : null}

                {receiverType === "OTHER" ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={receiverName}
                      onChange={(event) => setReceiverName(event.target.value)}
                      placeholder="수신자 이름"
                      className="focus-ring maeari-input h-[36px] px-3 text-xs"
                    />
                    <input
                      value={receiverEmail}
                      onChange={(event) => setReceiverEmail(event.target.value)}
                      placeholder="메일 주소"
                      type="email"
                      className="focus-ring maeari-input h-[36px] px-3 text-xs"
                    />
                    <input
                      value={receiverPhone}
                      onChange={(event) => setReceiverPhone(formatPhoneInput(event.target.value))}
                      placeholder="전화번호"
                      inputMode="tel"
                      maxLength={13}
                      className="focus-ring maeari-input h-[36px] px-3 text-xs"
                    />
                    <select
                      value={preferredChannel}
                      onChange={(event) => setPreferredChannel(event.target.value as PreferredChannel)}
                      className="focus-ring maeari-input h-[36px] px-3 text-xs"
                    >
                      <option value="AUTO">자동 선택</option>
                      <option value="EMAIL">이메일</option>
                      <option value="SMS">문자</option>
                    </select>
                  </div>
                ) : null}

                {receiverType === "SELF" ? (
                  <div className="h-[36px] rounded-[8px] border border-[#E3E5EF] bg-[#FEFDFD] px-3 py-2 text-xs text-[#B4B9CC]">
                    미래의 나에게 마음을 예약해요.
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addRecipientDraft}
                  className="focus-ring maeari-action h-8 px-3 text-xs"
                >
                  <Plus size={14} />
                  수신자 추가
                </button>
                {recipientDrafts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setRecipientDrafts([])}
                    className="focus-ring maeari-action h-8 px-3 text-xs"
                  >
                    목록 비우기
                  </button>
                ) : null}
              </div>

              {recipientDrafts.length > 0 ? (
                <div className="mt-3 grid gap-2 rounded-[8px] bg-[#F8F5FD] p-2">
                  {recipientDrafts.map((draft) => (
                    <div key={draft.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E7E0F2] bg-white px-3 py-2 text-xs text-[#6E738A]">
                      <span className="min-w-0 truncate">
                        {draft.label} · {receiverTypeLabel(draft.payload.type)}
                      </span>
                      <button type="button" onClick={() => removeRecipientDraft(draft.id)} aria-label="수신자 제거" className="focus-ring text-[#9A85E1]">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-[19px]">
              <label className="text-[13px] font-bold text-[#7E83AC]">제목</label>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="제목을 입력해주세요 (최대 50자)"
                className="focus-ring maeari-input mt-[8px] h-[38px] w-full px-3 text-xs"
              />
            </div>

            <div className="mt-[14px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-[#8186B1]">본문</label>
                <span className="text-xs text-[#BCC0D3]">{content.length}/5000</span>
              </div>
              <textarea
                required
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={5000}
                rows={4}
                placeholder={"당신의 마음을 자유롭게 적어주세요.\n따뜻한 한 마디가 누군가의 하루를 비출 수 있어요."}
                className="focus-ring maeari-input mt-[8px] min-h-[112px] w-full resize-y px-4 py-3 text-xs leading-5"
              />
            </div>

            <div className="mt-[18px]">
              <p className="text-[15px] font-medium text-[#797EA8]">감정태그</p>
              <p className="mt-1 text-[11px] text-[#BBBFD2]">
                <span className="mr-1 text-[#F18E90]">•</span>마음에 담긴 가장 가까운 태그를 선택해주세요.
              </p>
              <div className="mt-[9px] grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {emotionOptions.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEmotionTag(value)}
                    className={`focus-ring h-[41px] rounded-[8px] border text-xs font-medium transition ${
                      emotionTag === value ? "border-[#CBBBFA] bg-[#F2EDFD] text-[#9B84F8]" : "border-transparent bg-[#F6F4F9] text-[#9EA2BB] hover:border-[#E0D8F0]"
                    }`}
                  >
                    {emotionIcon(value)} {label}
                  </button>
                ))}
              </div>
              {emotionTag === "CUSTOM" ? (
                <input
                  value={customEmotionTag}
                  onChange={(event) => setCustomEmotionTag(event.target.value)}
                  placeholder="감정 태그"
                  className="focus-ring maeari-input mt-2 h-9 w-full px-3 text-xs"
                />
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as MessageTheme)}
                className="focus-ring maeari-input h-9 px-3 text-xs"
              >
                {themeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="focus-ring maeari-action h-9 text-xs">
                <input
                  type="checkbox"
                  checked={isReplyEnabled}
                  onChange={(event) => setIsReplyEnabled(event.target.checked)}
                  className="mr-2 accent-[#6D48DB]"
                />
                답장 허용
              </label>
            </div>

            <div className="mt-4 rounded-[8px] border border-[#E3E5EF] bg-[#FEFDFD] p-3">
              <label className="focus-ring maeari-action h-8 cursor-pointer px-3 text-xs">
                <ImagePlus size={15} />
                이미지 첨부
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    void handleAttachmentChange(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {attachments.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-[8px] bg-[#F3EFF7] p-2">
                      <img src={attachment.previewUrl} alt="" className="aspect-video w-full rounded-[6px] object-cover" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[11px] text-[#8588A1]">{attachment.fileName}</p>
                        <button type="button" onClick={() => removeAttachment(attachment.id)} className="focus-ring text-[#9A85E1]" aria-label="첨부 이미지 제거">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {serverTimeError ? (
                <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-3">
                  <Notice title="서버 시간을 불러오지 못했어요." body={serverTimeError} tone="danger" />
                  <button type="button" onClick={() => void loadServerDefaultSchedule()} className="focus-ring maeari-action maeari-action-danger mt-2 h-8 px-3 text-xs">
                    다시 시도
                  </button>
                </div>
              ) : contactsLoading ? (
                <Notice title="전화번호 인증 상태를 확인하고 있어요." tone="default" />
              ) : contactsError ? (
                <Notice title={contactsError} tone="danger" />
              ) : !hasVerifiedStrictPhone ? (
                <div className="rounded-[8px] border border-[#D9C8FF] bg-[#F3EEFD] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-[#6D48DB]">
                      <ShieldCheck size={17} />
                      <p className="text-sm font-semibold">전화번호 인증이 필요해요</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/phone-verification?next=/write")}
                      className="focus-ring maeari-action maeari-action-primary h-8 px-3 text-xs"
                    >
                      인증하기
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="figma-panel min-h-[521px] min-w-0 overflow-hidden px-[26px] py-[29px] xl:sticky xl:top-[96px]">
            <h2 className="text-[21px] font-medium text-[#6D71AF]">전달설정</h2>
            <div className="mt-[24px]">
              <label className="text-[13px] font-medium text-[#7D81B1]">전달 예정일</label>
              <input
                required
                type="date"
                value={arrivalDate}
                min={minArrivalDate}
                onChange={(event) => {
                  setArrivalTouched(true);
                  setArrivalDate(event.target.value);
                }}
                className="focus-ring maeari-input mt-[8px] h-[44px] w-full px-3 text-sm text-[#7377AB]"
              />
            </div>

            <div className="mt-[20px]">
              <label className="text-[13px] font-medium text-[#7B80B3]">전달 예정 시간</label>
              <div className="mt-[8px] grid min-w-0 grid-cols-[86px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                <select
                  value={Number(arrivalTime.split(":")[0] || "0") < 12 ? "AM" : "PM"}
                  onChange={(event) => {
                    const [rawHour = "09", minute = "00"] = arrivalTime.split(":");
                    const hour = Number(rawHour);
                    const normalized = event.target.value === "AM" ? hour % 12 : (hour % 12) + 12;
                    setArrivalTouched(true);
                    setArrivalTime(`${String(normalized).padStart(2, "0")}:${minute}`);
                  }}
                  className="focus-ring maeari-input h-[43px] min-w-0 px-2 text-sm text-[#8489B8]"
                >
                  <option value="AM">오전</option>
                  <option value="PM">오후</option>
                </select>
                <input
                  required
                  type="number"
                  min={0}
                  max={23}
                  value={arrivalTime.split(":")[0] || ""}
                  onChange={(event) => {
                    const minute = arrivalTime.split(":")[1] || "00";
                    setArrivalTouched(true);
                    setArrivalTime(`${event.target.value.padStart(2, "0").slice(-2)}:${minute}`);
                  }}
                  aria-label="도착 시"
                  className="focus-ring maeari-input h-[43px] min-w-0 px-3 text-sm text-[#6E72AC]"
                />
                <input
                  required
                  type="number"
                  min={0}
                  max={59}
                  value={arrivalTime.split(":")[1] || ""}
                  onChange={(event) => {
                    const hour = arrivalTime.split(":")[0] || "09";
                    setArrivalTouched(true);
                    setArrivalTime(`${hour}:${event.target.value.padStart(2, "0").slice(-2)}`);
                  }}
                  aria-label="도착 분"
                  className="focus-ring maeari-input h-[43px] min-w-0 px-3 text-sm text-[#7478AD]"
                />
              </div>
              <div className="mt-2 flex gap-1.5">
                {quarterMinuteOptions.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => applyQuarterMinute(minute)}
                    className="focus-ring maeari-chip h-7 flex-1 px-1 text-[11px] !font-normal"
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {presetOptions.slice(0, 4).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="focus-ring maeari-chip min-w-0 break-keep px-2 py-2 text-[11px] !font-normal leading-4"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className={`focus-ring flex h-9 cursor-pointer items-center justify-center rounded-[8px] border text-xs font-normal ${arrivalMode === "FIXED" ? "border-[#CBBBFA] bg-[#F3EEFD] text-[#6D48DB]" : "border-[#E3E5EF] text-[#8588A1]"}`}>
                <input type="radio" name="arrivalMode" checked={arrivalMode === "FIXED"} onChange={() => setArrivalMode("FIXED")} className="sr-only" />
                고정 도착
              </label>
              <label className={`focus-ring flex h-9 cursor-pointer items-center justify-center rounded-[8px] border text-xs font-normal ${arrivalMode === "RANDOM_WINDOW" ? "border-[#CBBBFA] bg-[#F3EEFD] text-[#6D48DB]" : "border-[#E3E5EF] text-[#8588A1]"}`}>
                <input type="radio" name="arrivalMode" checked={arrivalMode === "RANDOM_WINDOW"} onChange={() => setArrivalMode("RANDOM_WINDOW")} className="sr-only" />
                랜덤 도착
              </label>
            </div>

            {arrivalMode === "RANDOM_WINDOW" ? (
              <div className="mt-3 grid gap-2">
                <input
                  required
                  type="date"
                  value={randomEndDate}
                  min={arrivalDate || minArrivalDate}
                  onChange={(event) => setRandomEndDate(event.target.value)}
                  aria-label="랜덤 도착 종료 날짜"
                  className="focus-ring maeari-input h-10 px-3 text-xs"
                />
                <input
                  required
                  type="time"
                  step={60}
                  value={randomEndTime}
                  onChange={(event) => setRandomEndTime(event.target.value)}
                  aria-label="랜덤 도착 종료 시간"
                  className="focus-ring maeari-input h-10 px-3 text-xs"
                />
              </div>
            ) : null}

            <select
              value={hintPreset}
              onChange={(event) => setHintPreset(event.target.value as HintPreset)}
              className="focus-ring maeari-input mt-3 h-10 w-full px-3 text-xs"
            >
              <option value="NONE">도착 전 힌트 알림 없음</option>
              <option value="ONE_HOUR">도착 1시간 전 힌트 알림</option>
              <option value="ONE_DAY">도착 하루 전 힌트 알림</option>
            </select>

            <div className="mt-4 space-y-3 border-t border-[#F3EFF7] pt-4">
              <ToggleRow
                title="익명으로 보내기"
                description="받는 사람에게 내 이름을 숨겨요."
                checked={isSenderHidden}
                onChange={setIsSenderHidden}
              />
              <ToggleRow
                title="도착 예정일 숨기기"
                description="받는 사람에게 도착 예정일을 알려주지 않아요."
                checked={isDateHidden}
                onChange={setIsDateHidden}
              />
            </div>

            <div className="mt-4 min-w-0 break-words rounded-[8px] bg-[#F6F4F9] px-3 py-2 text-[12px] leading-5 text-[#7A80B1] [overflow-wrap:anywhere]">
              {arrivalMode === "RANDOM_WINDOW"
                ? `랜덤 도착: ${scheduledAtDate ? formatKstArrival(scheduledAtDate) : "시작 미정"} ~ ${
                    toDateFromKstInput(randomEndDate, randomEndTime)
                      ? formatKstArrival(toDateFromKstInput(randomEndDate, randomEndTime) as Date)
                      : "종료 미정"
                  }`
                : `도착 예정: ${scheduledAtDate ? formatKstArrival(scheduledAtDate) : "날짜와 시간을 선택해 주세요."}`}
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                contactsLoading ||
                Boolean(contactsError) ||
                !hasVerifiedStrictPhone ||
                serverTimeLoading ||
                Boolean(serverTimeError)
              }
              className="focus-ring maeari-action maeari-action-primary mt-5 h-[42px] w-full disabled:opacity-50"
            >
              <Send size={17} />
              {submitting ? "검사 중" : "마음 보내기"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/sent")}
              className="focus-ring maeari-action mt-2 h-9 w-full text-xs"
            >
              보낸 마음 보기
            </button>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}

function toBrowserPublicUrl(publicUrl: string) {
  try {
    const parsed = new URL(publicUrl);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return publicUrl;
  } catch {
    return publicUrl;
  }
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

function isDomesticPhoneNumber(value: string) {
  return /^0\d{9,10}$/.test(value);
}

function receiverTypeLabel(type: ReceiverType) {
  if (type === "FRIEND") {
    return "친구";
  }

  if (type === "OTHER") {
    return "연락처";
  }

  return "미래의 나";
}

function emotionIcon(value: string) {
  switch (value) {
    case "THANKS":
      return "🌷";
    case "CHEER":
      return "🍀";
    case "CELEBRATION":
      return "🎉";
    case "COMFORT":
      return "🌙";
    case "LONGING":
      return "💧";
    case "LOVE":
      return "💗";
    case "CUSTOM":
      return "•••";
    default:
      return "✦";
  }
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="focus-ring flex w-full items-center justify-between gap-4 rounded-[8px] text-left"
    >
      <span>
        <span className="block text-[13px] font-medium text-[#777CB1]">{title}</span>
        <span className="mt-1 block text-[12px] text-[#B8BCCF]">{description}</span>
      </span>
      <span
        className={`relative h-[30px] w-[51px] shrink-0 rounded-full transition ${checked ? "bg-[#6D48DB]" : "bg-[#D8D8E4]"}`}
      >
        <span
          className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? "left-[24px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

function WriteNoticeDialog({
  notice,
  completedMessage,
  onClose,
  onViewDetail,
  onViewSent,
  onReset,
  onHome,
}: {
  notice: WriteNotice;
  completedMessage: CompletedMessage | null;
  onClose: () => void;
  onViewDetail: (messageId: string) => void;
  onViewSent: () => void;
  onReset: () => void;
  onHome: () => void;
}) {
  const tone = notice.tone ?? "default";
  const isSuccess = tone === "success" && completedMessage;
  const accentClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : tone === "success"
        ? "border-[#D9C8FF] bg-[#F3EEFD] text-[#4E3B91]"
        : "border-[#E4DBF4] bg-white text-[#4E536B]";
  const primaryButtonClass =
    tone === "danger"
      ? "bg-rose-700 text-white"
      : tone === "success"
        ? "bg-brand-sub text-white"
        : "bg-[#6D48DB] text-white";

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#6D48DB]/28 px-4 py-20 backdrop-blur-sm sm:items-center sm:py-8" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="write-notice-title"
        className={`max-h-[calc(100vh-96px)] w-full max-w-lg overflow-y-auto rounded-[8px] border p-5 shadow-[0_24px_60px_rgba(52,40,92,0.22)] ${accentClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {tone === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={22} /> : null}
            <div>
              <h2 id="write-notice-title" className="text-base font-semibold">
                {notice.title}
              </h2>
              {notice.body ? <p className="mt-2 text-sm leading-6 opacity-85">{notice.body}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-current/20 bg-white/70"
            aria-label="팝업 닫기"
          >
            <X size={16} />
          </button>
        </div>

        {isSuccess ? (
          <div className="mt-4 grid gap-3 rounded-[8px] border border-[#D9C8FF] bg-white p-4 text-sm text-[#4E3B91]">
            <p>제목: {completedMessage.title}</p>
            <p>수신자: {completedMessage.receiverLabel}</p>
            <p>도착 예정: {formatKstArrival(completedMessage.scheduledAt)}</p>
            {completedMessage.publicUrl ? (
              <QrShare value={completedMessage.publicUrl} title="공개 도착 QR" fileName={`maeari-message-${completedMessage.id}.png`} />
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isSuccess ? (
            <>
              <button
                type="button"
                onClick={() => onViewDetail(completedMessage.id)}
                className={`focus-ring rounded-[8px] px-3 py-2 text-sm font-semibold ${primaryButtonClass}`}
              >
                예약 상세 보기
              </button>
              <button
                type="button"
                onClick={onViewSent}
                className="hidden"
              >
                보낸 마음 보기
              </button>
              <button
                type="button"
                onClick={onReset}
                className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-[#D9C8FF] bg-white px-3 py-2 text-sm font-semibold text-[#6D48DB]"
              >
                <RotateCcw size={15} />
                새 마음 쓰기
              </button>
              <button
                type="button"
                onClick={onHome}
                className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-[#D9C8FF] bg-white px-3 py-2 text-sm font-semibold text-[#6D48DB]"
              >
                <Home size={15} />
                메인
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className={`focus-ring rounded-[8px] px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}>
              확인
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function createAttachmentDraft(file: File): AttachmentDraft {
  if (!allowedAttachmentMimeTypes.includes(file.type) || !hasAllowedAttachmentExtension(file.name)) {
    throw new Error("이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.");
  }

  if (file.size > maxAttachmentBytes) {
    throw new Error("이미지는 2MB 이하로 첨부해 주세요.");
  }

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    mimeType: file.type as AttachmentDraft["mimeType"],
    sizeBytes: file.size,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function hasAllowedAttachmentExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return allowedAttachmentExtensions.some((extension) => normalized.endsWith(extension));
}

async function fetchServerTimeWithRetry(): Promise<ServerTimeResponse> {
  try {
    return await apiFetch<ServerTimeResponse>("/time");
  } catch (firstError) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));

    try {
      return await apiFetch<ServerTimeResponse>("/time");
    } catch {
      throw firstError;
    }
  }
}

function createPresetDate(key: (typeof presetOptions)[number][0]) {
  const now = new Date();
  const parts = getKstParts(now);
  const rounded = getKstParts(roundToNextKstQuarterHour(now));

  if (key === "todayNight") {
    const todayNight = fromKstParts(parts.year, parts.month, parts.day, 21, 0);
    return todayNight.getTime() > Date.now() ? todayNight : fromKstParts(parts.year, parts.month, parts.day + 1, 21, 0);
  }

  if (key === "tomorrowMorning") {
    return fromKstParts(parts.year, parts.month, parts.day + 1, 9, 0);
  }

  if (key === "tomorrowNight") {
    return fromKstParts(parts.year, parts.month, parts.day + 1, 21, 0);
  }

  if (key === "nextWeek") {
    return fromKstParts(rounded.year, rounded.month, rounded.day + 7, rounded.hour, rounded.minute);
  }

  return fromKstParts(rounded.year, rounded.month + 1, rounded.day, rounded.hour, rounded.minute);
}

function toDateFromKstInput(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const dateParts = dateValue.split("-").map(Number);
  const timeParts = timeValue.split(":").map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const hour = timeParts[0];
  const minute = timeParts[1];

  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    typeof day !== "number" ||
    typeof hour !== "number" ||
    typeof minute !== "number" ||
    ![year, month, day, hour, minute].every(Number.isFinite)
  ) {
    return null;
  }

  return fromKstParts(year, month, day, hour, minute);
}

function roundToNextKstQuarterHour(date: Date) {
  const parts = getKstParts(date);
  const nextMinute = Math.ceil((parts.minute + 1) / 15) * 15;
  const minute = nextMinute >= 60 ? 0 : nextMinute;
  const hour = nextMinute >= 60 ? parts.hour + 1 : parts.hour;
  return fromKstParts(parts.year, parts.month, parts.day, hour, minute);
}

function toKstDateInput(date: Date) {
  const parts = getKstParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function toKstTimeInput(date: Date) {
  const parts = getKstParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function fromKstParts(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
}

function getKstParts(date: Date) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function formatKstNow(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatKstArrival(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
