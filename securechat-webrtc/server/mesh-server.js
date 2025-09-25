// mesh-server-unified.js - Serveur complet WebRTC + Synchronisation des canaux
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
let connectedUsers = new Map(); // username -> user data
let customChannels = new Map(); // channelId -> channel data
let channelStats = new Map(); // channelId -> user count
let channelUsers = new Map(); // channelId -> Set of usernames
let userSockets = new Map(); // username -> socket.id
let userChannelHistory = new Map(); // username -> derniers canaux visités

// Canaux par défaut (pour les statistiques)
const defaultChannels = ['general', 'emergency', 'recon', 'logistics'];
defaultChannels.forEach(channelId => {
  channelStats.set(channelId, 0);
  channelUsers.set(channelId, new Set());
});

// ===============================================
// FONCTIONS UTILITAIRES
// ===============================================
const broadcastUsersList = () => {
  const users = Array.from(connectedUsers.values());
  console.log(`[BROADCAST] Diffusion de ${users.length} utilisateurs`);
  io.emit('users-list', users);
};

const broadcastChannelsList = () => {
  // Inclure TOUS les canaux (défaut + personnalisés) avec leurs stats
  const customChannelsArray = Array.from(customChannels.values()).map(channel => ({
    ...channel,
    users: channelStats.get(channel.id) || 0,
    isCustom: true
  }));
  
  console.log(`[BROADCAST] Diffusion de ${customChannelsArray.length} canaux personnalisés`);
  io.emit('channels-list', customChannelsArray);
};

const broadcastChannelStats = () => {
  const stats = Object.fromEntries(channelStats);
  console.log(`[BROADCAST] Statistiques des canaux:`, stats);
  io.emit('channel-stats', stats);
};

const getChannelUsers = (channelId) => {
  return Array.from(channelUsers.get(channelId) || []);
};

const updateChannelUserCount = (channelId) => {
  const users = channelUsers.get(channelId) || new Set();
  const count = users.size;
  channelStats.set(channelId, count);
  
  // Mettre à jour le canal personnalisé s'il existe
  if (customChannels.has(channelId)) {
    const channel = customChannels.get(channelId);
    channel.users = count;
    customChannels.set(channelId, channel);
  }
  
  console.log(`[STATS] Canal ${channelId}: ${count} utilisateurs`);
  return count;
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
    console.log(`[SYNC] Enregistrement utilisateur:`, userData.username);
    
    const user = {
      id: socket.id,
      username: userData.username,
      socketId: socket.id,
      status: 'online',
      currentChannel: null,
      connectedSince: userData.timestamp || new Date().toISOString()
    };

    // Mettre à jour ou ajouter l'utilisateur
    const existingUser = connectedUsers.get(userData.username);
    if (existingUser) {
      // Utilisateur existant - mettre à jour le socket
      user.connectedSince = existingUser.connectedSince;
      user.currentChannel = existingUser.currentChannel;
    }

    connectedUsers.set(userData.username, user);
    userSockets.set(userData.username, socket.id);
    socket.username = userData.username;
    currentUser = userData.username;
    
    // Notifier les autres utilisateurs (nouveaux seulement)
    if (!existingUser) {
      socket.broadcast.emit('user-joined', user);
      console.log(`[SYNC] Nouvel utilisateur ${userData.username} ajouté`);
    } else {
      console.log(`[SYNC] Utilisateur ${userData.username} reconnecté`);
    }
    
    // Envoyer les données au client
    socket.emit('users-list', Array.from(connectedUsers.values()));
    socket.emit('channels-list', Array.from(customChannels.values()));
    broadcastChannelStats();
  });

  // 🔥 CRÉATION D'UN CANAL - Point clé pour la synchronisation
  socket.on('create-channel', (channelData) => {
    console.log(`[CANAL] 🚀 Nouveau canal créé par ${socket.username}:`, channelData.name);
    
    const channel = {
      ...channelData,
      createdAt: new Date().toISOString(),
      users: 0,
      isCustom: true,
      createdBy: socket.username || channelData.createdBy
    };
    
    // Stocker le canal
    customChannels.set(channel.id, channel);
    channelStats.set(channel.id, 0);
    channelUsers.set(channel.id, new Set());
    
    console.log(`[CANAL] ✅ Canal ${channel.name} (${channel.id}) stocké sur le serveur`);
    console.log(`[CANAL] 📊 Total de canaux personnalisés: ${customChannels.size}`);
    
    // 🔥 DIFFUSER À TOUS LES CLIENTS (sauf celui qui l'a créé)
    socket.broadcast.emit('channel-created', channel);
    console.log(`[CANAL] 📡 Canal diffusé à tous les autres clients`);
    
    // Diffuser la liste mise à jour
    broadcastChannelsList();
    broadcastChannelStats();
    
    // Confirmer au créateur
    socket.emit('channel-creation-confirmed', { 
      channelId: channel.id, 
      success: true 
    });
  });

  // Utilisateur rejoint un canal (depuis HomePage)
  socket.on('user-join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) {
      console.log(`[CANAL] Tentative de rejoindre ${channelName} sans utilisateur identifié`);
      return;
    }
    
    console.log(`[CANAL] ${username} rejoint le canal ${channelName} (${channelId})`);
    
    // Mettre à jour l'utilisateur
    const user = connectedUsers.get(username);
    if (user) {
      // Quitter l'ancien canal (statistiques)
      if (user.currentChannel && user.currentChannel !== channelName) {
        const oldChannelId = user.currentChannel;
        const oldChannelUsers = channelUsers.get(oldChannelId) || new Set();
        oldChannelUsers.delete(username);
        updateChannelUserCount(oldChannelId);
        
        console.log(`[CANAL] ${username} a quitté ${oldChannelId}`);
      }
      
      // Rejoindre le nouveau canal
      user.currentChannel = channelName;
      connectedUsers.set(username, user);
      
      // Mettre à jour les stats du nouveau canal
      const newChannelUsers = channelUsers.get(channelId) || channelUsers.get(channelName) || new Set();
      newChannelUsers.add(username);
      channelUsers.set(channelId, newChannelUsers);
      channelUsers.set(channelName, newChannelUsers);
      
      updateChannelUserCount(channelId);
      if (channelId !== channelName) {
        updateChannelUserCount(channelName);
      }
      
      console.log(`[CANAL] ${username} maintenant dans ${channelName}, ${newChannelUsers.size} utilisateurs total`);
    }
    
    // Notifier tous les clients
    io.emit('user-channel-changed', { username, channelName });
    broadcastChannelStats();
    broadcastUsersList();
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
      
      console.log(`[WEBRTC] Nouvel utilisateur ${username} ajouté via WebRTC`);
    }
  });

  // Rejoindre un canal pour WebRTC
  socket.on('join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) {
      console.log(`[WEBRTC] Tentative de rejoindre le canal WebRTC sans utilisateur`);
      return;
    }
    
    console.log(`[WEBRTC] ${username} rejoint le canal WebRTC: ${channelName}`);
    
    // Quitter l'ancien canal WebRTC
    if (currentChannel) {
      socket.leave(currentChannel);
      const oldUsers = channelUsers.get(currentChannel) || new Set();
      oldUsers.delete(username);
      updateChannelUserCount(currentChannel);
      
      // Notifier l'ancien canal
      socket.to(currentChannel).emit('user-left-channel', {
        username: username,
        channelId: currentChannel
      });
      
      console.log(`[WEBRTC] ${username} a quitté l'ancien canal ${currentChannel}`);
    }
    
    // Rejoindre le nouveau canal WebRTC
    currentChannel = channelId || channelName;
    socket.join(currentChannel);
    
    // Mettre à jour les utilisateurs du canal
    const channelUserSet = channelUsers.get(currentChannel) || new Set();
    channelUserSet.add(username);
    channelUsers.set(currentChannel, channelUserSet);
    updateChannelUserCount(currentChannel);
    
    // Mettre à jour l'utilisateur dans la liste générale
    const user = connectedUsers.get(username);
    if (user) {
      user.currentChannel = channelName;
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
    
    // Mettre à jour les stats globales
    broadcastChannelStats();
    broadcastUsersList();
    
    console.log(`[WEBRTC] ${username} connecté au canal ${currentChannel}, ${users.length} utilisateurs`);
  });

  // Quitter un canal
  socket.on('leave-channel', () => {
    if (currentChannel && socket.username) {
      console.log(`[WEBRTC] ${socket.username} quitte le canal ${currentChannel}`);
      
      socket.leave(currentChannel);
      
      // Mettre à jour les stats du canal
      const channelUserSet = channelUsers.get(currentChannel) || new Set();
      channelUserSet.delete(socket.username);
      updateChannelUserCount(currentChannel);
      
      // Notifier le canal
      socket.to(currentChannel).emit('user-left-channel', {
        username: socket.username,
        channelId: currentChannel
      });
      
      // Mettre à jour l'utilisateur
      const user = connectedUsers.get(socket.username);
      if (user) {
        user.currentChannel = null;
        connectedUsers.set(socket.username, user);
      }
      
      currentChannel = null;
      broadcastChannelStats();
      broadcastUsersList();
      
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
      console.log(`[MESSAGE] ${message.sender} dans ${currentChannel}: ${message.text}`);
      socket.to(currentChannel).emit('message-received', message);
    }
  });

  // ==========================================
  // ÉVÉNEMENTS GÉNÉRIQUES
  // ==========================================
  
  socket.on('get-users-list', () => {
    console.log(`[API] Demande de liste utilisateurs par ${socket.username}`);
    socket.emit('users-list', Array.from(connectedUsers.values()));
  });

  socket.on('get-channels-list', () => {
    console.log(`[API] Demande de liste canaux par ${socket.username}`);
    socket.emit('channels-list', Array.from(customChannels.values()));
  });

  socket.on('get-channel-stats', () => {
    console.log(`[API] Demande de stats canaux par ${socket.username}`);
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
      console.log(`[SERVER] 👋 Déconnexion de ${username}: ${reason}`);
      
      // Quitter le canal actuel
      if (currentChannel) {
        const channelUserSet = channelUsers.get(currentChannel) || new Set();
        channelUserSet.delete(username);
        updateChannelUserCount(currentChannel);
        
        socket.to(currentChannel).emit('user-left-channel', {
          username: username,
          channelId: currentChannel
        });
        
        console.log(`[SERVER] ${username} retiré du canal ${currentChannel}`);
      }
      
      // Supprimer l'utilisateur des listes
      connectedUsers.delete(username);
      userSockets.delete(username);
      
      // Notifier les autres clients
      socket.broadcast.emit('user-left', { username, id: socket.id });
      broadcastChannelStats();
      
      console.log(`[SERVER] ${username} supprimé complètement, ${connectedUsers.size} utilisateurs restants`);
    } else {
      console.log(`[SERVER] Déconnexion d'un socket non identifié: ${socket.id}`);
    }
  });
});

// ===============================================
// ROUTES HTTP API
// ===============================================
app.get('/api/users', (req, res) => {
  const users = Array.from(connectedUsers.values());
  res.json(users);
});

app.get('/api/channels', (req, res) => {
  const channels = Array.from(customChannels.values()).map(channel => ({
    ...channel,
    users: channelStats.get(channel.id) || 0
  }));
  res.json(channels);
});

app.get('/api/channel/:channelId/users', (req, res) => {
  const channelId = req.params.channelId;
  const users = getChannelUsers(channelId);
  res.json(users);
});

app.get('/api/stats', (req, res) => {
  const stats = {
    connectedUsers: connectedUsers.size,
    customChannels: customChannels.size,
    totalChannels: customChannels.size + defaultChannels.length,
    channelStats: Object.fromEntries(channelStats),
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  res.json(stats);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    connectedUsers: connectedUsers.size,
    customChannels: customChannels.size,
    mode: 'unified-mesh-sync',
    features: ['webrtc', 'sync', 'channels'],
    version: '2.1.0',
    timestamp: new Date().toISOString()
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    name: 'SecureChat Unified Server',
    version: '2.1.0',
    features: ['WebRTC signaling', 'User synchronization', 'Channel management', 'Real-time sync'],
    endpoints: {
      health: '/health',
      users: '/api/users',
      channels: '/api/channels', 
      stats: '/api/stats'
    },
    statistics: {
      connectedUsers: connectedUsers.size,
      customChannels: customChannels.size,
      uptime: Math.floor(process.uptime())
    }
  });
});

// ===============================================
// NETTOYAGE PÉRIODIQUE
// ===============================================
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let deletedChannels = 0;
  
  for (const [channelId, channel] of customChannels.entries()) {
    const channelUserCount = channelStats.get(channelId) || 0;
    const channelAge = Date.now() - new Date(channel.createdAt).getTime();
    
    // Supprimer les canaux vides et anciens (sauf si autoDelete est false)
    if (channelUserCount === 0 && channelAge > oneHourAgo && channel.autoDelete !== false) {
      console.log(`[CLEANUP] Suppression du canal vide: ${channel.name} (${channelAge/1000/60} min d'âge)`);
      
      customChannels.delete(channelId);
      channelStats.delete(channelId);
      channelUsers.delete(channelId);
      deletedChannels++;
      
      // Notifier tous les clients
      io.emit('channel-deleted', { 
        channelId, 
        channelName: channel.name,
        reason: 'inactivity'
      });
    }
  }
  
  if (deletedChannels > 0) {
    console.log(`[CLEANUP] ${deletedChannels} canaux supprimés`);
    broadcastChannelsList();
    broadcastChannelStats();
  }
  
}, 10 * 60 * 1000); // Toutes les 10 minutes

// Statistiques périodiques
setInterval(() => {
  console.log(`[STATS] Utilisateurs: ${connectedUsers.size}, Canaux: ${customChannels.size}, Uptime: ${Math.floor(process.uptime())}s`);
}, 5 * 60 * 1000); // Toutes les 5 minutes

// ===============================================
// DÉMARRAGE DU SERVEUR
// ===============================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 SecureChat Unified Server v2.1.0 démarré sur le port ${PORT}`);
  console.log(`[SERVER] 🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] 👥 API Users: http://localhost:${PORT}/api/users`);
  console.log(`[SERVER] 📡 API Channels: http://localhost:${PORT}/api/channels`);
  console.log(`[SERVER] 📊 API Stats: http://localhost:${PORT}/api/stats`);
  console.log(`[SERVER] ⚡ Features: WebRTC + Synchronisation temps réel + Gestion des canaux`);
  console.log(`[SERVER] 🌐 CORS: Activé pour tous les domaines (développement)`);
  console.log(`[SERVER] 🔄 Nettoyage automatique des canaux inactifs: 10 min`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n[SERVER] 🛑 Arrêt du serveur unifié...');
  
  // Sauvegarder les statistiques finales
  console.log(`[SERVER] 📊 Statistiques finales:`);
  console.log(`  - Utilisateurs connectés: ${connectedUsers.size}`);
  console.log(`  - Canaux personnalisés: ${customChannels.size}`);
  console.log(`  - Uptime total: ${Math.floor(process.uptime())}s`);
  
  // Notifier tous les clients
  io.emit('server-shutdown', { 
    message: 'Serveur en cours d\'arrêt - Reconnexion automatique...',
    timestamp: new Date().toISOString(),
    reconnectDelay: 3000
  });
  
  // Fermer les connexions
  setTimeout(() => {
    io.close(() => {
      console.log('[SERVER] ✅ Toutes les connexions fermées proprement');
      process.exit(0);
    });
  }, 1000);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('[SERVER] ❌ Erreur non capturée:', err);
  // Ne pas arrêter le serveur pour une erreur simple
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] ❌ Promesse rejetée non gérée:', reason);
  // Ne pas arrêter le serveur pour une promesse rejetée
});

module.exports = { app, server, io };