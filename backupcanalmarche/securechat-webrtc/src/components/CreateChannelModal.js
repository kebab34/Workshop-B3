// src/components/CreateChannelModal.js - Version corrigée
import React, { useState, useEffect } from 'react';
import '../styles/CreateChannelModal.css';

function CreateChannelModal({ isOpen, onClose, onCreateChannel, existingChannels = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    password: '',
    confirmPassword: '',
    type: 'private',
    maxUsers: 10,
    autoDelete: false,
    deleteAfter: 24
  });
  
  const [errors, setErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // Reset du formulaire quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        password: '',
        confirmPassword: '',
        type: 'private',
        maxUsers: 10,
        autoDelete: false,
        deleteAfter: 24
      });
      setErrors({});
      setIsCreating(false);
    }
  }, [isOpen]);

  const channelTypes = [
    { value: 'private', label: 'Canal Privé', icon: '🔒', description: 'Accessible uniquement avec mot de passe' },
    { value: 'tactical', label: 'Canal Tactique', icon: '⚡', description: 'Communications opérationnelles sensibles' },
    { value: 'emergency', label: 'Canal d\'Urgence', icon: '🚨', description: 'Communications d\'urgence prioritaires' },
    { value: 'public', label: 'Canal Public', icon: '📢', description: 'Accessible à tous (pas de mot de passe)' }
  ];

  const validateForm = () => {
    const newErrors = {};

    // Validation du nom
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom du canal est obligatoire';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Le nom doit contenir au moins 3 caractères';
    } else if (formData.name.length > 30) {
      newErrors.name = 'Le nom ne peut pas dépasser 30 caractères';
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name)) {
      newErrors.name = 'Seuls les lettres, chiffres, espaces, tirets et underscores sont autorisés';
    }

    // Vérifier si le nom existe déjà
    if (existingChannels && existingChannels.length > 0) {
      const channelExists = existingChannels.some(
        channel => channel.name.toLowerCase() === formData.name.trim().toLowerCase()
      );
      if (channelExists) {
        newErrors.name = 'Un canal avec ce nom existe déjà';
      }
    }

    // Validation de la description
    if (formData.description && formData.description.length > 100) {
      newErrors.description = 'La description ne peut pas dépasser 100 caractères';
    }

    // Validation du mot de passe (sauf pour les canaux publics)
    if (formData.type !== 'public') {
      if (!formData.password) {
        newErrors.password = 'Le mot de passe est obligatoire pour les canaux privés';
      } else if (formData.password.length < 4) {
        newErrors.password = 'Le mot de passe doit contenir au moins 4 caractères';
      } else if (formData.password.length > 50) {
        newErrors.password = 'Le mot de passe ne peut pas dépasser 50 caractères';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
    }

    // Validation du nombre max d'utilisateurs
    if (formData.maxUsers < 2 || formData.maxUsers > 50) {
      newErrors.maxUsers = 'Le nombre d\'utilisateurs doit être entre 2 et 50';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsCreating(true);

    try {
      const channelData = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name.trim(),
        description: formData.description.trim() || 'Canal personnalisé',
        type: formData.type,
        password: formData.type !== 'public' ? formData.password : null,
        maxUsers: formData.maxUsers,
        autoDelete: formData.autoDelete,
        deleteAfter: formData.deleteAfter,
        createdAt: new Date().toISOString(),
        createdBy: 'current_user',
        users: 0,
        status: 'active',
        icon: channelTypes.find(t => t.value === formData.type)?.icon || '💬',
        isCustom: true,
        secure: formData.type !== 'public'
      };

      await onCreateChannel(channelData);
      
      // Fermer le modal après succès
      handleClose();
    } catch (error) {
      console.error('Erreur création canal:', error);
      setErrors({ submit: 'Erreur lors de la création du canal. Veuillez réessayer.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Reset immédiat pour éviter les erreurs React
    setFormData({
      name: '',
      description: '',
      password: '',
      confirmPassword: '',
      type: 'private',
      maxUsers: 10,
      autoDelete: false,
      deleteAfter: 24
    });
    setErrors({});
    setIsCreating(false);
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Nettoyer les erreurs au fur et à mesure
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Render conditionnel sécurisé
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="create-channel-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Créer un nouveau canal</h2>
          <button 
            type="button" 
            className="close-button" 
            onClick={handleClose}
            disabled={isCreating}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="channel-form">
          {/* Nom du canal */}
          <div className="form-group">
            <label htmlFor="channel-name">Nom du canal *</label>
            <input
              id="channel-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="ex: Opération Phoenix, Team Alpha..."
              maxLength={30}
              disabled={isCreating}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="channel-description">Description (optionnel)</label>
            <textarea
              id="channel-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              placeholder="Brève description du canal et de son usage..."
              maxLength={100}
              rows={3}
              disabled={isCreating}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
          </div>

          {/* Type de canal */}
          <div className="form-group">
            <label>Type de canal *</label>
            <div className="channel-types">
              {channelTypes.map(type => (
                <div
                  key={type.value}
                  className={`channel-type-option ${formData.type === type.value ? 'selected' : ''}`}
                  onClick={() => !isCreating && handleInputChange('type', type.value)}
                >
                  <div className="type-header">
                    <span className="type-icon">{type.icon}</span>
                    <span className="type-label">{type.label}</span>
                  </div>
                  <span className="type-description">{type.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mot de passe (sauf pour canal public) */}
          {formData.type !== 'public' && (
            <>
              <div className="form-group">
                <label htmlFor="channel-password">Mot de passe *</label>
                <input
                  id="channel-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Mot de passe pour accéder au canal"
                  maxLength={50}
                  disabled={isCreating}
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirmer le mot de passe *</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="Retapez le mot de passe"
                  maxLength={50}
                  disabled={isCreating}
                />
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>
            </>
          )}

          {/* Options avancées */}
          <div className="form-group">
            <label htmlFor="max-users">Nombre maximum d'utilisateurs</label>
            <div className="number-input-group">
              <input
                id="max-users"
                type="number"
                min="2"
                max="50"
                value={formData.maxUsers}
                onChange={(e) => handleInputChange('maxUsers', parseInt(e.target.value) || 10)}
                className={`form-input ${errors.maxUsers ? 'error' : ''}`}
                disabled={isCreating}
              />
              <span className="input-help">Entre 2 et 50 utilisateurs</span>
            </div>
            {errors.maxUsers && <span className="error-message">{errors.maxUsers}</span>}
          </div>

          {/* Erreur de soumission */}
          {errors.submit && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Boutons */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleClose}
              className="cancel-button"
              disabled={isCreating}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="create-button"
              disabled={isCreating || !formData.name.trim()}
            >
              {isCreating ? (
                <>
                  <span className="loading-spinner">⟳</span>
                  Création...
                </>
              ) : (
                <>
                  <span className="create-icon">✨</span>
                  Créer le canal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateChannelModal;