// server/signaling-server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuration CORS pour le développement
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

// Stockage des utilisateurs connectés
const connectedUsers = new Map();
const rooms = new Map();

// Route de santé pour vérifier que le serveur fonctionne
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    rooms: rooms.size
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

    // Rejoindre une room générique (pour simplifier la démo)
    const roomName = 'general';
    socket.join(roomName);

    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    rooms.get(roomName).add(socket.id);

    // Notifier les autres utilisateurs
    socket.to(roomName).emit('user-joined', username);
    
    // Envoyer les stats de connexion
    socket.emit('connection-stats', {
      totalUsers: connectedUsers.size,
      roomUsers: rooms.get(roomName)?.size || 0
    });
  });

  // Transmission d'une offre WebRTC
  socket.on('offer', (data) => {
    console.log(`[${new Date().toISOString()}] Offre de ${data.from} vers ${data.to}`);
    
    // Pour cette démo simple, on broadcast à tous les autres dans la room
    socket.to('general').emit('offer', {
      offer: data.offer,
      from: data.from
    });
  });

  // Transmission d'une réponse WebRTC
  socket.on('answer', (data) => {
    console.log(`[${new Date().toISOString()}] Réponse de ${data.from} vers ${data.to}`);
    
    socket.to('general').emit('answer', {
      answer: data.answer,
      from: data.from
    });
  });

  // Transmission des candidats ICE
  socket.on('ice-candidate', (data) => {
    console.log(`[${new Date().toISOString()}] Candidat ICE de ${socket.username}`);
    
    socket.to('general').emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.username
    });
  });

  // Signal de présence (pour l'indicateur "en train de taper")
  socket.on('typing-start', () => {
    socket.to('general').emit('user-typing-start', socket.username);
  });

  socket.on('typing-stop', () => {
    socket.to('general').emit('user-typing-stop', socket.username);
  });

  // Message d'urgence (bypass WebRTC si nécessaire)
  socket.on('emergency-message', (data) => {
    console.log(`[${new Date().toISOString()}] 🚨 MESSAGE D'URGENCE de ${socket.username}: ${data.text}`);
    
    // Broadcast immédiat via le serveur pour garantir la livraison
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
    
    // Nettoyer les données utilisateur
    connectedUsers.delete(socket.id);
    
    // Nettoyer les rooms
    for (let [roomName, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) {
          rooms.delete(roomName);
        } else {
          // Notifier les autres de la déconnexion
          socket.to(roomName).emit('user-left', socket.username);
        }
      }
    }
  });

  // Gestion des erreurs
  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Erreur socket ${socket.id}:`, error);
  });
});

// Gestion globale des erreurs
process.on('uncaughtException', (err) => {
  console.error('Erreur non gérée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejection non gérée:', reason);
});

// Statistiques périodiques
setInterval(() => {
  const stats = {
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    rooms: rooms.size,
    uptime: process.uptime()
  };
  console.log(`[STATS] ${JSON.stringify(stats)}`);
}, 30000); // Toutes les 30 secondes

// Démarrage du serveur
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          🛡️  SERVEUR DE SIGNALISATION        ║
║                                              ║
║  Port: ${PORT}                                  ║
║  URL:  http://localhost:${PORT}                ║
║  Health: http://localhost:${PORT}/health       ║
║                                              ║
║  🔐 Serveur sécurisé pour SecureLink         ║
╚══════════════════════════════════════════════╝
  `);
});

// Export pour les tests
module.exports = { app, server, io };