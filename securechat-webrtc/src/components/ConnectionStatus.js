// src/components/ConnectionStatus.js
import React from 'react';

function ConnectionStatus({ status, partnerName }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          text: `Connecté${partnerName ? ` à ${partnerName}` : ''}`,
          class: 'status-connected',
          icon: '🟢'
        };
      case 'connecting':
        return {
          text: 'Connexion en cours...',
          class: 'status-connecting',
          icon: '🟡'
        };
      case 'error':
        return {
          text: 'Erreur de connexion',
          class: 'status-error',
          icon: '🔴'
        };
      default:
        return {
          text: 'Déconnecté',
          class: 'status-disconnected',
          icon: '⚪'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`connection-status ${statusInfo.class}`}>
      <span className="status-icon">{statusInfo.icon}</span>
      <span className="status-text">{statusInfo.text}</span>
    </div>
  );
}

export default ConnectionStatus;