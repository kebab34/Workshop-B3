// src/hooks/useWebRTC.js - VERSION CORRIGÉE
import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

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

  // Mise à jour du statut de connexion (avec useCallback stable)
  const updateConnectionStatus = useCallback((status) => {
    setConnectionStatus(prevStatus => {
      if (prevStatus !== status) {
        console.log(`Connection status changed: ${prevStatus} -> ${status}`);
        onConnectionStatusChange?.(status);
        return status;
      }
      return prevStatus;
    });
  }, []); // Pas de dépendance sur onConnectionStatusChange pour éviter les boucles

  // Configuration du data channel
  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('Data channel ouvert');
      setIsConnected(true);
      updateConnectionStatus('connected');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Message reçu:', message);
        onMessageReceived?.(message);
      } catch (err) {
        console.error('Erreur parsing message:', err);
      }
    };

    channel.onclose = () => {
      console.log('Data channel fermé');
      setIsConnected(false);
      updateConnectionStatus('disconnected');
    };

    channel.onerror = (error) => {
      console.error('Erreur data channel:', error);
      setError('Erreur de communication');
      updateConnectionStatus('error');
    };

    dataChannelRef.current = channel;
  }, [updateConnectionStatus]); // updateConnectionStatus est stable grâce à useCallback

  // Création du peer connection
  const createPeerConnection = useCallback(() => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      // Gestion des candidats ICE
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          console.log('Envoi candidat ICE');
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            to: partnerName || 'partner'
          });
        }
      };

      // Gestion de l'état de connexion
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        
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
            setError('Connexion échouée');
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
      console.error('Erreur création PeerConnection:', err);
      setError('Erreur de création de connexion');
      updateConnectionStatus('error');
      return null;
    }
  }, [setupDataChannel, updateConnectionStatus]); // Dépendances stables

  // Envoi d'un message
  const sendMessage = useCallback((text, type = 'text') => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.error('Canal de données non disponible');
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
      console.log('Message envoyé:', message);
      return true;
    } catch (err) {
      console.error('Erreur envoi message:', err);
      setError('Erreur d\'envoi');
      return false;
    }
  }, [username]);

  // Création d'une offre
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      console.error('PeerConnection ou Socket non disponible');
      return;
    }

    try {
      console.log('Création d\'une offre...');
      
      // Créer le data channel (côté initiateur)
      const dataChannel = peerConnectionRef.current.createDataChannel('messages', {
        ordered: true
      });
      setupDataChannel(dataChannel);

      // Créer l'offre
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      // Envoyer l'offre via le serveur de signalisation
      socketRef.current.emit('offer', {
        offer,
        from: username,
        to: 'partner'
      });

      isInitiatorRef.current = true;
      console.log('Offre envoyée');
    } catch (err) {
      console.error('Erreur création offre:', err);
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [username, setupDataChannel, updateConnectionStatus]);

  // Traitement d'une offre reçue
  const handleOffer = useCallback(async (offer, from) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;

    try {
      console.log(`Traitement de l'offre de ${from}`);
      setPartnerName(from);
      
      await peerConnectionRef.current.setRemoteDescription(offer);
      
      // Créer la réponse
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Envoyer la réponse
      socketRef.current.emit('answer', {
        answer,
        from: username,
        to: from
      });
      
      console.log('Réponse envoyée');
    } catch (err) {
      console.error('Erreur traitement offre:', err);
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [username, updateConnectionStatus]);

  // Traitement d'une réponse reçue
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('Traitement de la réponse');
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (err) {
      console.error('Erreur traitement réponse:', err);
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [updateConnectionStatus]);

  // Traitement des candidats ICE
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('Candidat ICE ajouté');
    } catch (err) {
      console.error('Erreur ajout candidat ICE:', err);
    }
  }, []);

  // Connexion au serveur de signalisation
  const connect = useCallback(async () => {
    // Éviter les connexions multiples
    if (isConnectingRef.current || socketRef.current?.connected) {
      console.log('Connexion déjà en cours ou établie');
      return;
    }

    try {
      isConnectingRef.current = true;
      updateConnectionStatus('connecting');
      setError(null);

      console.log('Connexion au serveur de signalisation...');

      // Connexion au serveur de signalisation
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
      socketRef.current = io(serverUrl, {

        transports: ['websocket'],
        timeout: 5000,
        forceNew: true
      });

      socketRef.current.on('connect', () => {
        console.log('Connecté au serveur de signalisation');
        isConnectingRef.current = false;
        
        // S'enregistrer avec le nom d'utilisateur
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
        console.log('Utilisateur rejoint:', userName);
        if (userName !== username && peerConnectionRef.current) {
          // Démarrer la négociation après un délai
          setTimeout(() => createOffer(), 2000);
        }
      });

      socketRef.current.on('disconnect', () => {
        console.log('Déconnecté du serveur de signalisation');
        isConnectingRef.current = false;
        updateConnectionStatus('disconnected');
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Erreur connexion serveur:', err);
        isConnectingRef.current = false;
        setError('Serveur de signalisation indisponible');
        updateConnectionStatus('error');
      });

    } catch (err) {
      console.error('Erreur de connexion:', err);
      isConnectingRef.current = false;
      setError('Erreur de connexion');
      updateConnectionStatus('error');
    }
  }, [username, updateConnectionStatus, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, createOffer]);

  // Déconnexion
  const disconnect = useCallback(() => {
    console.log('Déconnexion...');
    
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
    console.log('Reconnexion...');
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
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