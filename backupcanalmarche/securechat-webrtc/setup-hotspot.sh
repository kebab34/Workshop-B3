#!/bin/bash
# setup-hotspot-fixed.sh

echo "Interface Wi-Fi détectée: wlo1"

# Créer le hotspot avec l'interface correcte
sudo nmcli device wifi hotspot ifname wlo1 ssid SecureLink-Mesh password ultron2025

echo "Hotspot créé !"
echo "SSID: SecureLink-Mesh"
echo "Password: ultron2025"

# Afficher l'IP attribuée
sleep 2
ip addr show wlo1 | grep "inet " | awk '{print "IP du hotspot:", $2}'