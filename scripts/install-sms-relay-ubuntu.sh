#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Run on the NCP Ubuntu server. This installs only the SMS relay and its HTTPS endpoint.
if [[ ${EUID} -ne 0 ]]; then
  echo 'Run this installer with sudo bash.' >&2
  exit 1
fi
source /etc/os-release
if [[ ${ID} != ubuntu || ${VERSION_ID} != 24.04 ]]; then
  echo 'This installer requires Ubuntu 24.04.' >&2
  exit 1
fi
exec 9>/run/lock/carewave-sms-install.lock
flock -n 9 || { echo 'Another CareWave installation is running.' >&2; exit 1; }

relay_host=${1:-carewave-sms.175-106-99-38.sslip.io}
if [[ ! ${relay_host} =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || ${relay_host} != *.* ]]; then
  echo 'Pass a DNS hostname without https:// or a path.' >&2
  exit 1
fi
install_dir=/opt/carewave-sms
config_dir=/etc/carewave-sms
if [[ ! -f /etc/systemd/system/carewave-sms-relay.service ]]; then
  if ss -H -lnt '( sport = :8788 )' | grep -q .; then
    echo 'Port 8788 is already in use. Stop and review the existing service.' >&2
    exit 1
  fi
fi
if [[ ! -f /etc/caddy/carewave-sms.caddy ]]; then
  if ss -H -lnt '( sport = :80 or sport = :443 )' | grep -q .; then
    echo 'An existing web server uses port 80 or 443. Integrate HTTPS with it before continuing.' >&2
    exit 1
  fi
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl xz-utils openssl caddy
install -d -m 755 "$install_dir" "$config_dir"
work_dir=$(mktemp -d)
trap 'rm -f -- "$work_dir"/*; rmdir -- "$work_dir"' EXIT

if [[ ! -x "$install_dir/runtime/bin/node" ]]; then
  case $(uname -m) in
    x86_64) node_arch=x64 ;;
    aarch64) node_arch=arm64 ;;
    *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;;
  esac
  curl -fsS --retry 3 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$work_dir/SHASUMS256.txt"
  node_archive=$(awk -v suffix="-linux-${node_arch}.tar.xz" '$2 ~ /^node-v24\./ && substr($2, length($2)-length(suffix)+1) == suffix { print $2; exit }' "$work_dir/SHASUMS256.txt")
  [[ -n "$node_archive" && "$node_archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]]
  curl -fsS --retry 3 "https://nodejs.org/dist/latest-v24.x/$node_archive" -o "$work_dir/$node_archive"
  (cd "$work_dir"; grep "  $node_archive$" SHASUMS256.txt | sha256sum -c -)
  install -d -m 755 "$install_dir/runtime"
  tar -xJf "$work_dir/$node_archive" --strip-components=1 -C "$install_dir/runtime"
fi
chmod -R a+rX "$install_dir/runtime"

relay_source=https://raw.githubusercontent.com/wldnjs1126/DASH_BOARD/16707d381cadd585a7b75ad1742abb83445f981d/scripts/sms-relay.mjs
curl -fsS --retry 3 "$relay_source" -o "$work_dir/sms-relay.mjs"
echo "d7407fb2944631553228f7e4d026be1548c1d1576fced3ae9a46dc4a5eb7e121  $work_dir/sms-relay.mjs" | sha256sum -c -
install -m 644 "$work_dir/sms-relay.mjs" "$install_dir/sms-relay.mjs"
if [[ ! -f "$config_dir/relay.env" ]]; then
  printf 'CAREWAVE_SMS_RELAY_TOKEN=%s\n' "$(openssl rand -hex 32)" > "$config_dir/relay.env"
fi
chmod 600 "$config_dir/relay.env"

cat > /etc/systemd/system/carewave-sms-relay.service <<'SERVICE'
[Unit]
Description=CareWave SMS relay
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
DynamicUser=yes
EnvironmentFile=/etc/carewave-sms/relay.env
ExecStart=/opt/carewave-sms/runtime/bin/node /opt/carewave-sms/sms-relay.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
UMask=0077

[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable --now carewave-sms-relay
systemctl restart carewave-sms-relay
curl -fsS --retry 8 --retry-connrefused --retry-delay 1 http://127.0.0.1:8788/health

cat > "$work_dir/sms.caddy" <<CADDY
${relay_host} {
  reverse_proxy 127.0.0.1:8788
}
CADDY
cp /etc/caddy/Caddyfile "$work_dir/Caddyfile"
if ! grep -Fxq 'import /etc/caddy/carewave-sms.caddy' "$work_dir/Caddyfile"; then
  printf '\nimport /etc/caddy/carewave-sms.caddy\n' >> "$work_dir/Caddyfile"
fi
if [[ -f /etc/caddy/carewave-sms.caddy ]]; then
  cp /etc/caddy/carewave-sms.caddy "$work_dir/previous.caddy"
fi
install -m 644 "$work_dir/sms.caddy" /etc/caddy/carewave-sms.caddy
if ! caddy validate --config "$work_dir/Caddyfile" --adapter caddyfile; then
  if [[ -f "$work_dir/previous.caddy" ]]; then
    install -m 644 "$work_dir/previous.caddy" /etc/caddy/carewave-sms.caddy
  else
    rm -f /etc/caddy/carewave-sms.caddy
  fi
  echo 'Caddy configuration validation failed. The main Caddyfile was not changed.' >&2
  exit 1
fi
cp -p /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-carewave-$(date +%Y%m%d-%H%M%S)"
install -m 644 "$work_dir/Caddyfile" /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

printf '\nRelay installed. Public HTTPS checks may take a minute.\n'
printf 'CAREWAVE_SMS_RELAY_URL=https://%s/sms\n' "$relay_host"
printf 'Health check: https://%s/health\n' "$relay_host"
printf 'The relay token is in /etc/carewave-sms/relay.env. Copy it directly into Cloudflare Secrets.\n'
printf 'Allow inbound TCP 80/443 in NCP ACG and any host firewall. Keep port 8788 local.\n'
