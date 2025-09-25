// src/components/SurvivalCoursesList.js - Liste des cours de survie disponibles
import React, { useState } from 'react';
import SurvivalCourse from './SurvivalCourse';
import survivalCourses from '../data/survivalCourses';
import '../styles/SurvivalCoursesList.css';

const SurvivalCoursesList = ({ onBackToHome }) => {
  const [selectedCourse, setSelectedCourse] = useState(null);

  const openCourse = (course) => {
    setSelectedCourse(course);
  };

  const closeCourse = () => {
    setSelectedCourse(null);
  };

  if (selectedCourse) {
    return <SurvivalCourse course={selectedCourse} onClose={closeCourse} />;
  }

  return (
    <div className="survival-courses-overlay">
      <div className="survival-courses-container">
        
        <div className="courses-header">
          <button className="back-to-chat" onClick={onBackToHome} title="Retour au chat">
            🏠
          </button>
          
          <h2 className="courses-title">
            📚 Manuel de survie post-Ultron
          </h2>
          <p className="courses-subtitle">
            Connaissances essentielles pour survivre dans le nouveau monde
          </p>
        </div>

        <div className="courses-stats">
          <div className="stat-item">
            <span className="stat-number">{survivalCourses.length}</span>
            <span className="stat-label">Cours disponibles</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {survivalCourses.filter(c => c.priority === 'critique').length}
            </span>
            <span className="stat-label">Critiques</span>
          </div>
        </div>

        <div className="courses-grid">
          {survivalCourses.map(course => (
            <div key={course.id} className="course-card">
              
              <div className="card-header">
                <div className="course-number">#{course.id}</div>
                <div className={`priority-badge priority-${course.priority}`}>
                  {course.priority === 'critique' ? '🔴' : '🟡'} {course.priority}
                </div>
              </div>

              <div className="card-content">
                <div className="course-icon-large">
                  {course.icon}
                </div>
                
                <h3 className="card-title">{course.title}</h3>
                
                <p className="card-category">{course.category}</p>
                
                <div className="card-meta">
                  <span className="card-difficulty">📊 {course.difficulty}</span>
                  <span className="card-duration">⏱️ {course.duration}</span>
                </div>

                <div className="card-preview">
                  {course.sections.length} sections • Quiz inclus
                </div>
              </div>

              <div className="card-actions">
                <button 
                  className="start-course-button"
                  onClick={() => openCourse(course)}
                >
                  🚀 Commencer
                </button>
              </div>

            </div>
          ))}
        </div>

        <div className="courses-footer">
          <div>
            <div className="survival-tip">
              <h4>💡 Conseil de survie du jour</h4>
              <p>
                "Dans un monde post-apocalyptique, la connaissance est votre ressource la plus précieuse. 
                Elle ne peut pas être volée, ne se dégrade pas et peut sauver votre vie."
              </p>
            </div>
            
            <div className="emergency-contacts">
              <h4>📡 Contacts d'urgence</h4>
              <div className="contact-item">
                <span>Fréquence radio d'urgence :</span>
                <strong>146.520 MHz</strong>
              </div>
              <div className="contact-item">
                <span>Signal de détresse international :</span>
                <strong>SOS (3 courts, 3 longs, 3 courts)</strong>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SurvivalCoursesList;