// src/App.js
import React, { useState } from 'react';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = (name) => {
    setUsername(name);
    setIsConnected(true);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>SecureLink</h1>
        <span className="tagline">Messagerie sécurisée post-Ultron</span>
      </div>
      
      {!isConnected ? (
        <LoginForm onConnect={handleConnect} />
      ) : (
        <Chat username={username} />
      )}
    </div>
  );
}

// Composant de connexion simple
function LoginForm({ onConnect }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onConnect(name.trim());
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Connexion sécurisée</h2>
        <input
          type="text"
          placeholder="Nom de code (ex: Agent47)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="login-input"
          maxLength={20}
        />
        <button type="submit" className="login-button">
          Se connecter
        </button>
      </form>
    </div>
  );
}

export default App;