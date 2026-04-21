<div align="center">

```
  ██████╗ ██████╗ ██╗███████╗███╗   ███╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗
  ██╔══██╗██╔══██╗██║██╔════╝████╗ ████║    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
  ██████╔╝██████╔╝██║███████╗██╔████╔██║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
  ██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
  ██║     ██║  ██║██║███████║██║ ╚═╝ ██║    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
  ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
```

**The only AI coding agent that shows you exactly why it answered the way it did.**

[![npm version](https://img.shields.io/npm/v/prism-agent.svg?style=flat-square&color=89b4fa)](https://www.npmjs.com/package/prism-agent)
[![Publish Status](https://github.com/PRAFULREDDYM/prism-agent/actions/workflows/publish.yml/badge.svg?style=flat-square)](https://github.com/PRAFULREDDYM/prism-agent/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-a6e3a1.svg?style=flat-square)](LICENSE)

</div>

Prism Agent is a standalone terminal AI coding agent that makes the routing layer visible. Unlike "black box" agents, Prism shows you a live knowledge graph that updates as you work, letting you see exactly which domains activated and why.

<div align="center">

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

</div>

| | Work Visibility | Control | Token Efficiency |
|---|---|---|---|
| Typical Agents | 🌑 Black box | None | 💰 Heavy |
| **Prism Agent** | 🛡️ Live Graph | 📌 Pin/Suppress | 🆓 Zero-token routing |

---

## Installation

```bash
npm install -g prism-agent
```

### Configuration
Set your Anthropic API key before starting:
```bash
export ANTHROPIC_API_KEY=your_key_here
# or add it to a .env file
```

---

## Powered by [prism-ai](https://github.com/PRAFULREDDYM/prism-ai)

Prism Agent is powered by the [**prism-ai**](https://www.npmjs.com/package/prism-ai) core engine. It layers premium agentic features on top:

- **Claude Code-style Tooling**: File system, shell, and git integration.
- **Interactive TUI**: Built with Ink for a high-fidelity terminal experience.
- **Graph Steering**: Real-time domain scoring with manual overrides.
- **Session Persistence**: Autosave and historical session resumption.

---

## Usage

- `prism-agent`: Start the full terminal UI.
- `prism-agent start --cwd /path/to/repo`: Open against a specific repository.
- `prism-agent test "prompt"`: Dry-run routing without API calls.
- `prism-agent history`: List saved sessions and stats.

### Keyboard Shortcuts
- `Tab`: Switch focus between Conversation and Graph panes.
- `P` / `S`: **Pin** or **Suppress** the currently focused domain.
- `C`: Clear all domain overrides.
- `Ctrl+S`: Toggle expanded session stats.
- `Ctrl+C`: Exit.

---

## Contributing

We welcome contributions to the agent's TUI and tool integrations. For routing rules and fillers, please contribute directly to the [prism-ai](https://github.com/PRAFULREDDYM/prism-ai) repository. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup.

---

## License

MIT — see [LICENSE](LICENSE).
