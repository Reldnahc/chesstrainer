#!/bin/bash
# Keep the Fieldwork container off your LAN. Run as root on the Unraid server, then set
# the container's Network Type to "fieldwork". Firewall rules do not survive a reboot:
# run it again at every array start (User Scripts plugin, "At Startup of Array").
# Running it repeatedly is safe; "isolate-lan.sh remove" deletes the rules again.
#
# Fieldwork still answers its web port and reaches the internet (Chess.com, Lichess,
# model downloads). It can no longer open connections to the Unraid server itself,
# other containers or any private address, so a compromised app cannot reach the
# web UI, SSH, SMB shares or other devices.
set -euo pipefail

NETWORK="${FIELDWORK_NETWORK:-fieldwork}"
SUBNET="${FIELDWORK_SUBNET:-172.31.250.0/24}"
PRIVATE=(10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10)
ACTION="${1:-add}"

# At array start Docker may still be starting.
for _ in $(seq 60); do
    docker info >/dev/null 2>&1 && break
    sleep 5
done

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
    [ "$ACTION" = remove ] && exit 0
    docker network create --driver bridge --subnet "$SUBNET" \
        --opt com.docker.network.bridge.enable_icc=false "$NETWORK" >/dev/null
fi
SUBNET="$(docker network inspect -f '{{(index .IPAM.Config 0).Subnet}}' "$NETWORK")"

rule() {
    if [ "$ACTION" = remove ]; then
        while iptables -C "$@" 2>/dev/null; do iptables -D "$@"; done
    elif ! iptables -C "$@" 2>/dev/null; then
        iptables -I "$@"
    fi
}

# Docker creates DOCKER-USER when it starts; make sure it exists for the rules below.
iptables -N DOCKER-USER 2>/dev/null || true

# New connections to the server itself. Replies to visitors are not new connections.
rule INPUT -s "$SUBNET" -m conntrack --ctstate NEW -j DROP
# New connections to the LAN and other containers. Inserted first, so they end up last.
for range in "${PRIVATE[@]}"; do
    rule DOCKER-USER -s "$SUBNET" -d "$range" -m conntrack --ctstate NEW -j DROP
done
# DNS to the server's own resolvers (often the router) still works, inserted above the drops.
for resolver in $(awk '$1 == "nameserver" {print $2}' /etc/resolv.conf); do
    case "$resolver" in *:* | 127.*) continue ;; esac
    for protocol in udp tcp; do
        rule DOCKER-USER -s "$SUBNET" -d "$resolver" -p "$protocol" --dport 53 -j ACCEPT
    done
done

if [ "$ACTION" = remove ]; then
    echo "Removed the Fieldwork LAN rules for $SUBNET. The $NETWORK network is kept."
else
    echo "Fieldwork network $NETWORK ($SUBNET) can reach the internet but not the LAN."
fi
