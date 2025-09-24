// src/hooks/useWebRTC.js - VERSION MESH COMPLÈTE
import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { getBestServer } from '../utils/networkDiscovery';

const useWebRTC = (username, onMessageReceived, onConnectionStatusChange) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [partnerName, setPartnerName] = useState('');
  const [error, setError] = useState(null);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const socketRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Configuration WebRTC avec serveurs STUN publics
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Mise à jour du statut de connexion
  const updateConnectionStatus = useCallback((status) => {
    setConnectionStatus(prevStatus => {
      if (prevStatus !== status) {
        console.log(`[MESH] Connection status: ${prevStatus} -> ${status}`);
        onConnectionStatusChange?.(status);
        return status;
      }
      return prevStatus;
    });
  }, []);

  // Configuration du data channel
  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('[MESH] Data channel ouvert');
      setIsConnected(true);
      updateConnectionStatus('connected');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[MESH] Message reçu:', message);
        onMessageReceived?.(message);
      } catch (err) {
        console.error('[MESH] Erreur parsing message:', err);
      }
    };

    channel.onclose = () => {
      console.log('[MESH] Data channel fermé');
      setIsConnected(false);
      updateConnectionStatus('disconnected');
    };

    channel.onerror = (error) => {
      console.error('[MESH] Erreur data channel:', error);
      setError('Erreur de communication mesh');
      updateConnectionStatus('error');
    };

    dataChannelRef.current = channel;
  }, [updateConnectionStatus, onMessageReceived]);

  // Nettoyage des anciennes connexions
  const cleanupOldConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('[MESH] Nettoyage ancienne connexion');
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.log('[MESH] Erreur nettoyage:', err);
      }
      peerConnectionRef.current = null;
    }
    
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (err) {
        console.log('[MESH] Erreur nettoyage canal:', err);
      }
      dataChannelRef.current = null;
    }
    
    isInitiatorRef.current = false;
  }, []);

  // Création du peer connection
  const createPeerConnection = useCallback(() => {
    // Nettoyer l'ancienne connexion d'abord
    cleanupOldConnection();
    
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      // Gestion des candidats ICE
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          console.log('[MESH] Envoi candidat ICE');
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            to: partnerName || 'partner'
          });
        }
      };

      // Gestion de l'état de connexion
      pc.onconnectionstatechange = () => {
        console.log('[MESH] Connection state:', pc.connectionState);
        
        switch (pc.connectionState) {
          case 'connected':
            updateConnectionStatus('connected');
            setIsConnected(true);
            setError(null);
            break;
          case 'connecting':
            updateConnectionStatus('connecting');
            break;
          case 'disconnected':
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
          case 'failed':
            updateConnectionStatus('error');
            setIsConnected(false);
            setError('Connexion mesh échouée');
            // Tentative de reconnexion automatique
            setTimeout(() => {
              if (pc.connectionState === 'failed') {
                console.log('[MESH] Tentative de reconnexion automatique...');
                reconnect();
              }
            }, 5000);
            break;
          case 'closed':
            updateConnectionStatus('disconnected');
            setIsConnected(false);
            break;
        }
      };

      // Gestion des data channels entrants
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
      };

      return pc;
    } catch (err) {
      console.error('[MESH] Erreur création PeerConnection:', err);
      setError('Erreur de création de connexion mesh');
      updateConnectionStatus('error');
      return null;
    }
  }, [setupDataChannel, updateConnectionStatus, partnerName, cleanupOldConnection]);

  // Envoi d'un message
  const sendMessage = useCallback((text, type = 'text') => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.error('[MESH] Canal de données non disponible');
      return false;
    }

    try {
      const message = {
        text,
        type,
        sender: username,
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random()
      };

      dataChannelRef.current.send(JSON.stringify(message));
      console.log('[MESH] Message envoyé:', message);
      return true;
    } catch (err) {
      console.error('[MESH] Erreur envoi message:', err);
      setError('Erreur d\'envoi mesh');
      return false;
    }
  }, [username]);

  // Création d'une offre
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      console.error('[MESH] PeerConnection ou Socket non disponible');
      return;
    }

    if (peerConnectionRef.current.signalingState !== 'stable') {
      console.log(`[MESH] Création d'offre ignorée - État: ${peerConnectionRef.current.signalingState}`);
      return;
    }

    try {
      console.log('[MESH] Création d\'une offre...');
      
      // Créer le data channel (côté initiateur)
      const dataChannel = peerConnectionRef.current.createDataChannel('messages', {
        ordered: true
      });
      setupDataChannel(dataChannel);

      // Créer l'offre
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      // Envoyer l'offre via le serveur mesh
      socketRef.current.emit('offer', {
        offer,
        from: username,
        to: 'partner'
      });

      isInitiatorRef.current = true;
      console.log('[MESH] Offre envoyée');
    } catch (err) {
      console.error('[MESH] Erreur création offre:', err);
      setError('Erreur de connexion mesh');
      updateConnectionStatus('error');
    }
  }, [username, setupDataChannel, updateConnectionStatus]);

  // Traitement d'une offre reçue
  const handleOffer = useCallback(async (offer, from) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;

    try {
      if (peerConnectionRef.current.signalingState !== 'stable') {
        console.log(`[MESH] Offre ignorée - État incorrect: ${peerConnectionRef.current.signalingState}`);
        return;
      }

      console.log(`[MESH] Traitement de l'offre de ${from}`);
      setPartnerName(from);
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      
      if (peerConnectionRef.current.signalingState === 'have-remote-offer') {
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socketRef.current.emit('answer', {
          answer,
          from: username,
          to: from
        });
        
        console.log('[MESH] Réponse envoyée');
      }
    } catch (err) {
      console.error('[MESH] Erreur traitement offre:', err);
    }
  }, [username]);

  // Traitement d'une réponse reçue
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      if (peerConnectionRef.current.signalingState === 'have-local-offer') {
        console.log('[MESH] Traitement de la réponse');
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    } catch (err) {
      console.error('[MESH] Erreur traitement réponse:', err);
    }
  }, []);

  // Traitement des candidats ICE
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) {
      console.log('[MESH] Candidat ICE ignoré - pas de PeerConnection');
      return;
    }

    try {
      // Vérifier l'état de la connexion avant d'ajouter le candidat
      const state = peerConnectionRef.current.signalingState;
      if (state === 'closed' || (state === 'stable' && !peerConnectionRef.current.remoteDescription)) {
        console.log(`[MESH] Candidat ICE ignoré - État: ${state}`);
        return;
      }

      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
        console.log('[MESH] Candidat ICE ajouté');
      } else {
        console.log('[MESH] Candidat ICE en attente - pas de remoteDescription');
      }
    } catch (err) {
      // Ignorer les erreurs de candidats ICE obsolètes
      if (err.message.includes('Unknown ufrag')) {
        console.log('[MESH] Candidat ICE obsolète ignoré');
      } else {
        console.error('[MESH] Erreur ajout candidat ICE:', err);
      }
    }
  }, []);

  // Connexion au serveur mesh
  const connect = useCallback(async () => {
    if (isConnectingRef.current || socketRef.current?.connected) {
      console.log('[MESH] Connexion déjà en cours ou établie');
      return;
    }

    try {
      isConnectingRef.current = true;
      updateConnectionStatus('connecting');
      setError(null);

      console.log('[MESH] Découverte du serveur mesh...');

      // Découverte automatique du serveur mesh
      const server = await getBestServer();
      const serverUrl = server.url;
      
      console.log(`[MESH] Connexion au serveur: ${serverUrl}`);

      // Connexion au serveur mesh
      socketRef.current = io(serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('[MESH] Connecté au serveur mesh');
        isConnectingRef.current = false;
        
        // S'enregistrer
        socketRef.current.emit('register', username);
        
        // Créer la connexion peer
        peerConnectionRef.current = createPeerConnection();
      });

      socketRef.current.on('offer', ({ offer, from }) => {
        handleOffer(offer, from);
      });

      socketRef.current.on('answer', ({ answer }) => {
        handleAnswer(answer);
      });

      socketRef.current.on('ice-candidate', ({ candidate }) => {
        handleIceCandidate(candidate);
      });

      socketRef.current.on('user-joined', (userName) => {
        console.log('[MESH] Utilisateur rejoint:', userName);
        if (userName !== username && peerConnectionRef.current && !isConnected) {
          // Seulement si pas déjà connecté et pas déjà en train de se connecter
          if (peerConnectionRef.current.signalingState === 'stable' && 
              peerConnectionRef.current.connectionState !== 'connecting' &&
              !isInitiatorRef.current && !isConnectingRef.current) {
            
            console.log('[MESH] Tentative de connexion vers', userName);
            isConnectingRef.current = true;
            setTimeout(() => {
              if (peerConnectionRef.current && 
                  peerConnectionRef.current.signalingState === 'stable' && 
                  !isInitiatorRef.current) {
                createOffer();
              }
              isConnectingRef.current = false;
            }, 1000);
          }
        }
      });

      socketRef.current.on('mesh-info', (info) => {
        console.log('[MESH] Info réseau:', info);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[MESH] Déconnecté du serveur mesh');
        isConnectingRef.current = false;
        updateConnectionStatus('disconnected');
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('[MESH] Erreur connexion serveur:', err);
        isConnectingRef.current = false;
        setError('Serveur mesh indisponible');
        updateConnectionStatus('error');
      });

    } catch (err) {
      console.error('[MESH] Erreur de connexion:', err);
      isConnectingRef.current = false;
      setError('Erreur de découverte mesh');
      updateConnectionStatus('error');
    }
  }, [username, updateConnectionStatus, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, createOffer]);

  // Déconnexion
  const disconnect = useCallback(() => {
    console.log('[MESH] Déconnexion...');
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isConnectingRef.current = false;
    isInitiatorRef.current = false;
    setIsConnected(false);
    setPartnerName('');
    setError(null);
    updateConnectionStatus('disconnected');
  }, [updateConnectionStatus]);

  // Reconnexion
  const reconnect = useCallback(() => {
    console.log('[MESH] Reconnexion...');
    disconnect();
    setTimeout(() => {
      connect();
    }, 2000);
  }, [disconnect, connect]);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionStatus,
    partnerName,
    error,
    connect,
    disconnect,
    sendMessage,
    reconnect
  };
};

export default useWebRTC;