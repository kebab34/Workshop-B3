// server/signaling-server.js - VERSION CORRIGÉE pour éviter les conflits
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuration CORS pour accepter toutes les connexions
app.use(cors({
  origin: true, // Accepter toutes les origines pour le développement
  methods: ["GET", "POST"],
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: true, // Accepter toutes les origines
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Stockage des utilisateurs et des rooms
const connectedUsers = new Map();
const activeConnections = new Map(); // Pour gérer les connexions P2P actives

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    activeConnections: activeConnections.size
  });
});

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Nouvelle connexion: ${socket.id}`);

  // Enregistrement d'un utilisateur
  socket.on('register', (username) => {
    console.log(`[${new Date().toISOString()}] Utilisateur enregistré: ${username}`);
    
    socket.username = username;
    connectedUsers.set(socket.id, {
      username,
      socketId: socket.id,
      joinedAt: new Date()
    });

    // Rejoindre une room générique
    const roomName = 'general';
    socket.join(roomName);

    // Informer seulement s'il y a moins de 3 utilisateurs (éviter le spam)
    if (connectedUsers.size <= 3) {
      socket.to(roomName).emit('user-joined', username);
    }
    
    console.log(`Total utilisateurs: ${connectedUsers.size}`);
  });

  // Transmission d'une offre WebRTC - AVEC GESTION DES CONFLITS
  socket.on('offer', (data) => {
    console.log(`[${new Date().toISOString()}] Offre de ${data.from}`);
    
    // Vérifier s'il n'y a pas déjà une connexion active
    const connectionKey = [data.from, 'partner'].sort().join('-');
    
    if (!activeConnections.has(connectionKey)) {
      activeConnections.set(connectionKey, {
        initiator: data.from,
        timestamp: Date.now()
      });
      
      // Envoyer seulement au premier autre utilisateur dans la room
      const roomSockets = Array.from(io.sockets.adapter.rooms.get('general') || []);
      const otherSockets = roomSockets.filter(id => id !== socket.id);
      
      if (otherSockets.length > 0) {
        // Prendre seulement le premier autre utilisateur
        const targetSocket = otherSockets[0];
        io.to(targetSocket).emit('offer', {
          offer: data.offer,
          from: data.from
        });
        console.log(`Offre envoyée spécifiquement à ${targetSocket}`);
      }
    } else {
      console.log(`Connexion déjà active pour ${connectionKey}, offre ignorée`);
    }
  });

  // Transmission d'une réponse WebRTC
  socket.on('answer', (data) => {
    console.log(`[${new Date().toISOString()}] Réponse de ${data.from}`);
    
    // Envoyer la réponse à celui qui a initié
    socket.to('general').emit('answer', {
      answer: data.answer,
      from: data.from
    });
  });

  // Transmission des candidats ICE
  socket.on('ice-candidate', (data) => {
    console.log(`[${new Date().toISOString()}] Candidat ICE`);
    
    socket.to('general').emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.username
    });
  });

  // Message d'urgence (bypass WebRTC)
  socket.on('emergency-message', (data) => {
    console.log(`[${new Date().toISOString()}] 🚨 URGENCE de ${socket.username}: ${data.text}`);
    
    socket.to('general').emit('emergency-received', {
      text: data.text,
      from: socket.username,
      timestamp: new Date().toISOString(),
      type: 'emergency'
    });
  });

  // Déconnexion d'un utilisateur
  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Déconnexion: ${socket.id} (${socket.username || 'Anonyme'})`);
    
    // Nettoyer les connexions actives
    if (socket.username) {
      for (let [key, connection] of activeConnections.entries()) {
        if (key.includes(socket.username)) {
          activeConnections.delete(key);
          console.log(`Connexion ${key} nettoyée`);
        }
      }
    }
    
    // Nettoyer les utilisateurs connectés
    connectedUsers.delete(socket.id);
    
    // Notifier les autres de la déconnexion
    socket.to('general').emit('user-left', socket.username);
  });

  // Gestion des erreurs
  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Erreur socket ${socket.id}:`, error);
  });
});

// Nettoyage périodique des connexions inactives
setInterval(() => {
  const now = Date.now();
  for (let [key, connection] of activeConnections.entries()) {
    // Supprimer les connexions de plus de 30 secondes
    if (now - connection.timestamp > 30000) {
      activeConnections.delete(key);
      console.log(`Connexion expirée supprimée: ${key}`);
    }
  }
}, 10000);

// Statistiques périodiques
setInterval(() => {
  const stats = {
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    activeConnections: activeConnections.size,
    uptime: Math.floor(process.uptime())
  };
  console.log(`[STATS] ${JSON.stringify(stats)}`);
}, 30000);

// Démarrage du serveur sur toutes les interfaces
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          🛡️  SERVEUR DE SIGNALISATION        ║
║                                              ║
║  Port: ${PORT}                                  ║
║  Interface: 0.0.0.0 (toutes)                 ║
║  Health: http://localhost:${PORT}/health       ║
║                                              ║
║  🔐 Serveur sécurisé pour SecureLink         ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };