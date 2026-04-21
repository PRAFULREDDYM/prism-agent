#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CAST_FILE="${SCRIPT_DIR}/prism-demo.cast"
GIF_FILE="${SCRIPT_DIR}/prism-demo.gif"
OPTIMIZED_GIF_FILE="${SCRIPT_DIR}/prism-demo-optimized.gif"
SESSION_SCRIPT="${SCRIPT_DIR}/.recording-session.sh"

export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

rm -f "${CAST_FILE}" "${GIF_FILE}" "${OPTIMIZED_GIF_FILE}" "${SESSION_SCRIPT}"

cat > "${SESSION_SCRIPT}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "◆ PRISM AGENT — Zero-token semantic routing for Claude"
sleep 1
node bin/prism-agent.js test "fix the TypeError in my auth middleware"
sleep 2
node bin/prism-agent.js test "what does the useEffect cleanup function do"
sleep 2
node bin/prism-agent.js test "should I use Redis or Memcached for session storage"
sleep 2
node bin/prism-agent.js test "write a debounce function in TypeScript"
sleep 2
node bin/prism-agent.js domains
sleep 1
EOF

chmod +x "${SESSION_SCRIPT}"
trap 'rm -f "${SESSION_SCRIPT}"' EXIT

cd "${PROJECT_ROOT}"

asciinema rec \
  --overwrite \
  --quiet \
  --headless \
  --return \
  --window-size 120x35 \
  --command "bash ${SESSION_SCRIPT}" \
  "${CAST_FILE}"

agg \
  --theme monokai \
  --font-size 14 \
  --cols 120 \
  --rows 35 \
  "${CAST_FILE}" \
  "${GIF_FILE}"

gifsicle -O3 --colors 64 "${GIF_FILE}" -o "${OPTIMIZED_GIF_FILE}"

FILE_SIZE_BYTES="$(stat -f%z "${OPTIMIZED_GIF_FILE}")"
FILE_SIZE_HUMAN="$(du -h "${OPTIMIZED_GIF_FILE}" | awk '{print $1}')"

echo "Optimized GIF size: ${FILE_SIZE_HUMAN} (${FILE_SIZE_BYTES} bytes)"
