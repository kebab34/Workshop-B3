// src/components/MeshStatus.js
import React, { useState, useEffect } from 'react';

function MeshStatus({ meshServers = [], isScanning = false }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const toggleNodeExpansion = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getNodeStatusIcon = (node) => {
    const now = Date.now();
    const lastSeen = new Date(node.lastSeen || Date.now()).getTime();
    const timeDiff = now - lastSeen;

    if (timeDiff < 30000) return { icon: '🟢', status: 'En ligne' };
    if (timeDiff < 120000) return { icon: '🟡', status: 'Latence' };
    return { icon: '🔴', status: 'Hors ligne' };
  };

  const getNetworkStrength = () => {
    if (meshServers.length === 0) return { strength: 0, label: 'Aucun réseau' };
    if (meshServers.length === 1) return { strength: 1, label: 'Réseau faible' };
    if (meshServers.length <= 3) return { strength: 2, label: 'Réseau modéré' };
    if (meshServers.length <= 5) return { strength: 3, label: 'Réseau fort' };
    return { strength: 4, label: 'Réseau excellent' };
  };

  const totalUsers = meshServers.reduce((sum, server) => sum + (server.users || 0), 0);
  const networkStrength = getNetworkStrength();

  return (
    <div className="mesh-status">
      <div className="mesh-header">
        <div className="mesh-title">
          <span className="mesh-icon">🕸️</span>
          <h4>Réseau Mesh Local</h4>
        </div>
        
        <div className="network-strength">
          <div className="strength-bars">
            {[1, 2, 3, 4].map(bar => (
              <div 
                key={bar}
                className={`strength-bar ${bar <= networkStrength.strength ? 'active' : ''}`}
              />
            ))}
          </div>
          <span className="strength-label">{networkStrength.label}</span>
        </div>
      </div>

      <div className="mesh-stats">
        <div className="stat-item">
          <span className="stat-value">{meshServers.length}</span>
          <span className="stat-label">Nœuds</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalUsers}</span>
          <span className="stat-label">Utilisateurs</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{isScanning ? '...' : '45ms'}</span>
          <span className="stat-label">Latence</span>
        </div>
      </div>

      {isScanning && (
        <div className="scanning-indicator">
          <div className="scanning-animation">
            <div className="pulse"></div>
            <div className="pulse"></div>
            <div className="pulse"></div>
          </div>
          <span>Scan du réseau en cours...</span>
        </div>
      )}

      <div className="mesh-nodes">
        {meshServers.length > 0 ? (
          meshServers.map((server, index) => {
            const nodeId = `${server.ip}:${server.port || 3001}`;
            const isExpanded = expandedNodes.has(nodeId);
            const statusInfo = getNodeStatusIcon(server);

            return (
              <div 
                key={nodeId}
                className={`mesh-node ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleNodeExpansion(nodeId)}
              >
                <div className="node-header">
                  <div className="node-basic-info">
                    <span className="node-status">{statusInfo.icon}</span>
                    <span className="node-ip">{server.ip}</span>
                    <span className="node-users">
                      👥 {server.users || 0} utilisateur{(server.users || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="node-controls">
                    <span className="node-expand">{isExpanded ? '🔽' : '▶️'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="node-details">
                    <div className="detail-row">
                      <span className="detail-label">Statut:</span>
                      <span className="detail-value">{statusInfo.status}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Port:</span>
                      <span className="detail-value">{server.port || 3001}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Uptime:</span>
                      <span className="detail-value">
                        {server.uptime ? Math.floor(server.uptime / 60) + 'm' : 'N/A'}
                      </span>
                    </div>
                    {server.url && (
                      <div className="detail-row">
                        <span className="detail-label">URL:</span>
                        <span className="detail-value detail-url">{server.url}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : !isScanning ? (
          <div className="no-mesh">
            <div className="no-mesh-icon">📡</div>
            <h4>Aucun nœud mesh détecté</h4>
            <p>Pour créer un réseau mesh:</p>
            <ul>
              <li>Activez un hotspot Wi-Fi "SecureLink-Mesh"</li>
              <li>Démarrez le serveur mesh sur port 3001</li>
              <li>Connectez d'autres appareils au réseau</li>
            </ul>
            <div className="create-mesh-hint">
              <span className="hint-icon">💡</span>
              <span>Mode autonome activé - Communications P2P locales disponibles</span>
            </div>
          </div>
        ) : null}
      </div>

      {meshServers.length > 0 && (
        <div className="mesh-actions">
          <button className="mesh-action-btn">
            📊 Statistiques détaillées
          </button>
          <button className="mesh-action-btn">
            🔧 Configuration réseau
          </button>
        </div>
      )}
    </div>
  );
}

export default MeshStatus;