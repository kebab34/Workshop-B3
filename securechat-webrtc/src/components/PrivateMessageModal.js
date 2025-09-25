// src/components/PrivateMessageModal.js
import React, { useState, useEffect, useRef } from 'react';
import '../styles/PrivateMessageModal.css';

function PrivateMessageModal({ 
  isOpen, 
  onClose, 
  targetUser, 
  currentUser,
  socket,
  messages = [],
  onSendMessage 
}) {
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gestion de la frappe
  useEffect(() => {
    if (socket && isOpen) {
      // Écouter les notifications de frappe
      const handleTypingStart = ({ from }) => {
        if (from === targetUser?.username) {
          setPartnerTyping(true);
        }
      };

      const handleTypingStop = ({ from }) => {
        if (from === targetUser?.username) {
          setPartnerTyping(false);
        }
      };

      socket.on('private-typing-start', handleTypingStart);
      socket.on('private-typing-stop', handleTypingStop);

      return () => {
        socket.off('private-typing-start', handleTypingStart);
        socket.off('private-typing-stop', handleTypingStop);
      };
    }
  }, [socket, isOpen, targetUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !targetUser) return;

    const message = {
      id: Date.now() + Math.random(),
      text: messageText.trim(),
      sender: currentUser,
      recipient: targetUser.username,
      timestamp: new Date().toISOString(),
      type: 'private'
    };

    onSendMessage(message);
    setMessageText('');
    
    // Arrêter l'indicateur de frappe
    if (socket) {
      socket.emit('private-typing-stop', {
        to: targetUser.username,
        from: currentUser
      });
    }
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageText(value);

    if (!socket) return;

    // Gestion de l'indicateur "en train de taper"
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      socket.emit('private-typing-start', {
        to: targetUser?.username,
        from: currentUser
      });
    }

    // Reset du timeout de frappe
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('private-typing-stop', {
          to: targetUser?.username,
          from: currentUser
        });
      }
      setIsTyping(false);
    }, 2000);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClose = () => {
    // Nettoyer les timeouts
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Arrêter l'indicateur de frappe
    if (socket && isTyping) {
      socket.emit('private-typing-stop', {
        to: targetUser?.username,
        from: currentUser
      });
    }
    
    setMessageText('');
    setIsTyping(false);
    setPartnerTyping(false);
    onClose();
  };

  if (!isOpen || !targetUser) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="private-message-modal" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="pm-header">
          <div className="pm-user-info">
            <div className="pm-avatar">
              <span className="pm-initial">
                {targetUser.username.charAt(0).toUpperCase()}
              </span>
              <div className="pm-status-dot online"></div>
            </div>
            <div className="pm-user-details">
              <h3>Message privé</h3>
              <p>Conversation avec {targetUser.username}</p>
            </div>
          </div>
          
          <button 
            className="pm-close-button" 
            onClick={handleClose}
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="pm-messages-container">
          {messages.length === 0 ? (
            <div className="pm-no-messages">
              <div className="pm-welcome-icon">💬</div>
              <h4>Début de votre conversation</h4>
              <p>Envoyez un message privé et sécurisé à {targetUser.username}</p>
              <div className="pm-security-info">
                <span className="pm-security-item">🔒 Chiffré E2E</span>
                <span className="pm-security-item">👁️ Éphémère</span>
                <span className="pm-security-item">📡 P2P</span>
              </div>
            </div>
          ) : (
            <div className="pm-messages-list">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`pm-message ${
                    message.sender === currentUser ? 'sent' : 'received'
                  }`}
                >
                  <div className="pm-message-content">
                    <p className="pm-message-text">{message.text}</p>
                    <div className="pm-message-meta">
                      <span className="pm-message-time">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.sender === currentUser && (
                        <span className="pm-message-status">✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Indicateur de frappe */}
              {partnerTyping && (
                <div className="pm-typing-indicator">
                  <div className="pm-typing-content">
                    <span className="pm-typing-text">
                      {targetUser.username} tape...
                    </span>
                    <div className="pm-typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="pm-input-container">
          <form onSubmit={handleSendMessage} className="pm-form">
            <div className="pm-input-wrapper">
              <input
                type="text"
                value={messageText}
                onChange={handleInputChange}
                placeholder={`Message privé à ${targetUser.username}...`}
                className="pm-input"
                maxLength={500}
                autoFocus
              />
              <button
                type="submit"
                className={`pm-send-button ${messageText.trim() ? 'active' : ''}`}
                disabled={!messageText.trim()}
                title="Envoyer (Enter)"
              >
                ➤
              </button>
            </div>
            
            <div className="pm-input-footer">
              <span className="pm-char-count">
                {messageText.length}/500
              </span>
              <div className="pm-security-indicators">
                <span className="pm-indicator">🔒 Chiffré</span>
                <span className="pm-indicator">📡 Direct</span>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

export default PrivateMessageModal;