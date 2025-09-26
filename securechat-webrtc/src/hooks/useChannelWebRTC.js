import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const useChannelWebRTC = (username, onMessageReceived, onConnectionStatusChange) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [currentChannel, setCurrentChannel] = useState(null);
  const [channelUsers, setChannelUsers] = useState([]);
  const [error, setError] = useState(null);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const socketRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const isConnectingRef = useRef(false);

  // 🏢 Configuration WebRTC
  const rtcConfig = {
    iceServers: [],
    
    iceCandidatePoolSize: 3,
    iceTransportPolicy: 'all', 
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require'
  };

  const updateConnectionStatus = useCallback((status) => {
    setConnectionStatus(prevStatus => {
      if (prevStatus !== status) {
        console.log(`[CHANNEL] Connection status: ${prevStatus} -> ${status}`);
        onConnectionStatusChange?.(status);
        return status;
      }
      return prevStatus;
    });
  }, [onConnectionStatusChange]);

  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('🎉 [CHANNEL] Data channel ouvert - Mode LAN direct !');
      setIsConnected(true);
      updateConnectionStatus('connected');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 [CHANNEL] Message reçu via WebRTC P2P (LAN):', message);
        onMessageReceived?.(message);
      } catch (err) {
        console.error('[CHANNEL] Erreur parsing message:', err);
      }
    };

    channel.onclose = () => {
      console.log('❌ [CHANNEL] Data channel fermé');
      setIsConnected(false);
      updateConnectionStatus('disconnected');
    };

    channel.onerror = (error) => {
      console.error('[CHANNEL] Erreur data channel:', error);
      setError('Erreur de communication P2P');
      updateConnectionStatus('error');
    };

    dataChannelRef.current = channel;
  }, [updateConnectionStatus, onMessageReceived]);

  const cleanupOldConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('[CHANNEL] Nettoyage ancienne connexion P2P');
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.log('[CHANNEL] Erreur nettoyage:', err);
      }
      peerConnectionRef.current = null;
    }
    
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (err) {
        console.log('[CHANNEL] Erreur nettoyage canal:', err);
      }
      dataChannelRef.current = null;
    }
    
    isInitiatorRef.current = false;
    setIsConnected(false);
  }, []);

  const createPeerConnection = useCallback(() => {
    cleanupOldConnection();
    
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected && currentChannel) {
          console.log('🧊 [CHANNEL] Candidat ICE (LAN):', event.candidate.type, event.candidate.address);
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            channelId: currentChannel.id
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 [CHANNEL] Connection state:', pc.connectionState);
        console.log('📡 [CHANNEL] ICE Connection state:', pc.iceConnectionState);
        
        switch (pc.connectionState) {
          case 'connected':
            console.log('🚀 [CHANNEL] WebRTC P2P établi (réseau local) !');
            updateConnectionStatus('connected');
            setIsConnected(true);
            setError(null);
            break;
          case 'connecting':
            console.log('🔄 [CHANNEL] Connexion P2P en cours...');
            updateConnectionStatus('connecting');
            break;
          case 'disconnected':
            console.log('⚠️ [CHANNEL] P2P Déconnecté temporairement');
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
          case 'failed':
            console.log('💥 [CHANNEL] Échec P2P - Fallback vers Socket.IO');
            updateConnectionStatus('error');
            setIsConnected(false);
            setError('Connexion P2P échouée - Utilisation serveur de secours');
            break;
          case 'closed':
            console.log('🔒 [CHANNEL] P2P Fermé');
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
          default:
            console.log(`[CHANNEL] État: ${pc.connectionState}`);
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`📊 [CHANNEL] ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'completed') {
          console.log('✅ [CHANNEL] Connexion ICE optimale (réseau local)');
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        console.log('📬 [CHANNEL] Data channel reçu');
        setupDataChannel(channel);
      };

      return pc;
    } catch (err) {
      console.error('[CHANNEL] Erreur création PeerConnection:', err);
      setError('Erreur de création de connexion P2P');
      updateConnectionStatus('error');
      return null;
    }
  }, [setupDataChannel, updateConnectionStatus, currentChannel, cleanupOldConnection]);

  // Envoi d'un message
  const sendMessage = useCallback((text, type = 'text') => {
    console.log(`[CHANNEL] 💬 Envoi message:`, { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      type,
      dataChannelState: dataChannelRef.current?.readyState,
      socketConnected: socketRef.current?.connected,
      mode: dataChannelRef.current?.readyState === 'open' ? 'P2P-LAN' : 'Socket.IO'
    });

    const message = {
      text,
      type,
      sender: username,
      timestamp: new Date().toISOString(),
      channelId: currentChannel?.id,
      id: Date.now() + Math.random()
    };

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(message));
        console.log('✅ [CHANNEL] Message envoyé via P2P LAN (ultra-rapide)');
        return true;
      } catch (err) {
        console.error('❌ [CHANNEL] Erreur P2P, basculement Socket.IO:', err);
      }
    }

    if (socketRef.current?.connected && currentChannel) {
      try {
        console.log('📡 [CHANNEL] Envoi via Socket.IO (fallback)');
        socketRef.current.emit('send-message', message);
        console.log('✅ [CHANNEL] Message envoyé via Socket.IO');
        return true;
      } catch (err) {
        console.error('❌ [CHANNEL] Erreur Socket.IO:', err);
        setError('Erreur d\'envoi');
        return false;
      }
    }

    console.error('💀 [CHANNEL] Aucun canal de communication disponible');
    setError('Pas de connexion disponible');
    return false;
  }, [username, currentChannel]);

  // Création d'une offre
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected || !currentChannel) {
      console.error('[CHANNEL] Conditions non remplies pour créer une offre');
      return;
    }

    if (peerConnectionRef.current.signalingState !== 'stable') {
      console.log(`[CHANNEL] Offre ignorée - État: ${peerConnectionRef.current.signalingState}`);
      return;
    }

    try {
      console.log(`🤝 [CHANNEL] Création offre P2P pour canal ${currentChannel.name}`);
      
      const dataChannel = peerConnectionRef.current.createDataChannel('messages', {
        ordered: true,
        maxRetransmits: 3
      });
      setupDataChannel(dataChannel);

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      socketRef.current.emit('offer', {
        offer,
        from: username,
        channelId: currentChannel.id
      });

      isInitiatorRef.current = true;
      console.log('📤 [CHANNEL] Offre P2P envoyée');
    } catch (err) {
      console.error('[CHANNEL] Erreur création offre:', err);
      setError('Erreur de connexion P2P');
      updateConnectionStatus('error');
    }
  }, [username, currentChannel, setupDataChannel, updateConnectionStatus]);

  // Traitement d'une offre reçue
  const handleOffer = useCallback(async (offer, from, channelId) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;
    if (!currentChannel || currentChannel.id !== channelId) return;

    try {
      if (peerConnectionRef.current.signalingState !== 'stable') {
        console.log(`[CHANNEL] Offre ignorée - État: ${peerConnectionRef.current.signalingState}`);
        return;
      }

      console.log(`📥 [CHANNEL] Traitement offre P2P de ${from}`);
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      
      if (peerConnectionRef.current.signalingState === 'have-remote-offer') {
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socketRef.current.emit('answer', {
          answer,
          from: username,
          channelId: channelId
        });
        
        console.log('📤 [CHANNEL] Réponse P2P envoyée');
      }
    } catch (err) {
      console.error('[CHANNEL] Erreur traitement offre:', err);
    }
  }, [username, currentChannel]);

  // Traitement d'une réponse reçue
  const handleAnswer = useCallback(async (answer, channelId) => {
    if (!peerConnectionRef.current) return;
    if (!currentChannel || currentChannel.id !== channelId) return;

    try {
      if (peerConnectionRef.current.signalingState === 'have-local-offer') {
        console.log(`📥 [CHANNEL] Traitement réponse P2P`);
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    } catch (err) {
      console.error('[CHANNEL] Erreur traitement réponse:', err);
    }
  }, [currentChannel]);

  // Traitement des candidats ICE
  const handleIceCandidate = useCallback(async (candidate, channelId) => {
    if (!peerConnectionRef.current) return;
    if (!currentChannel || currentChannel.id !== channelId) return;

    try {
      const state = peerConnectionRef.current.signalingState;
      if (state === 'closed' || (state === 'stable' && !peerConnectionRef.current.remoteDescription)) {
        return;
      }

      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log('🧊 [CHANNEL] Candidat ICE ajouté (LAN)');
      }
    } catch (err) {
      if (!err.message.includes('Unknown ufrag')) {
        console.error('[CHANNEL] Erreur candidat ICE:', err);
      }
    }
  }, [currentChannel]);

  // Connexion au serveur
  const connect = useCallback(async () => {
    if (isConnectingRef.current || socketRef.current?.connected) {
      console.log('[CHANNEL] Connexion déjà établie');
      return;
    }

    try {
      isConnectingRef.current = true;
      updateConnectionStatus('connecting');
      setError(null);

      const serverUrl = 'http://172.20.10.3:3001';
      console.log(`🌐 [CHANNEL] Connexion serveur: ${serverUrl}`);

      socketRef.current = io(serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('✅ [CHANNEL] Connecté au serveur signaling');
        isConnectingRef.current = false;
        
        socketRef.current.emit('register', username);
        updateConnectionStatus('connected');
      });

      socketRef.current.on('offer', ({ offer, from, channelId }) => {
        handleOffer(offer, from, channelId);
      });

      socketRef.current.on('answer', ({ answer, channelId }) => {
        handleAnswer(answer, channelId);
      });

      socketRef.current.on('ice-candidate', ({ candidate, channelId }) => {
        handleIceCandidate(candidate, channelId);
      });

      socketRef.current.on('user-joined-channel', ({ username: userName, channelId }) => {
        console.log('👋 [CHANNEL] Utilisateur rejoint:', userName);
        if (userName !== username && currentChannel && currentChannel.id === channelId) {
          if (!isConnected && peerConnectionRef.current?.signalingState === 'stable') {
            setTimeout(() => createOffer(), 1000);
          }
        }
      });

      socketRef.current.on('user-left-channel', ({ username: userName, channelId }) => {
        console.log('👋 [CHANNEL] Utilisateur quitté:', userName);
        setChannelUsers(prev => prev.filter(user => user !== userName));
      });

      socketRef.current.on('channel-users', (users) => {
        console.log('👥 [CHANNEL] Utilisateurs du canal:', users);
        setChannelUsers(users);
      });

      socketRef.current.on('message-received', (message) => {
        console.log('📨 [CHANNEL] Message reçu via Socket.IO (fallback):', message);
        
        if (onMessageReceived && (message.channelId === currentChannel?.id || !currentChannel)) {
          console.log('✅ [CHANNEL] Message Socket.IO transmis à l\'interface');
          onMessageReceived(message);
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('❌ [CHANNEL] Erreur connexion serveur:', err);
        isConnectingRef.current = false;
        setError('Serveur indisponible');
        updateConnectionStatus('error');
      });

    } catch (err) {
      console.error('[CHANNEL] Erreur de connexion:', err);
      isConnectingRef.current = false;
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [username, updateConnectionStatus, handleOffer, handleAnswer, handleIceCandidate, createOffer, currentChannel, isConnected, onMessageReceived]);

  // Rejoindre un canal
  const joinChannel = useCallback(async (channel) => {
    if (!socketRef.current?.connected) {
      console.error('[CHANNEL] Non connecté au serveur');
      return false;
    }

    console.log('🚪 [CHANNEL] Rejoindre canal:', channel.name);
    
    cleanupOldConnection();
    
    setCurrentChannel(channel);
    setChannelUsers([]);
    
    peerConnectionRef.current = createPeerConnection();
    
    socketRef.current.emit('join-channel', {
      channelId: channel.id,
      channelName: channel.name
    });
    
    return true;
  }, [cleanupOldConnection, createPeerConnection]);

  const leaveChannel = useCallback(() => {
    console.log('🚪 [CHANNEL] Quitter le canal');
    
    if (socketRef.current?.connected && currentChannel) {
      socketRef.current.emit('leave-channel');
    }
    
    cleanupOldConnection();
    setCurrentChannel(null);
    setChannelUsers([]);
    setIsConnected(false);
    updateConnectionStatus('disconnected');
  }, [cleanupOldConnection, updateConnectionStatus, currentChannel]);

  // Déconnexion
  const disconnect = useCallback(() => {
    console.log('🔌 [CHANNEL] Déconnexion complète');
    
    cleanupOldConnection();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isConnectingRef.current = false;
    setCurrentChannel(null);
    setChannelUsers([]);
    setError(null);
    updateConnectionStatus('disconnected');
  }, [cleanupOldConnection, updateConnectionStatus]);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionStatus,
    currentChannel,
    channelUsers,
    error,
    connect,
    disconnect,
    joinChannel,
    leaveChannel,
    sendMessage
  };
};

export default useChannelWebRTC;