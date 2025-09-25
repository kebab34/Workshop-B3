// Test simple de synchronisation des utilisateurs
const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

async function testUserSync() {
  console.log('🔄 Test de synchronisation des utilisateurs...\n');
  
  // Premier utilisateur se connecte
  const user1 = io(SERVER_URL);
  
  await new Promise(resolve => {
    user1.on('connect', () => {
      console.log('✅ User1 connecté');
      
      // User1 rejoint le canal
      user1.emit('user-join', 'User1');
      user1.emit('join-channel', { 
        channelId: 'general', 
        channelName: 'Canal Général' 
      });
      
      // Écouter les événements
      user1.on('channel-users', (users) => {
        console.log('👥 User1 reçoit liste des utilisateurs:', users);
      });
      
      resolve();
    });
  });
  
  // Attendre un peu puis connecter le deuxième utilisateur
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const user2 = io(SERVER_URL);
  
  await new Promise(resolve => {
    user2.on('connect', () => {
      console.log('✅ User2 connecté');
      
      // User2 rejoint le même canal
      user2.emit('user-join', 'User2');
      user2.emit('join-channel', { 
        channelId: 'general', 
        channelName: 'Canal Général' 
      });
      
      // Écouter les événements
      user2.on('channel-users', (users) => {
        console.log('👥 User2 reçoit liste des utilisateurs:', users);
      });
      
      resolve();
    });
  });
  
  // Attendre pour voir les résultats
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n🔚 Test terminé');
  user1.disconnect();
  user2.disconnect();
  process.exit(0);
}

testUserSync().catch(console.error);
