// src/utils/networkDiscovery.js
export const discoverMeshServers = async () => {
  const possibleIPs = [
    '10.42.0.1',        // Hotspot Linux (votre config)
    '192.168.137.1',    // Hotspot Windows
    '192.168.4.1',      // Hotspot Linux alternatif
    '172.20.10.1',      // Hotspot Mac/iOS
    '10.0.0.1',         // Autre config locale
    'localhost',        // Test local
  ];
  
  const foundServers = [];
  
  for (const ip of possibleIPs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const url = ip === 'localhost' ? 'http://localhost:3001' : `http://${ip}:3001`;
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        foundServers.push({
          url: ip === 'localhost' ? 'http://localhost:3001' : `http://${ip}:3001`,
          ip,
          users: data.connectedUsers || 0,
          uptime: data.uptime || 0,
          mode: data.mode || 'unknown'
        });
        console.log(`Serveur mesh trouvé: ${ip}`);
      }
    } catch (error) {
      // Serveur non trouvé sur cette IP, continuer silencieusement
    }
  }
  
  return foundServers;
};

export const getBestServer = async () => {
  const servers = await discoverMeshServers();
  
  if (servers.length === 0) {
    // Fallback vers localhost si aucun serveur mesh trouvé
    return {
      url: 'http://localhost:3001',
      ip: 'localhost',
      users: 0,
      fallback: true
    };
  }
  
  // Choisir le serveur avec le moins d'utilisateurs
  const bestServer = servers.sort((a, b) => a.users - b.users)[0];
  console.log('Meilleur serveur sélectionné:', bestServer);
  return bestServer;
};