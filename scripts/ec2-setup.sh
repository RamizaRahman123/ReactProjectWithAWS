#!/bin/bash
# One-time setup for a fresh Amazon Linux 2023 EC2 instance.
# Installs Docker, Docker Compose, Buildx and Git, and adds swap memory.
# Run with:  sudo bash scripts/ec2-setup.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash scripts/ec2-setup.sh"
  exit 1
fi

echo "==> Installing Docker and Git"
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Pick the right binaries for the CPU (t2/t3 = x86_64, t4g = aarch64)
case "$(uname -m)" in
  x86_64)  COMPOSE_ARCH="x86_64";  BUILDX_ARCH="amd64" ;;
  aarch64) COMPOSE_ARCH="aarch64"; BUILDX_ARCH="arm64" ;;
  *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;;
esac

PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
mkdir -p "$PLUGIN_DIR"

echo "==> Installing Docker Compose plugin"
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}" \
  -o "$PLUGIN_DIR/docker-compose"
chmod +x "$PLUGIN_DIR/docker-compose"

echo "==> Installing Docker Buildx plugin (needed by 'docker compose build')"
BUILDX_VERSION=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
  | grep '"tag_name"' | head -1 | cut -d '"' -f4)
curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${BUILDX_ARCH}" \
  -o "$PLUGIN_DIR/docker-buildx"
chmod +x "$PLUGIN_DIR/docker-buildx"

# t2.micro / t3.micro only have 1 GB RAM; MySQL + Node + Nginx + builds need a safety net
if ! swapon --show | grep -q '/swapfile'; then
  echo "==> Adding 2 GB swap"
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

echo
docker --version
docker compose version
docker buildx version
echo
echo "Setup complete. Log out and log back in so you can run docker without sudo,"
echo "then run:  bash scripts/deploy.sh"
