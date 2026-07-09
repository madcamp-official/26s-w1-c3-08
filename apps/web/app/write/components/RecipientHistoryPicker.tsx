import type { RecipientHistoryItem } from "@maeari/shared";

type RecipientHistoryPickerProps = {
  recipients: RecipientHistoryItem[];
  loading: boolean;
  error: string | null;
  selectedKey: string;
  onSelect: (recipient: RecipientHistoryItem) => void;
};

export function RecipientHistoryPicker({
  recipients,
  loading,
  error,
  selectedKey,
  onSelect,
}: RecipientHistoryPickerProps) {
  if (!loading && !error && recipients.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[8px] border border-[#ECE7F5] bg-[#FEFDFD] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-[#858AB3]">다시 전하고 싶은 사람</p>
        {loading ? <span className="text-[11px] text-[#B8BCD2]">불러오는 중</span> : null}
      </div>

      {error ? (
        <p className="text-[11px] leading-5 text-[#B0B4CA]">최근 연락처를 잠시 불러오지 못했어요.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {recipients.map((recipient) => {
            const contactLabel = getContactLabel(recipient);
            const isSelected = selectedKey.length > 0 && selectedKey === createRecipientKey(recipient);

            return (
              <button
                key={recipient.id}
                type="button"
                onClick={() => onSelect(recipient)}
                className={`focus-ring min-w-0 rounded-[8px] border px-2.5 py-2 text-left transition ${
                  isSelected
                    ? "border-[#CBBBFA] bg-[#F3EEFD] text-[#6D48DB]"
                    : "border-[#EEE8F7] bg-white text-[#70758F] hover:border-[#D7CCF8]"
                }`}
              >
                <span className="block truncate text-[12px] font-medium">{recipient.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[#A1A6BE]">{contactLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getContactLabel(recipient: RecipientHistoryItem) {
  return [recipient.maskedEmail, recipient.maskedPhone].filter(Boolean).join(" · ") || "연락처";
}

function createRecipientKey(recipient: RecipientHistoryItem) {
  if (recipient.email) {
    return `EMAIL:${recipient.email.trim().toLowerCase()}`;
  }

  if (recipient.phone) {
    return `PHONE:${recipient.phone.replace(/\D/g, "")}`;
  }

  return "";
}
