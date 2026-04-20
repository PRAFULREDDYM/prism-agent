#!/usr/bin/env node

try {
  require("../dist/cli/index.js");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("prism-agent is not built yet. Run `npm install` and `npm run build` first.");
  console.error(message);
  process.exit(1);
}
