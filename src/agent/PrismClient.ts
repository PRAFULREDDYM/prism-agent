import pai from "prism-ai";

export interface PrismSendOptions {
  conversationId?: number;
  knowledgeBase?: string;
  maxTokens?: number;
  model?: string;
}

export interface PrismSendResult {
  text: string;
  raw: string;
  conversationId?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
};

const tryParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const extractText = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => extractText(entry))
      .filter((entry): entry is string => Boolean(entry));

    return parts.length ? parts.join("\n") : null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const directKeys = ["text", "reply", "response", "message", "content", "completion"];
  for (const key of directKeys) {
    const extracted = extractText(record[key]);
    if (extracted) {
      return extracted;
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const extracted = extractText(choices[0]);
    if (extracted) {
      return extracted;
    }
  }

  return null;
};

const extractConversationId = (value: unknown): number | undefined => {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const conversationId = record.conversation_id;
  return typeof conversationId === "number" ? conversationId : undefined;
};

const extractUsage = (value: unknown): PrismSendResult["usage"] => {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const usage = asRecord(record.usage);
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined
  };
};

export class PrismClient {
  private readonly client: ReturnType<typeof pai>;

  constructor(private readonly apiKey: string, private readonly defaultModel?: string) {
    this.client = pai({ api_key: apiKey });
  }

  async send(prompt: string, options: PrismSendOptions = {}): Promise<PrismSendResult> {
    const response = await this.client.Reply.create({
      prompt,
      conversation_id: options.conversationId,
      knowledge_base: options.knowledgeBase,
      max_tokens: options.maxTokens,
      model: options.model ?? this.defaultModel
    });

    if (response instanceof Error) {
      throw response;
    }

    const raw = await response.text();
    const parsed = tryParseJson(raw);

    return {
      text: extractText(parsed) ?? raw.trim(),
      raw,
      conversationId: extractConversationId(parsed) ?? options.conversationId,
      usage: extractUsage(parsed)
    };
  }
}

export default PrismClient;
