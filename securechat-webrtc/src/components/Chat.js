// src/components/Chat.js - Version avec support des canaux
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

  // Fonction stable pour ajouter un message
  const addMessage = useCallback((text, sender = username, type = 'text', saveToStorage = true) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      text,
      sender,
      timestamp: new Date(),
      type,
      encrypted: type !== 'system',
      delivered: sender === username
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Sauvegarder dans le localStorage
    if (saveToStorage) {
      try {
        const savedMessages = JSON.parse(localStorage.getItem('chat-messages') || '[]');
        savedMessages.push(newMessage);
        // Limiter à 1000 messages max
        if (savedMessages.length > 1000) {
          savedMessages.splice(0, savedMessages.length - 1000);
        }
        localStorage.setItem('chat-messages', JSON.stringify(savedMessages));
      } catch (error) {
        console.error('Erreur sauvegarde localStorage:', error);
      }
    }
  }, [username]);

  // Fonction pour effacer les messages localement
  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('chat-messages');
  }, []);

  // Callbacks stables pour le hook WebRTC
  const handleMessageReceived = useCallback((message) => {
    console.log('📨 [CHAT] Message reçu dans handleMessageReceived:', message);
    
    // Si c'est un signal d'effacement, effacer aussi localement
    if (message.type === 'clear-history') {
      clearMessages();
      addMessage('🗑️ Historique effacé par mesure de sécurité', 'System', 'system', false);
    } else {
      // Message normal
      console.log('📝 [CHAT] Ajout du message à l\'interface:', message.text, 'de', message.sender);
      addMessage(message.text, message.sender, message.type, false);
    }
  }, [addMessage, clearMessages]);

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
    leaveChannel,
    sendMessage: sendWebRTCMessage
  } = useChannelWebRTC(username, handleMessageReceived, handleConnectionStatusChange);

  // Fonction de reconnexion (disconnect + rejoin channel)
  const reconnect = useCallback(async () => {
    console.log('Reconnecting...');
    if (currentChannel) {
      const channelToRejoin = currentChannel;
      disconnect();
      // Attendre un peu avant de reconnecter
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

  // Fonction pour envoyer un message
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

    // Ajouter immédiatement à notre interface
    addMessage(text, username, type);
    
    // Envoyer via le hook WebRTC (il gère WebRTC + fallback Socket.IO)
    if (connectionStatus === 'connected' && currentChannel) {
      console.log(`[DEBUG] Tentative d'envoi via hook WebRTC...`);
      const success = sendWebRTCMessage(text, type);
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
  }, [addMessage, username, isConnected, sendWebRTCMessage]);

  const sendEmergencyMessage = useCallback(() => {
    const emergencyText = '🚨 MESSAGE D\'URGENCE - Position compromise, besoin d\'aide immédiate !';
    sendMessage(emergencyText, 'emergency');
  }, [sendMessage]);

  // Fonction pour effacer l'historique - SIMPLIFIÉE
  const clearHistory = useCallback(() => {
    if (window.confirm('Effacer tout l\'historique des messages ? Cette action est irréversible.')) {
      // Effacer localement
      clearMessages();
      
      // Si connecté, envoyer signal d'effacement à l'autre participant
      if (isConnected) {
        sendWebRTCMessage('clear-history', 'clear-history');
        addMessage('🗑️ Historique effacé pour tous les participants', 'System', 'system', false);
      } else {
        addMessage('🗑️ Historique effacé localement', 'System', 'system', false);
      }
    }
  }, [clearMessages, isConnected, sendWebRTCMessage, addMessage]);

  // Charger l'historique et connexion initiale (une seule fois)
  useEffect(() => {
    // Charger l'historique des messages
    try {
      const savedMessages = JSON.parse(localStorage.getItem('chat-messages') || '[]');
      if (savedMessages.length > 0) {
        const loadedMessages = savedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
    
    // Message de bienvenue
    addMessage('🛡️ SecureLink initialisé - Canal de communication sécurisé prêt', 'System', 'system', false);
    
    // Connexion automatique unique avec support des canaux
    if (!hasAutoConnected && channel) {
      setHasAutoConnected(true);
      setTimeout(async () => {
        console.log(`Connexion automatique et rejointure du canal ${channel.name}...`);
        
        try {
          console.log(`[DEBUG] Canal à rejoindre:`, channel);
          
          // Se connecter au serveur d'abord
          await connect();
          
          // Puis rejoindre le canal après un court délai
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
  }, []);

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
            title="Effacer l'historique"
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
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input pour nouveau message */}
      <MessageInput 
        onSendMessage={sendMessage}
        disabled={connectionStatus === 'disconnected'}
        connectionStatus={connectionStatus}
      />

      {/* Info de debug en développement */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <small>
            Status: {connectionStatus} | Messages: {messages.length} | Connected: {isConnected ? 'Yes' : 'No'}
          </small>
        </div>
      )}
    </div>
  );
}

export default Chat;