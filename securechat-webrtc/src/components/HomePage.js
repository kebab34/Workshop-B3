// src/components/HomePage.js
import React, { useState, useEffect } from 'react';
import MeshStatus from './MeshStatus';
import { discoverMeshServers } from '../utils/networkDiscovery';
import '../styles/HomePage.css';

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
      status: 'active'
    },
    {
      id: 'emergency',
      name: 'Canal d\'Urgence',
      description: 'Communications d\'urgence uniquement',
      users: 0,
      type: 'emergency',
      icon: '🚨',
      status: 'active'
    },
    {
      id: 'recon',
      name: 'Reconnaissance',
      description: 'Échange d\'informations terrain',
      users: 0,
      type: 'tactical',
      icon: '🔍',
      status: 'active'
    },
    {
      id: 'logistics',
      name: 'Logistique',
      description: 'Coordination des ressources',
      users: 0,
      type: 'public',
      icon: '📦',
      status: 'active'
    }
  ]);

  const [meshServers, setMeshServers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);

  // Scanner les serveurs mesh disponibles
  const scanMeshNetwork = async () => {
    setIsScanning(true);
    try {
      const servers = await discoverMeshServers();
      setMeshServers(servers);
      
      // Mettre à jour les compteurs d'utilisateurs
      setAvailableChannels(prev => prev.map(channel => ({
        ...channel,
        users: Math.floor(Math.random() * 5) // Simulation pour la démo
      })));
    } catch (error) {
      console.error('Erreur scan réseau:', error);
    }
    setIsScanning(false);
  };

  // Rejoindre un canal
  const handleJoinChannel = (channel) => {
    setSelectedChannel(channel);
    // Animation de transition
    setTimeout(() => {
      onJoinChannel(channel);
    }, 500);
  };

  // Créer un nouveau canal
  const handleCreateChannel = () => {
    const channelName = prompt('Nom du nouveau canal:');
    if (channelName && channelName.trim()) {
      const newChannel = {
        id: `custom_${Date.now()}`,
        name: channelName.trim(),
        description: 'Canal personnalisé',
        users: 1,
        type: 'custom',
        icon: '💬',
        status: 'active'
      };
      
      setAvailableChannels(prev => [...prev, newChannel]);
    }
  };

  // Scan initial
  useEffect(() => {
    scanMeshNetwork();
    const interval = setInterval(scanMeshNetwork, 15000); // Scan toutes les 15s
    return () => clearInterval(interval);
  }, []);

  const getChannelIcon = (type) => {
    switch (type) {
      case 'emergency': return '🚨';
      case 'tactical': return '🔍';
      case 'custom': return '💬';
      default: return '📡';
    }
  };

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
            {meshServers.length > 0 ? 
              `Connecté au réseau mesh (${meshServers.length} nœuds)` : 
              'Mode autonome - Aucun réseau mesh détecté'
            }
          </p>
        </div>
        
        <div className="network-controls">
          <button 
            className="scan-button"
            onClick={scanMeshNetwork}
            disabled={isScanning}
            title="Scanner le réseau"
          >
            <span className={`scan-icon ${isScanning ? 'spinning' : ''}`}>🔄</span>
            {isScanning ? 'Scan...' : 'Scanner'}
          </button>
        </div>
      </div>

      {/* Section des canaux disponibles */}
      <div className="channels-section">
        <div className="section-header">
          <h3>Canaux Disponibles</h3>
          <button 
            className="create-channel-btn"
            onClick={handleCreateChannel}
            title="Créer un nouveau canal"
          >
            ➕ Nouveau Canal
          </button>
        </div>

        <div className="channels-grid">
          {availableChannels.map((channel) => (
            <div
              key={channel.id}
              className={`channel-card ${channel.type} ${selectedChannel?.id === channel.id ? 'selected' : ''}`}
              onClick={() => handleJoinChannel(channel)}
            >
              <div className="channel-header">
                <span className="channel-icon">{channel.icon}</span>
                <div className="channel-info">
                  <h4 className="channel-name">{channel.name}</h4>
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

      {/* Section réseau mesh */}
      <div className="mesh-section">
        <MeshStatus meshServers={meshServers} isScanning={isScanning} />
      </div>

      {/* Section d'aide rapide */}
      <div className="quick-help">
        <h4>Aide Rapide</h4>
        <div className="help-grid">
          <div className="help-item">
            <span className="help-icon">🔒</span>
            <span>Communications chiffrées E2E</span>
          </div>
          <div className="help-item">
            <span className="help-icon">📡</span>
            <span>Réseau mesh décentralisé</span>
          </div>
          <div className="help-item">
            <span className="help-icon">🚨</span>
            <span>Canal d'urgence prioritaire</span>
          </div>
          <div className="help-item">
            <span className="help-icon">🔧</span>
            <span>Fonctionne sans Internet</span>
          </div>
        </div>
      </div>

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