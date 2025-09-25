// mesh-server-unified.js - Serveur complet WebRTC + Synchronisation
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuration CORS pour Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===============================================
// STOCKAGE EN MÉMOIRE
// ===============================================
let connectedUsers = new Map(); // username -> user data (TOUJOURS visibles, même dans un canal)
let customChannels = new Map(); // channelId -> channel data
let channelStats = new Map(); // channelId -> user count (pour statistiques des canaux)
let channelUsers = new Map(); // channelId -> Set of usernames (utilisateurs actuellement dans chaque canal)
let userSockets = new Map(); // username -> socket.id

// IMPORTANT: Les utilisateurs restent dans connectedUsers même quand ils sont dans un canal.
// Seule la déconnexion complète les supprime de cette liste.

// ===============================================
// FONCTIONS UTILITAIRES
// ===============================================
const broadcastUsersList = () => {
  const users = Array.from(connectedUsers.values());
  io.emit('users-list', users);
  console.log(`[SERVER] Broadcasting ${users.length} users`);
};

const broadcastChannelsList = () => {
  const channels = Array.from(customChannels.values());
  io.emit('channels-list', channels);
  console.log(`[SERVER] Broadcasting ${channels.length} custom channels`);
};

const broadcastChannelStats = () => {
  const stats = Object.fromEntries(channelStats);
  io.emit('channel-stats', stats);
};

const getChannelUsers = (channelId) => {
  return Array.from(channelUsers.get(channelId) || []);
};

// ===============================================
// GESTION DES CONNEXIONS SOCKET.IO
// ===============================================
io.on('connection', (socket) => {
  console.log(`[SERVER] Nouvelle connexion: ${socket.id}`);
  
  let currentUser = null;
  let currentChannel = null;

  // ==========================================
  // ÉVÉNEMENTS DE SYNCHRONISATION (HomePage)
  // ==========================================
  
  // Enregistrement d'un utilisateur pour la synchronisation
  socket.on('register-user', (userData) => {
    console.log(`[SYNC] Enregistrement utilisateur:`, userData);
    
    const user = {
      id: socket.id,
      username: userData.username,
      socketId: socket.id,
      status: 'online',
      currentChannel: null,
      connectedSince: userData.timestamp || new Date().toISOString()
    };

    connectedUsers.set(userData.username, user);
    userSockets.set(userData.username, socket.id);
    socket.username = userData.username;
    currentUser = userData.username;
    
    // Notifier les autres utilisateurs
    socket.broadcast.emit('user-joined', user);
    
    // Envoyer les données au nouvel utilisateur
    socket.emit('users-list', Array.from(connectedUsers.values()));
    socket.emit('channels-list', Array.from(customChannels.values()));
    
    console.log(`[SYNC] Utilisateur ${userData.username} enregistré`);
  });

  // Création d'un canal
  socket.on('create-channel', (channelData) => {
    console.log('[SYNC] Nouveau canal créé:', channelData);
    
    const channel = {
      ...channelData,
      createdAt: new Date().toISOString(),
      users: 0
    };
    
    customChannels.set(channel.id, channel);
    channelStats.set(channel.id, 0);
    channelUsers.set(channel.id, new Set());
    
    // Notifier tous les clients
    io.emit('channel-created', channel);
    broadcastChannelsList();
  });

  // Utilisateur rejoint un canal (depuis HomePage)
  socket.on('user-join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) return;
    
    console.log(`[SYNC] ${username} rejoint le canal ${channelName} depuis HomePage`);
    
    // Mettre à jour l'utilisateur SANS le supprimer de la liste générale
    const user = connectedUsers.get(username);
    if (user) {
      // Quitter l'ancien canal (stats seulement)
      if (user.currentChannel) {
        const oldChannelId = user.currentChannel;
        const oldChannelUsers = channelUsers.get(oldChannelId) || new Set();
        oldChannelUsers.delete(username);
        channelStats.set(oldChannelId, oldChannelUsers.size);
      }
      
      // Rejoindre le nouveau canal (stats seulement)
      user.currentChannel = channelName; // Garder l'utilisateur dans la liste
      connectedUsers.set(username, user); // L'utilisateur reste connecté
      
      // Mettre à jour les stats du canal
      const newChannelUsers = channelUsers.get(channelId) || new Set();
      newChannelUsers.add(username);
      channelUsers.set(channelId, newChannelUsers);
      channelStats.set(channelId, newChannelUsers.size);
      channelStats.set(channelName, newChannelUsers.size);
    }
    
    // Notifier le changement de canal, pas la déconnexion
    io.emit('user-channel-changed', { username, channelName });
    broadcastChannelStats();
    broadcastUsersList(); // Renvoyer la liste complète avec l'utilisateur dedans
  });

  // ==========================================
  // ÉVÉNEMENTS WEBRTC (Chat)
  // ==========================================
  
  // Enregistrement d'un utilisateur pour WebRTC
  socket.on('register', (username) => {
    console.log(`[WEBRTC] Enregistrement WebRTC: ${username}`);
    socket.username = username;
    currentUser = username;
    
    // Si pas déjà enregistré pour la sync, l'ajouter
    if (!connectedUsers.has(username)) {
      const user = {
        id: socket.id,
        username: username,
        socketId: socket.id,
        status: 'online',
        currentChannel: null,
        connectedSince: new Date().toISOString()
      };
      
      connectedUsers.set(username, user);
      userSockets.set(username, socket.id);
      socket.broadcast.emit('user-joined', user);
      broadcastUsersList();
    }
  });

  // Rejoindre un canal pour WebRTC
  socket.on('join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) return;
    
    console.log(`[WEBRTC] ${username} rejoint le canal WebRTC: ${channelName}`);
    
    // Quitter l'ancien canal WebRTC (sans supprimer l'utilisateur de la liste)
    if (currentChannel) {
      socket.leave(currentChannel);
      const oldUsers = channelUsers.get(currentChannel) || new Set();
      oldUsers.delete(username);
      channelUsers.set(currentChannel, oldUsers);
      channelStats.set(currentChannel, oldUsers.size);
      
      // Notifier l'ancien canal
      socket.to(currentChannel).emit('user-left-channel', {
        username: username,
        channelId: currentChannel
      });
    }
    
    // Rejoindre le nouveau canal WebRTC
    currentChannel = channelId || channelName;
    socket.join(currentChannel);
    
    // Mettre à jour les utilisateurs du canal
    const channelUserSet = channelUsers.get(currentChannel) || new Set();
    channelUserSet.add(username);
    channelUsers.set(currentChannel, channelUserSet);
    channelStats.set(currentChannel, channelUserSet.size);
    
    // Mettre à jour l'utilisateur dans la liste générale (il reste connecté)
    const user = connectedUsers.get(username);
    if (user) {
      user.currentChannel = channelName; // Garder l'utilisateur connecté
      connectedUsers.set(username, user);
    }
    
    // Notifier le nouveau canal
    socket.to(currentChannel).emit('user-joined-channel', {
      username: username,
      channelId: currentChannel
    });
    
    // Envoyer la liste des utilisateurs du canal
    const users = getChannelUsers(currentChannel);
    io.to(currentChannel).emit('channel-users', users);
    
    // Mettre à jour les stats globales (utilisateur reste visible)
    broadcastChannelStats();
    broadcastUsersList(); // L'utilisateur reste dans la liste générale
    
    console.log(`[WEBRTC] ${username} dans le canal ${currentChannel}, ${users.length} utilisateurs total`);
    console.log(`[WEBRTC] ${username} reste visible dans la liste générale des utilisateurs connectés`);
  });

  // Quitter un canal
  socket.on('leave-channel', () => {
    if (currentChannel && socket.username) {
      console.log(`[WEBRTC] ${socket.username} quitte le canal ${currentChannel}`);
      
      socket.leave(currentChannel);
      
      // Mettre à jour les stats du canal
      const channelUserSet = channelUsers.get(currentChannel) || new Set();
      channelUserSet.delete(socket.username);
      channelUsers.set(currentChannel, channelUserSet);
      channelStats.set(currentChannel, channelUserSet.size);
      
      // Notifier le canal
      socket.to(currentChannel).emit('user-left-channel', {
        username: socket.username,
        channelId: currentChannel
      });
      
      // Mettre à jour l'utilisateur (il reste connecté, juste plus dans un canal)
      const user = connectedUsers.get(socket.username);
      if (user) {
        user.currentChannel = null; // Plus dans un canal spécifique
        connectedUsers.set(socket.username, user); // Mais reste connecté
      }
      
      currentChannel = null;
      broadcastChannelStats();
      broadcastUsersList(); // L'utilisateur reste visible
      
      console.log(`[WEBRTC] ${socket.username} a quitté le canal mais reste connecté`);
    }
  });

  // Offre WebRTC
  socket.on('offer', (data) => {
    console.log(`[WEBRTC] Offre de ${data.from} pour le canal ${data.channelId}`);
    if (currentChannel) {
      socket.to(currentChannel).emit('offer', data);
    }
  });

  // Réponse WebRTC
  socket.on('answer', (data) => {
    console.log(`[WEBRTC] Réponse de ${data.from} pour le canal ${data.channelId}`);
    if (currentChannel) {
      socket.to(currentChannel).emit('answer', data);
    }
  });

  // Candidats ICE
  socket.on('ice-candidate', (data) => {
    if (currentChannel) {
      socket.to(currentChannel).emit('ice-candidate', data);
    }
  });

  // Messages via Socket.IO (fallback)
  socket.on('send-message', (message) => {
    if (currentChannel) {
      console.log(`[WEBRTC] Message de ${message.sender}: ${message.text}`);
      socket.to(currentChannel).emit('message-received', message);
    }
  });

  // ==========================================
  // ÉVÉNEMENTS GÉNÉRIQUES
  // ==========================================
  
  socket.on('get-users-list', () => {
    socket.emit('users-list', Array.from(connectedUsers.values()));
  });

  socket.on('get-channels-list', () => {
    socket.emit('channels-list', Array.from(customChannels.values()));
  });

  socket.on('get-channel-stats', () => {
    broadcastChannelStats();
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  // ==========================================
  // GESTION DE LA DÉCONNEXION
  // ==========================================
  socket.on('disconnect', (reason) => {
    const username = socket.username;
    
    if (username) {
      console.log(`[SERVER] Déconnexion de ${username}: ${reason}`);
      
      // Quitter le canal actuel
      if (currentChannel) {
        const channelUserSet = channelUsers.get(currentChannel) || new Set();
        channelUserSet.delete(username);
        channelUsers.set(currentChannel, channelUserSet);
        channelStats.set(currentChannel, channelUserSet.size);
        
        socket.to(currentChannel).emit('user-left-channel', {
          username: username,
          channelId: currentChannel
        });
      }
      
      // Supprimer l'utilisateur des listes
      connectedUsers.delete(username);
      userSockets.delete(username);
      
      // Notifier les autres clients
      socket.broadcast.emit('user-left', { username, id: socket.id });
      broadcastChannelStats();
      
      console.log(`[SERVER] ${username} supprimé, ${connectedUsers.size} utilisateurs restants`);
    }
  });
});

// ===============================================
// ROUTES HTTP API
// ===============================================
app.get('/api/users', (req, res) => {
  res.json(Array.from(connectedUsers.values()));
});

app.get('/api/channels', (req, res) => {
  const channels = Array.from(customChannels.values());
  res.json(channels);
});

app.get('/api/channel/:channelId/users', (req, res) => {
  const channelId = req.params.channelId;
  const users = getChannelUsers(channelId);
  res.json(users);
});

app.get('/api/stats', (req, res) => {
  res.json({
    connectedUsers: connectedUsers.size,
    customChannels: customChannels.size,
    channelStats: Object.fromEntries(channelStats),
    totalChannels: customChannels.size + 4 // +4 pour les canaux par défaut
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    connectedUsers: connectedUsers.size,
    customChannels: customChannels.size,
    mode: 'unified-mesh-sync',
    features: ['webrtc', 'sync', 'channels'],
    timestamp: new Date().toISOString()
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    name: 'SecureChat Unified Server',
    version: '2.0.0',
    features: ['WebRTC signaling', 'User synchronization', 'Channel management'],
    endpoints: {
      health: '/health',
      users: '/api/users',
      channels: '/api/channels', 
      stats: '/api/stats'
    }
  });
});

// ===============================================
// NETTOYAGE PÉRIODIQUE
// ===============================================
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [channelId, channel] of customChannels.entries()) {
    const channelUserCount = channelStats.get(channelId) || 0;
    const channelAge = Date.now() - new Date(channel.createdAt).getTime();
    
    if (channelUserCount === 0 && channelAge > oneHourAgo && channel.autoDelete !== false) {
      console.log(`[SERVER] Suppression du canal vide: ${channel.name}`);
      customChannels.delete(channelId);
      channelStats.delete(channelId);
      channelUsers.delete(channelId);
      
      io.emit('channel-deleted', { channelId, channelName: channel.name });
      broadcastChannelsList();
    }
  }
}, 10 * 60 * 1000); // Toutes les 10 minutes

// ===============================================
// DÉMARRAGE DU SERVEUR
// ===============================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 SecureChat Unified Server démarré sur le port ${PORT}`);
  console.log(`[SERVER] 🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] 👥 API Users: http://localhost:${PORT}/api/users`);
  console.log(`[SERVER] 📡 API Channels: http://localhost:${PORT}/api/channels`);
  console.log(`[SERVER] 📊 API Stats: http://localhost:${PORT}/api/stats`);
  console.log(`[SERVER] ⚡ Features: WebRTC + Synchronisation + Gestion des canaux`);
  console.log(`[SERVER] 🌐 CORS: Activé pour tous les domaines (développement)`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n[SERVER] 🛑 Arrêt du serveur unifié...');
  
  // Notifier tous les clients
  io.emit('server-shutdown', { 
    message: 'Serveur en cours d\'arrêt',
    timestamp: new Date().toISOString()
  });
  
  // Fermer les connexions
  io.close(() => {
    console.log('[SERVER] ✅ Toutes les connexions fermées');
    process.exit(0);
  });
});

module.exports = { app, server, io };