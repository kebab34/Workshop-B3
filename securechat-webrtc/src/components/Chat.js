import React, { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConnectionStatus from './ConnectionStatus';
import useChannelWebRTC from '../hooks/useChannelWebRTC';
import '../styles/Chat.css';

function Chat({ username, channel }) {
  const [messages, setMessages] = useState([]);
  const [hasAutoConnected, setHasAutoConnected] = useState(false);
  const messagesEndRef = useRef(null);

  // Générer une clé unique pour chaque canal
  const getChannelStorageKey = useCallback((channelData) => {
    return `chat-messages-${channelData.id || channelData.name}`;
  }, []);

  // Fonction stable pour ajouter un message avec stockage par canal
  const addMessage = useCallback((text, sender = username, type = 'text', saveToStorage = true) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      text,
      sender,
      timestamp: new Date(),
      type,
      encrypted: type !== 'system',
      delivered: sender === username,
      channelId: channel.id || channel.name
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Sauvegarder dans le localStorage avec clé spécifique au canal
    if (saveToStorage && channel) {
      try {
        const storageKey = getChannelStorageKey(channel);
        const savedMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
        savedMessages.push(newMessage);
        
        if (savedMessages.length > 1000) {
          savedMessages.splice(0, savedMessages.length - 1000);
        }
        localStorage.setItem(storageKey, JSON.stringify(savedMessages));
      } catch (error) {
        console.error('Erreur sauvegarde localStorage:', error);
      }
    }
  }, [username, channel, getChannelStorageKey]);

  // Fonction pour charger l'historique d'un canal spécifique
  const loadChannelHistory = useCallback((channelData) => {
    try {
      const storageKey = getChannelStorageKey(channelData);
      const savedMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      if (savedMessages.length > 0) {
        const loadedMessages = savedMessages
          .filter(msg => msg.channelId === (channelData.id || channelData.name))
          .map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        setMessages(loadedMessages);
        console.log(`[CHAT] Chargé ${loadedMessages.length} messages pour le canal ${channelData.name}`);
      } else {
        setMessages([]);
        console.log(`[CHAT] Aucun historique pour le canal ${channelData.name}`);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      setMessages([]);
    }
  }, [getChannelStorageKey]);

  // Fonction pour effacer l'historique du canal actuel
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (channel) {
      const storageKey = getChannelStorageKey(channel);
      localStorage.removeItem(storageKey);
    }
  }, [channel, getChannelStorageKey]);

  // Callbacks stables pour le hook WebRTC
  const handleMessageReceived = useCallback((message) => {
    console.log('📨 [CHAT] Message reçu dans handleMessageReceived:', message);
    
    if (message.type === 'clear-history') {
      clearMessages();
      addMessage('🗑️ Historique effacé par mesure de sécurité', 'System', 'system', false);
    } else {
      const messageChannelId = message.channelId || message.channel;
      const currentChannelId = channel.id || channel.name;
      
      if (messageChannelId === currentChannelId) {
        console.log('📝 [CHAT] Ajout du message à l\'interface:', message.text, 'de', message.sender);
        addMessage(message.text, message.sender, message.type, false);
      } else {
        console.log('🚫 [CHAT] Message ignoré - canal différent:', messageChannelId, 'vs', currentChannelId);
      }
    }
  }, [addMessage, clearMessages, channel]);

  const handleConnectionStatusChange = useCallback((status) => {
    console.log('Status changed to:', status);
    if (status === 'connected') {
      addMessage('🔗 Connexion sécurisée établie', 'System', 'system', false);
    } else if (status === 'error') {
      addMessage('🚨 Erreur de connexion', 'System', 'system', false);
    }
  }, [addMessage]);

  // Hook WebRTC avec callbacks stables
  const {
    isConnected,
    connectionStatus,
    currentChannel,
    channelUsers,
    error,
    connect,
    disconnect,
    joinChannel,
    sendMessage: sendWebRTCMessage
  } = useChannelWebRTC(username, handleMessageReceived, handleConnectionStatusChange);

  // Fonction de reconnexion (disconnect + rejoin channel)
  const reconnect = useCallback(async () => {
    console.log('Reconnecting...');
    if (currentChannel) {
      const channelToRejoin = currentChannel;
      disconnect();
      setTimeout(() => {
        joinChannel(channelToRejoin);
      }, 1000);
    } else if (channel) {
      disconnect();
      setTimeout(() => {
        joinChannel(channel);
      }, 1000);
    }
  }, [currentChannel, channel, disconnect, joinChannel]);

  // Fonction pour envoyer un message avec info du canal
  const sendMessage = useCallback((text, type = 'text') => {
    if (!text.trim()) return;

    console.log(`[DEBUG] Tentative d'envoi:`, { 
      text, 
      type, 
      isConnected, 
      connectionStatus,
      currentChannel: currentChannel?.name, 
      channelUsers: channelUsers.length 
    });

    addMessage(text, username, type);
    
    if (connectionStatus === 'connected' && currentChannel) {
      console.log(`[DEBUG] Tentative d'envoi via hook WebRTC...`);
      
      // Créer le message avec info du canal
      const messageWithChannel = {
        text,
        type,
        sender: username,
        timestamp: new Date().toISOString(),
        channelId: channel.id || channel.name,
        channel: channel.name
      };
      
      const success = sendWebRTCMessage(messageWithChannel.text, messageWithChannel.type, messageWithChannel);
      if (!success) {
        console.log(`[DEBUG] Échec d'envoi complet`);
        addMessage('⚠️ Échec d\'envoi - Message stocké localement', 'System', 'system', false);
      } else {
        console.log(`[DEBUG] Envoi réussi`);
      }
    } else {
      console.log(`[DEBUG] Non prêt - Status: ${connectionStatus}, Canal: ${currentChannel?.name || 'aucun'}`);
      addMessage('📤 Message en attente de connexion...', 'System', 'system', false);
    }
  }, [addMessage, username, isConnected, sendWebRTCMessage, connectionStatus, currentChannel, channelUsers.length, channel]);

  const sendEmergencyMessage = useCallback(() => {
    const emergencyText = '🚨 MESSAGE D\'URGENCE - Position compromise, besoin d\'aide immédiate !';
    sendMessage(emergencyText, 'emergency');
  }, [sendMessage]);

  // Fonction pour effacer l'historique du canal actuel
  const clearHistory = useCallback(() => {
    if (window.confirm(`Effacer l'historique du canal "${channel.name}" ? Cette action est irréversible.`)) {
      clearMessages();
      
      if (isConnected) {
        sendWebRTCMessage('clear-history', 'clear-history');
        addMessage(`🗑️ Historique du canal "${channel.name}" effacé pour tous les participants`, 'System', 'system', false);
      } else {
        addMessage(`🗑️ Historique du canal "${channel.name}" effacé localement`, 'System', 'system', false);
      }
    }
  }, [clearMessages, isConnected, sendWebRTCMessage, addMessage, channel.name]);

  // Effet pour charger l'historique et connexion initiale quand le canal change
  useEffect(() => {
    console.log(`[CHAT] Changement de canal vers: ${channel.name} (ID: ${channel.id})`);
    
    loadChannelHistory(channel);
    
    setTimeout(() => {
      addMessage(`🛡️ Connexion au canal "${channel.name}" - Communications sécurisées activées`, 'System', 'system', false);
    }, 100);
    
    if (!hasAutoConnected) {
      setHasAutoConnected(true);
      setTimeout(async () => {
        console.log(`Connexion automatique et rejointure du canal ${channel.name}...`);
        
        try {
          console.log(`[DEBUG] Canal à rejoindre:`, channel);
          
          await connect();
          
          setTimeout(async () => {
            console.log(`[DEBUG] Tentative de rejoin du canal:`, channel);
            const success = await joinChannel(channel);
            if (success) {
              addMessage(`📡 Connecté au canal: ${channel.name} (ID: ${channel.id})`, 'System', 'system', false);
              console.log(`[DEBUG] Succès - Canal actuel:`, currentChannel);
            } else {
              addMessage('❌ Échec de connexion au canal', 'System', 'system', false);
              console.log(`[DEBUG] Échec de connexion au canal`);
            }
          }, 1000);
        } catch (error) {
          console.error('Erreur connexion:', error);
          addMessage('🚨 Erreur de connexion au serveur', 'System', 'system', false);
        }
      }, 1500);
    }
  }, [channel, loadChannelHistory, addMessage, hasAutoConnected, connect, joinChannel]);

  // Auto-scroll vers le bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        reconnect();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        disconnect();
      } else if (e.key === 'F1') {
        e.preventDefault();
        sendEmergencyMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reconnect, disconnect, sendEmergencyMessage]);

  return (
    <div className="chat-container">
      {/* Header avec statut de connexion */}
      <div className="chat-header">
        <div className="user-info">
          <span className="username">{username}</span>
          <span className="channel-name">Canal: {currentChannel?.name || channel?.name}</span>
          <ConnectionStatus 
            status={connectionStatus} 
            partnerName={channelUsers.length > 1 ? `${channelUsers.length - 1} autre(s)` : 'Aucun autre utilisateur'} 
          />
        </div>
        
        <div className="channel-users">
          <span className="users-label">👥 Utilisateurs ({channelUsers.length}):</span>
          <div className="users-list">
            {channelUsers.map(user => (
              <span key={user} className={`user-badge ${user === username ? 'current-user' : ''}`}>
                {user}
              </span>
            ))}
          </div>
        </div>
        
        <div className="chat-actions">
          <button 
            className="emergency-button"
            onClick={sendEmergencyMessage}
            title="Message d'urgence (F1)"
          >
            🚨
          </button>
          
          {!isConnected ? (
            <button 
              className="connect-button"
              onClick={connect}
              disabled={connectionStatus === 'connecting'}
              title="Se connecter"
            >
              🔗
            </button>
          ) : (
            <button 
              className="disconnect-button"
              onClick={disconnect}
              title="Se déconnecter (Ctrl+D)"
            >
              ⚡
            </button>
          )}
          
          <button 
            className="reconnect-button"
            onClick={reconnect}
            disabled={connectionStatus === 'connecting'}
            title="Reconnexion (Ctrl+R)"
          >
            🔄
          </button>
          
          <button 
            className="clear-button"
            onClick={clearHistory}
            title={`Effacer l'historique du canal "${channel.name}"`}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Affichage des erreurs */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button 
            className="error-retry"
            onClick={reconnect}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Zone de messages */}
      <div className="messages-container">
        <MessageList 
          messages={messages} 
          currentUser={username}
          channelName={channel.name}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input pour nouveau message */}
      <MessageInput 
        onSendMessage={sendMessage}
        disabled={connectionStatus === 'disconnected'}
        connectionStatus={connectionStatus}
        channelName={channel.name}
        placeholder={`Message dans ${channel.name}...`}
      />

      {/* Info de debug en développement */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <small>
            Canal: {channel.name} | Messages: {messages.length} | Connected: {isConnected ? 'Yes' : 'No'} | Status: {connectionStatus}
          </small>
        </div>
      )}
    </div>
  );
}

export default Chat;