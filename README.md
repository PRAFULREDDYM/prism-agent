# ◆ Prism Agent

The only AI coding agent that shows you exactly why it answered the way it did.

![npm version](https://img.shields.io/npm/v/prism-agent)
![Publish Status](https://github.com/PRAFULREDDYM/prism-agent/actions/workflows/publish.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

```text
┌─ PRISM AGENT ──────────────────────────────────────────────────┐
│ KNOWLEDGE GRAPH      │ CONVERSATION                            │
│                      │                                         │
│ ◆ security  ████ .91 │ you: fix the auth middleware            │
│ ◆ js        ███  .87 │                                         │
│   └── node  ██   .72 │ ● intent: DEBUG  domains: security,js  │
│                      │ ● tokens in: 312  saved: 148            │
│ [P]in [S]uppress     │                                         │
│                      │ agent: The issue is in line 34...       │
│ session stats:       │                                         │
│ tokens saved: 1,204  │                                         │
│ filler removed: 23   │ > _                                     │
└──────────────────────┴─────────────────────────────────────────┘
```

## Install

```bash
npm install -g prism-agent
prism-agent
```

## What makes it different

Every other coding agent is a black box. You type a prompt, it thinks somewhere off-screen, and you get an answer with no visibility into why that answer happened.

Prism Agent makes the routing layer visible. The left pane shows a live knowledge graph that updates in real time as you work. You can see which domains activated, why they ranked highly, and how they relate to each other. You can also steer the agent directly by pinning domains you always want active or suppressing domains you do not want influencing the next turn.

That means Prism Agent is not just answering your request. It is showing its work.

## Configuration

Set one of these environment variables before starting the full TUI:

- `ANTHROPIC_API_KEY`
- `PRISM_API_KEY`

You can keep the key in a local `.env` file or export it in your shell.

## Powered by prism-ai

Prism Agent is powered by [**prism-ai**](https://www.npmjs.com/package/prism-ai), a zero-token semantic routing engine for Claude.

To install the core engine separately:
```bash
npm install prism-ai
```

It layers on top:

- Claude Code-style tool calling for files, shell, and git
- Prism-inspired prompt routing and live domain scoring
- Session persistence, autosave, and summarization
- An interactive Ink terminal UI with graph steering controls

## Commands

- `prism-agent`
  Starts the full terminal UI.

- `prism-agent start`
  Starts the full terminal UI.

- `prism-agent start --cwd /path/to/repo`
  Opens Prism Agent against a specific repository.

- `prism-agent test "fix the auth middleware in my Express app"`
  Runs a dry routing pass and prints the detected intent, active domains, fragment, and token counts without calling the API.

- `prism-agent history`
  Lists recent saved sessions with token and turn stats.

- `prism-agent resume <id>`
  Resumes a specific saved session.

## Keyboard shortcuts

- `Tab`
  Switch focus between the conversation pane and the knowledge graph pane.

- `P`
  Pin the currently focused domain in the graph pane.

- `S`
  Suppress the currently focused domain in the graph pane.

- `C`
  Clear all domain overrides in the graph pane.

- `Page Up` / `Page Down`
  Scroll the conversation history.

- `Ctrl+S`
  Toggle expanded session stats.

- `Ctrl+L`
  Clear the terminal screen.

- `Ctrl+C`
  Exit Prism Agent.

## Development

```bash
npm install
npm run build
node bin/prism-agent.js test "fix the auth middleware in my Express app"
```

## License

MIT
