// server/mesh-server.js - Serveur autonome pour réseau mesh local
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Configuration CORS pour accepter toutes les connexions locales
app.use(cors({
  origin: true,
  methods: ["GET", "POST"],
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Stockage des utilisateurs et des connexions
const connectedUsers = new Map();
const activeConnections = new Map();
const meshNodes = new Map(); // Pour tracker les autres nœuds du réseau
const channelRooms = new Map(); // Pour tracker les utilisateurs par canal

// Fonction pour obtenir l'IP locale du hotspot/réseau
const getLocalNetworkIP = () => {
  const interfaces = os.networkInterfaces();
  
  // Chercher l'interface du hotspot en priorité
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('hotspot') || 
        name.toLowerCase().includes('ap0') || 
        name.toLowerCase().includes('wlo1')) {  // <-- MODIFIÉ ICI
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  
  // Sinon, chercher n'importe quelle interface locale
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Privilégier les adresses de réseau local
        if (iface.address.startsWith('192.168.') || 
            iface.address.startsWith('172.20.') || 
            iface.address.startsWith('10.42.') ||
            iface.address.startsWith('10.')) {
          return iface.address;
        }
      }
    }
  }
  
  // IP par défaut pour votre hotspot Linux
  return '10.42.0.1';  // <-- MODIFIÉ ICI
};

// Route de santé avec informations mesh
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    mode: 'mesh',
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    activeConnections: activeConnections.size,
    localIP: getLocalNetworkIP(),
    uptime: Math.floor(process.uptime()),
    meshNodes: meshNodes.size,
    version: '1.0.0-mesh'
  });
});

// Route pour découvrir les nœuds du réseau
app.get('/nodes', (req, res) => {
  const nodeList = Array.from(meshNodes.values());
  res.json({
    nodes: nodeList,
    count: nodeList.length
  });
});

// Route pour annoncer ce nœud aux autres
app.post('/announce', express.json(), (req, res) => {
  const { ip, port, users } = req.body;
  
  if (ip && port) {
    meshNodes.set(`${ip}:${port}`, {
      ip,
      port,
      users: users || 0,
      lastSeen: new Date(),
      url: `http://${ip}:${port}`
    });
    
    console.log(`[MESH] Nouveau nœud découvert: ${ip}:${port}`);
  }
  
  res.json({ success: true });
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Nouvelle connexion mesh: ${socket.id}`);

  // Enregistrement d'un utilisateur
  socket.on('register', (username) => {
    console.log(`[${new Date().toISOString()}] Utilisateur mesh: ${username}`);
    
    socket.username = username;
    connectedUsers.set(socket.id, {
      username,
      socketId: socket.id,
      joinedAt: new Date(),
      ip: socket.handshake.address,
      currentChannel: null // Ajout du canal actuel
    });

    // Rejoindre la room mesh générale
    const roomName = 'mesh-room';
    socket.join(roomName);

    // Envoyer les statistiques mesh
    socket.emit('mesh-info', {
      connectedUsers: connectedUsers.size,
      activeConnections: activeConnections.size,
      meshNodes: meshNodes.size,
      localIP: getLocalNetworkIP()
    });
    
    console.log(`[MESH] Total utilisateurs: ${connectedUsers.size}`);
  });

  // Rejoindre un canal spécifique
  socket.on('join-channel', (data) => {
    const { channelId, channelName } = data;
    const user = connectedUsers.get(socket.id);
    
    if (!user) return;
    
    console.log(`[MESH] ${user.username} rejoint le canal: ${channelName || channelId}`);
    
    // Quitter l'ancien canal s'il y en a un
    if (user.currentChannel) {
      socket.leave(`channel-${user.currentChannel}`);
      console.log(`[MESH] ${user.username} quitte le canal: ${user.currentChannel}`);
    }
    
    // Rejoindre le nouveau canal
    const roomName = `channel-${channelId}`;
    socket.join(roomName);
    user.currentChannel = channelId;
    
    // Mettre à jour les statistiques du canal
    if (!channelRooms.has(channelId)) {
      channelRooms.set(channelId, new Set());
    }
    channelRooms.get(channelId).add(socket.id);
    
    // Informer les autres utilisateurs du canal
    socket.to(roomName).emit('user-joined-channel', {
      username: user.username,
      channelId: channelId
    });
    
    // Envoyer la liste des utilisateurs du canal
    const channelUsers = Array.from(channelRooms.get(channelId))
      .map(socketId => connectedUsers.get(socketId))
      .filter(u => u)
      .map(u => u.username);
    
    socket.emit('channel-users', channelUsers);
    
    console.log(`[MESH] Canal ${channelId}: ${channelUsers.length} utilisateurs`);
  });

  // Transmission d'une offre WebRTC - Avec gestion par canal
  socket.on('offer', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.currentChannel) {
      console.log(`[MESH] Offre ignorée - utilisateur pas dans un canal`);
      return;
    }
    
    console.log(`[${new Date().toISOString()}] Offre mesh de ${data.from} dans canal ${user.currentChannel}`);
    
    const roomName = `channel-${user.currentChannel}`;
    const connectionKey = [data.from, user.currentChannel].sort().join('-');
    
    if (!activeConnections.has(connectionKey)) {
      activeConnections.set(connectionKey, {
        initiator: data.from,
        timestamp: Date.now(),
        room: roomName
      });
      
      // Envoyer à tous les autres utilisateurs dans le même canal
      socket.to(roomName).emit('offer', {
        offer: data.offer,
        from: data.from,
        channelId: user.currentChannel
      });
      console.log(`[MESH] Offre routée dans canal ${user.currentChannel}`);
    } else {
      console.log(`[MESH] Connexion déjà active pour ${connectionKey}`);
    }
  });

  // Transmission d'une réponse WebRTC
  socket.on('answer', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.currentChannel) return;
    
    console.log(`[${new Date().toISOString()}] Réponse mesh de ${data.from} dans canal ${user.currentChannel}`);
    
    const roomName = `channel-${user.currentChannel}`;
    socket.to(roomName).emit('answer', {
      answer: data.answer,
      from: data.from,
      channelId: user.currentChannel
    });
  });

  // Transmission des candidats ICE
  socket.on('ice-candidate', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.currentChannel) return;
    
    console.log(`[${new Date().toISOString()}] Candidat ICE mesh dans canal ${user.currentChannel}`);
    
    const roomName = `channel-${user.currentChannel}`;
    socket.to(roomName).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.username,
      channelId: user.currentChannel
    });
  });

  // Message d'urgence mesh (broadcast à tous les nœuds)
  socket.on('emergency-message', (data) => {
    console.log(`[${new Date().toISOString()}] 🚨 URGENCE MESH de ${socket.username}: ${data.text}`);
    
    // Broadcast dans le nœud local
    socket.to('mesh-room').emit('emergency-received', {
      text: data.text,
      from: socket.username,
      timestamp: new Date().toISOString(),
      type: 'emergency',
      meshNode: getLocalNetworkIP()
    });

    // TODO: Propager vers les autres nœuds mesh si nécessaire
  });

  // Demande de scan réseau
  socket.on('scan-mesh-network', async () => {
    console.log(`[MESH] Scan réseau demandé par ${socket.username}`);
    
    // Retourner les nœuds connus
    const nodeList = Array.from(meshNodes.values());
    socket.emit('mesh-nodes-found', nodeList);
  });

  // Déconnexion d'un utilisateur
  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Déconnexion mesh: ${socket.id} (${socket.username || 'Anonyme'})`);
    
    const user = connectedUsers.get(socket.id);
    
    if (user) {
      // Nettoyer les connexions actives
      for (let [key, connection] of activeConnections.entries()) {
        if (key.includes(user.username)) {
          activeConnections.delete(key);
          console.log(`[MESH] Connexion ${key} nettoyée`);
        }
      }
      
      // Retirer l'utilisateur du canal
      if (user.currentChannel) {
        const channelUsers = channelRooms.get(user.currentChannel);
        if (channelUsers) {
          channelUsers.delete(socket.id);
          if (channelUsers.size === 0) {
            channelRooms.delete(user.currentChannel);
          }
        }
        
        // Notifier les autres utilisateurs du canal
        socket.to(`channel-${user.currentChannel}`).emit('user-left-channel', {
          username: user.username,
          channelId: user.currentChannel
        });
      }
    }
    
    // Nettoyer les utilisateurs connectés
    connectedUsers.delete(socket.id);
    
    // Notifier les autres de la déconnexion générale
    socket.to('mesh-room').emit('user-left', socket.username);
  });

  // Gestion des erreurs
  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Erreur socket mesh ${socket.id}:`, error);
  });
});

// Fonction de découverte automatique des autres nœuds mesh
const discoverMeshNodes = async () => {
  const currentIP = getLocalNetworkIP();
  const subnet = currentIP.substring(0, currentIP.lastIndexOf('.'));
  
  console.log(`[MESH] Scan du réseau ${subnet}.x pour découverte automatique...`);
  
  // Scanner les IPs communes du subnet
  const commonIPs = [
    `${subnet}.1`,   // Gateway habituel
    `${subnet}.2`,   // Souvent le premier client
    `${subnet}.10`,  // IP souvent utilisée
    `${subnet}.100`, // IP souvent utilisée
  ];
  
  for (const ip of commonIPs) {
    if (ip === currentIP) continue; // Skip notre propre IP
    
    try {
      const response = await fetch(`http://${ip}:3001/health`, {
        method: 'GET',
        timeout: 2000
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.mode === 'mesh') {
          meshNodes.set(`${ip}:3001`, {
            ip,
            port: 3001,
            users: data.connectedUsers || 0,
            lastSeen: new Date(),
            url: `http://${ip}:3001`,
            uptime: data.uptime
          });
          console.log(`[MESH] Nœud mesh découvert: ${ip}:3001`);
        }
      }
    } catch (error) {
      // Pas de nœud sur cette IP, continuer
    }
  }
};

// Nettoyage périodique des connexions et nœuds inactifs
setInterval(() => {
  const now = Date.now();
  
  // Nettoyer les connexions expirées
  for (let [key, connection] of activeConnections.entries()) {
    if (now - connection.timestamp > 60000) { // 1 minute
      activeConnections.delete(key);
      console.log(`[MESH] Connexion expirée: ${key}`);
    }
  }
  
  // Nettoyer les nœuds mesh inactifs
  for (let [key, node] of meshNodes.entries()) {
    if (now - new Date(node.lastSeen).getTime() > 300000) { // 5 minutes
      meshNodes.delete(key);
      console.log(`[MESH] Nœud inactif retiré: ${key}`);
    }
  }
}, 30000);

// Découverte périodique des nœuds mesh
setInterval(discoverMeshNodes, 120000); // Toutes les 2 minutes

// Statistiques périodiques
setInterval(() => {
  const stats = {
    timestamp: new Date().toISOString(),
    mode: 'mesh',
    localIP: getLocalNetworkIP(),
    connectedUsers: connectedUsers.size,
    activeConnections: activeConnections.size,
    meshNodes: meshNodes.size,
    uptime: Math.floor(process.uptime())
  };
  console.log(`[MESH-STATS] ${JSON.stringify(stats)}`);
}, 60000);

// Démarrage du serveur mesh
const PORT = process.env.PORT || 3001;
const MESH_IP = getLocalNetworkIP();

// Découverte initiale après démarrage
setTimeout(discoverMeshNodes, 5000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          🛡️ SERVEUR MESH AUTONOME            ║
║                                              ║
║  Mode: Réseau maillé local                   ║
║  IP Locale: ${MESH_IP}:${PORT}                    ║
║  Écoute sur: 0.0.0.0:${PORT} (toutes interfaces) ║
║                                              ║
║  Pour les clients:                           ║
║  • Se connecter au Wi-Fi "SecureLink-Mesh"   ║
║  • Ouvrir: http://${MESH_IP}:3000              ║
║                                              ║
║  Health check: http://${MESH_IP}:${PORT}/health    ║
║  🔐 Réseau sécurisé post-Ultron              ║
╚══════════════════════════════════════════════╝
  `);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n[MESH] Arrêt du serveur mesh...');
  server.close(() => {
    console.log('[MESH] Serveur mesh arrêté proprement');
    process.exit(0);
  });
});

module.exports = { app, server, io, getLocalNetworkIP };