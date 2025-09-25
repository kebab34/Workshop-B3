// src/hooks/useConnectedUsers.js
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const useConnectedUsers = (username, serverUrl = 'http://localhost:3001') => {
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!username) return;

    const connectToServer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Connexion au serveur
        socketRef.current = io(serverUrl, {
          transports: ['websocket'],
          timeout: 5000
        });

        socketRef.current.on('connect', () => {
          console.log('[USERS] Connecté au serveur pour les utilisateurs');
          
          // S'enregistrer
          socketRef.current.emit('register', username);
          
          // Demander la liste des utilisateurs connectés
          socketRef.current.emit('get-users-list');
        });

        // Recevoir la liste complète des utilisateurs
        socketRef.current.on('users-list', (users) => {
          console.log('[USERS] Liste des utilisateurs reçue:', users);
          
          const formattedUsers = users.map(user => ({
            id: user.id || user.username,
            username: user.username,
            status: user.status || 'online',
            currentChannel: user.currentChannel || null,
            connectedSince: new Date(user.connectedSince || Date.now())
          }));
          
          setConnectedUsers(formattedUsers);
          setIsLoading(false);
        });

        // Nouvel utilisateur connecté
        socketRef.current.on('user-joined', (user) => {
          console.log('[USERS] Utilisateur connecté:', user);
          
          setConnectedUsers(prev => {
            // Éviter les doublons
            if (prev.some(u => u.username === user.username)) {
              return prev;
            }
            
            return [...prev, {
              id: user.id || user.username,
              username: user.username,
              status: 'online',
              currentChannel: user.currentChannel || null,
              connectedSince: new Date()
            }];
          });
        });

        // Utilisateur déconnecté
        socketRef.current.on('user-left', (userData) => {
          console.log('[USERS] Utilisateur déconnecté:', userData);
          
          setConnectedUsers(prev => 
            prev.filter(user => 
              user.username !== userData.username && 
              user.id !== userData.id
            )
          );
        });

        // Utilisateur changé de canal
        socketRef.current.on('user-channel-changed', ({ username: userName, channelName }) => {
          console.log('[USERS] Utilisateur changé de canal:', userName, channelName);
          
          setConnectedUsers(prev => 
            prev.map(user => 
              user.username === userName 
                ? { ...user, currentChannel: channelName }
                : user
            )
          );
        });

        // Erreurs de connexion
        socketRef.current.on('connect_error', (err) => {
          console.error('[USERS] Erreur connexion serveur:', err);
          setError('Impossible de récupérer la liste des utilisateurs');
          setIsLoading(false);
          
          // Fallback: afficher au moins l'utilisateur actuel
          setConnectedUsers([{
            id: username,
            username: username,
            status: 'online',
            currentChannel: null,
            connectedSince: new Date()
          }]);
        });

        socketRef.current.on('disconnect', () => {
          console.log('[USERS] Déconnecté du serveur utilisateurs');
          setError('Connexion perdue avec le serveur');
        });

      } catch (err) {
        console.error('[USERS] Erreur initialisation:', err);
        setError('Erreur d\'initialisation');
        setIsLoading(false);
        
        // Fallback
        setConnectedUsers([{
          id: username,
          username: username,
          status: 'online',
          currentChannel: null,
          connectedSince: new Date()
        }]);
      }
    };

    connectToServer();

    // Nettoyage
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [username, serverUrl]);

  // Fonction pour notifier un changement de canal
  const notifyChannelChange = (channelName) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('user-channel-change', { channelName });
    }
  };

  // Fonction pour forcer une mise à jour
  const refreshUsersList = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get-users-list');
    }
  };

  return {
    connectedUsers,
    isLoading,
    error,
    notifyChannelChange,
    refreshUsersList,
    isConnected: socketRef.current?.connected || false
  };
};

export default useConnectedUsers;