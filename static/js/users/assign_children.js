/**
 * assign_children.js
 * Gère l'interaction utilisateur sur la page d'attribution Parent-Enfant.
 * VERSION SÉCURISÉE & ROBUSTE :
 * - Lit les données JSON depuis les balises <script type="application/json"> générées par Django.
 * - Évite les erreurs de syntaxe JSON dues aux guillemets simples Python.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Récupération des données et configuration ---
    const container = document.getElementById('assign-children-container');
    const csrfInput = document.getElementById('csrf-token');
    
    // Valeurs par défaut
    let linksData = {};
    let studentsData = [];
    let toggleUrl = '';
    const csrfToken = csrfInput ? csrfInput.value : '';

    // A. Récupération de l'URL API
    if (container) {
        toggleUrl = container.getAttribute('data-toggle-url');
    }

    // B. Récupération des données JSON via json_script
    // Cette méthode est beaucoup plus fiable que les data-attributes pour les objets complexes
    try {
        const linksElement = document.getElementById('links-data-json');
        if (linksElement) {
            linksData = JSON.parse(linksElement.textContent);
            // Si la donnée a été passée comme une string JSON depuis la vue, on parse une seconde fois
            if (typeof linksData === 'string') {
                linksData = JSON.parse(linksData);
            }
        }
    } catch (e) {
        console.error("Erreur lecture linksData", e);
    }

    try {
        const studentsElement = document.getElementById('students-data-json');
        if (studentsElement) {
            studentsData = JSON.parse(studentsElement.textContent);
            // Idem, double parse si nécessaire
            if (typeof studentsData === 'string') {
                studentsData = JSON.parse(studentsData);
            }
        }
    } catch (e) {
        console.error("Erreur lecture studentsData", e);
    }

    // --- Éléments du DOM ---
    const parentList = document.getElementById('parent-list');
    const assignmentSection = document.getElementById('assignment-section');
    const detailsSection = document.getElementById('details-section');
    const selectedParentName = document.getElementById('selected-parent-name');
    const linkedStudentsList = document.getElementById('linked-students-list');
    const availableStudentsList = document.getElementById('available-students-list');
    const actionMessage = document.getElementById('action-message');

    // --- État de l'application ---
    let currentParentId = null;

    /**
     * Recherche un étudiant par son ID dans la liste complète.
     */
    function findStudent(studentId) {
        return studentsData.find(student => String(student.id) == String(studentId));
    }

    /**
     * Crée un élément LI pour un étudiant avec le bouton d'action approprié.
     */
    function createStudentElement(student, type) {
        const li = document.createElement('li');
        li.dataset.studentId = student.id; 
        
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
        
        li.addEventListener('click', () => {
            const action = type === 'linked' ? 'unlink' : 'link';
            if (currentParentId) {
                toggleAssignment(currentParentId, student.id, action, li);
            }
        });

        return li;
    }

    /**
     * Met à jour les listes des enfants liés et disponibles.
     */
    function updateStudentLists(parentId) {
        linkedStudentsList.innerHTML = '';
        availableStudentsList.innerHTML = '';
        actionMessage.textContent = ''; 

        const linkedIds = linksData[String(parentId)] || [];
        
        let hasLinked = false;
        let hasAvailable = false;

        // 1. Liste des enfants liés
        linkedIds.forEach(studentId => {
            const student = findStudent(studentId);
            if (student) {
                linkedStudentsList.appendChild(createStudentElement(student, 'linked'));
                hasLinked = true;
            }
        });

        // 2. Liste des enfants disponibles
        studentsData.forEach(student => {
            if (!linkedIds.includes(String(student.id))) {
                availableStudentsList.appendChild(createStudentElement(student, 'available'));
                hasAvailable = true;
            }
        });

        if (!hasLinked) {
            linkedStudentsList.innerHTML = '<p class="text-red-500 italic" id="no-linked-students">Aucun enfant n\'est attribué à ce parent.</p>';
        }
        if (!hasAvailable) {
            availableStudentsList.innerHTML = '<p class="text-green-500 italic" id="no-available-students">Tous les étudiants ont été attribués à ce parent ou sont déjà liés.</p>';
        }
    }

    /**
     * Gère la sélection d'un parent.
     */
    function handleParentSelection(selectedLi) {
        assignmentSection.classList.add('hidden');
        detailsSection.classList.remove('hidden');

        document.querySelectorAll('.parent-item').forEach(li => {
            li.classList.remove('bg-blue-200', 'font-bold', 'border-blue-500');
            li.classList.add('bg-white', 'hover:bg-blue-50', 'border-transparent', 'font-medium');
        });
        selectedLi.classList.add('bg-blue-200', 'font-bold', 'border-blue-500');
        selectedLi.classList.remove('bg-white', 'hover:bg-blue-50', 'border-transparent', 'font-medium');

        currentParentId = selectedLi.dataset.parentId;
        selectedParentName.textContent = selectedLi.querySelector('span').textContent;

        updateStudentLists(currentParentId);
    }

    /**
     * Envoie la requête API et met à jour l'état local.
     */
    async function toggleAssignment(parentId, studentId, action, element) {
        
        if (!toggleUrl) {
            actionMessage.textContent = "Erreur de configuration : URL API manquante.";
            actionMessage.className = 'mt-6 text-sm text-center font-medium text-red-600';
            return;
        }

        actionMessage.textContent = "Action en cours...";
        actionMessage.className = 'mt-6 text-sm text-center font-medium text-gray-500';
        
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
                const parentKey = String(parentId);
                const studentKey = String(studentId);

                if (action === 'link') {
                    if (!linksData[parentKey]) linksData[parentKey] = [];
                    if (!linksData[parentKey].includes(studentKey)) linksData[parentKey].push(studentKey);
                } else if (action === 'unlink') {
                    if (linksData[parentKey]) {
                        linksData[parentKey] = linksData[parentKey].filter(id => id !== studentKey);
                        if (linksData[parentKey].length === 0) delete linksData[parentKey];
                    }
                }
                
                updateStudentLists(parentId);

                actionMessage.textContent = data.message;
                actionMessage.className = 'mt-6 text-sm text-center font-medium text-green-600';

            } else {
                actionMessage.textContent = data.message || `Erreur lors de l'action ${action}.`;
                actionMessage.className = 'mt-6 text-sm text-center font-medium text-red-600';
            }

        } catch (error) {
            console.error("Erreur API:", error);
            actionMessage.textContent = "Erreur de connexion au serveur.";
            actionMessage.className = 'mt-6 text-sm text-center font-medium text-red-600';
        } finally {
            if (element && element.parentNode) {
                element.style.opacity = 1;
                element.style.pointerEvents = 'auto';
            }
        }
    }

    // --- Écouteurs d'événements ---
    if (parentList) {
        parentList.addEventListener('click', (event) => {
            const li = event.target.closest('.parent-item');
            if (li) handleParentSelection(li);
        });
    }

    // Initialisation
    const firstParentLi = parentList ? parentList.querySelector('.parent-item') : null;
    if (firstParentLi) handleParentSelection(firstParentLi);
});