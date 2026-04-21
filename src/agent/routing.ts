import { Domain, RouteAnalysis } from "../types";

interface DomainDefinition {
  id: string;
  label: string;
  baseScore: number;
  increment: number;
  keywords: string[];
  related: string[];
}

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    id: "security",
    label: "security",
    baseScore: 0.75,
    increment: 0.08,
    keywords: ["auth", "authentication", "authorization", "token", "jwt", "oauth", "session", "login", "middleware", "csrf", "xss", "secret"],
    related: ["javascript", "node"]
  },
  {
    id: "javascript",
    label: "javascript",
    baseScore: 0.71,
    increment: 0.08,
    keywords: ["javascript", "js", "node", "express", "npm", "async", "promise", "react", "middleware", "browser", "frontend", "backend"],
    related: ["node", "typescript", "ui"]
  },
  {
    id: "node",
    label: "node",
    baseScore: 0.6,
    increment: 0.08,
    keywords: ["node", "express", "server", "npm", "cli", "process", "fs", "path", "backend"],
    related: ["javascript", "security", "database"]
  },
  {
    id: "typescript",
    label: "typescript",
    baseScore: 0.62,
    increment: 0.08,
    keywords: ["typescript", "type", "types", "ts", "tsx", "interface", "compiler"],
    related: ["javascript", "ui"]
  },
  {
    id: "ui",
    label: "ui",
    baseScore: 0.58,
    increment: 0.08,
    keywords: ["ui", "ux", "layout", "render", "component", "ink", "terminal", "tui", "react", "view"],
    related: ["javascript", "typescript"]
  },
  {
    id: "testing",
    label: "testing",
    baseScore: 0.6,
    increment: 0.08,
    keywords: ["test", "testing", "spec", "jest", "vitest", "mocha", "assert", "failing"],
    related: ["javascript", "node"]
  },
  {
    id: "git",
    label: "git",
    baseScore: 0.6,
    increment: 0.08,
    keywords: ["git", "commit", "diff", "branch", "merge", "rebase", "stash"],
    related: ["testing"]
  },
  {
    id: "database",
    label: "database",
    baseScore: 0.62,
    increment: 0.08,
    keywords: ["database", "db", "sql", "query", "postgres", "mysql", "sqlite", "prisma", "mongodb"],
    related: ["node", "performance"]
  },
  {
    id: "performance",
    label: "performance",
    baseScore: 0.6,
    increment: 0.08,
    keywords: ["performance", "slow", "latency", "memory", "optimize", "cache", "cpu", "speed"],
    related: ["node", "database", "javascript"]
  }
];

export interface AvailableDomain {
  id: string;
  label: string;
  keywords: string[];
  related: string[];
}

const FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "can",
  "for",
  "from",
  "i",
  "if",
  "in",
  "into",
  "it",
  "just",
  "like",
  "my",
  "of",
  "on",
  "please",
  "should",
  "so",
  "some",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with"
]);

const INTENT_RULES: Array<{ intent: string; keywords: string[] }> = [
  { intent: "DEBUG", keywords: ["fix", "debug", "bug", "broken", "failing", "error", "issue", "crash"] },
  { intent: "REVIEW", keywords: ["review", "audit", "inspect"] },
  { intent: "TEST", keywords: ["test", "spec", "coverage"] },
  { intent: "REFACTOR", keywords: ["refactor", "cleanup", "simplify", "restructure"] },
  { intent: "BUILD", keywords: ["build", "create", "scaffold", "implement", "add"] },
  { intent: "EXPLAIN", keywords: ["explain", "why", "how", "walk through"] }
];

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_\- ]+/g, " ");

const estimateTokens = (value: string): number => Math.max(1, Math.ceil(value.length / 4));

export const detectIntent = (prompt: string): string => {
  const normalized = normalizeText(prompt);

  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.intent;
    }
  }

  return "CHAT";
};

const countFillerWords = (prompt: string): number => {
  const tokens = normalizeText(prompt).split(/\s+/).filter(Boolean);
  return tokens.filter((token) => FILLER_WORDS.has(token)).length;
};

const buildDomain = (definition: DomainDefinition, score: number): Domain => ({
  id: definition.id,
  label: definition.label,
  score: Number(score.toFixed(2)),
  related: definition.related
});

export interface RouteOptions {
  pinnedDomains?: string[];
  suppressedDomains?: string[];
}

export const analyzePrompt = (prompt: string, options: RouteOptions = {}): RouteAnalysis => {
  const normalized = normalizeText(prompt);
  const pinnedDomains = options.pinnedDomains ?? [];
  const suppressedDomains = options.suppressedDomains ?? [];
  const domains: Domain[] = [];

  for (const definition of DOMAIN_DEFINITIONS) {
    const matches = unique(
      definition.keywords.filter((keyword) => normalized.includes(keyword))
    );

    if (!matches.length && !pinnedDomains.includes(definition.id)) {
      continue;
    }

    const score = pinnedDomains.includes(definition.id)
      ? Math.max(0.92, definition.baseScore + matches.length * definition.increment)
      : Math.min(0.95, definition.baseScore + matches.length * definition.increment);

    domains.push(buildDomain(definition, score));
  }

  const suppressedSet = new Set(suppressedDomains);
  const sortedDomains = domains
    .sort((left, right) => right.score - left.score)
    .map((domain) => ({
      ...domain,
      related: (domain.related ?? []).filter((relatedId) =>
        domains.some((candidate) => candidate.id === relatedId)
      )
    }));

  const fillerRemoved = countFillerWords(prompt);
  const saved = Math.max(0, fillerRemoved * 4);

  return {
    intent: detectIntent(prompt),
    activeDomains: sortedDomains.length
      ? sortedDomains
      : [
          {
            id: "general",
            label: "general",
            score: suppressedSet.has("general") ? 0.4 : 0.55,
            related: []
          }
        ],
    fragment: prompt.trim().slice(0, 120),
    tokensIn: estimateTokens(prompt),
    saved,
    fillerRemoved
  };
};

export const formatRouteSummary = (analysis: RouteAnalysis, suppressedDomains: string[] = []): string => {
  const visibleDomains = analysis.activeDomains
    .filter((domain) => !suppressedDomains.includes(domain.id))
    .map((domain) => domain.id)
    .join(",");

  return `intent: ${analysis.intent}  domains: ${visibleDomains || "general"}  tokens_in: ${analysis.tokensIn}  saved: ${analysis.saved}  filler: ${analysis.fillerRemoved}`;
};

export const getAvailableDomains = (): AvailableDomain[] =>
  DOMAIN_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    keywords: [...definition.keywords],
    related: [...definition.related]
  }));
