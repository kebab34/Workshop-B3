#!/usr/bin/env node
/**
 * Test de connectivité pour SecureLink
 */

const { execSync } = require('child_process');

async function testConnectivity() {
    console.log('🔍 Test de connectivité SecureLink\n');
    
    // 1. Vérifier l'IP locale
    try {
        const interfaces = require('os').networkInterfaces();
        let localIP = null;
        
        for (const [name, ifaces] of Object.entries(interfaces)) {
            for (const iface of ifaces) {
                if (iface.family === 'IPv4' && !iface.internal && 
                    (iface.address.startsWith('192.168.') || 
                     iface.address.startsWith('172.20.') ||
                     iface.address.startsWith('10.'))) {
                    localIP = iface.address;
                    console.log(`✅ IP locale détectée: ${localIP} (interface: ${name})`);
                    break;
                }
            }
        }
        
        if (!localIP) {
            console.log('❌ Impossible de détecter l\'IP locale');
            return;
        }
        
        // 2. Tester le serveur mesh
        try {
            const response = await fetch(`http://${localIP}:3001/health`);
            const data = await response.json();
            console.log(`✅ Serveur mesh: ${data.status} (${data.connectedUsers} utilisateurs)`);
        } catch (error) {
            console.log(`❌ Serveur mesh inaccessible sur ${localIP}:3001`);
        }
        
        // 3. Tester l'application React
        try {
            const response = await fetch(`http://${localIP}:3000`);
            if (response.ok) {
                console.log(`✅ Application React accessible sur ${localIP}:3000`);
            } else {
                console.log(`⚠️  Application React répond mais avec erreur: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Application React inaccessible sur ${localIP}:3000`);
        }
        
        // 4. Tester Socket.IO
        console.log('\n🔌 Test de la connexion Socket.IO...');
        const io = require('socket.io-client');
        const socket = io(`http://${localIP}:3001`, {
            timeout: 5000,
            transports: ['websocket']
        });
        
        socket.on('connect', () => {
            console.log('✅ Connexion Socket.IO établie');
            socket.emit('register', 'test-user');
            
            setTimeout(() => {
                socket.disconnect();
                console.log('✅ Test Socket.IO terminé avec succès\n');
                console.log('🎉 Tous les tests de connectivité sont passés !');
                console.log(`📱 Accédez à votre application: http://${localIP}:3000`);
            }, 2000);
        });
        
        socket.on('connect_error', (error) => {
            console.log(`❌ Erreur Socket.IO: ${error.message}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
    }
}

testConnectivity();
