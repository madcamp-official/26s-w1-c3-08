export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }

  return value;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const shouldDispatchLoading = typeof window !== "undefined";

  if (shouldDispatchLoading) {
    const loadingWindow = window as Window & { __maeariPendingApiRequests?: number };
    loadingWindow.__maeariPendingApiRequests = (loadingWindow.__maeariPendingApiRequests ?? 0) + 1;
    window.dispatchEvent(new CustomEvent("maeari:api-start"));
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let body: ApiErrorBody = {};

      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        body = {};
      }

      throw new ApiError(
        response.status,
        body.error?.code ?? "API_ERROR",
        body.error?.message ?? getFallbackErrorMessage(response.status),
        body.error?.details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    if (shouldDispatchLoading) {
      const loadingWindow = window as Window & { __maeariPendingApiRequests?: number };
      loadingWindow.__maeariPendingApiRequests = Math.max(0, (loadingWindow.__maeariPendingApiRequests ?? 1) - 1);
      window.dispatchEvent(new CustomEvent("maeari:api-end"));
    }
  }
}

function getFallbackErrorMessage(status: number) {
  if (status === 413) {
    return "첨부 이미지 용량이 너무 커요. 이미지는 최대 3개, 각 2MB 이하로 첨부해 주세요.";
  }

  return "요청을 완료하지 못했어요.";
}
