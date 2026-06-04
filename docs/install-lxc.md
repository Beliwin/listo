# Bare-metal / LXC install (no Docker)

Tested on a Debian 12/13 LXC (Proxmox) with Node 24. Runs as an unprivileged
`systemd` service behind Nginx Proxy Manager.

## 1. Prerequisites

```bash
# Node 24 (e.g. via nodesource) + git + build tools for the native SQLite module
apt-get install -y git build-essential python3
corepack enable   # provides pnpm
```

## 2. Get the code & build

```bash
useradd --system --create-home --home-dir /opt/listo listo
sudo -u listo -H bash <<'EOF'
cd /opt/listo
git clone https://github.com/Beliwin/listo.git app
cd app
pnpm install --frozen-lockfile
pnpm build
EOF
mkdir -p /var/lib/listo && chown listo:listo /var/lib/listo
```

## 3. Environment file

```bash
install -o listo -g listo -m 600 /dev/null /etc/listo.env
cat > /etc/listo.env <<EOF
DATA_DIR=/var/lib/listo
INSTANCE_PASSWORD=$(openssl rand -hex 12)
SESSION_SECRET=$(openssl rand -hex 32)
TRUST_PROXY=true
PORT=8787
EOF
chmod 600 /etc/listo.env
```

## 4. systemd unit

```ini
# /etc/systemd/system/listo.service
[Unit]
Description=Listo — shared grocery list
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=listo
Group=listo
EnvironmentFile=/etc/listo.env
WorkingDirectory=/opt/listo/app/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3
# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/listo
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now listo
systemctl status listo
curl -s localhost:8787/healthz   # {"status":"ok",...}
```

## 5. Reverse proxy (Nginx Proxy Manager)

Create a proxy host pointing at `http://<lxc-ip>:8787`, enable SSL (Let's Encrypt),
**Force SSL** and **HTTP/2**. In the **Advanced** tab, add — this is required for the
real-time SSE stream to flow through the proxy:

```nginx
proxy_buffering off;
proxy_read_timeout 1h;
```

## 6. Backup (cron)

```bash
# /etc/cron.daily/listo-backup
#!/bin/sh
sudo -u listo DATA_DIR=/var/lib/listo \
  /usr/bin/node /opt/listo/app/server/dist/index.js backup \
  /var/lib/listo/backups/listo-$(date +\%F).db
find /var/lib/listo/backups -name 'listo-*.db' -mtime +30 -delete
```

## Updating

```bash
sudo -u listo -H bash -c 'cd /opt/listo/app && git pull && pnpm install --frozen-lockfile && pnpm build'
systemctl restart listo
```

> Take a backup before a major update. Migrations run automatically at boot and are
> idempotent.
