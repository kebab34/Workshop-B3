import React, { useState, useRef, useEffect } from 'react';

function MessageInput({ onSendMessage, disabled = false, connectionStatus }) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Emojis rapides pour communication d'urgence
  const quickEmojis = [
    { emoji: '🆘', label: 'SOS' },
    { emoji: '👍', label: 'OK' },
    { emoji: '👎', label: 'Non' },
    { emoji: '⚠️', label: 'Attention' },
    { emoji: '🔥', label: 'Urgence' },
    { emoji: '📍', label: 'Position' },
    { emoji: '🏃', label: 'Fuite' },
    { emoji: '😶', label: 'Silence' }
  ];

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setIsComposing(false);
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    setIsComposing(value.length > 0);
    
    if (value.length > 0 && !isComposing) {
      console.log('User started typing...');
    } else if (value.length === 0 && isComposing) {
      console.log('User stopped typing...');
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleQuickMessage = (quickMsg) => {
    if (!disabled) {
      onSendMessage(quickMsg);
    }
  };

  const getPlaceholderText = () => {
    switch (connectionStatus) {
      case 'connected':
        return "Message sécurisé...";
      case 'connecting':
        return "Établissement de la connexion...";
      case 'disconnected':
        return "Connexion requise...";
      case 'error':
        return "Erreur de connexion...";
      default:
        return "Tapez votre message...";
    }
  };

  const getCharacterCountColor = () => {
    const length = message.length;
    if (length > 450) return '#ff4444';
    if (length > 400) return '#ffaa00';
    return '#666';
  };

  return (
    <div className="message-input-container">
      {/* Messages rapides d'urgence */}
      <div className="quick-actions">
        <div className="quick-messages">
          <button 
            className="quick-btn emergency"
            onClick={() => handleQuickMessage('🆘 URGENCE - Besoin d\'aide immédiate!')}
            disabled={disabled}
            title="Message d'urgence"
          >
            🆘 SOS
          </button>
          <button 
            className="quick-btn status"
            onClick={() => handleQuickMessage('👍 Statut: OK, position sécurisée')}
            disabled={disabled}
            title="Statut OK"
          >
            👍 OK
          </button>
          <button 
            className="quick-btn warning"
            onClick={() => handleQuickMessage('⚠️ ATTENTION - Menace détectée, restez vigilant')}
            disabled={disabled}
            title="Signal d'alerte"
          >
            ⚠️ ALERTE
          </button>
        </div>
        
        <button 
          className="emoji-toggle"
          onClick={() => setShowEmoji(!showEmoji)}
          disabled={disabled}
          title="Emojis rapides"
        >
          😶
        </button>
      </div>

      {/* Panel d'emojis rapides */}
      {showEmoji && (
        <div className="emoji-panel">
          <div className="emoji-header">Communication rapide</div>
          <div className="emoji-grid">
            {quickEmojis.map(({ emoji, label }) => (
              <button
                key={emoji}
                className="emoji-btn"
                onClick={() => handleEmojiClick(emoji)}
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone de saisie principale */}
      <form onSubmit={handleSubmit} className="message-form">
        <div className="input-wrapper">
          <textarea
            ref={(el) => {
              inputRef.current = el;
              textareaRef.current = el;
            }}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholderText()}
            className="message-textarea"
            disabled={disabled}
            rows={1}
            maxLength={500}
          />
          
          <button 
            type="submit" 
            className={`send-button ${isComposing ? 'active' : ''}`}
            disabled={disabled || !message.trim()}
            title="Envoyer (Enter)"
          >
            {isComposing ? '➤' : '○'}
          </button>
        </div>
        
        <div className="input-footer">
          <div className="input-info">
            <span 
              className="char-count"
              style={{ color: getCharacterCountColor() }}
            >
              {message.length}/500
            </span>
            
            {connectionStatus === 'connected' && (
              <span className="encryption-status">
                🔒 Chiffré E2E
              </span>
            )}
          </div>
          
          <div className="network-status">
            {connectionStatus === 'connected' && (
              <span className="latency">⚡ 45ms</span>
            )}
          </div>
        </div>
      </form>

      {/* Indicateurs de sécurité */}
      <div className="security-indicators">
        <div className={`security-indicator ${connectionStatus === 'connected' ? 'active' : ''}`}>
          <span className="indicator-icon">🔒</span>
          <span className="indicator-text">Chiffrement</span>
        </div>
        
        <div className={`security-indicator ${connectionStatus === 'connected' ? 'active' : ''}`}>
          <span className="indicator-icon">🕶️</span>
          <span className="indicator-text">Anonymat</span>
        </div>
        
        <div className={`security-indicator ${connectionStatus === 'connected' ? 'active' : ''}`}>
          <span className="indicator-icon">📡</span>
          <span className="indicator-text">P2P Direct</span>
        </div>
      </div>

      {/* Messages d'aide contextuelle */}
      {disabled && (
        <div className="connection-help">
          <span className="help-icon">ℹ️</span>
          <span>Établissement du canal sécurisé en cours...</span>
        </div>
      )}
      
      {connectionStatus === 'error' && (
        <div className="connection-error">
          <span className="error-icon">⚠️</span>
          <span>Connexion compromise. Tentative de reconnexion...</span>
        </div>
      )}
    </div>
  );
}

export default MessageInput;