import crypto from "node:crypto";
import { NotificationChannel } from "@maeari/database";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  ApiKeyError,
  BadRequestError,
  ClientError,
  MessageNotReceivedError,
  NetworkError,
  ServerError,
  SolapiMessageService,
} from "solapi";
import { config } from "../config/env.js";

export type ExternalNotificationChannel = "EMAIL" | "SMS";

export type SendNotificationInput = {
  channel: ExternalNotificationChannel;
  to: string;
  receiverName: string | null;
  publicUrl: string;
  subject?: string;
  text: string;
  html?: string;
  idempotencyKey: string;
};

export type SendNotificationResult = {
  status: "SENT" | "RETRYABLE_FAILED" | "FAILED";
  provider: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

type McpToolResponse = {
  result?: {
    providerMessageId?: string;
    messageId?: string;
    id?: string;
  };
  error?: {
    code?: string | number;
    message?: string;
  };
};

export class McpNotificationProvider {
  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    if (!config.mcpNotificationEnabled) {
      return {
        status: "FAILED",
        provider: "mcp",
        errorCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED",
        errorMessage: "외부 알림 provider가 설정되지 않아 실제 발송은 생략했습니다.",
      };
    }

    const toolName = input.channel === NotificationChannel.SMS ? config.mcpSmsTool : config.mcpEmailTool;

    if (!config.mcpNotificationServer || !toolName) {
      return {
        status: "FAILED",
        provider: "mcp",
        errorCode: "MCP_TOOL_UNAVAILABLE",
        errorMessage: "MCP 알림 tool 설정을 찾지 못했어요.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      };

      if (config.mcpNotificationApiKey) {
        headers[config.mcpNotificationAuthHeader] = formatAuthValue(config.mcpNotificationApiKey);
      }

      const response = await fetch(config.mcpNotificationServer, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "tools/call",
          params: {
            name: toolName,
            arguments: {
              channel: input.channel,
              to: input.to,
              receiverName: input.receiverName,
              publicUrl: input.publicUrl,
              subject: input.subject,
              text: input.text,
              html: input.html,
              idempotencyKey: input.idempotencyKey,
            },
          },
        }),
        signal: AbortSignal.timeout(config.mcpNotificationTimeoutMs),
      });

      const rawBody = await safeReadText(response);

      if (!response.ok) {
        return mapHttpFailure(response.status, rawBody);
      }

      const body = parseMcpToolResponse(rawBody);

      if (body.error) {
        return {
          status: "FAILED",
          provider: "mcp",
          errorCode: "MCP_PROVIDER_REJECTED",
          errorMessage: body.error.message ?? `MCP provider rejected the request: ${body.error.code ?? "unknown"}`,
        };
      }

      return {
        status: "SENT",
        provider: "mcp",
        providerMessageId: body.result?.providerMessageId ?? body.result?.messageId ?? body.result?.id,
      };
    } catch (error) {
      return {
        status: "RETRYABLE_FAILED",
        provider: "mcp",
        errorCode: "MCP_PROVIDER_TIMEOUT",
        errorMessage: error instanceof Error ? error.message : "MCP provider request failed",
      };
    }
  }
}

export class GmailSmtpNotificationProvider {
  private transporter: Transporter | null = null;

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    if (!config.gmailSmtpEnabled) {
      return {
        status: "FAILED",
        provider: "gmail_smtp",
        errorCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED",
        errorMessage: "Gmail SMTP provider가 설정되지 않아 이메일 발송을 생략했습니다.",
      };
    }

    if (!config.gmailSmtpUser || !config.gmailSmtpAppPassword) {
      return {
        status: "FAILED",
        provider: "gmail_smtp",
        errorCode: "SMTP_AUTH_NOT_CONFIGURED",
        errorMessage: "Gmail SMTP 계정 또는 앱 비밀번호가 설정되지 않았어요.",
      };
    }

    try {
      const info = await this.getTransporter().sendMail({
        from: formatMailAddress(config.gmailSmtpFromName, config.gmailSmtpFromAddress ?? config.gmailSmtpUser),
        to: input.to,
        subject: input.subject ?? "매아리에서 마음이 도착했어요",
        text: input.text,
        html: input.html,
      });

      return {
        status: "SENT",
        provider: "gmail_smtp",
        providerMessageId: typeof info.messageId === "string" ? info.messageId : undefined,
      };
    } catch (error) {
      return mapSmtpFailure(error);
    }
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.gmailSmtpHost,
        port: config.gmailSmtpPort,
        secure: config.gmailSmtpSecure,
        auth: {
          user: config.gmailSmtpUser,
          pass: config.gmailSmtpAppPassword,
        },
        connectionTimeout: config.gmailSmtpConnectionTimeoutMs,
        greetingTimeout: config.gmailSmtpConnectionTimeoutMs,
        socketTimeout: config.gmailSmtpConnectionTimeoutMs,
      });
    }

    return this.transporter;
  }
}

export class SolapiSmsNotificationProvider {
  private messageService: SolapiMessageService | null = null;

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    if (!config.solapiSmsEnabled) {
      return {
        status: "FAILED",
        provider: "solapi",
        errorCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED",
        errorMessage: "Solapi SMS provider가 설정되지 않아 문자 발송을 생략했습니다.",
      };
    }

    if (!config.solapiApiKey || !config.solapiApiSecret || !config.solapiSenderNumber) {
      return {
        status: "FAILED",
        provider: "solapi",
        errorCode: "SOLAPI_AUTH_NOT_CONFIGURED",
        errorMessage: "Solapi API 키, 시크릿 또는 발신번호가 설정되지 않았어요.",
      };
    }

    try {
      const response = await this.getMessageService().send(
        {
          to: input.to,
          from: config.solapiSenderNumber,
          text: input.text,
          autoTypeDetect: true,
        },
        {
          showMessageList: true,
        },
      );

      return {
        status: "SENT",
        provider: "solapi",
        providerMessageId: getSolapiProviderMessageId(response),
      };
    } catch (error) {
      return mapSolapiFailure(error);
    }
  }

  private getMessageService() {
    if (!this.messageService) {
      this.messageService = new SolapiMessageService(config.solapiApiKey ?? "", config.solapiApiSecret ?? "");
    }

    return this.messageService;
  }
}

function getSolapiProviderMessageId(response: unknown) {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const value = response as {
    messageList?: Array<{ messageId?: string }>;
    groupId?: string;
  };

  return value.messageList?.[0]?.messageId ?? value.groupId;
}

export class ExternalNotificationProvider {
  constructor(
    private readonly gmailSmtpProvider: GmailSmtpNotificationProvider,
    private readonly solapiSmsProvider: SolapiSmsNotificationProvider,
    private readonly mcpProvider: McpNotificationProvider,
  ) {}

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    if (input.channel === NotificationChannel.EMAIL && config.gmailSmtpEnabled) {
      return this.gmailSmtpProvider.send(input);
    }

    if (input.channel === NotificationChannel.SMS && config.solapiSmsEnabled) {
      return this.solapiSmsProvider.send(input);
    }

    return this.mcpProvider.send(input);
  }
}

function formatAuthValue(apiKey: string) {
  if (config.mcpNotificationAuthScheme.toLowerCase() === "none") {
    return apiKey;
  }

  return `${config.mcpNotificationAuthScheme} ${apiKey}`;
}

function formatMailAddress(name: string, address: string) {
  const escapedName = name.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escapedName}" <${address}>`;
}

function mapSmtpFailure(error: unknown): SendNotificationResult {
  const smtpError = asSmtpError(error);
  const responseCode = smtpError.responseCode;
  const message = smtpError.message ?? "Gmail SMTP request failed";

  if (smtpError.code === "EAUTH" || responseCode === 534 || responseCode === 535) {
    return {
      status: "FAILED",
      provider: "gmail_smtp",
      errorCode: "SMTP_AUTH_FAILED",
      errorMessage: message,
    };
  }

  if (smtpError.code === "ETIMEDOUT" || smtpError.code === "ECONNRESET" || smtpError.code === "ESOCKET") {
    return {
      status: "RETRYABLE_FAILED",
      provider: "gmail_smtp",
      errorCode: "SMTP_TIMEOUT",
      errorMessage: message,
    };
  }

  if (typeof responseCode === "number" && responseCode >= 500) {
    return {
      status: "FAILED",
      provider: "gmail_smtp",
      errorCode: "SMTP_PERMANENT_FAILURE",
      errorMessage: message,
    };
  }

  if (typeof responseCode === "number" && responseCode >= 400) {
    return {
      status: "RETRYABLE_FAILED",
      provider: "gmail_smtp",
      errorCode: "SMTP_TEMPORARY_FAILURE",
      errorMessage: message,
    };
  }

  return {
    status: "RETRYABLE_FAILED",
    provider: "gmail_smtp",
    errorCode: "SMTP_SEND_FAILED",
    errorMessage: message,
  };
}

function mapSolapiFailure(error: unknown): SendNotificationResult {
  const message = getErrorMessage(error, "Solapi SMS request failed");

  if (error instanceof ApiKeyError) {
    return {
      status: "FAILED",
      provider: "solapi",
      errorCode: "SOLAPI_AUTH_FAILED",
      errorMessage: message,
    };
  }

  if (error instanceof BadRequestError || error instanceof MessageNotReceivedError) {
    const errorCode = classifySolapiPermanentError(error);
    return {
      status: "FAILED",
      provider: "solapi",
      errorCode,
      errorMessage: message,
    };
  }

  if (error instanceof ClientError) {
    const errorCode = classifySolapiClientError(error);
    return {
      status: error.httpStatus === 429 ? "RETRYABLE_FAILED" : "FAILED",
      provider: "solapi",
      errorCode,
      errorMessage: message,
    };
  }

  if (error instanceof NetworkError || error instanceof ServerError) {
    return {
      status: "RETRYABLE_FAILED",
      provider: "solapi",
      errorCode: error instanceof NetworkError ? "SOLAPI_NETWORK_ERROR" : "SOLAPI_SERVER_ERROR",
      errorMessage: message,
    };
  }

  return {
    status: "RETRYABLE_FAILED",
    provider: "solapi",
    errorCode: "SOLAPI_SEND_FAILED",
    errorMessage: message,
  };
}

function classifySolapiPermanentError(error: BadRequestError | MessageNotReceivedError) {
  const text = getErrorMessage(error, "").toLowerCase();

  if (text.includes("balance") || text.includes("cash") || text.includes("잔액") || text.includes("충전")) {
    return "SOLAPI_INSUFFICIENT_BALANCE";
  }

  if (text.includes("from") || text.includes("sender") || text.includes("발신")) {
    return "SOLAPI_INVALID_SENDER";
  }

  if (text.includes("to") || text.includes("phone") || text.includes("수신") || text.includes("번호")) {
    return "SOLAPI_INVALID_RECEIVER";
  }

  return "SOLAPI_PROVIDER_REJECTED";
}

function classifySolapiClientError(error: ClientError) {
  const text = `${error.errorCode} ${error.errorMessage}`.toLowerCase();

  if (error.httpStatus === 401 || error.httpStatus === 403) {
    return "SOLAPI_AUTH_FAILED";
  }

  if (error.httpStatus === 429) {
    return "SOLAPI_RATE_LIMITED";
  }

  if (text.includes("balance") || text.includes("cash") || text.includes("잔액") || text.includes("충전")) {
    return "SOLAPI_INSUFFICIENT_BALANCE";
  }

  if (text.includes("from") || text.includes("sender") || text.includes("발신")) {
    return "SOLAPI_INVALID_SENDER";
  }

  if (text.includes("to") || text.includes("phone") || text.includes("수신") || text.includes("번호")) {
    return "SOLAPI_INVALID_RECEIVER";
  }

  return "SOLAPI_PROVIDER_REJECTED";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}

function asSmtpError(error: unknown) {
  if (error && typeof error === "object") {
    return error as {
      code?: string;
      responseCode?: number;
      message?: string;
    };
  }

  return {
    message: typeof error === "string" ? error : undefined,
  };
}

function mapHttpFailure(status: number, body: string): SendNotificationResult {
  if (status === 401 || status === 403) {
    return {
      status: "FAILED",
      provider: "mcp",
      errorCode: "MCP_PROVIDER_AUTH_FAILED",
      errorMessage: body || "MCP provider authentication failed",
    };
  }

  if (status === 429) {
    return {
      status: "RETRYABLE_FAILED",
      provider: "mcp",
      errorCode: "MCP_PROVIDER_RATE_LIMITED",
      errorMessage: body || "MCP provider rate limited the request",
    };
  }

  return {
    status: status >= 500 ? "RETRYABLE_FAILED" : "FAILED",
    provider: "mcp",
    errorCode: status >= 500 ? "MCP_PROVIDER_TIMEOUT" : "MCP_PROVIDER_REJECTED",
    errorMessage: body || `MCP provider returned HTTP ${status}`,
  };
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseMcpToolResponse(rawBody: string): McpToolResponse {
  const body = rawBody.trim();

  if (!body) {
    return {};
  }

  const directJson = tryParseJson(body);

  if (directJson) {
    return directJson;
  }

  const ssePayload = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line.length > 0 && line !== "[DONE]")
    .at(-1);

  return ssePayload ? tryParseJson(ssePayload) ?? {} : {};
}

function tryParseJson(value: string): McpToolResponse | null {
  try {
    return JSON.parse(value) as McpToolResponse;
  } catch {
    return null;
  }
}

export const gmailSmtpNotificationProvider = new GmailSmtpNotificationProvider();
export const solapiSmsNotificationProvider = new SolapiSmsNotificationProvider();
export const mcpNotificationProvider = new McpNotificationProvider();
export const externalNotificationProvider = new ExternalNotificationProvider(
  gmailSmtpNotificationProvider,
  solapiSmsNotificationProvider,
  mcpNotificationProvider,
);
