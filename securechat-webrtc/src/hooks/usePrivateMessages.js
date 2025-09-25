// src/hooks/usePrivateMessages.js
import { useState, useCallback, useEffect } from 'react';

const usePrivateMessages = (socket, currentUser) => {
  const [conversations, setConversations] = useState(new Map());
  const [unreadCounts, setUnreadCounts] = useState(new Map());
  const [notifications, setNotifications] = useState([]);

  // Ajouter un message à une conversation
  const addMessage = useCallback((message) => {
    const conversationKey = message.sender === currentUser ? message.recipient : message.sender;
    
    setConversations(prev => {
      const newConversations = new Map(prev);
      const existingMessages = newConversations.get(conversationKey) || [];
      newConversations.set(conversationKey, [...existingMessages, message]);
      return newConversations;
    });

    // Incrémenter le compteur non lu si c'est un message reçu
    if (message.sender !== currentUser) {
      setUnreadCounts(prev => {
        const newCounts = new Map(prev);
        const current = newCounts.get(conversationKey) || 0;
        newCounts.set(conversationKey, current + 1);
        return newCounts;
      });

      // Ajouter une notification
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'private-message',
        from: message.sender,
        text: message.text,
        timestamp: message.timestamp
      }]);
    }
  }, [currentUser]);

  // Envoyer un message privé
  const sendPrivateMessage = useCallback((message) => {
    if (!socket || !message.recipient) {
      console.error('[PM] Impossible d\'envoyer le message - Socket ou destinataire manquant');
      return false;
    }

    try {
      // Ajouter immédiatement à notre conversation locale
      addMessage(message);
      
      // Envoyer via le serveur
      socket.emit('private-message', {
        to: message.recipient,
        from: currentUser,
        text: message.text,
        timestamp: message.timestamp,
        id: message.id
      });

      console.log(`[PM] Message envoyé à ${message.recipient}:`, message.text);
      return true;
    } catch (error) {
      console.error('[PM] Erreur envoi message privé:', error);
      return false;
    }
  }, [socket, currentUser, addMessage]);

  // Marquer une conversation comme lue
  const markAsRead = useCallback((username) => {
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.delete(username);
      return newCounts;
    });
  }, []);

  // Supprimer une notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Obtenir les messages d'une conversation
  const getConversation = useCallback((username) => {
    return conversations.get(username) || [];
  }, [conversations]);

  // Obtenir le nombre de messages non lus
  const getUnreadCount = useCallback((username) => {
    return unreadCounts.get(username) || 0;
  }, [unreadCounts]);

  // Obtenir le total de messages non lus
  const getTotalUnreadCount = useCallback(() => {
    return Array.from(unreadCounts.values()).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  // Écouter les messages privés entrants
  useEffect(() => {
    if (!socket) return;

    const handlePrivateMessage = (data) => {
      console.log('[PM] Message privé reçu:', data);
      
      const message = {
        id: data.id || Date.now() + Math.random(),
        text: data.text,
        sender: data.from,
        recipient: currentUser,
        timestamp: data.timestamp || new Date().toISOString(),
        type: 'private'
      };

      addMessage(message);
    };

    // Confirmation de livraison
    const handleMessageDelivered = (data) => {
      console.log('[PM] Message livré:', data);
      // On pourrait mettre à jour le statut du message ici
    };

    socket.on('private-message', handlePrivateMessage);
    socket.on('private-message-delivered', handleMessageDelivered);

    return () => {
      socket.off('private-message', handlePrivateMessage);
      socket.off('private-message-delivered', handleMessageDelivered);
    };
  }, [socket, currentUser, addMessage]);

  return {
    conversations,
    unreadCounts,
    notifications,
    sendPrivateMessage,
    addMessage,
    markAsRead,
    removeNotification,
    getConversation,
    getUnreadCount,
    getTotalUnreadCount
  };
};

export default usePrivateMessages;