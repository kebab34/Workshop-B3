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
      ip: socket.handshake.address
    });

    // Rejoindre la room mesh
    const roomName = 'mesh-room';
    socket.join(roomName);

    // Informer les autres utilisateurs
    if (connectedUsers.size <= 5) {
      socket.to(roomName).emit('user-joined', username);
    }
    
    // Envoyer les statistiques mesh
    socket.emit('mesh-info', {
      connectedUsers: connectedUsers.size,
      activeConnections: activeConnections.size,
      meshNodes: meshNodes.size,
      localIP: getLocalNetworkIP()
    });
    
    console.log(`[MESH] Total utilisateurs: ${connectedUsers.size}`);
  });

  // Transmission d'une offre WebRTC - Avec gestion mesh
  socket.on('offer', (data) => {
    console.log(`[${new Date().toISOString()}] Offre mesh de ${data.from}`);
    
    // Vérifier s'il n'y a pas déjà une connexion active
    const connectionKey = [data.from, 'partner'].sort().join('-');
    
    if (!activeConnections.has(connectionKey)) {
      activeConnections.set(connectionKey, {
        initiator: data.from,
        timestamp: Date.now(),
        room: 'mesh-room'
      });
      
      // Envoyer à tous les autres utilisateurs dans la room mesh
      const roomSockets = Array.from(io.sockets.adapter.rooms.get('mesh-room') || []);
      const otherSockets = roomSockets.filter(id => id !== socket.id);
      
      if (otherSockets.length > 0) {
        // Sélectionner le premier utilisateur disponible
        const targetSocket = otherSockets[0];
        io.to(targetSocket).emit('offer', {
          offer: data.offer,
          from: data.from
        });
        console.log(`[MESH] Offre routée vers ${targetSocket}`);
      }
    } else {
      console.log(`[MESH] Connexion déjà active pour ${connectionKey}`);
    }
  });

  // Transmission d'une réponse WebRTC
  socket.on('answer', (data) => {
    console.log(`[${new Date().toISOString()}] Réponse mesh de ${data.from}`);
    
    socket.to('mesh-room').emit('answer', {
      answer: data.answer,
      from: data.from
    });
  });

  // Transmission des candidats ICE
  socket.on('ice-candidate', (data) => {
    console.log(`[${new Date().toISOString()}] Candidat ICE mesh`);
    
    socket.to('mesh-room').emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.username
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
    
    // Nettoyer les connexions actives
    if (socket.username) {
      for (let [key, connection] of activeConnections.entries()) {
        if (key.includes(socket.username)) {
          activeConnections.delete(key);
          console.log(`[MESH] Connexion ${key} nettoyée`);
        }
      }
    }
    
    // Nettoyer les utilisateurs connectés
    connectedUsers.delete(socket.id);
    
    // Notifier les autres de la déconnexion
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