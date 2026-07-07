#!/bin/bash
exec > /tmp/shot-benchswitch.log 2>&1
set +e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd /Users/andyw/TCLOT/web || exit 9
mkdir -p mockup-shots
rm -f mockup-shots/benchswitch-*.png
rm -rf /tmp/chrome-bsw-prof /tmp/chrome-bsw.log
"$CHROME" --headless=new --remote-debugging-port=9233 --hide-scrollbars \
  --user-data-dir=/tmp/chrome-bsw-prof --window-size=1600,1800 \
  --force-device-scale-factor=2 \
  "file:///Users/andyw/TCLOT/web/public/scorecard-benchswitch-options.html" > /tmp/chrome-bsw.log 2>&1 &
CHROME_PID=$!
WS=""
for i in $(seq 1 40); do
  WS=$(grep -oE "ws://127.0.0.1:9233/devtools/browser/[A-Za-z0-9-]+" /tmp/chrome-bsw.log | tail -1)
  [ -n "$WS" ] && break
  sleep 0.3
done
echo "WS=$WS"
node mockup-shots/shoot-benchswitch.mjs "$WS"
echo "NODE_EXIT=$?"
kill "$CHROME_PID" 2>/dev/null
ls -la mockup-shots/benchswitch-*.png 2>/dev/null
echo "ALLDONE"
