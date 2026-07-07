#!/bin/bash
exec > /tmp/shot-team-switch-subtle.log 2>&1
set +e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd /Users/andyw/TCLOT/web || exit 9
mkdir -p mockup-shots
rm -f mockup-shots/team-switch-subtle-*.png
rm -rf /tmp/chrome-tss-prof /tmp/chrome-tss.log

"$CHROME" --headless=new --remote-debugging-port=9232 --hide-scrollbars \
  --user-data-dir=/tmp/chrome-tss-prof --window-size=1600,1900 \
  --force-device-scale-factor=2 \
  "file:///Users/andyw/TCLOT/web/public/scorecard-team-switch-subtle.html" > /tmp/chrome-tss.log 2>&1 &
CHROME_PID=$!
echo "CHROME_PID=$CHROME_PID"
WS=""
for i in $(seq 1 40); do
  WS=$(grep -oE "ws://127.0.0.1:9232/devtools/browser/[A-Za-z0-9-]+" /tmp/chrome-tss.log | tail -1)
  [ -n "$WS" ] && break
  sleep 0.3
done
echo "WS=$WS"
node mockup-shots/shoot-team-switch-subtle.mjs "$WS"
echo "NODE_EXIT=$?"
kill "$CHROME_PID" 2>/dev/null
ls -la mockup-shots/team-switch-subtle-*.png 2>/dev/null
echo "ALLDONE"
