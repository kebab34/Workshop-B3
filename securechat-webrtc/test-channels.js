#!/usr/bin/env node
/**
 * Script de test pour simuler des connexions multiples au même canal
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://172.20.10.3:3001';
const CHANNEL_ID = 'general';

async function createTestUser(username) {
    console.log(`🔗 [${username}] Connexion au serveur...`);
    
    const socket = io(SERVER_URL, {
        transports: ['websocket'],
        timeout: 5000
    });
    
    return new Promise((resolve) => {
        socket.on('connect', () => {
            console.log(`✅ [${username}] Connecté au serveur`);
            
            // S'enregistrer
            socket.emit('register', username);
            
            // Rejoindre le canal
            setTimeout(() => {
                console.log(`📡 [${username}] Rejoint le canal ${CHANNEL_ID}`);
                socket.emit('join-channel', {
                    channelId: CHANNEL_ID,
                    channelName: 'Canal Général'
                });
            }, 500);
        });
        
        socket.on('user-joined-channel', ({ username: userName, channelId }) => {
            console.log(`👋 [${username}] Utilisateur ${userName} a rejoint le canal ${channelId}`);
        });
        
        socket.on('user-left-channel', ({ username: userName, channelId }) => {
            console.log(`👋 [${username}] Utilisateur ${userName} a quitté le canal ${channelId}`);
        });
        
        socket.on('channel-users', (users) => {
            console.log(`👥 [${username}] Utilisateurs dans le canal:`, users);
        });
        
        socket.on('connect_error', (error) => {
            console.log(`❌ [${username}] Erreur de connexion:`, error.message);
        });
        
        resolve(socket);
    });
}

async function runTest() {
    console.log('🧪 Test de connexion multiple au même canal\n');
    
    try {
        // Créer deux utilisateurs de test
        const user1 = await createTestUser('TestUser1');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const user2 = await createTestUser('TestUser2');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n✅ Test terminé - les deux utilisateurs devraient se voir mutuellement');
        
        // Nettoyer après 10 secondes
        setTimeout(() => {
            user1.disconnect();
            user2.disconnect();
            console.log('🧹 Connexions nettoyées');
            process.exit(0);
        }, 10000);
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
        process.exit(1);
    }
}

runTest();
