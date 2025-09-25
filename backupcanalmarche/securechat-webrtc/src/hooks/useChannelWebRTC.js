// src/hooks/useChannelWebRTC.js - Hook WebRTC avec support des canaux
import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { getBestServer } from '../utils/networkDiscovery';

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

  // Configuration WebRTC avec serveurs STUN publics et TURN de secours
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Serveur TURN public de secours (limité mais peut aider)
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  };

  // Mise à jour du statut de connexion
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

  // Configuration du data channel
  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('[CHANNEL] Data channel ouvert');
      setIsConnected(true);
      updateConnectionStatus('connected');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[CHANNEL] Message reçu:', message);
        onMessageReceived?.(message);
      } catch (err) {
        console.error('[CHANNEL] Erreur parsing message:', err);
      }
    };

    channel.onclose = () => {
      console.log('[CHANNEL] Data channel fermé');
      setIsConnected(false);
      updateConnectionStatus('disconnected');
    };

    channel.onerror = (error) => {
      console.error('[CHANNEL] Erreur data channel:', error);
      setError('Erreur de communication');
      updateConnectionStatus('error');
    };

    dataChannelRef.current = channel;
  }, [updateConnectionStatus, onMessageReceived]);

  // Nettoyage des anciennes connexions
  const cleanupOldConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('[CHANNEL] Nettoyage ancienne connexion');
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

  // Création du peer connection
  const createPeerConnection = useCallback(() => {
    cleanupOldConnection();
    
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected && currentChannel) {
          console.log('[CHANNEL] Envoi candidat ICE');
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            channelId: currentChannel.id
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[CHANNEL] Connection state:', pc.connectionState);
        console.log('[CHANNEL] ICE Connection state:', pc.iceConnectionState);
        console.log('[CHANNEL] ICE Gathering state:', pc.iceGatheringState);
        
        switch (pc.connectionState) {
          case 'connected':
            console.log('🎉 [CHANNEL] WebRTC Connexion établie !');
            updateConnectionStatus('connected');
            setIsConnected(true);
            setError(null);
            break;
          case 'connecting':
            console.log('🔄 [CHANNEL] Connexion WebRTC en cours...');
            updateConnectionStatus('connecting');
            break;
          case 'disconnected':
            console.log('❌ [CHANNEL] WebRTC Déconnecté');
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
          case 'failed':
            console.log('💥 [CHANNEL] Échec WebRTC - Problème de NAT/Firewall probable');
            updateConnectionStatus('error');
            setIsConnected(false);
            setError('Connexion WebRTC échouée - Vérifiez NAT/Firewall');
            break;
          case 'closed':
            console.log('🔒 [CHANNEL] WebRTC Fermé');
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
        }
      };

      // Debug ICE state changes  
      pc.oniceconnectionstatechange = () => {
        console.log(`[CHANNEL] ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
          console.log('🚨 [CHANNEL] ICE Failed - Connexion directe impossible');
          console.log('💡 [CHANNEL] Suggestion: Désactivez le firewall ou utilisez un serveur TURN');
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
      };

      return pc;
    } catch (err) {
      console.error('[CHANNEL] Erreur création PeerConnection:', err);
      setError('Erreur de création de connexion');
      updateConnectionStatus('error');
      return null;
    }
  }, [setupDataChannel, updateConnectionStatus, currentChannel, cleanupOldConnection]);

  // Envoi d'un message
  const sendMessage = useCallback((text, type = 'text') => {
    console.log(`[CHANNEL] 🚀 Tentative d'envoi de message:`, { 
      text, 
      type,
      dataChannelState: dataChannelRef.current?.readyState,
      socketConnected: socketRef.current?.connected,
      currentChannelId: currentChannel?.id,
      hasDataChannel: !!dataChannelRef.current,
      hasSocket: !!socketRef.current
    });

    const message = {
      text,
      type,
      sender: username,
      timestamp: new Date().toISOString(),
      channelId: currentChannel?.id,
      id: Date.now() + Math.random()
    };

    // Essayer d'envoyer via WebRTC d'abord
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(message));
        console.log('[CHANNEL] ✅ Message envoyé via WebRTC:', message);
        return true;
      } catch (err) {
        console.error('[CHANNEL] ❌ Erreur WebRTC, fallback vers Socket.IO:', err);
      }
    } else {
      console.log('[CHANNEL] 📡 WebRTC non disponible, utilisation Socket.IO directement');
    }

    // Fallback via Socket.IO si WebRTC n'est pas disponible
    if (socketRef.current?.connected && currentChannel) {
      try {
        console.log('[CHANNEL] 📤 Envoi via Socket.IO...', message);
        socketRef.current.emit('send-message', message);
        console.log('[CHANNEL] ✅ Message envoyé via Socket.IO:', message);
        return true;
      } catch (err) {
        console.error('[CHANNEL] ❌ Erreur Socket.IO:', err);
        setError('Erreur d\'envoi');
        return false;
      }
    } else {
      console.error('[CHANNEL] ❌ Conditions non remplies:', {
        socketConnected: socketRef.current?.connected,
        hasCurrentChannel: !!currentChannel,
        channelId: currentChannel?.id
      });
    }

    console.error('[CHANNEL] ❌ Aucun canal de communication disponible');
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
      console.log(`[CHANNEL] Création d'offre ignorée - État: ${peerConnectionRef.current.signalingState}`);
      return;
    }

    try {
      console.log(`[CHANNEL] Création d'une offre pour le canal ${currentChannel.name}`);
      
      const dataChannel = peerConnectionRef.current.createDataChannel('messages', {
        ordered: true
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
      console.log('[CHANNEL] Offre envoyée');
    } catch (err) {
      console.error('[CHANNEL] Erreur création offre:', err);
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [username, currentChannel, setupDataChannel, updateConnectionStatus]);

  // Traitement d'une offre reçue
  const handleOffer = useCallback(async (offer, from, channelId) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;
    if (!currentChannel || currentChannel.id !== channelId) return;

    try {
      if (peerConnectionRef.current.signalingState !== 'stable') {
        console.log(`[CHANNEL] Offre ignorée - État incorrect: ${peerConnectionRef.current.signalingState}`);
        return;
      }

      console.log(`[CHANNEL] Traitement de l'offre de ${from} dans canal ${channelId}`);
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      
      if (peerConnectionRef.current.signalingState === 'have-remote-offer') {
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socketRef.current.emit('answer', {
          answer,
          from: username,
          channelId: channelId
        });
        
        console.log('[CHANNEL] Réponse envoyée');
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
        console.log(`[CHANNEL] Traitement de la réponse dans canal ${channelId}`);
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
        console.log(`[CHANNEL] Candidat ICE ignoré - État: ${state}`);
        return;
      }

      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log('[CHANNEL] Candidat ICE ajouté');
      }
    } catch (err) {
      if (!err.message.includes('Unknown ufrag')) {
        console.error('[CHANNEL] Erreur ajout candidat ICE:', err);
      }
    }
  }, [currentChannel]);

  // Connexion au serveur
  const connect = useCallback(async () => {
    if (isConnectingRef.current || socketRef.current?.connected) {
      console.log('[CHANNEL] Connexion déjà en cours ou établie');
      return;
    }

    try {
      isConnectingRef.current = true;
      updateConnectionStatus('connecting');
      setError(null);

      console.log('[CHANNEL] Découverte du serveur...');

      const server = await getBestServer();
      const serverUrl = server.url;
      
      console.log(`[CHANNEL] Connexion au serveur: ${serverUrl}`);

      socketRef.current = io(serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('[CHANNEL] Connecté au serveur');
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
        console.log('[CHANNEL] Utilisateur rejoint le canal:', userName);
        if (userName !== username && currentChannel && currentChannel.id === channelId) {
          // Créer une nouvelle connexion peer si on n'est pas déjà connecté
          if (!isConnected && peerConnectionRef.current?.signalingState === 'stable') {
            setTimeout(() => createOffer(), 1000);
          }
        }
      });

      socketRef.current.on('user-left-channel', ({ username: userName, channelId }) => {
        console.log('[CHANNEL] Utilisateur quitte le canal:', userName);
        setChannelUsers(prev => prev.filter(user => user !== userName));
      });

      socketRef.current.on('channel-users', (users) => {
        console.log('[CHANNEL] Utilisateurs du canal:', users);
        setChannelUsers(users);
      });

      socketRef.current.on('message-received', (message) => {
        console.log('[CHANNEL] Message reçu via Socket.IO:', message);
        console.log('[CHANNEL] 🔍 Vérification canal:', {
          messageChannelId: message.channelId,
          currentChannelId: currentChannel?.id,
          hasCallback: !!onMessageReceived,
          channelMatch: message.channelId === currentChannel?.id
        });
        
        // Accepter les messages si on a un callback (même si currentChannel est temporairement null)
        if (onMessageReceived && (message.channelId === currentChannel?.id || !currentChannel)) {
          console.log('[CHANNEL] ✅ Message transmis à l\'interface');
          onMessageReceived(message);
        } else {
          console.log('[CHANNEL] ❌ Message ignoré:', {
            hasCallback: !!onMessageReceived,
            messageChannel: message.channelId,
            currentChannel: currentChannel?.id
          });
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('[CHANNEL] Erreur connexion serveur:', err);
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
  }, [username, updateConnectionStatus, handleOffer, handleAnswer, handleIceCandidate, createOffer, currentChannel, isConnected]);

  // Rejoindre un canal
  const joinChannel = useCallback(async (channel) => {
    if (!socketRef.current?.connected) {
      console.error('[CHANNEL] Non connecté au serveur');
      return false;
    }

    console.log('[CHANNEL] Rejoindre le canal:', channel.name);
    
    // Nettoyer l'ancienne connexion WebRTC
    cleanupOldConnection();
    
    // Mettre à jour le canal actuel
    setCurrentChannel(channel);
    setChannelUsers([]);
    
    // Créer une nouvelle connexion peer
    peerConnectionRef.current = createPeerConnection();
    
    // Rejoindre le canal sur le serveur
    socketRef.current.emit('join-channel', {
      channelId: channel.id,
      channelName: channel.name
    });
    
    return true;
  }, [cleanupOldConnection, createPeerConnection]);

  // Quitter un canal
  const leaveChannel = useCallback(() => {
    console.log('[CHANNEL] Quitter le canal');
    
    cleanupOldConnection();
    setCurrentChannel(null);
    setChannelUsers([]);
    setIsConnected(false);
    updateConnectionStatus('disconnected');
  }, [cleanupOldConnection, updateConnectionStatus]);

  // Déconnexion
  const disconnect = useCallback(() => {
    console.log('[CHANNEL] Déconnexion...');
    
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
