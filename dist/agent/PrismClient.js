"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismClient = void 0;
const prism_ai_1 = __importDefault(require("prism-ai"));
const asRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value;
};
const tryParseJson = (raw) => {
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const extractText = (value) => {
    if (!value) {
        return null;
    }
    if (typeof value === "string") {
        return value.trim();
    }
    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => extractText(entry))
            .filter((entry) => Boolean(entry));
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
const extractConversationId = (value) => {
    const record = asRecord(value);
    if (!record) {
        return undefined;
    }
    const conversationId = record.conversation_id;
    return typeof conversationId === "number" ? conversationId : undefined;
};
const extractUsage = (value) => {
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
class PrismClient {
    constructor(apiKey, defaultModel) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
        this.client = (0, prism_ai_1.default)({ api_key: apiKey });
    }
    async send(prompt, options = {}) {
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
exports.PrismClient = PrismClient;
exports.default = PrismClient;
