#!/bin/bash

# Script de lancement SecureChat Mesh
# Usage: ./start-mesh.sh

echo "🛡️  SecureChat Mesh - Démarrage"
echo "=================================="

# Obtenir l'IP locale
LOCAL_IP=$(ip route | grep wlo1 | grep -E "172\.|192\.168\.|10\." | awk '{print $9}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="172.20.10.6"
fi

echo "📍 IP Locale détectée: $LOCAL_IP"

# Démarrer le serveur mesh
echo "🚀 Démarrage du serveur mesh..."
cd server
node mesh-server.js &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 3

# Tester la connexion
echo "🔍 Test de connexion au serveur..."
if curl -s http://$LOCAL_IP:3001/health > /dev/null; then
    echo "✅ Serveur mesh démarré avec succès"
    echo ""
    echo "📱 Pour vos collègues:"
    echo "   URL à ouvrir: http://$LOCAL_IP:3000"
    echo ""
    echo "🔧 Serveur mesh: http://$LOCAL_IP:3001"
    echo "📊 Health check: http://$LOCAL_IP:3001/health"
    echo ""
    echo "💡 Assurez-vous que tous les appareils sont sur le même réseau WiFi"
    echo ""
    
    # Démarrer le client React
    echo "🌐 Démarrage du client web..."
    cd ..
    BROWSER=none npm start
else
    echo "❌ Erreur: Le serveur mesh n'a pas pu démarrer"
    kill $SERVER_PID 2>/dev/null
fi