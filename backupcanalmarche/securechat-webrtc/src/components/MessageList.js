// src/components/MessageList.js
import React from 'react';

function MessageList({ messages, currentUser }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const today = new Date();
    const messageDate = new Date(timestamp);
    
    if (today.toDateString() === messageDate.toDateString()) {
      return null; // Aujourd'hui, on affiche juste l'heure
    }
    
    return messageDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getMessageClass = (message) => {
    let baseClass = 'message';
    
    if (message.sender === currentUser) {
      baseClass += ' message-sent';
    } else if (message.type === 'system') {
      baseClass += ' message-system';
    } else if (message.type === 'emergency') {
      baseClass += ' message-emergency';
    } else {
      baseClass += ' message-received';
    }
    
    return baseClass;
  };

  const getMessageIcon = (message) => {
    switch (message.type) {
      case 'emergency':
        return '🚨';
      case 'system':
        return 'ℹ️';
      case 'encrypted':
        return '🔒';
      default:
        return null;
    }
  };

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    
    return currentDate !== previousDate;
  };

  const renderDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    
    let dateText;
    if (date.toDateString() === today.toDateString()) {
      dateText = "Aujourd'hui";
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        dateText = "Hier";
      } else {
        dateText = date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long'
        });
      }
    }
    
    return (
      <div className="date-separator">
        <div className="date-line"></div>
        <span className="date-text">{dateText}</span>
        <div className="date-line"></div>
      </div>
    );
  };

  const renderMessage = (message, index) => {
    const showDateSeparator = shouldShowDateSeparator(
      message, 
      index > 0 ? messages[index - 1] : null
    );
    
    const messageIcon = getMessageIcon(message);
    const messageDate = formatDate(message.timestamp);
    
    return (
      <React.Fragment key={message.id}>
        {showDateSeparator && renderDateSeparator(message.timestamp)}
        
        <div className={getMessageClass(message)}>
          <div className="message-content">
            <div className="message-header">
              {messageIcon && (
                <span className="message-icon">{messageIcon}</span>
              )}
              {message.sender !== currentUser && message.type !== 'system' && (
                <span className="message-sender-name">{message.sender}</span>
              )}
            </div>
            
            <div className="message-text">
              {message.text}
            </div>
            
            <div className="message-meta">
              <span className="message-time">
                {messageDate && <span className="message-date">{messageDate} </span>}
                {formatTime(message.timestamp)}
              </span>
              
              {message.sender === currentUser && (
                <span className="message-status">
                  {message.delivered ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
          
          {/* Indicateur de chiffrement pour les messages sensibles */}
          {message.encrypted && (
            <div className="encryption-indicator" title="Message chiffré">
              🔒
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="no-messages">
          <div className="no-messages-icon">📡</div>
          <p>Canal sécurisé établi</p>
          <small>Vos communications sont chiffrées de bout en bout.</small>
          <div className="security-info">
            <div className="security-item">
              <span className="security-icon">🔒</span>
              <span>Chiffrement AES-256</span>
            </div>
            <div className="security-item">
              <span className="security-icon">🌐</span>
              <span>Réseau P2P</span>
            </div>
            <div className="security-item">
              <span className="security-icon">👁️‍🗨️</span>
              <span>Mode furtif activé</span>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message, index) => renderMessage(message, index))
      )}
      
      {/* Indicateur de frappe (pour plus tard avec WebRTC) */}
      {false && ( // Remplacer par une vraie condition
        <div className="typing-indicator">
          <div className="typing-content">
            <span className="typing-user">Agent partenaire</span>
            <span className="typing-text">tape...</span>
            <div className="typing-dots">
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

export default MessageList;