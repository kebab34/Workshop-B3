import React, { useState } from 'react';
import '../styles/SurvivalCourse.css';

const SurvivalCourse = ({ course, onClose }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);

  if (!course) return null;

  const renderContent = (contentItem) => {
    switch (contentItem.type) {
      case 'text':
        return <p className="course-text">{contentItem.text}</p>;
      
      case 'warning':
        return (
          <div className="course-warning">
            <span className="warning-icon">⚠️</span>
            {contentItem.text}
          </div>
        );
      
      case 'danger':
        return (
          <div className="course-danger">
            <span className="danger-icon">🚨</span>
            {contentItem.text}
          </div>
        );
      
      case 'subtitle':
        return <h4 className="course-subtitle">{contentItem.text}</h4>;
      
      case 'list':
        return (
          <ul className="course-list">
            {contentItem.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        );
      
      case 'technique':
        return (
          <div className="technique-card">
            <h5 className="technique-title">💡 {contentItem.title}</h5>
            <p className="technique-description">{contentItem.description}</p>
          </div>
        );
      
      case 'method':
        return (
          <div className="method-card">
            <h5 className="method-title">🔧 {contentItem.title}</h5>
            
            <div className="method-steps">
              <h6>Étapes :</h6>
              <ol>
                {contentItem.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
            
            <div className="method-pros-cons">
              <div className="pros">
                <h6>✅ Avantages :</h6>
                <ul>
                  {contentItem.pros.map((pro, index) => (
                    <li key={index}>{pro}</li>
                  ))}
                </ul>
              </div>
              
              <div className="cons">
                <h6>❌ Inconvénients :</h6>
                <ul>
                  {contentItem.cons.map((con, index) => (
                    <li key={index}>{con}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'tip':
        return (
          <div className="course-tip">
            <span className="tip-icon">💡</span>
            {contentItem.text}
          </div>
        );
      
      case 'important':
        return (
          <div className="course-important">
            <span className="important-icon">⭐</span>
            {contentItem.text}
          </div>
        );
      
      default:
        return <p>{contentItem.text}</p>;
    }
  };

  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const submitQuiz = () => {
    setQuizCompleted(true);
  };

  const getQuizScore = () => {
    let correct = 0;
    course.quiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correct) {
        correct++;
      }
    });
    return { correct, total: course.quiz.length };
  };

  const nextSection = () => {
    if (currentSection < course.sections.length - 1) {
      setCurrentSection(currentSection + 1);
    } else {
      setShowQuiz(true);
    }
  };

  const prevSection = () => {
    if (showQuiz) {
      setShowQuiz(false);
    } else if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const currentSectionData = course.sections[currentSection];

  return (
    <div className="survival-course-overlay">
      <div className="survival-course-container">
        
        {/* Header */}
        <div className="course-header">
          <div className="course-header-left">
            <h2 className="course-title">
              <span className="course-icon">{course.icon}</span>
              📘 Cours de survie n°{course.id} : {course.title}
            </h2>
            <div className="course-meta">
              <span className="course-difficulty">{course.difficulty}</span>
              <span className="course-duration">⏱️ {course.duration}</span>
              <span className={`course-priority priority-${course.priority}`}>
                {course.priority === 'critique' ? '🔴' : '🟡'} {course.priority}
              </span>
            </div>
          </div>

          <button className="close-button" onClick={onClose}>
            ❌
          </button>
        </div>

        {/* Progress Bar */}
        <div className="course-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: showQuiz 
                  ? '100%' 
                  : `${((currentSection + 1) / course.sections.length) * 100}%` 
              }}
            />
          </div>
          <span className="progress-text">
            {showQuiz 
              ? 'Quiz final' 
              : `Section ${currentSection + 1}/${course.sections.length}`
            }
          </span>
        </div>

        {/* Content */}
        <div className="course-content">
          {!showQuiz ? (
            // Section du cours
            <div className="course-section">
              <h3 className="section-title">{currentSectionData.title}</h3>
              
              <div className="section-content">
                {currentSectionData.content.map((contentItem, index) => (
                  <div key={index} className="content-item">
                    {renderContent(contentItem)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Quiz
            <div className="course-quiz">
              <h3 className="quiz-title">🎯 Quiz de validation</h3>
              
              {!quizCompleted ? (
                <div className="quiz-questions">
                  {course.quiz.map((question, questionIndex) => (
                    <div key={questionIndex} className="quiz-question">
                      <h4 className="question-text">
                        {questionIndex + 1}. {question.question}
                      </h4>
                      
                      <div className="question-options">
                        {question.options.map((option, optionIndex) => (
                          <button
                            key={optionIndex}
                            className={`quiz-option ${
                              quizAnswers[questionIndex] === optionIndex ? 'selected' : ''
                            }`}
                            onClick={() => handleQuizAnswer(questionIndex, optionIndex)}
                          >
                            {String.fromCharCode(65 + optionIndex)}. {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    className="submit-quiz-button"
                    onClick={submitQuiz}
                    disabled={Object.keys(quizAnswers).length !== course.quiz.length}
                  >
                    Valider le quiz
                  </button>
                </div>
              ) : (
                // Résultats du quiz
                <div className="quiz-results">
                  <div className="score-display">
                    <h4>Résultat : {getQuizScore().correct}/{getQuizScore().total}</h4>
                    <div className="score-percentage">
                      {Math.round((getQuizScore().correct / getQuizScore().total) * 100)}%
                    </div>
                  </div>
                  
                  <div className="quiz-feedback">
                    {course.quiz.map((question, index) => (
                      <div key={index} className="question-feedback">
                        <h5>{question.question}</h5>
                        <p className={`answer-feedback ${
                          quizAnswers[index] === question.correct ? 'correct' : 'incorrect'
                        }`}>
                          {quizAnswers[index] === question.correct ? '✅' : '❌'} 
                          {question.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="course-completed">
                    <h3>🎉 Cours terminé !</h3>
                    <p>Ce savoir pourrait vous sauver la vie dans le monde post-Ultron.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="course-navigation">
          <button 
            className="nav-button prev-button"
            onClick={prevSection}
            disabled={currentSection === 0 && !showQuiz}
          >
            ← Précédent
          </button>
          
          <div className="nav-info">
            {!showQuiz && (
              <span>{currentSection + 1} / {course.sections.length}</span>
            )}
          </div>
          
          {!showQuiz ? (
            <button 
              className="nav-button next-button"
              onClick={nextSection}
            >
              {currentSection === course.sections.length - 1 ? 'Quiz →' : 'Suivant →'}
            </button>
          ) : quizCompleted ? (
            <button className="nav-button finish-button" onClick={onClose}>
              Terminer
            </button>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default SurvivalCourse;