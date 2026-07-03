export type ModerationCategories = Record<string, boolean>;

export function getModerationFeedback(categories: ModerationCategories): string {
  const hasAny = (...keys: string[]) => keys.some((key) => categories[key]);

  if (hasAny("hate", "hate/threatening", "harassment", "harassment/threatening")) {
    return "상대방에게 상처를 줄 수 있는 표현이 포함되어 있어요. 조금 더 부드러운 말로 바꿔볼까요?";
  }

  if (hasAny("self-harm", "self-harm/intent", "self-harm/instructions", "violence", "violence/graphic")) {
    return "더 따뜻하고 안전한 표현으로 다듬어보는 건 어떨까요?";
  }

  if (hasAny("sexual", "sexual/minors")) {
    return "받는 사람이 편안하게 읽을 수 있도록 표현을 조금 더 조심스럽게 다듬어 주세요.";
  }

  return "이 메시지는 그대로 전달하기 어려운 표현을 포함하고 있어요. 조금 더 따뜻한 말로 다시 적어볼까요?";
}
