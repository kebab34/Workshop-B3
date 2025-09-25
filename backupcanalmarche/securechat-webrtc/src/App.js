// src/App.js - Version avec cours de survie intégrés
import React, { useState } from 'react';
import Chat from './components/Chat.js';
import HomePage from './components/HomePage.js';
import SurvivalCoursesList from './components/SurvivalCoursesList.js';
import './styles/App.css';

function App() {
  const [username, setUsername] = useState('');
  const [currentView, setCurrentView] = useState('login'); // 'login', 'home', 'chat', 'courses'
  const [selectedChannel, setSelectedChannel] = useState(null);

  const handleConnect = (name) => {
    setUsername(name);
    setCurrentView('home');
  };

  const handleJoinChannel = (channel) => {
    setSelectedChannel(channel);
    setCurrentView('chat');
  };

  const handleViewCourses = () => {
    setCurrentView('courses');
  };

  const handleBackToHome = () => {
    setSelectedChannel(null);
    setCurrentView('home');
  };

  const handleLogout = () => {
    setUsername('');
    setSelectedChannel(null);
    setCurrentView('login');
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <h1>SecureLink</h1>
          <span className="tagline">
            {currentView === 'chat' ? `Canal: ${selectedChannel?.name}` : 
             currentView === 'courses' ? 'Formation à la survie' :
             'Messagerie sécurisée post-Ultron'}
          </span>
        </div>
        
        {currentView !== 'login' && (
          <div className="header-controls">
            {(currentView === 'chat' || currentView === 'courses') && (
              <button 
                className="back-button"
                onClick={handleBackToHome}
                title="Retour à l'accueil"
              >
                🏠 Accueil
              </button>
            )}
            
            <div className="user-badge">
              <span className="user-icon">👤</span>
              <span className="user-name">{username}</span>
            </div>
            
            <button 
              className="logout-button"
              onClick={handleLogout}
              title="Se déconnecter"
            >
              🚪
            </button>
          </div>
        )}
      </div>
      
      {currentView === 'login' && (
        <LoginForm onConnect={handleConnect} />
      )}
      
      {currentView === 'home' && (
        <HomePage 
          username={username} 
          onJoinChannel={handleJoinChannel}
          onViewCourses={handleViewCourses}
        />
      )}
      {currentView === 'courses' && (
        <SurvivalCoursesList 
          onBackToHome={handleBackToHome}
        />
      )}
      
      {currentView === 'chat' && selectedChannel && (
        <Chat 
          username={username} 
          channel={selectedChannel}
          onBackToHome={handleBackToHome}
        />
      )}
    </div>
  );
}

// Composant de connexion amélioré
function LoginForm({ onConnect }) {
  const [name, setName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (name.trim()) {
      setIsConnecting(true);
      
      // Simulation d'une vérification/connexion
      setTimeout(() => {
        onConnect(name.trim());
        setIsConnecting(false);
      }, 1000);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <div className="login-icon">🛡️</div>
          <h2>Connexion sécurisée</h2>
          <p className="login-description">
            Entrez votre nom de code pour accéder au réseau de résistance SecureLink
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Nom de code (ex: Agent47, Phoenix, Ghost)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="login-input"
              maxLength={20}
              disabled={isConnecting}
              autoComplete="username"
            />
            <div className="input-help">
              Choisissez un pseudonyme pour préserver votre anonymat
            </div>
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={!name.trim() || isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="loading-spinner">⟳</span>
                Connexion en cours...
              </>
            ) : (
              <>
                <span className="login-icon">🔐</span>
                Se connecter
              </>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <div className="security-notice">
            <span className="security-icon">🔒</span>
            <div className="security-text">
              <strong>Communications chiffrées</strong>
              <br />
              Vos messages sont protégés par chiffrement de bout en bout
            </div>
          </div>
          
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">📡</span>
              <span>Réseau mesh décentralisé</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚫</span>
              <span>Aucun cloud ni serveur centralisé</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span>Fonctionne sans Internet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;