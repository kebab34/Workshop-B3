export const survivalCourses = [
  // Cours 1: Eau potable
  {
    id: 1,
    title: "Trouver et purifier de l'eau",
    icon: "💧",
    category: "Ressources essentielles",
    difficulty: "Débutant",
    duration: "15 min",
    priority: "critique",
    sections: [
      {
        id: "why-vital",
        title: "1️⃣ Pourquoi l'eau est vitale ?",
        content: [
          {
            type: "text",
            text: "Le corps humain survit environ 3 jours sans eau."
          },
          {
            type: "warning",
            text: "L'eau contaminée peut transmettre des maladies (diarrhée, choléra, parasites)."
          }
        ]
      },
      {
        id: "find-water",
        title: "2️⃣ Où trouver de l'eau dans la nature ?",
        content: [
          {
            type: "subtitle",
            text: "Sources naturelles :"
          },
          {
            type: "list",
            items: [
              "Rivières et ruisseaux",
              "Lacs et étangs", 
              "Eau de pluie",
              "Rosée du matin"
            ]
          },
          {
            type: "subtitle",
            text: "Méthodes alternatives :"
          },
          {
            type: "technique",
            title: "Collecte de pluie",
            description: "Utiliser une bâche, un tissu ou un récipient pour collecter l'eau de pluie."
          },
          {
            type: "technique", 
            title: "Creuser près des rivières",
            description: "Creuser près des lits de rivière asséchés pour trouver de l'eau souterraine."
          },
          {
            type: "technique",
            title: "Condensation végétale",
            description: "Attacher un sac plastique autour d'une branche feuillue → récupérer la condensation."
          },
          {
            type: "technique",
            title: "Fruits et plantes",
            description: "Noix de coco, certaines vignes, fruits juteux."
          },
          {
            type: "danger",
            text: "⚠️ Ne jamais boire directement l'eau stagnante sans traitement !"
          }
        ]
      },
      {
        id: "purification",
        title: "3️⃣ Méthodes de purification",
        content: [
          {
            type: "method",
            title: "Ébullition (la plus sûre)",
            steps: [
              "Faire bouillir l'eau pendant au moins 5 minutes",
              "Laisser refroidir avant de boire",
              "Efficace contre bactéries, virus et parasites"
            ],
            pros: ["100% efficace", "Pas de produits chimiques"],
            cons: ["Nécessite du feu", "Consomme du combustible"]
          },
          {
            type: "method",
            title: "Filtration improvisée",
            steps: [
              "Couper une bouteille plastique",
              "Ajouter des couches : tissu, sable fin, charbon, gros gravier",
              "Verser l'eau lentement par le haut"
            ],
            pros: ["Filtre la boue et les débris", "Matériaux faciles à trouver"],
            cons: ["Ne tue pas les bactéries", "À combiner avec une autre méthode"]
          },
          {
            type: "method",
            title: "Désinfection solaire (SODIS)",
            steps: [
              "Remplir une bouteille PET transparente",
              "Laisser au soleil direct pendant 6 heures minimum",
              "Les rayons UV détruisent les microbes"
            ],
            pros: ["Gratuit", "Pas de combustible nécessaire"],
            cons: ["Nécessite du soleil", "Prend du temps"]
          },
          {
            type: "method",
            title: "Produits chimiques (si disponibles)",
            steps: [
              "Utiliser des pastilles de purification (iode, chlore)",
              "Suivre les instructions du fabricant",
              "Attendre 30 minutes avant consommation"
            ],
            pros: ["Rapide", "Portable"],
            cons: ["Ressources limitées", "Goût désagréable"]
          }
        ]
      },
      {
        id: "practical-tips",
        title: "4️⃣ Astuces pratiques",
        content: [
          {
            type: "tip",
            text: "Toujours avoir une bouteille réutilisable avec soi."
          },
          {
            type: "tip",
            text: "Transporter un morceau de charbon de bois → utile pour la filtration."
          },
          {
            type: "tip",
            text: "Marquer tes sources d'eau fiables sur une carte."
          },
          {
            type: "important",
            text: "Si tu hésites, ne bois pas : la déshydratation est parfois moins risquée qu'une maladie grave."
          }
        ]
      }
    ],
    quiz: [
      {
        question: "Combien de temps peut-on survivre sans eau ?",
        options: ["1 jour", "3 jours", "1 semaine", "2 semaines"],
        correct: 1,
        explanation: "Le corps humain peut survivre environ 3 jours sans eau, selon les conditions."
      },
      {
        question: "Quelle est la méthode de purification la plus sûre ?",
        options: ["Filtration", "Ébullition", "Désinfection solaire", "Pastilles"],
        correct: 1,
        explanation: "L'ébullition pendant 5 minutes élimine tous les microbes pathogènes."
      }
    ],
    relatedCourses: [2, 3],
    lastUpdated: "2025-09-25",
    author: "SecureLink Survival Team"
  },
  
  // Cours 2: Feu et chaleur
  {
    id: 2,
    title: "Allumer et maintenir un feu",
    icon: "🔥",
    category: "Chaleur et énergie",
    difficulty: "Débutant",
    duration: "20 min",
    priority: "critique",
    description: "Techniques essentielles pour créer et entretenir un feu de survie dans diverses conditions.",
    
    sections: [
      {
        id: "fire-basics",
        title: "Les bases du feu",
        content: "Le feu repose sur trois éléments : combustible, oxygène et chaleur. Sans l'un d'entre eux, impossible d'obtenir des flammes durables.",
        keyPoints: [
          "Triangle du feu : combustible + oxygène + chaleur",
          "Types de combustibles : amadou, petit bois, bois moyen, grosses bûches",
          "Préparation essentielle avant l'allumage",
          "Sécurité : toujours prévoir l'extinction"
        ]
      },
      {
        id: "ignition-methods",
        title: "Méthodes d'allumage",
        content: "Plusieurs techniques existent selon les outils disponibles : moderne (briquet), traditionnel (silex-acier) ou primitif (friction).",
        keyPoints: [
          "Briquet/allumettes : rapide mais limité",
          "Silex et acier : fiable même mouillé",
          "Friction (archet) : pas besoin d'outils",
          "Préparation d'un nid d'amadou sec"
        ]
      },
      {
        id: "fire-maintenance",
        title: "Entretien et sécurité",
        content: "Un feu mal entretenu s'éteint rapidement. La surveillance constante et l'alimentation progressive sont cruciales.",
        keyPoints: [
          "Ajouter du combustible progressivement",
          "Maintenir l'équilibre air/combustible",
          "Protection contre vent et pluie",
          "Ne JAMAIS laisser un feu sans surveillance"
        ]
      }
    ],
    
    practicalTips: [
      "Toujours rassembler plus de combustible que nécessaire",
      "Garder de l'amadou sec dans un contenant étanche",
      "Apprendre à reconnaître les bons bois d'allumage",
      "S'entraîner avec différentes méthodes"
    ],
    
    quiz: [
      {
        question: "Quels sont les 3 éléments du triangle du feu ?",
        options: ["Combustible, oxygène, chaleur", "Bois, allumette, air", "Sec, chaud, ventilé"],
        correct: 0
      },
      {
        question: "Dans quel ordre ajouter les combustibles ?",
        options: ["Gros bois d'abord", "Amadou, puis petit bois, puis gros", "L'ordre n'importe pas"],
        correct: 1
      }
    ],
    
    relatedCourses: [1, 3],
    lastUpdated: "2025-09-25",
    author: "SecureLink Survival Team"
  },
  
  // Cours 3: Abri et protection
  {
    id: 3,
    title: "Construire un abri de fortune",
    icon: "🏠",
    category: "Protection",
    difficulty: "Intermédiaire", 
    duration: "30 min",
    priority: "critique",
    description: "Techniques de construction d'abris temporaires pour se protéger des éléments et maintenir la température corporelle.",
    
    sections: [
      {
        id: "shelter-principles", 
        title: "Principes de l'abri",
        content: "La règle des 3 : 3 minutes sans air, 3 heures sans abri par temps froid, 3 jours sans eau, 3 semaines sans nourriture. L'abri est souvent prioritaire.",
        keyPoints: [
          "Protection contre vent, pluie, froid",
          "Isolation du sol crucial (25x plus de perte que l'air)",
          "Ventilation pour éviter la condensation",
          "Matériaux locaux et rapidité de construction"
        ]
      },
      {
        id: "shelter-types",
        title: "Types d'abris",
        content: "Différents abris selon l'environnement et le temps disponible : appentis rapide, hutte triangulaire ou abri souterrain.",
        keyPoints: [
          "Appentis : rapide, bon drainage, une ouverture",
          "Hutte en A : stable, bonne isolation, moins d'espace",
          "Abri souterrain : isolation maximale, plus de travail",
          "Adaptation au terrain et aux matériaux disponibles"
        ]
      },
      {
        id: "insulation-comfort",
        title: "Isolation et confort", 
        content: "Le sol draine énormément de chaleur. Une isolation de 30cm minimum est nécessaire entre le corps et le sol froid.",
        keyPoints: [
          "Matelas de feuilles sèches (30cm mini)",
          "Écorce, branches de conifères",
          "Éviter matériaux qui retiennent l'humidité",
          "Feu réfléchi contre paroi rocheuse très efficace"
        ]
      }
    ],
    
    practicalTips: [
      "Tester l'isolation du sol avant de s'allonger",
      "Construire l'abri avant la tombée de la nuit",
      "Prévoir un système d'évacuation de l'eau",
      "Garder des matériaux de réparation à portée"
    ],
    
    quiz: [
      {
        question: "Combien de temps peut-on survivre sans abri par temps froid ?",
        options: ["3 minutes", "3 heures", "3 jours"],
        correct: 1
      },
      {
        question: "Pourquoi l'isolation du sol est-elle cruciale ?",
        options: ["Pour le confort", "Le sol draine 25x plus de chaleur", "Pour éviter l'humidité"],
        correct: 1
      }
    ],
    
    relatedCourses: [1, 2, 4],
    lastUpdated: "2025-09-25", 
    author: "SecureLink Survival Team"
  },
  
  // Cours 4: Signalisation et navigation
  {
    id: 4,
    title: "Signalisation et navigation",
    icon: "📡",
    category: "Communication",
    difficulty: "Intermédiaire",
    duration: "25 min", 
    priority: "important",
    description: "Techniques pour signaler sa présence aux secours et s'orienter sans GPS ni boussole.",
    
    sections: [
      {
        id: "signaling-basics",
        title: "Bases de la signalisation",
        content: "Être visible et audible est crucial pour les secours. Utiliser les contrastes, les mouvements et les signaux universels.",
        keyPoints: [
          "Règle des 3 : 3 signaux répétés (sifflets, feux, miroirs)",
          "Contraste visuel avec l'environnement",
          "Signaux de détresse universels",
          "Économiser l'énergie et les ressources"
        ]
      },
      {
        id: "visual-signals",
        title: "Signaux visuels", 
        content: "Miroirs, feux de signalisation, signaux au sol et vêtements colorés sont les moyens les plus efficaces de jour.",
        keyPoints: [
          "Miroir de signalisation : visible à 50km",
          "Feux de signalisation : 3 feux en triangle",
          "Signaux au sol : SOS avec pierres/branches",
          "Vêtements colorés suspendus haut"
        ]
      },
      {
        id: "navigation-basics",
        title: "Navigation sans instruments",
        content: "Le soleil, les étoiles et la nature donnent des indices d'orientation même sans boussole ni GPS.",
        keyPoints: [
          "Méthode de l'ombre : bâton planté au sol",
          "Étoile polaire pour le nord (hémisphère nord)",
          "Mousse sur les arbres (côté humide/nord souvent)",
          "Cours d'eau descendent généralement vers la civilisation"
        ]
      }
    ],
    
    practicalTips: [
      "Toujours garder un miroir de signalisation sur soi",
      "S'entraîner à faire des signaux de fumée contrôlés", 
      "Apprendre les constellations de base",
      "Repérer les points de repère lors des déplacements"
    ],
    
    quiz: [
      {
        question: "Combien de signaux faut-il répéter pour un signal de détresse ?",
        options: ["2", "3", "5"],
        correct: 1
      },
      {
        question: "À quelle distance un miroir de signalisation est-il visible ?",
        options: ["5 km", "25 km", "50 km"],
        correct: 2
      }
    ],
    
    relatedCourses: [3, 5],
    lastUpdated: "2025-09-25",
    author: "SecureLink Survival Team"
  }
];

export default survivalCourses;