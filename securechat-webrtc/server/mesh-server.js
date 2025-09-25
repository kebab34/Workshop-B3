// mesh-server-unified.js - Serveur avec support des messages privés
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

// 🔥 NOUVEAU - Stockage pour les messages privés
let privateMessages = new Map(); // "user1-user2" -> array of messages
let userTypingStatus = new Map(); // username -> { to: username, typing: boolean }

// Canaux par défaut
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
  
  if (customChannels.has(channelId)) {
    const channel = customChannels.get(channelId);
    channel.users = count;
    customChannels.set(channelId, channel);
  }
  
  console.log(`[STATS] Canal ${channelId}: ${count} utilisateurs`);
  return count;
};

// 🔥 NOUVELLES FONCTIONS POUR LES MESSAGES PRIVÉS
const getConversationKey = (user1, user2) => {
  return [user1, user2].sort().join('-');
};

const storePrivateMessage = (from, to, messageData) => {
  const key = getConversationKey(from, to);
  const messages = privateMessages.get(key) || [];
  
  const message = {
    ...messageData,
    from,
    to,
    timestamp: new Date().toISOString(),
    delivered: false
  };
  
  messages.push(message);
  privateMessages.set(key, messages);
  
  // Limiter à 100 messages par conversation
  if (messages.length > 100) {
    messages.splice(0, messages.length - 100);
  }
  
  return message;
};

const getPrivateMessages = (user1, user2, limit = 50) => {
  const key = getConversationKey(user1, user2);
  const messages = privateMessages.get(key) || [];
  return messages.slice(-limit);
};

// ===============================================
// GESTION DES CONNEXIONS SOCKET.IO
// ===============================================
io.on('connection', (socket) => {
  console.log(`[SERVER] Nouvelle connexion: ${socket.id}`);
  
  let currentUser = null;
  let currentChannel = null;

  // Enregistrement d'un utilisateur
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

    const existingUser = connectedUsers.get(userData.username);
    if (existingUser) {
      user.connectedSince = existingUser.connectedSince;
      user.currentChannel = existingUser.currentChannel;
    }

    connectedUsers.set(userData.username, user);
    userSockets.set(userData.username, socket.id);
    socket.username = userData.username;
    currentUser = userData.username;
    
    if (!existingUser) {
      socket.broadcast.emit('user-joined', user);
      console.log(`[SYNC] Nouvel utilisateur ${userData.username} ajouté`);
    } else {
      console.log(`[SYNC] Utilisateur ${userData.username} reconnecté`);
    }
    
    socket.emit('users-list', Array.from(connectedUsers.values()));
    socket.emit('channels-list', Array.from(customChannels.values()));
    broadcastChannelStats();
  });

  // Enregistrement WebRTC
  socket.on('register', (username) => {
    console.log(`[WEBRTC] Enregistrement WebRTC: ${username}`);
    socket.username = username;
    currentUser = username;
    
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

  // 🔥 NOUVEAU - Envoi de message privé
  socket.on('private-message', (data) => {
    const { to, from, text, timestamp, id } = data;
    console.log(`[PM] Message privé de ${from} vers ${to}: ${text}`);
    
    // Stocker le message
    const message = storePrivateMessage(from, to, { text, timestamp, id });
    
    // Trouver le socket du destinataire
    const recipientSocketId = userSockets.get(to);
    if (recipientSocketId) {
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket) {
        // Envoyer le message au destinataire
        recipientSocket.emit('private-message', {
          from,
          text,
          timestamp,
          id
        });
        
        // Confirmer la livraison à l'expéditeur
        socket.emit('private-message-delivered', {
          messageId: id,
          to,
          deliveredAt: new Date().toISOString()
        });
        
        console.log(`[PM] Message livré à ${to}`);
      } else {
        console.log(`[PM] Socket introuvable pour ${to}`);
        socket.emit('private-message-failed', {
          messageId: id,
          to,
          error: 'Utilisateur hors ligne'
        });
      }
    } else {
      console.log(`[PM] Utilisateur ${to} non connecté`);
      socket.emit('private-message-failed', {
        messageId: id,
        to,
        error: 'Utilisateur non connecté'
      });
    }
  });

  // 🔥 NOUVEAU - Indicateur "en train de taper"
  socket.on('private-typing-start', (data) => {
    const { to, from } = data;
    console.log(`[PM] ${from} tape un message à ${to}`);
    
    userTypingStatus.set(from, { to, typing: true });
    
    const recipientSocketId = userSockets.get(to);
    if (recipientSocketId) {
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket) {
        recipientSocket.emit('private-typing-start', { from });
      }
    }
  });

  socket.on('private-typing-stop', (data) => {
    const { to, from } = data;
    console.log(`[PM] ${from} a arrêté de taper à ${to}`);
    
    userTypingStatus.delete(from);
    
    const recipientSocketId = userSockets.get(to);
    if (recipientSocketId) {
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket) {
        recipientSocket.emit('private-typing-stop', { from });
      }
    }
  });

  // 🔥 NOUVEAU - Récupération de l'historique des messages privés
  socket.on('get-private-messages', (data) => {
    const { with: otherUser, limit } = data;
    const username = socket.username;
    
    if (!username || !otherUser) return;
    
    console.log(`[PM] Récupération messages privés entre ${username} et ${otherUser}`);
    
    const messages = getPrivateMessages(username, otherUser, limit);
    socket.emit('private-messages-history', {
      with: otherUser,
      messages
    });
  });

  // Création d'un canal
  socket.on('create-channel', (channelData) => {
    console.log('[CANAL] Nouveau canal créé:', channelData.name);
    
    const channel = {
      ...channelData,
      createdAt: new Date().toISOString(),
      users: 0
    };
    
    customChannels.set(channel.id, channel);
    channelStats.set(channel.id, 0);
    channelUsers.set(channel.id, new Set());
    
    socket.broadcast.emit('channel-created', channel);
    broadcastChannelsList();
    
    socket.emit('channel-creation-confirmed', { 
      channelId: channel.id, 
      success: true 
    });
  });

  // Rejoindre un canal (HomePage)
  socket.on('user-join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) return;
    
    console.log(`[CANAL] ${username} rejoint le canal ${channelName} (${channelId})`);
    
    const user = connectedUsers.get(username);
    if (user) {
      if (user.currentChannel && user.currentChannel !== channelName) {
        const oldChannelId = user.currentChannel;
        const oldChannelUsers = channelUsers.get(oldChannelId) || new Set();
        oldChannelUsers.delete(username);
        updateChannelUserCount(oldChannelId);
        
        console.log(`[CANAL] ${username} a quitté ${oldChannelId}`);
      }
      
      user.currentChannel = channelName;
      connectedUsers.set(username, user);
      
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
    
    io.emit('user-channel-changed', { username, channelName });
    broadcastChannelStats();
    broadcastUsersList();
  });

  // Rejoindre un canal WebRTC
  socket.on('join-channel', (data) => {
    const { channelId, channelName } = data;
    const username = socket.username;
    
    if (!username) return;
    
    console.log(`[WEBRTC] ${username} rejoint le canal WebRTC: ${channelName}`);
    
    if (currentChannel) {
      socket.leave(currentChannel);
      const oldUsers = channelUsers.get(currentChannel) || new Set();
      oldUsers.delete(username);
      updateChannelUserCount(currentChannel);
      
      socket.to(currentChannel).emit('user-left-channel', {
        username: username,
        channelId: currentChannel
      });
    }
    
    currentChannel = channelId || channelName;
    socket.join(currentChannel);
    
    const channelUserSet = channelUsers.get(currentChannel) || new Set();
    channelUserSet.add(username);
    channelUsers.set(currentChannel, channelUserSet);
    updateChannelUserCount(currentChannel);
    
    const user = connectedUsers.get(username);
    if (user) {
      user.currentChannel = channelName;
      connectedUsers.set(username, user);
    }
    
    socket.to(currentChannel).emit('user-joined-channel', {
      username: username,
      channelId: currentChannel
    });
    
    const users = getChannelUsers(currentChannel);
    io.to(currentChannel).emit('channel-users', users);
    
    broadcastChannelStats();
    broadcastUsersList();
    
    console.log(`[WEBRTC] ${username} dans le canal ${currentChannel}, ${users.length} utilisateurs`);
  });

  // Quitter un canal
  socket.on('leave-channel', () => {
    if (currentChannel && socket.username) {
      console.log(`[WEBRTC] ${socket.username} quitte le canal ${currentChannel}`);
      
      socket.leave(currentChannel);
      
      const channelUserSet = channelUsers.get(currentChannel) || new Set();
      channelUserSet.delete(socket.username);
      updateChannelUserCount(currentChannel);
      
      socket.to(currentChannel).emit('user-left-channel', {
        username: socket.username,
        channelId: currentChannel
      });
      
      const user = connectedUsers.get(socket.username);
      if (user) {
        user.currentChannel = null;
        connectedUsers.set(socket.username, user);
      }
      
      currentChannel = null;
      broadcastChannelStats();
      broadcastUsersList();
    }
  });

  // Signalisation WebRTC
  socket.on('offer', (data) => {
    console.log(`[WEBRTC] Offre de ${data.from} pour le canal ${data.channelId}`);
    if (currentChannel) {
      socket.to(currentChannel).emit('offer', data);
    }
  });

  socket.on('answer', (data) => {
    console.log(`[WEBRTC] Réponse de ${data.from} pour le canal ${data.channelId}`);
    if (currentChannel) {
      socket.to(currentChannel).emit('answer', data);
    }
  });

  socket.on('ice-candidate', (data) => {
    if (currentChannel) {
      socket.to(currentChannel).emit('ice-candidate', data);
    }
  });

  // Messages de canal via Socket.IO
  socket.on('send-message', (message) => {
    if (currentChannel) {
      console.log(`[MESSAGE] ${message.sender} dans ${currentChannel}: ${message.text}`);
      socket.to(currentChannel).emit('message-received', message);
    }
  });

  // Événements génériques
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

  // Déconnexion
  socket.on('disconnect', (reason) => {
    const username = socket.username;
    
    if (username) {
      console.log(`[SERVER] Déconnexion de ${username}: ${reason}`);
      
      // Arrêter l'indicateur de frappe
      userTypingStatus.delete(username);
      
      // Notifier tous les utilisateurs avec qui il était en train de taper
      for (const [user, typingData] of userTypingStatus.entries()) {
        if (typingData.to === username) {
          const userSocketId = userSockets.get(user);
          if (userSocketId) {
            const userSocket = io.sockets.sockets.get(userSocketId);
            if (userSocket) {
              userSocket.emit('private-typing-stop', { from: username });
            }
          }
        }
      }
      
      if (currentChannel) {
        const channelUserSet = channelUsers.get(currentChannel) || new Set();
        channelUserSet.delete(username);
        updateChannelUserCount(currentChannel);
        
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

// 🔥 NOUVELLE API - Messages privés
app.get('/api/private-messages/:user1/:user2', (req, res) => {
  const { user1, user2 } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  const messages = getPrivateMessages(user1, user2, limit);
  res.json({
    conversation: `${user1}-${user2}`,
    messages,
    count: messages.length
  });
});

// 🔥 NOUVELLE API - Statistiques des messages privés
app.get('/api/private-messages-stats', (req, res) => {
  const conversationCount = privateMessages.size;
  let totalMessages = 0;
  
  for (const messages of privateMessages.values()) {
    totalMessages += messages.length;
  }
  
  res.json({
    conversations: conversationCount,
    totalMessages,
    activeTypingUsers: userTypingStatus.size
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    connectedUsers: connectedUsers.size,
    customChannels: customChannels.size,
    totalChannels: customChannels.size + defaultChannels.length,
    channelStats: Object.fromEntries(channelStats),
    privateConversations: privateMessages.size,
    totalPrivateMessages: Array.from(privateMessages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    activeTypingUsers: userTypingStatus.size,
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
    privateConversations: privateMessages.size,
    mode: 'unified-mesh-sync-pm',
    features: ['webrtc', 'sync', 'channels', 'private-messages'],
    version: '2.2.0',
    timestamp: new Date().toISOString()
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    name: 'SecureChat Unified Server',
    version: '2.2.0',
    features: [
      'WebRTC signaling', 
      'User synchronization', 
      'Channel management', 
      'Private messaging',
      'Real-time typing indicators'
    ],
    endpoints: {
      health: '/health',
      users: '/api/users',
      channels: '/api/channels', 
      stats: '/api/stats',
      privateMessages: '/api/private-messages/:user1/:user2',
      privateStats: '/api/private-messages-stats'
    },
    statistics: {
      connectedUsers: connectedUsers.size,
      customChannels: customChannels.size,
      privateConversations: privateMessages.size,
      uptime: Math.floor(process.uptime())
    }
  });
});

// ===============================================
// NETTOYAGE PÉRIODIQUE
// ===============================================
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  let deletedChannels = 0;
  let deletedMessages = 0;
  
  // Nettoyage des canaux inactifs
  for (const [channelId, channel] of customChannels.entries()) {
    const channelUserCount = channelStats.get(channelId) || 0;
    const channelAge = Date.now() - new Date(channel.createdAt).getTime();
    
    if (channelUserCount === 0 && channelAge > oneHourAgo && channel.autoDelete !== false) {
      console.log(`[CLEANUP] Suppression du canal vide: ${channel.name}`);
      
      customChannels.delete(channelId);
      channelStats.delete(channelId);
      channelUsers.delete(channelId);
      deletedChannels++;
      
      io.emit('channel-deleted', { 
        channelId, 
        channelName: channel.name,
        reason: 'inactivity'
      });
    }
  }
  
  // 🔥 NOUVEAU - Nettoyage des anciens messages privés
  for (const [conversationKey, messages] of privateMessages.entries()) {
    const filteredMessages = messages.filter(msg => {
      const messageAge = Date.now() - new Date(msg.timestamp).getTime();
      return messageAge < oneDayAgo; // Garder les messages de moins de 24h
    });
    
    if (filteredMessages.length !== messages.length) {
      const deleted = messages.length - filteredMessages.length;
      deletedMessages += deleted;
      
      if (filteredMessages.length === 0) {
        privateMessages.delete(conversationKey);
      } else {
        privateMessages.set(conversationKey, filteredMessages);
      }
      
      console.log(`[CLEANUP] Suppression de ${deleted} anciens messages privés dans ${conversationKey}`);
    }
  }
  
  // Nettoyage des statuts de frappe orphelins
  const activeUsers = Array.from(connectedUsers.keys());
  for (const [username, typingData] of userTypingStatus.entries()) {
    if (!activeUsers.includes(username) || !activeUsers.includes(typingData.to)) {
      userTypingStatus.delete(username);
    }
  }
  
  if (deletedChannels > 0 || deletedMessages > 0) {
    console.log(`[CLEANUP] Nettoyage terminé: ${deletedChannels} canaux, ${deletedMessages} messages privés supprimés`);
    if (deletedChannels > 0) {
      broadcastChannelsList();
      broadcastChannelStats();
    }
  }
  
}, 10 * 60 * 1000); // Toutes les 10 minutes

// Statistiques périodiques
setInterval(() => {
  console.log(`[STATS] Utilisateurs: ${connectedUsers.size}, Canaux: ${customChannels.size}, Messages privés: ${Array.from(privateMessages.values()).reduce((sum, msgs) => sum + msgs.length, 0)}, Uptime: ${Math.floor(process.uptime())}s`);
}, 5 * 60 * 1000);

// ===============================================
// DÉMARRAGE DU SERVEUR
// ===============================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 SecureChat Unified Server v2.2.0 démarré sur le port ${PORT}`);
  console.log(`[SERVER] 🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] 👥 API Users: http://localhost:${PORT}/api/users`);
  console.log(`[SERVER] 📡 API Channels: http://localhost:${PORT}/api/channels`);
  console.log(`[SERVER] 💬 API Private Messages: http://localhost:${PORT}/api/private-messages/:user1/:user2`);
  console.log(`[SERVER] 📊 API Stats: http://localhost:${PORT}/api/stats`);
  console.log(`[SERVER] ⚡ Features: WebRTC + Synchronisation + Canaux + Messages privés`);
  console.log(`[SERVER] 🔄 Nettoyage automatique: canaux inactifs (10min) + messages privés (24h)`);
  console.log(`[SERVER] 🌐 CORS: Activé pour tous les domaines (développement)`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n[SERVER] 🛑 Arrêt du serveur unifié...');
  
  console.log(`[SERVER] 📊 Statistiques finales:`);
  console.log(`  - Utilisateurs connectés: ${connectedUsers.size}`);
  console.log(`  - Canaux personnalisés: ${customChannels.size}`);
  console.log(`  - Conversations privées: ${privateMessages.size}`);
  console.log(`  - Messages privés total: ${Array.from(privateMessages.values()).reduce((sum, msgs) => sum + msgs.length, 0)}`);
  console.log(`  - Uptime total: ${Math.floor(process.uptime())}s`);
  
  io.emit('server-shutdown', { 
    message: 'Serveur en cours d\'arrêt - Reconnexion automatique...',
    timestamp: new Date().toISOString(),
    reconnectDelay: 3000
  });
  
  setTimeout(() => {
    io.close(() => {
      console.log('[SERVER] ✅ Toutes les connexions fermées proprement');
      process.exit(0);
    });
  }, 1000);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] ❌ Erreur non capturée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] ❌ Promesse rejetée non gérée:', reason);
});

module.exports = { app, server, io };