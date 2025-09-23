// src/components/MeshStatus.js
import React, { useState, useEffect } from 'react';
import { discoverMeshServers } from '../utils/networkDiscovery';

function MeshStatus() {
  const [meshServers, setMeshServers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const scanNetwork = async () => {
    setIsScanning(true);
    try {
      const servers = await discoverMeshServers();
      setMeshServers(servers);
    } catch (error) {
      console.error('Erreur scan réseau:', error);
    }
    setIsScanning(false);
  };

  useEffect(() => {
    scanNetwork();
    const interval = setInterval(scanNetwork, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mesh-status">
      <div className="mesh-header">
        <span>Réseau Mesh Local</span>
        <button onClick={scanNetwork} disabled={isScanning}>
          {isScanning ? 'Scan...' : 'Actualiser'}
        </button>
      </div>
      
      <div className="mesh-nodes">
        {meshServers.map((server, index) => (
          <div key={index} className="mesh-node">
            <span className="node-ip">{server.ip}</span>
            <span className="node-users">{server.users} utilisateurs</span>
          </div>
        ))}
      </div>
      
      {meshServers.length === 0 && !isScanning && (
        <div className="no-mesh">
          Aucun réseau mesh détecté. 
          Créez un hotspot Wi-Fi "SecureLink-Mesh" pour commencer.
        </div>
      )}
    </div>
  );
}

export default MeshStatus;