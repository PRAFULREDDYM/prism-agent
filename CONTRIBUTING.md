# Contributing to Prism Agent

Thank you for your interest in contributing to the Prism Agent! This agent uses Prism's semantic routing to provide a better terminal coding experience.

## How to Contribute Rules

While the agent is a separate package, it relies on semantic routing rules to understand intent and clean responses. You can contribute to these rules in the `rules/` directory.

### 1. Intent Rules (`rules/intents.json`)

Intents define how the agent classifies your requests. Each intent has a `threshold`, `keywords`, and `patterns` (regex).

**Example addition:**
```json
"DEBUG": {
  "threshold": 2.7,
  "keywords": ["error", "failing", "broken"],
  "patterns": ["\\bnot working\\b", "\\berror\\b"]
}
```

### 2. Filler Patterns (`rules/fillers.json`)

Fillers are common phrases that are removed from the agent's response to keep the terminal output clean and focused.

**Example addition:**
```json
{ "pattern": "^\\s*sure!?\\s*", "label": "", "type": "prefix" }
```

> [!NOTE]
> Contributions to the core routing logic and knowledge domains should be made directly to the [`prism-ai`](https://github.com/PRAFULREDDYM/prism-ai) repository for maximum impact.

## Development Setup

```bash
npm install
npm run build
npm run dev
```

We look forward to your contributions!
