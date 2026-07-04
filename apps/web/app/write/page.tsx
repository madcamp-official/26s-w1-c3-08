"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Home, RotateCcw, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
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

type Friend = {
  friendshipId: string;
  userId: string;
  nickname: string;
};

type ReceiverType = "SELF" | "FRIEND" | "OTHER";
type PreferredChannel = "AUTO" | "EMAIL" | "SMS";

type CompletedMessage = {
  id: string;
  title: string;
  receiverLabel: string;
  scheduledAt: Date;
  publicUrl: string | null;
};

const emotionOptions = [
  ["THANKS", "고마움"],
  ["CHEER", "응원"],
  ["CELEBRATION", "축하"],
  ["COMFORT", "위로"],
  ["LONGING", "그리움"],
  ["LOVE", "사랑"],
  ["CUSTOM", "직접 입력"],
];

const presetOptions = [
  ["todayNight", "오늘 밤 9시"],
  ["tomorrowMorning", "내일 아침 9시"],
  ["tomorrowNight", "내일 밤 9시"],
  ["nextWeek", "1주 뒤"],
  ["nextMonth", "1개월 뒤"],
] as const;

const quarterMinuteOptions = ["00", "15", "30", "45"];

export default function WritePage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [receiverType, setReceiverType] = useState<ReceiverType>("SELF");
  const [selectedFriendshipId, setSelectedFriendshipId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>("AUTO");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [emotionTag, setEmotionTag] = useState("THANKS");
  const [customEmotionTag, setCustomEmotionTag] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [isSenderHidden, setIsSenderHidden] = useState(false);
  const [isDateHidden, setIsDateHidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [completedMessage, setCompletedMessage] = useState<CompletedMessage | null>(null);
  const [kstNow, setKstNow] = useState("KST 시간 확인 중");

  const selectedFriend = friends.find((friend) => friend.friendshipId === selectedFriendshipId);
  const scheduledAtDate = useMemo(() => toDateFromKstInput(arrivalDate, arrivalTime), [arrivalDate, arrivalTime]);
  const minArrivalDate = useMemo(() => toKstDateInput(new Date()), []);

  useEffect(() => {
    setArrivalFromDate(roundToNextKstQuarterHour(new Date(Date.now() + 60 * 60 * 1000)));
  }, []);

  useEffect(() => {
    function tick() {
      setKstNow(formatKstNow(new Date()));
    }

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
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
      if (!scheduledAtDate || scheduledAtDate.getTime() <= Date.now()) {
        setNotice({ title: "도착 시간은 현재보다 뒤로 골라 주세요.", tone: "danger" });
        return;
      }

      if (receiverType === "FRIEND" && !selectedFriend) {
        setNotice({ title: "마음을 받을 친구를 선택해 주세요.", tone: "danger" });
        return;
      }

      const sanitizedPhone = sanitizePhoneNumber(receiverPhone);

      if (receiverType === "OTHER" && receiverPhone.trim() && !isDomesticPhoneNumber(sanitizedPhone)) {
        setNotice({ title: "전화번호는 국내 번호 10~11자리로 입력해 주세요.", tone: "danger" });
        return;
      }

      if (receiverType === "OTHER" && preferredChannel === "EMAIL" && !receiverEmail.trim()) {
        setNotice({ title: "이메일 알림을 보내려면 수신자 이메일이 필요해요.", tone: "danger" });
        return;
      }

      if (receiverType === "OTHER" && preferredChannel === "SMS" && !sanitizedPhone) {
        setNotice({ title: "문자 알림을 보내려면 수신자 전화번호가 필요해요.", tone: "danger" });
        return;
      }

      if (receiverType === "OTHER" && preferredChannel === "AUTO" && !receiverEmail.trim() && !sanitizedPhone) {
        setNotice({ title: "연락처로 보내려면 이메일이나 전화번호 중 하나가 필요해요.", tone: "danger" });
        return;
      }

      const response = await apiFetch<CreateMessageResponse>("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverInfo: createReceiverInfo(),
          title,
          content,
          emotionTag,
          customEmotionTag: emotionTag === "CUSTOM" ? customEmotionTag : undefined,
          scheduledAt: scheduledAtDate.toISOString(),
          isSenderHidden,
          isDateHidden,
        }),
      });

      if (response.publicUrl) {
        const browserPublicUrl = toBrowserPublicUrl(response.publicUrl);
        setCompletedMessage({
          id: response.message.id,
          title,
          receiverLabel: getReceiverLabel(),
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

      setNotice({
        title: caught instanceof ApiError ? caught.message : "메시지를 예약하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function createReceiverInfo() {
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
    setTitle("");
    setContent("");
    setEmotionTag("THANKS");
    setCustomEmotionTag("");
    setIsSenderHidden(false);
    setIsDateHidden(false);
    setCompletedMessage(null);
    setNotice(null);
    setArrivalFromDate(roundToNextKstQuarterHour(new Date(Date.now() + 60 * 60 * 1000)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyPreset(key: (typeof presetOptions)[number][0]) {
    setArrivalFromDate(createPresetDate(key));
  }

  function setArrivalFromDate(date: Date) {
    setArrivalDate(toKstDateInput(date));
    setArrivalTime(toKstTimeInput(date));
  }

  function applyQuarterMinute(minute: string) {
    const hour = arrivalTime.split(":")[0] || "09";
    setArrivalTime(`${hour.padStart(2, "0")}:${minute}`);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">마음 쓰기</h1>
          <p className="mt-2 text-sm text-slate-600">지금의 마음을 미래의 순간에 남겨요.</p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <CalendarClock className="text-moss" size={22} />
          <div>
            <p className="text-xs font-semibold text-slate-500">현재 KST</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-ink">{kstNow}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5">
        {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
        {completedMessage ? (
          <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-950">
                  <CheckCircle2 size={20} />
                  <h2 className="text-base font-semibold">예약이 저장됐어요</h2>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-emerald-950">
                  <p>제목: {completedMessage.title}</p>
                  <p>수신자: {completedMessage.receiverLabel}</p>
                  <p>도착 예정: {formatKstArrival(completedMessage.scheduledAt)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/messages/${completedMessage.id}`)}
                  className="focus-ring rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white"
                >
                  예약 상세 보기
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/sent")}
                  className="focus-ring rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-950"
                >
                  보낸 마음 보기
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-950"
                >
                  <RotateCcw size={15} />
                  새 마음 쓰기
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-950"
                >
                  <Home size={15} />
                  메인
                </button>
              </div>
            </div>

            {completedMessage.publicUrl ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-white p-4">
                <p className="text-sm font-semibold text-emerald-950">공개 도착 링크</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  이 링크는 수신자가 로그인하지 않아도 도착 시간 이후 마음을 열어볼 수 있는 주소예요.
                  문자/이메일 발송이 아직 연결되지 않았거나 직접 전달해야 할 때만 필요한 사람에게 공유해 주세요.
                </p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <code className="break-all text-sm text-emerald-950">{completedMessage.publicUrl}</code>
                  <button
                    type="button"
                    onClick={() => completedMessage.publicUrl && void navigator.clipboard.writeText(completedMessage.publicUrl)}
                    className="focus-ring rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white"
                  >
                    링크 복사
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">수신 대상</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="rounded-md border border-slate-200 p-3">
              <input
                type="radio"
                name="receiverType"
                checked={receiverType === "SELF"}
                onChange={() => setReceiverType("SELF")}
                className="mr-2"
              />
              미래의 나
            </label>
            <label className="rounded-md border border-slate-200 p-3">
              <input
                type="radio"
                name="receiverType"
                checked={receiverType === "FRIEND"}
                onChange={() => setReceiverType("FRIEND")}
                className="mr-2"
              />
              친구
            </label>
            <label className="rounded-md border border-slate-200 p-3">
              <input
                type="radio"
                name="receiverType"
                checked={receiverType === "OTHER"}
                onChange={() => setReceiverType("OTHER")}
                className="mr-2"
              />
              연락처로 보내기
            </label>
          </div>

          {receiverType === "FRIEND" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                required
                value={selectedFriendshipId}
                onChange={(event) => setSelectedFriendshipId(event.target.value)}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">친구 선택</option>
                {friends.map((friend) => (
                  <option key={friend.friendshipId} value={friend.friendshipId}>
                    {friend.nickname}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push("/friends")}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                친구 관리
              </button>
            </div>
          ) : null}

          {receiverType === "OTHER" ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <input
                  required
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                  placeholder="수신자 이름"
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                />
                <input
                  value={receiverEmail}
                  onChange={(event) => setReceiverEmail(event.target.value)}
                  placeholder="수신자 이메일"
                  type="email"
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                />
                <input
                  value={receiverPhone}
                  onChange={(event) => setReceiverPhone(formatPhoneInput(event.target.value))}
                  placeholder="수신자 전화번호"
                  inputMode="tel"
                  maxLength={13}
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                />
                <select
                  value={preferredChannel}
                  onChange={(event) => setPreferredChannel(event.target.value as PreferredChannel)}
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="AUTO">자동 선택</option>
                  <option value="EMAIL">이메일 우선</option>
                  <option value="SMS">문자 우선</option>
                </select>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                자동 선택은 이메일이 있으면 이메일을 먼저 사용하고, 이메일이 없으면 문자로 도착 알림을 보내요.
              </p>
            </>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">내용</h2>
          <div className="grid gap-3">
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="제목"
              className="focus-ring rounded-md border border-slate-300 px-3 py-2"
            />
            <textarea
              required
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
              rows={10}
              placeholder="본문"
              className="focus-ring resize-y rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={emotionTag}
                onChange={(event) => setEmotionTag(event.target.value)}
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              >
                {emotionOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {emotionTag === "CUSTOM" ? (
                <input
                  value={customEmotionTag}
                  onChange={(event) => setCustomEmotionTag(event.target.value)}
                  placeholder="감정 태그"
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">도착 설정</h2>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {presetOptions.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {quarterMinuteOptions.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => applyQuarterMinute(minute)}
                  className="focus-ring rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  {minute}분
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                type="date"
                value={arrivalDate}
                min={minArrivalDate}
                onChange={(event) => setArrivalDate(event.target.value)}
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                required
                type="time"
                step={60}
                value={arrivalTime}
                onChange={(event) => setArrivalTime(event.target.value)}
                aria-label="도착 시간"
                className="focus-ring rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              도착 예정: {scheduledAtDate ? formatKstArrival(scheduledAtDate) : "날짜와 시간을 선택해 주세요."}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-md border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={isSenderHidden}
                  onChange={(event) => setIsSenderHidden(event.target.checked)}
                  className="mr-2"
                />
                발신인 숨기기
              </label>
              <label className="rounded-md border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={isDateHidden}
                  onChange={(event) => setIsDateHidden(event.target.checked)}
                  className="mr-2"
                />
                도착일 숨기기
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/sent")}
            className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            발신함
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-petal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send size={17} />
            {submitting ? "검사 중" : "예약하기"}
          </button>
        </div>
      </form>
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
