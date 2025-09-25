// src/components/HomePage.js - Avec synchronisation temps réel
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import CreateChannelModal from './CreateChannelModal';
import JoinChannelModal from './JoinChannelModal';
import '../styles/HomePage.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

function HomePage({ username, onJoinChannel }) {
  const [availableChannels, setAvailableChannels] = useState([
    // Canaux par défaut
    {
      id: 'general',
      name: 'Canal Général',
      description: 'Communication générale sécurisée',
      users: 0,
      type: 'public',
      icon: '📡',
      status: 'active',
      isDefault: true
    },
    {
      id: 'emergency',
      name: 'Canal d\'Urgence',
      description: 'Communications d\'urgence uniquement',
      users: 0,
      type: 'emergency',
      icon: '🚨',
      status: 'active',
      isDefault: true
    },
    {
      id: 'recon',
      name: 'Reconnaissance',
      description: 'Échange d\'informations terrain',
      users: 0,
      type: 'tactical',
      icon: '🔍',
      status: 'active',
      isDefault: true
    },
    {
      id: 'logistics',
      name: 'Logistique',
      description: 'Coordination des ressources',
      users: 0,
      type: 'public',
      icon: '📦',
      status: 'active',
      isDefault: true
    }
  ]);

  // États pour les utilisateurs connectés
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [usersServerConnected, setUsersServerConnected] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [channelToJoin, setChannelToJoin] = useState(null);

  // Référence pour Socket.IO
  const socketRef = useRef(null);

  // Séparer les canaux par défaut et personnalisés
  const defaultChannels = availableChannels.filter(channel => channel.isDefault);
  const customChannels = availableChannels.filter(channel => channel.isCustom);

  // Fonctions utilitaires
  const formatConnectionTime = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  // Initialiser la connexion Socket.IO
  const initializeSocket = () => {
    console.log('[HOMEPAGE] Initialisation Socket.IO vers', SERVER_URL);
    
    socketRef.current = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
      forceNew: true
    });

    // Connexion réussie
    socketRef.current.on('connect', () => {
      console.log('[HOMEPAGE] Connecté au serveur');
      setUsersServerConnected(true);
      setUsersError(null);
      
      // S'enregistrer auprès du serveur
      socketRef.current.emit('register-user', {
        username: username,
        timestamp: new Date().toISOString()
      });
      
      // Demander les données initiales
      socketRef.current.emit('get-users-list');
      socketRef.current.emit('get-channels-list');
    });

    // Liste des utilisateurs connectés reçue
    socketRef.current.on('users-list', (users) => {
      console.log('[HOMEPAGE] Liste utilisateurs reçue:', users);
      
      const formattedUsers = users.map(user => ({
        id: user.id || user.username,
        username: user.username,
        status: user.status || 'online',
        currentChannel: user.currentChannel || null,
        connectedSince: new Date(user.connectedSince || user.timestamp || Date.now())
      }));
      
      setConnectedUsers(formattedUsers);
      setUsersLoading(false);
    });

    // Liste des canaux reçue
    socketRef.current.on('channels-list', (channels) => {
      console.log('[HOMEPAGE] Liste canaux reçue:', channels);
      
      // Fusionner les canaux par défaut avec les canaux du serveur
      const serverChannels = channels.map(channel => ({
        ...channel,
        isCustom: !channel.isDefault,
        users: channel.users || 0
      }));
      
      // Garder les canaux par défaut et ajouter les canaux du serveur
      const defaultChannelsOnly = availableChannels.filter(ch => ch.isDefault);
      const customChannelsFromServer = serverChannels.filter(ch => ch.isCustom);
      
      setAvailableChannels([...defaultChannelsOnly, ...customChannelsFromServer]);
    });

    // Nouvel utilisateur connecté
    socketRef.current.on('user-joined', (user) => {
      console.log('[HOMEPAGE] Utilisateur connecté:', user.username);
      
      setConnectedUsers(prev => {
        // Éviter les doublons
        if (prev.some(u => u.username === user.username)) {
          return prev;
        }
        
        return [...prev, {
          id: user.id || user.username,
          username: user.username,
          status: 'online',
          currentChannel: null,
          connectedSince: new Date(user.timestamp || Date.now())
        }];
      });
    });

    // Utilisateur déconnecté
    socketRef.current.on('user-left', (user) => {
      console.log('[HOMEPAGE] Utilisateur déconnecté:', user.username);
      
      setConnectedUsers(prev => 
        prev.filter(u => u.username !== user.username)
      );
    });

    // Nouveau canal créé
    socketRef.current.on('channel-created', (channel) => {
      console.log('[HOMEPAGE] Nouveau canal créé:', channel.name);
      
      const newChannel = {
        ...channel,
        isCustom: true,
        isDefault: false,
        users: channel.users || 0
      };
      
      setAvailableChannels(prev => {
        // Éviter les doublons
        if (prev.some(ch => ch.id === channel.id)) {
          return prev;
        }
        return [...prev, newChannel];
      });
    });

    // Statistiques des canaux mises à jour
    socketRef.current.on('channel-stats', (stats) => {
      console.log('[HOMEPAGE] Stats canaux:', stats);
      
      setAvailableChannels(prev => prev.map(channel => ({
        ...channel,
        users: stats[channel.id] || stats[channel.name] || 0
      })));
    });

    // Utilisateur changé de canal
    socketRef.current.on('user-channel-changed', ({ username: userName, channelName }) => {
      console.log('[HOMEPAGE] Utilisateur changé de canal:', userName, '->', channelName);
      
      setConnectedUsers(prev => 
        prev.map(user => 
          user.username === userName 
            ? { ...user, currentChannel: channelName }
            : user
        )
      );
    });

    // Erreurs de connexion
    socketRef.current.on('connect_error', (err) => {
      console.error('[HOMEPAGE] Erreur connexion:', err);
      setUsersError('Impossible de se connecter au serveur');
      setUsersServerConnected(false);
      setUsersLoading(false);
      
      // Afficher au moins l'utilisateur actuel
      setConnectedUsers([{
        id: username,
        username: username,
        status: 'online',
        currentChannel: null,
        connectedSince: new Date()
      }]);
    });

    // Déconnexion du serveur
    socketRef.current.on('disconnect', (reason) => {
      console.log('[HOMEPAGE] Déconnecté du serveur:', reason);
      setUsersServerConnected(false);
      setUsersError('Connexion perdue avec le serveur');
    });
  };

  // Gérer les messages privés
  const handleDirectMessage = (e, user) => {
    e.stopPropagation();
    console.log('Message privé vers:', user.username);
    alert(`Fonction de message privé vers ${user.username} - À implémenter !`);
  };

  // Rejoindre un canal
  const handleChannelClick = (channel) => {
    // Notifier le serveur du changement de canal
    if (socketRef.current?.connected) {
      socketRef.current.emit('user-join-channel', {
        channelId: channel.id,
        channelName: channel.name
      });
    }
    
    if (channel.secure && channel.type !== 'public') {
      // Canal protégé par mot de passe
      setChannelToJoin(channel);
      setShowJoinModal(true);
    } else {
      // Canal public, rejoindre directement
      handleJoinChannel(channel);
    }
  };

  const handleJoinChannel = (channel, password = null) => {
    setSelectedChannel(channel);
    
    // Notifier le serveur du changement de canal
    if (socketRef.current?.connected) {
      socketRef.current.emit('user-join-channel', {
        channelId: channel.id,
        channelName: channel.name
      });
    }
    
    // Animation de transition
    setTimeout(() => {
      onJoinChannel(channel, password);
    }, 500);
  };

  // Créer un nouveau canal
  const handleCreateChannel = async (channelData) => {
    try {
      // Marquer le canal comme personnalisé
      const newChannel = {
        ...channelData,
        isCustom: true,
        isDefault: false,
        createdBy: username,
        createdAt: new Date().toISOString()
      };
      
      // Envoyer au serveur pour synchronisation
      if (socketRef.current?.connected) {
        socketRef.current.emit('create-channel', newChannel);
        console.log('[HOMEPAGE] Canal envoyé au serveur:', newChannel);
      } else {
        // Ajouter localement si pas de connexion serveur
        setAvailableChannels(prev => [...prev, newChannel]);
        console.log('[HOMEPAGE] Canal créé localement:', newChannel);
      }
      
    } catch (error) {
      console.error('Erreur création canal:', error);
      throw error;
    }
  };

  // Fonction pour réessayer la connexion
  const refreshUsersList = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setTimeout(() => {
      initializeSocket();
    }, 1000);
  };

  // Initialisation au montage du composant
  useEffect(() => {
    if (username) {
      initializeSocket();
    }

    // Nettoyage à la déconnexion
    return () => {
      if (socketRef.current) {
        console.log('[HOMEPAGE] Nettoyage connexion Socket.IO');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [username]);

  const getChannelStatusColor = (status) => {
    switch (status) {
      case 'active': return '#00ff88';
      case 'busy': return '#ffaa00';
      case 'inactive': return '#666';
      default: return '#666';
    }
  };

  return (
    <div className={`home-page ${selectedChannel ? 'transitioning' : ''}`}>
      {/* Header avec informations utilisateur */}
      <div className="home-header">
        <div className="user-welcome">
          <h2>Bienvenue, <span className="username">{username}</span></h2>
          <p className="network-status">
            SecureLink - Communication sécurisée active
            {!usersServerConnected && <span className="offline-indicator"> (Mode hors ligne)</span>}
          </p>
        </div>
        
        {/* Indicateur de connexion */}
        <div className="connection-indicator">
          <div className={`connection-dot ${usersServerConnected ? 'connected' : 'disconnected'}`}></div>
          <span className="connection-text">
            {usersServerConnected ? 'Connecté' : 'Hors ligne'}
          </span>
        </div>
      </div>

      {/* Section des canaux généraux (par défaut) */}
      <div className="channels-section">
        <div className="section-header">
          <h3>Canaux Généraux</h3>
          <button 
            className="create-channel-btn"
            onClick={() => setShowCreateModal(true)}
            title="Créer un nouveau canal"
          >
            ➕ Nouveau Canal
          </button>
        </div>

        <div className="channels-grid">
          {defaultChannels.map((channel) => (
            <div
              key={channel.id}
              className={`channel-card ${channel.type} ${selectedChannel?.id === channel.id ? 'selected' : ''}`}
              onClick={() => handleChannelClick(channel)}
            >
              <div className="channel-header">
                <span className="channel-icon">{channel.icon}</span>
                <div className="channel-info">
                  <h4 className="channel-name">
                    {channel.name}
                    {channel.secure && <span className="security-badge">🔒</span>}
                  </h4>
                  <p className="channel-description">{channel.description}</p>
                </div>
              </div>
              
              <div className="channel-footer">
                <div className="channel-users">
                  <span className="users-count">{channel.users}</span>
                  <span className="users-label">utilisateur{channel.users > 1 ? 's' : ''}</span>
                </div>
                
                <div 
                  className="channel-status"
                  style={{ color: getChannelStatusColor(channel.status) }}
                >
                  ● {channel.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section des canaux créés */}
      {customChannels.length > 0 && (
        <div className="custom-channels-section">
          <div className="section-header">
            <h3>Canaux Privés Créés</h3>
            <span className="channel-count">{customChannels.length} canal{customChannels.length > 1 ? 'aux' : ''}</span>
          </div>

          <div className="channels-grid">
            {customChannels.map((channel) => (
              <div
                key={channel.id}
                className={`channel-card custom ${selectedChannel?.id === channel.id ? 'selected' : ''}`}
                onClick={() => handleChannelClick(channel)}
              >
                <div className="channel-header">
                  <span className="channel-icon">{channel.icon}</span>
                  <div className="channel-info">
                    <h4 className="channel-name">
                      {channel.name}
                      {channel.secure && <span className="security-badge">🔒</span>}
                    </h4>
                    <p className="channel-description">{channel.description}</p>
                  </div>
                </div>
                
                <div className="channel-footer">
                  <div className="channel-users">
                    <span className="users-count">{channel.users || 0}</span>
                    <span className="users-label">utilisateur{(channel.users || 0) > 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="channel-meta">
                    <span className="created-by">Par: {channel.createdBy === username ? 'Vous' : channel.createdBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section des utilisateurs connectés */}
      <div className="connected-users-section">
        <div className="section-header">
          <h3>Utilisateurs Connectés</h3>
          <div className="users-stats">
            <span className="online-indicator">●</span>
            <span className="users-count">{connectedUsers.length} en ligne</span>
            {usersLoading && <span className="loading-text">Synchronisation...</span>}
            {usersError && <span className="error-text">Erreur: {usersError}</span>}
          </div>
        </div>

        <div className="users-grid">
          {usersLoading ? (
            <div className="users-loading">
              <div className="loading-spinner">⟳</div>
              <p>Synchronisation des utilisateurs...</p>
            </div>
          ) : connectedUsers.length > 0 ? (
            connectedUsers.map((user) => (
              <div key={user.id} className={`user-card ${user.username === username ? 'current-user' : ''}`}>
                <div className="user-avatar">
                  <span className="user-initial">{user.username.charAt(0).toUpperCase()}</span>
                  <div className={`status-indicator ${user.status}`}></div>
                </div>
                
                <div className="user-info">
                  <div className="user-name">
                    {user.username}
                    {user.username === username && <span className="you-badge">(Vous)</span>}
                  </div>
                  <div className="user-status">
                    {user.currentChannel ? (
                      <span className="in-channel">📡 {user.currentChannel}</span>
                    ) : (
                      <span className="in-lobby">🏠 Accueil</span>
                    )}
                  </div>
                  <div className="user-connection">
                    Connecté depuis {formatConnectionTime(user.connectedSince)}
                  </div>
                </div>
                
                {user.username !== username && (
                  <div className="user-actions">
                    <button 
                      className="direct-message-btn"
                      onClick={(e) => handleDirectMessage(e, user)}
                      title="Message privé"
                    >
                      💬
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-users">
              <div className="no-users-icon">👤</div>
              <p>Vous êtes le seul utilisateur connecté</p>
              <small>
                {usersServerConnected 
                  ? "Partagez le lien avec vos collègues pour qu'ils vous rejoignent"
                  : "Mode hors ligne - Impossible de synchroniser avec les autres utilisateurs"
                }
              </small>
              {!usersServerConnected && (
                <button 
                  className="retry-connection-btn"
                  onClick={refreshUsersList}
                  title="Réessayer la connexion"
                >
                  🔄 Réessayer
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateChannel={handleCreateChannel}
        existingChannels={availableChannels}
      />

      <JoinChannelModal
        isOpen={showJoinModal}
        channel={channelToJoin}
        onClose={() => {
          setShowJoinModal(false);
          setChannelToJoin(null);
        }}
        onJoinChannel={handleJoinChannel}
        username={username}
      />

      {/* Indicateur de transition */}
      {selectedChannel && (
        <div className="transition-overlay">
          <div className="transition-content">
            <div className="transition-icon">{selectedChannel.icon}</div>
            <h3>Connexion au canal</h3>
            <p>{selectedChannel.name}</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;