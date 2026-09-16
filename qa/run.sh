#!/bin/bash
# Suite QA end-to-end contra el Supabase real.
#
#   ./qa/run.sh              todos los scripts
#   ./qa/run.sh clientes     sólo qa/clientes.mjs
#
# Cada script crea sus propios negocios (slug `qa-…`) y los borra al terminar.
set -u
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Falta .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY…)" >&2
  exit 1
fi

if [ $# -gt 0 ]; then
  SCRIPTS=""
  for n in "$@"; do SCRIPTS="$SCRIPTS qa/$n.mjs"; done
else
  SCRIPTS=$(ls qa/*.mjs | grep -v '/lib\.mjs$')
fi

TOTAL_PASS=0; TOTAL_FAIL=0; FAILED=""
for s in $SCRIPTS; do
  echo "═══ $(basename "$s" .mjs) ═══"
  OUT=$(node --env-file=.env.local "$s" 2>&1)
  echo "$OUT" | grep -E "^  ✗|^# |pass,"
  LINE=$(echo "$OUT" | grep -oE "[0-9]+ pass, [0-9]+ fail" | tail -1)
  P=$(echo "$LINE" | grep -oE "^[0-9]+")
  F=$(echo "$LINE" | grep -oE "[0-9]+ fail" | grep -oE "^[0-9]+")
  TOTAL_PASS=$((TOTAL_PASS + ${P:-0})); TOTAL_FAIL=$((TOTAL_FAIL + ${F:-0}))
  [ "${F:-1}" != "0" ] && FAILED="$FAILED $(basename "$s" .mjs)"
  echo
done

echo "═══════════════════════════════════════"
echo "TOTAL: $TOTAL_PASS pass, $TOTAL_FAIL fail"
if [ -n "$FAILED" ]; then echo "CON FALLOS:$FAILED"; exit 1; fi
echo "todo en verde ✅"
