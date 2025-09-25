// src/utils/networkDiscovery.js - Version améliorée
export const getBestServer = async () => {
  console.log('[DISCOVERY] Recherche du serveur...');

  // Liste prioritaire des IPs à tester (ajoutez l'IP de votre ami ici)
  const priorityIPs = [
    '172.20.10.3',  // IP ami (hotspot)
    '192.168.1.100', // IP potentielle ami
    '192.168.0.100', // IP potentielle ami 
    '10.0.0.100',   // IP potentielle ami
    // AJOUTEZ ICI L'IP EXACTE DE VOTRE AMI
  ];

  // Test prioritaire des IPs connues
  for (const ip of priorityIPs) {
    try {
      console.log(`[DISCOVERY] Test de ${ip}:3001...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://${ip}:3001/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[DISCOVERY] ✅ Serveur trouvé sur ${ip}:3001!`, data);
        return {
          url: `http://${ip}:3001`,
          ip: ip,
          port: 3001,
          users: data.connectedUsers || 0,
          uptime: data.serverUptime || 0
        };
      }
    } catch (error) {
      console.log(`[DISCOVERY] ❌ ${ip}:3001 non accessible:`, error.message);
      continue;
    }
  }

  // Si aucun serveur prioritaire trouvé, scanner le réseau local
  console.log('[DISCOVERY] Scan automatique du réseau...');
  
  try {
    const localIP = await getLocalNetworkIP();
    const subnet = localIP.substring(0, localIP.lastIndexOf('.'));
    console.log(`[DISCOVERY] Scan du sous-réseau ${subnet}.x`);
    
    // IPs communes à scanner dans le sous-réseau local
    const localIPs = [
      `${subnet}.1`,   // Gateway
      `${subnet}.2`,   // Premier client
      `${subnet}.10`,  
      `${subnet}.50`,
      `${subnet}.100`,
      `${subnet}.150`,
      `${subnet}.200`
    ];
    
    for (const ip of localIPs) {
      try {
        console.log(`[DISCOVERY] Test de ${ip}:3001...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch(`http://${ip}:3001/health`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[DISCOVERY] ✅ Serveur découvert sur ${ip}:3001!`);
          return {
            url: `http://${ip}:3001`,
            ip: ip,
            port: 3001,
            users: data.connectedUsers || 0,
            uptime: data.serverUptime || 0
          };
        }
      } catch (error) {
        continue; // Continuer le scan
      }
    }
  } catch (error) {
    console.error('[DISCOVERY] Erreur lors du scan réseau:', error);
  }

  // Fallback final : tenter localhost
  try {
    console.log('[DISCOVERY] Test fallback localhost...');
    const response = await fetch('http://localhost:3001/health', {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });
    
    if (response.ok) {
      console.log('[DISCOVERY] ✅ Serveur local trouvé');
      return {
        url: 'http://localhost:3001',
        ip: 'localhost',
        port: 3001,
        fallback: true
      };
    }
  } catch (error) {
    console.log('[DISCOVERY] Localhost non disponible');
  }

  // Aucun serveur trouvé
  console.error('[DISCOVERY] ❌ Aucun serveur mesh trouvé sur le réseau');
  throw new Error('Aucun serveur disponible. Vérifiez que le serveur fonctionne et que vous êtes sur le même réseau.');
};

// Fonction pour obtenir l'IP locale
const getLocalNetworkIP = async () => {
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
          return;
        }
      }
    };
    
    // Timeout de secours
    setTimeout(() => {
      pc.close();
      resolve('192.168.1.100'); // IP par défaut
    }, 3000);
  });
};