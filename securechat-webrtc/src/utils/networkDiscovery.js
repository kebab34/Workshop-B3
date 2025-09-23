// src/utils/networkDiscovery.js
/**
 * Utilitaires pour découvrir et gérer les serveurs mesh SecureLink
 */

// Configuration par défaut
const DEFAULT_PORTS = [3001, 3002, 8080];
const COMMON_MESH_NAMES = ['SecureLink-Mesh', 'SecureLink_Emergency', 'SecureLink_Node'];

/**
 * Découvre les serveurs mesh sur le réseau local
 */
export const discoverMeshServers = async () => {
  const servers = [];
  
  try {
    // Obtenir l'IP locale approximative
    const localIP = await getLocalNetworkIP();
    const subnet = localIP.substring(0, localIP.lastIndexOf('.'));
    
    console.log(`[DISCOVERY] Scan du réseau ${subnet}.x`);
    
    // IPs communes à scanner
    const targetIPs = [
      `${subnet}.1`,   // Gateway
      `${subnet}.2`,   // Premier client
      `${subnet}.10`,  // IP commune
      `${subnet}.100`, // IP commune
      '192.168.1.1',   // Router par défaut
      '192.168.0.1',   // Router alternatif
      '10.42.0.1',     // Hotspot Linux
      '172.20.10.1'    // Hotspot mobile
    ];
    
    // Scanner chaque IP
    const scanPromises = targetIPs.map(ip => scanIP(ip));
    const results = await Promise.allSettled(scanPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        servers.push(result.value);
      }
    });
    
    console.log(`[DISCOVERY] ${servers.length} serveurs mesh trouvés`);
    return servers;
    
  } catch (error) {
    console.error('[DISCOVERY] Erreur découverte réseau:', error);
    return [];
  }
};

/**
 * Scanner une IP spécifique pour détecter un serveur mesh
 */
const scanIP = async (ip) => {
  for (const port of DEFAULT_PORTS) {
    try {
      const url = `http://${ip}:${port}/health`;
      
      const response = await fetch(url, {
        method: 'GET',
        timeout: 2000,
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Vérifier si c'est un serveur SecureLink mesh
        if (data.mode === 'mesh' || data.status === 'OK') {
          return {
            ip,
            port,
            url: `http://${ip}:${port}`,
            users: data.connectedUsers || 0,
            uptime: data.uptime || 0,
            lastSeen: new Date().toISOString(),
            version: data.version || '1.0.0'
          };
        }
      }
    } catch (error) {
      // Continuer le scan même si une IP échoue
      continue;
    }
  }
  
  return null;
};

/**
 * Obtient l'IP du réseau local
 */
const getLocalNetworkIP = async () => {
  try {
    // Méthode 1: Via WebRTC (fonctionne dans le navigateur)
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (ipMatch && !ipMatch[1].startsWith('127.')) {
            pc.close();
            resolve(ipMatch[1]);
          }
        }
      };
      
      // Timeout de secours
      setTimeout(() => {
        pc.close();
        resolve('192.168.1.100'); // IP par défaut
      }, 3000);
    });
    
  } catch (error) {
    console.error('[DISCOVERY] Erreur détection IP locale:', error);
    return '192.168.1.100'; // IP par défaut
  }
};

/**
 * Trouve le meilleur serveur mesh disponible
 */
export const getBestServer = async () => {
  const servers = await discoverMeshServers();
  
  if (servers.length === 0) {
    // Aucun serveur trouvé, utiliser le serveur par défaut
    return {
      url: process.env.REACT_APP_SERVER_URL || 'http://localhost:3001',
      ip: 'localhost',
      port: 3001,
      users: 0,
      fallback: true
    };
  }
  
  // Trier par nombre d'utilisateurs (moins = mieux pour la charge)
  // puis par uptime (plus = plus stable)
  servers.sort((a, b) => {
    if (a.users !== b.users) {
      return a.users - b.users; // Moins d'utilisateurs en premier
    }
    return b.uptime - a.uptime; // Plus d'uptime en premier
  });
  
  return servers[0];
};

/**
 * Test de latence vers un serveur
 */
export const testLatency = async (serverUrl) => {
  const start = performance.now();
  
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      const end = performance.now();
      return Math.round(end - start);
    }
    
    return -1;
  } catch (error) {
    return -1;
  }
};

/**
 * Annonce ce client aux autres nœuds mesh
 */
export const announceTo = async (serverUrl, clientInfo) => {
  try {
    const response = await fetch(`${serverUrl}/announce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientInfo)
    });
    
    return response.ok;
  } catch (error) {
    console.error(`[DISCOVERY] Erreur annonce vers ${serverUrl}:`, error);
    return false;
  }
};

/**
 * Vérifie la connectivité Internet (pour mode hybride)
 */
export const checkInternetConnectivity = async () => {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'GET',
      mode: 'no-cors',
      timeout: 3000
    });
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Obtient les informations réseau du navigateur
 */
export const getNetworkInfo = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    return {
      type: connection.effectiveType || connection.type || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false
    };
  }
  
  return {
    type: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false
  };
};