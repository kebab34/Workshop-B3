// src/components/JoinChannelModal.js - Version corrigée
import React, { useState, useEffect } from 'react';
import '../styles/JoinChannelModal.css';

function JoinChannelModal({ isOpen, channel, onClose, onJoinChannel, username }) {
  const [password, setPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  // Reset des états quand le modal change
  useEffect(() => {
    if (isOpen && channel) {
      setPassword('');
      setError('');
      setAttempts(0);
      setIsJoining(false);
    }
  }, [isOpen, channel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Veuillez entrer le mot de passe');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Simuler une vérification de mot de passe
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const isPasswordCorrect = await verifyChannelPassword(channel.id, password);
      
      if (isPasswordCorrect) {
        // Rejoindre le canal avec succès
        await onJoinChannel(channel, password);
        handleClose();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 3) {
          setError('Trop de tentatives échouées. Canal temporairement verrouillé.');
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else {
          setError(`Mot de passe incorrect. ${3 - newAttempts} tentative(s) restante(s).`);
        }
        setPassword('');
      }
    } catch (error) {
      console.error('Erreur connexion canal:', error);
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    // Reset immédiat des états pour éviter les erreurs React
    setPassword('');
    setError('');
    setAttempts(0);
    setIsJoining(false);
    onClose();
  };

  // Fonction de vérification du mot de passe
  const verifyChannelPassword = async (channelId, inputPassword) => {
    // Mots de passe de démonstration
    const validPasswords = {
      'demo123': true,
      'test': true,
      'password': true,
      'admin': true,
      'ultron': true // Thématique !
    };
    
    return validPasswords[inputPassword] || false;
  };

  const getChannelTypeInfo = () => {
    if (!channel) return { icon: '💬', title: 'Canal', description: '', color: '#00ff88' };

    switch (channel.type) {
      case 'tactical':
        return {
          icon: '⚡',
          title: 'Canal Tactique',
          description: 'Communications opérationnelles sensibles',
          color: '#ffaa00'
        };
      case 'emergency':
        return {
          icon: '🚨',
          title: 'Canal d\'Urgence', 
          description: 'Communications d\'urgence prioritaires',
          color: '#ff4444'
        };
      case 'private':
        return {
          icon: '🔒',
          title: 'Canal Privé',
          description: 'Accès restreint par mot de passe',
          color: '#8844ff'
        };
      default:
        return {
          icon: '💬',
          title: 'Canal Sécurisé',
          description: 'Communications protégées',
          color: '#00ff88'
        };
    }
  };

  // Render conditionnel sécurisé
  if (!isOpen || !channel) {
    return null;
  }

  const typeInfo = getChannelTypeInfo();

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="join-channel-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="channel-info">
            <span 
              className="channel-type-icon"
              style={{ color: typeInfo.color }}
            >
              {typeInfo.icon}
            </span>
            <div className="channel-details">
              <h2>{channel.name}</h2>
              <p className="channel-type">{typeInfo.title}</p>
            </div>
          </div>
          <button 
            type="button"
            className="close-button" 
            onClick={handleClose}
            disabled={isJoining}
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <div className="security-notice">
            <div className="security-icon">🛡️</div>
            <div className="security-text">
              <strong>Canal Sécurisé</strong>
              <br />
              {typeInfo.description}
            </div>
          </div>

          {channel.description && (
            <div className="channel-description">
              <p>{channel.description}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="password-form">
            <div className="form-group">
              <label htmlFor="channel-password">
                Mot de passe requis pour rejoindre ce canal
              </label>
              <div className="password-input-group">
                <input
                  id="channel-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`password-input ${error ? 'error' : ''}`}
                  placeholder="Entrez le mot de passe..."
                  disabled={isJoining || attempts >= 3}
                  autoFocus
                  maxLength={50}
                />
                <div className="input-security-indicator">
                  <span className="security-badge">🔐</span>
                </div>
              </div>
              
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="channel-stats">
              <div className="stat-item">
                <span className="stat-icon">👥</span>
                <span className="stat-text">
                  {channel.users || 0}/{channel.maxUsers || '∞'} utilisateurs
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">📅</span>
                <span className="stat-text">
                  Créé {channel.createdAt ? 
                    new Date(channel.createdAt).toLocaleDateString('fr-FR') : 
                    'récemment'
                  }
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleClose}
                className="cancel-button"
                disabled={isJoining}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="join-button"
                disabled={isJoining || attempts >= 3 || !password.trim()}
                style={{ backgroundColor: attempts >= 3 ? '#666' : typeInfo.color }}
              >
                {isJoining ? (
                  <>
                    <span className="loading-spinner">⟳</span>
                    Connexion...
                  </>
                ) : attempts >= 3 ? (
                  <>
                    <span className="lock-icon">🔒</span>
                    Verrouillé
                  </>
                ) : (
                  <>
                    <span className="join-icon">🚪</span>
                    Rejoindre
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Aide pour la démo */}
          {process.env.NODE_ENV === 'development' && (
            <div className="demo-help">
              <div className="demo-title">💡 Aide démo :</div>
              <div className="demo-passwords">
                Mots de passe valides : <code>demo123</code>, <code>test</code>, <code>password</code>, <code>admin</code>, <code>ultron</code>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="security-indicators">
            <div className="security-item">
              <span className="indicator-icon">🔒</span>
              <span>Chiffré E2E</span>
            </div>
            <div className="security-item">
              <span className="indicator-icon">🕶️</span>
              <span>Mode privé</span>
            </div>
            <div className="security-item">
              <span className="indicator-icon">📡</span>
              <span>Réseau mesh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinChannelModal;