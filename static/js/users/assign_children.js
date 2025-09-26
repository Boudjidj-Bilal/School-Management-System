/**
 * assign_children.js
 * Gère l'interaction utilisateur sur la page d'attribution Parent-Enfant.
 * Utilise les données JSON injectées dans le template (window.linksData, window.studentsData, window.urlsData).
 * Effectue des requêtes POST vers l'API Django pour mettre à jour la BDD.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Variables Globales (issues du template Django) ---
    const linksData = window.linksData || {}; // { parent_id: [student_id1, student_id2, ...], ... }
    const studentsData = window.studentsData || []; // [{ id: 1, username: 'A'}, ...]
    const toggleUrl = window.urlsData.toggleUrl;
    // Récupère le jeton CSRF pour les requêtes POST
    const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;

    // --- Éléments du DOM ---
    const parentList = document.getElementById('parent-list');
    const assignmentSection = document.getElementById('assignment-section'); // Message initial
    const detailsSection = document.getElementById('details-section'); // Conteneur des listes
    const selectedParentName = document.getElementById('selected-parent-name');
    const linkedStudentsList = document.getElementById('linked-students-list');
    const availableStudentsList = document.getElementById('available-students-list');
    const actionMessage = document.getElementById('action-message');

    // --- État de l'application ---
    let currentParentId = null;

    /**
     * Recherche un étudiant par son ID dans la liste complète.
     * @param {string|number} studentId L'ID de l'étudiant à trouver.
     * @returns {object|undefined} L'objet étudiant ou undefined.
     */
    function findStudent(studentId) {
        // La comparaison est faite avec '==' pour gérer la possible différence de type (number vs string)
        return studentsData.find(student => String(student.id) == String(studentId));
    }

    /**
     * Crée un élément LI pour un étudiant avec le bouton d'action approprié.
     * @param {object} student L'objet étudiant.
     * @param {string} type 'linked' ou 'available'.
     * @returns {HTMLLIElement} L'élément li créé.
     */
    function createStudentElement(student, type) {
        const li = document.createElement('li');
        // Stocke l'ID dans l'attribut de données
        li.dataset.studentId = student.id; 
        
        // Classes de base communes
        li.className = `student-item p-3 rounded-lg shadow-sm cursor-pointer transition-colors duration-200 
                        flex items-center justify-between border`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${student.username}`;

        const button = document.createElement('button');
        button.className = `text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap`;
        
        if (type === 'linked') {
            li.classList.add('bg-red-100', 'hover:bg-red-200', 'border-red-300');
            nameSpan.classList.add('text-red-800', 'font-medium');
            button.innerHTML = '<i class="fas fa-unlink mr-1"></i> Délier';
            button.classList.add('bg-red-300', 'text-red-900', 'hover:bg-red-400');
        } else {
            li.classList.add('bg-green-100', 'hover:bg-green-200', 'border-green-300');
            nameSpan.classList.add('text-green-800', 'font-medium');
            button.innerHTML = '<i class="fas fa-link mr-1"></i> Lier';
            button.classList.add('bg-green-300', 'text-green-900', 'hover:bg-green-400');
        }

        li.appendChild(nameSpan);
        li.appendChild(button);
        
        // Ajout de l'écouteur d'événement pour l'action link/unlink via l'API
        li.addEventListener('click', () => {
            const action = type === 'linked' ? 'unlink' : 'link';
            // L'ID du parent est forcément défini ici
            if (currentParentId) {
                toggleAssignment(currentParentId, student.id, action, li);
            }
        });

        return li;
    }

    /**
     * Met à jour les listes des enfants liés et disponibles pour le parent sélectionné.
     * @param {string} parentId ID du parent sélectionné.
     */
    function updateStudentLists(parentId) {
        // Nettoyage des listes
        linkedStudentsList.innerHTML = '';
        availableStudentsList.innerHTML = '';
        actionMessage.textContent = ''; // Effacer les anciens messages d'action

        // Récupération des IDs des enfants liés au parent (les IDs dans linksData sont des chaînes)
        const linkedIds = linksData[String(parentId)] || [];
        
        let hasLinked = false;
        let hasAvailable = false;

        // 1. Peupler la liste des enfants liés
        linkedIds.forEach(studentId => {
            const student = findStudent(studentId);
            if (student) {
                linkedStudentsList.appendChild(createStudentElement(student, 'linked'));
                hasLinked = true;
            }
        });

        // 2. Peupler la liste des enfants disponibles
        studentsData.forEach(student => {
            // Vérifie si l'ID de l'étudiant (en chaîne) n'est PAS dans la liste des IDs liés
            if (!linkedIds.includes(String(student.id))) {
                availableStudentsList.appendChild(createStudentElement(student, 'available'));
                hasAvailable = true;
            }
        });

        // Affichage des messages par défaut si les listes sont vides
        if (!hasLinked) {
            linkedStudentsList.innerHTML = '<p class="text-red-500 italic" id="no-linked-students">Aucun enfant n\'est attribué à ce parent.</p>';
        }
        if (!hasAvailable) {
            availableStudentsList.innerHTML = '<p class="text-green-500 italic" id="no-available-students">Tous les étudiants ont été attribués à ce parent ou sont déjà liés.</p>';
        }
    }

    /**
     * Gère la sélection d'un parent.
     * @param {HTMLLIElement} selectedLi L'élément LI du parent sélectionné.
     */
    function handleParentSelection(selectedLi) {
        // Masquer le message initial, afficher la section de détails
        assignmentSection.classList.add('hidden');
        detailsSection.classList.remove('hidden');

        // Gérer la classe 'selected' pour le parent
        document.querySelectorAll('.parent-item').forEach(li => {
            li.classList.remove('bg-blue-200', 'font-bold', 'border-blue-500');
            li.classList.add('bg-white', 'hover:bg-blue-50', 'border-transparent', 'font-medium');
        });
        selectedLi.classList.add('bg-blue-200', 'font-bold', 'border-blue-500');
        selectedLi.classList.remove('bg-white', 'hover:bg-blue-50', 'border-transparent', 'font-medium');


        // Mettre à jour l'état et l'affichage
        currentParentId = selectedLi.dataset.parentId;
        selectedParentName.textContent = selectedLi.querySelector('span').textContent;

        updateStudentLists(currentParentId);
    }

    /**
     * Envoie la requête à l'API pour lier/délier un enfant et met à jour l'état local.
     * @param {string} parentId ID du parent.
     * @param {number} studentId ID de l'étudiant.
     * @param {string} action 'link' ou 'unlink'.
     * @param {HTMLLIElement} element L'élément DOM de l'étudiant (pour le feedback).
     */
    async function toggleAssignment(parentId, studentId, action, element) {
        
        // Affichage du message de chargement
        actionMessage.textContent = "Action en cours...";
        actionMessage.className = 'mt-6 text-sm text-center font-medium text-gray-500';
        
        // Désactiver l'élément pendant le traitement
        element.style.opacity = 0.5;
        element.style.pointerEvents = 'none';

        try {
            const response = await fetch(toggleUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({
                    parent_id: parentId,
                    student_id: studentId,
                    action: action
                })
            });

            const data = await response.json();

            if (data.success) {
                // Mettre à jour les liens dans l'état local (linksData)
                const parentKey = String(parentId);
                const studentKey = String(studentId); // Les IDs stockés sont des chaînes

                if (action === 'link') {
                    if (!linksData[parentKey]) {
                        linksData[parentKey] = [];
                    }
                    if (!linksData[parentKey].includes(studentKey)) {
                        linksData[parentKey].push(studentKey);
                    }
                } else if (action === 'unlink') {
                    if (linksData[parentKey]) {
                        // Filtre pour enlever l'ID de l'étudiant
                        linksData[parentKey] = linksData[parentKey].filter(id => id !== studentKey);
                        // Supprime la clé si la liste devient vide pour garder l'état propre
                        if (linksData[parentKey].length === 0) {
                            delete linksData[parentKey];
                        }
                    }
                }
                
                // Rafraîchir les listes après la mise à jour de l'état local
                updateStudentLists(parentId);

                actionMessage.textContent = data.message;
                actionMessage.className = 'mt-6 text-sm text-center font-medium text-green-600';

            } else {
                actionMessage.textContent = data.message || `Erreur lors de l'action ${action}.`;
                actionMessage.className = 'mt-6 text-sm text-center font-medium text-red-600';
            }

        } catch (error) {
            console.error("Erreur de l'API de bascule:", error);
            actionMessage.textContent = "Erreur de connexion au serveur.";
            actionMessage.className = 'mt-6 text-sm text-center font-medium text-red-600';
        } finally {
            // Réactiver l'élément (note: il sera de toute façon recréé par updateStudentLists)
            element.style.opacity = 1;
            element.style.pointerEvents = 'auto';
        }
    }


    // --- Écouteurs d'événements principaux ---
    
    // 1. Écouter la sélection d'un parent
    if (parentList) {
        parentList.addEventListener('click', (event) => {
            // Trouve le LI le plus proche avec la classe .parent-item
            const li = event.target.closest('.parent-item');
            if (li) {
                handleParentSelection(li);
            }
        });
    }

    // 2. Initialisation : Si des parents existent, sélectionne le premier par défaut
    const firstParentLi = parentList ? parentList.querySelector('.parent-item') : null;
    if (firstParentLi) {
        handleParentSelection(firstParentLi);
    }
});
