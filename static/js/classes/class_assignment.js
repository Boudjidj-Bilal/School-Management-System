// Récupération des données globales définies dans le template
// NOTE: API_URL, CSRF_TOKEN, et CLASS_PK sont définis dans le bloc extra_js du template.

// --- 1. Récupération des données JSON injectées ---
function getInitialData(id) {
    const scriptTag = document.getElementById(id);
    if (scriptTag) {
        try {
            const rawJson = scriptTag.textContent.trim();
            if (!rawJson || rawJson.length < 2 || rawJson === '[]') return []; 
            
            // Correction potentielle si Django double-quote le JSON array:
            let contentToParse = rawJson;
            if (contentToParse.startsWith('"') && contentToParse.endsWith('"')) {
                contentToParse = JSON.parse(contentToParse); // Décodage de la chaîne échappée
            }
            return JSON.parse(contentToParse);
        } catch (e) {
            console.error(`Erreur de parsage des données initiales pour l'ID ${id}:`, e);
            return [];
        }
    }
    return [];
}

// Variables d'état
let assignedStudents = getInitialData('assigned-students-data');
let availableStudents = getInitialData('available-students-data');
let assignedTeachers = getInitialData('assigned-teachers-data');
let availableTeachers = getInitialData('available-teachers-data');

// Éléments du DOM
const notificationArea = document.getElementById('notification-area');
const assignedStudentsList = document.getElementById('assigned-students-list');
const studentSelect = document.getElementById('student-select');
const addStudentBtn = document.getElementById('add-student-btn');

const assignedTeachersList = document.getElementById('assigned-teachers-list');
const teacherSelect = document.getElementById('teacher-select');
const addTeacherBtn = document.getElementById('add-teacher-btn');

// Éléments du Modal
const modal = document.getElementById('confirmation-modal');
const modalMessage = document.getElementById('modal-message');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// Variable pour stocker l'action en attente de confirmation du modal
let pendingAction = null;


// --- 2. Fonctions d'Utilité ---

/**
 * Affiche un message de notification.
 * @param {string} message - Le texte du message.
 * @param {boolean} isSuccess - Si c'est un message de succès (true) ou d'erreur (false).
 */
function showNotification(message, isSuccess) {
    const alertClass = isSuccess 
        ? 'bg-green-100 text-green-800 border-green-400' 
        : 'bg-red-100 text-red-800 border-red-400';
    
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-xl shadow-md border ${alertClass} transition-opacity duration-500 ease-in-out opacity-0`;
    notification.innerHTML = `<p class="font-medium">${message}</p>`;

    notificationArea.prepend(notification);
    
    // Animation d'apparition
    setTimeout(() => notification.classList.remove('opacity-0'), 10);

    // Disparition après 5 secondes
    setTimeout(() => {
        notification.classList.add('opacity-0');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 5000);
}

/**
 * Envoie une requête AJAX (POST) générique à l'API.
 */
async function sendApiRequest(data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN,
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        
        if (!response.ok) {
            // Utiliser le message de la réponse JSON ou un message par défaut
            throw new Error(result.message || `Erreur HTTP ${response.status} lors de l'action ${data.action}.`);
        }

        return result;

    } catch (error) {
        showNotification(error.message, false);
        console.error("Erreur API:", error);
        return { success: false, message: error.message };
    }
}


// --- 3. Logique du Modal de Confirmation ---

/**
 * Affiche le modal de confirmation et met en attente l'action.
 * @param {object} actionDetails - Détails de l'action à exécuter après confirmation.
 * @param {string} message - Message spécifique à afficher dans le modal.
 */
function showConfirmationModal(actionDetails, message) {
    modalMessage.textContent = message;
    pendingAction = actionDetails;
    
    // Afficher le modal (rendre visible et cliquable)
    modal.classList.remove('opacity-0', 'pointer-events-none');
    // Optionnel: ajouter une classe pour l'animation interne du dialogue
    modal.querySelector('div').classList.remove('translate-y-4');
}

/**
 * Cache le modal de confirmation et nettoie l'action en attente.
 */
function hideConfirmationModal() {
    // Animer le dialogue avant de le cacher complètement
    modal.querySelector('div').classList.add('translate-y-4');
    
    setTimeout(() => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        pendingAction = null;
    }, 300); // Doit correspondre à la durée de transition CSS
}

/**
 * Exécute l'action de désaffectation stockée dans pendingAction.
 */
async function executePendingUnlink() {
    if (!pendingAction) return;

    const action = pendingAction.action;
    const assignment_pk = pendingAction.assignment_pk;

    const data = {
        action: action,
        assignment_pk: assignment_pk,
    };

    const result = await sendApiRequest(data);

    if (result.success) {
        showNotification(result.message, true);
        
        // --- CORRECTION 1: Ajout automatique à la liste des disponibles ---
        
        if (action === 'unlink_student') {
            const unlinkedIndex = assignedStudents.findIndex(s => s.pk == assignment_pk);
            // Stocker et retirer l'élément de la liste des affectés
            const unlinkedStudent = assignedStudents.splice(unlinkedIndex, 1)[0];
            
            // Trouver l'original de l'étudiant dans les données initiales pour garantir toutes les clés
            const studentId = unlinkedStudent.student_id;
            
            // On vérifie s'il n'est pas déjà dans la liste des disponibles 
            const isAlreadyAvailable = availableStudents.some(s => s.pk == studentId);
            
            if (!isAlreadyAvailable) {
                // Créer un objet de format "disponible" pour l'ajouter
                const newAvailableStudent = {
                    pk: studentId, // C'est le PK de l'objet Student, pas ClassStudentYear
                    user__first_name: unlinkedStudent.student__user__first_name,
                    user__last_name: unlinkedStudent.student__user__last_name,
                    user__username: unlinkedStudent.student__user__username,
                };
                availableStudents.push(newAvailableStudent);
                availableStudents.sort((a, b) => (a.user__last_name > b.user__last_name) ? 1 : -1);
            }
            
        } else if (action === 'unlink_teacher') {
            const unlinkedIndex = assignedTeachers.findIndex(t => t.pk == assignment_pk);
            const unlinkedTeacher = assignedTeachers.splice(unlinkedIndex, 1)[0];
            
            const tsId = unlinkedTeacher.teacher_id;
            const isAlreadyAvailable = availableTeachers.some(t => t.pk == tsId);
            
            if (!isAlreadyAvailable) {
                // Créer un objet de format "disponible" pour l'ajouter
                const newAvailableTeacher = {
                    pk: tsId, // C'est le PK de l'objet TeacherSubject
                    subject__name: unlinkedTeacher.teacher__subject__name,
                    teacher__user__first_name: unlinkedTeacher.teacher__teacher__user__first_name,
                    teacher__user__last_name: unlinkedTeacher.teacher__teacher__user__last_name,
                };
                availableTeachers.push(newAvailableTeacher);
                availableTeachers.sort((a, b) => (a.teacher__user__last_name > b.teacher__user__last_name) ? 1 : -1);
            }
        }
        
        renderAllLists(); 
    }
}


// --- 4. Fonctions de Rendu des Listes (Ajustées pour les data-attributes) ---

/**
 * Génère l'élément HTML pour un étudiant affecté.
 */
function renderAssignedStudent(student) {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-indigo-100';
    item.id = `student-link-${student.pk}`;
    
    // Nom et prénom
    const name = student.student__user__last_name + ' ' + student.student__user__first_name;
    const username = student.student__user__username;

    item.innerHTML = `
        <div class="flex-grow">
            <p class="font-medium text-gray-800">${name}</p>
            <p class="text-sm text-gray-500">${username}</p>
        </div>
        <div class="flex items-center space-x-3">
            <!-- Bouton/Toggle Délégué -->
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" 
                       data-action="set_delegate"
                       data-assignment-pk="${student.pk}"
                       ${student.is_delegate ? 'checked' : ''} 
                       class="sr-only peer delegate-toggle">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span class="ms-3 text-sm font-medium text-gray-900 delegate-label">${student.is_delegate ? 'Délégué' : 'Non Délégué'}</span>
            </label>
            <!-- Bouton Supprimer -->
            <button data-action="unlink_student" 
                    data-assignment-pk="${student.pk}"
                    data-name="${name} (${username})"
                    class="unlink-btn text-red-500 hover:text-red-700 transition duration-150 p-2 rounded-full hover:bg-red-50" title="Retirer de la classe">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    return item;
}

/**
 * Génère l'élément HTML pour un professeur affecté.
 */
function renderAssignedTeacher(teacher) {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-teal-100';
    item.id = `teacher-link-${teacher.pk}`;

    // Nom et prénom
    const name = teacher.teacher__teacher__user__last_name + ' ' + teacher.teacher__teacher__user__first_name;
    const subjectName = teacher.teacher__subject__name;

    item.innerHTML = `
        <div class="flex-grow">
            <p class="font-medium text-gray-800">${name}</p>
            <p class="text-sm text-teal-600 font-semibold">${subjectName}</p>
        </div>
        <div class="flex items-center space-x-3">
            <!-- Bouton/Toggle Prof Principal -->
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" 
                       data-action="set_main_teacher"
                       data-assignment-pk="${teacher.pk}"
                       ${teacher.is_main_teacher ? 'checked' : ''} 
                       class="sr-only peer main-teacher-toggle">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                <span class="ms-3 text-sm font-medium text-gray-900 principal-label">${teacher.is_main_teacher ? 'Principal' : 'Non Principal'}</span>
            </label>
            <!-- Bouton Supprimer -->
            <button data-action="unlink_teacher" 
                    data-assignment-pk="${teacher.pk}"
                    data-name="${name} (${subjectName})"
                    class="unlink-btn text-red-500 hover:text-red-700 transition duration-150 p-2 rounded-full hover:bg-red-50" title="Retirer l'affectation">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    return item;
}

/**
 * Met à jour le <select> des élèves disponibles.
 */
function updateAvailableStudentsSelect() {
    studentSelect.innerHTML = '<option value="" disabled selected>-- Sélectionnez --</option>';
    availableStudents.forEach(student => {
        const option = document.createElement('option');
        option.value = student.pk;
        option.textContent = `${student.user__last_name} ${student.user__first_name} (${student.user__username})`;
        studentSelect.appendChild(option);
    });
    // Si la liste des disponibles est vide, on désactive le select et le bouton
    studentSelect.disabled = availableStudents.length === 0;
    addStudentBtn.disabled = !studentSelect.value || availableStudents.length === 0;
}

/**
 * Met à jour le <select> des professeurs disponibles.
 */
function updateAvailableTeachersSelect() {
    teacherSelect.innerHTML = '<option value="" disabled selected>-- Sélectionnez --</option>';
    availableTeachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.pk;
        option.textContent = `${teacher.teacher__user__last_name} ${teacher.teacher__user__first_name} (${teacher.subject__name})`;
        teacherSelect.appendChild(option);
    });
    // Si la liste des disponibles est vide, on désactive le select et le bouton
    teacherSelect.disabled = availableTeachers.length === 0;
    addTeacherBtn.disabled = !teacherSelect.value || availableTeachers.length === 0;
}

/**
 * Rend et met à jour les deux listes (Élèves et Professeurs).
 */
function renderAllLists() {
    // Rendu des élèves affectés
    assignedStudentsList.innerHTML = '';
    if (assignedStudents.length === 0) {
         assignedStudentsList.innerHTML = '<p class="text-center p-4 text-gray-500 italic">Aucun élève affecté à cette classe pour l\'instant.</p>';
    } else {
        assignedStudents.forEach(student => {
            assignedStudentsList.appendChild(renderAssignedStudent(student));
        });
    }

    // Rendu des professeurs affectés
    assignedTeachersList.innerHTML = '';
    if (assignedTeachers.length === 0) {
         assignedTeachersList.innerHTML = '<p class="text-center p-4 text-gray-500 italic">Aucun professeur affecté à cette classe pour cette année.</p>';
    } else {
        assignedTeachers.forEach(teacher => {
            assignedTeachersList.appendChild(renderAssignedTeacher(teacher));
        });
    }

    // Mise à jour des selects disponibles
    updateAvailableStudentsSelect();
    updateAvailableTeachersSelect();
}


// --- 5. Gestionnaires d'Événements pour l'API ---

/**
 * Gère l'ajout d'un étudiant à la classe.
 */
async function handleAddStudent() {
    const student_id = studentSelect.value;
    if (!student_id) return;
    
    addStudentBtn.disabled = true;

    const data = { action: 'link_student', student_id: student_id };
    const result = await sendApiRequest(data);

    if (result.success) {
        showNotification(result.message, true);
        
        // Retirer de la liste disponible
        const addedStudentIndex = availableStudents.findIndex(s => s.pk == student_id);
        const addedStudent = availableStudents.splice(addedStudentIndex, 1)[0];
        
        // Créer l'objet ClassStudentYear pour la liste affectée
        const newAssignment = {
            pk: result.assignment_pk,
            student_id: addedStudent.pk,
            is_delegate: false,
            // Copier les infos de l'utilisateur pour le rendu
            student__user__first_name: addedStudent.user__first_name,
            student__user__last_name: addedStudent.user__last_name,
            student__user__username: addedStudent.user__username,
        };

        assignedStudents.push(newAssignment);
        assignedStudents.sort((a, b) => (a.student__user__last_name > b.student__user__last_name) ? 1 : -1);
        
        studentSelect.value = '';
        renderAllLists(); 
    }
    addStudentBtn.disabled = !studentSelect.value || availableStudents.length === 0;
}

/**
 * Gère l'ajout d'un professeur à la classe.
 */
async function handleAddTeacher() {
    const teacher_subject_id = teacherSelect.value;
    if (!teacher_subject_id) return;
    
    addTeacherBtn.disabled = true;

    const data = { action: 'link_teacher', teacher_subject_id: teacher_subject_id };
    const result = await sendApiRequest(data);

    if (result.success) {
        showNotification(result.message, true);
        
        // Retirer de la liste disponible
        const addedTeacherIndex = availableTeachers.findIndex(t => t.pk == teacher_subject_id);
        const addedTeacher = availableTeachers.splice(addedTeacherIndex, 1)[0];
        
        // Créer l'objet ClassTeacherYear pour la liste affectée
        const newAssignment = {
            pk: result.assignment_pk,
            teacher_id: addedTeacher.pk,
            is_main_teacher: false,
            // Copier les infos pour le rendu
            teacher__subject__name: addedTeacher.subject__name,
            teacher__teacher__user__first_name: addedTeacher.teacher__user__first_name,
            teacher__teacher__user__last_name: addedTeacher.teacher__user__last_name,
        };

        assignedTeachers.push(newAssignment);
        assignedTeachers.sort((a, b) => (a.teacher__subject__name > b.teacher__subject__name) ? 1 : -1);
        
        teacherSelect.value = '';
        renderAllLists(); 
    }
    addTeacherBtn.disabled = !teacherSelect.value || availableTeachers.length === 0;
}


/**
 * Gère le clic sur les boutons d'action des listes affectées (Unlink/Toggle).
 */
async function handleAssignedListClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const assignment_pk = target.dataset.assignmentPk;

    // --- Action Supprimer/Désaffecter (Unlink) ---
    if (action.startsWith('unlink_')) {
        // CORRECTION 2: Utilisation du modal de confirmation
        const entityName = target.dataset.name;
        const message = `Voulez-vous vraiment retirer ${entityName} de cette classe ?`;
        
        showConfirmationModal({ action, assignment_pk }, message);

    // --- Action Toggle Délégué / Principal ---
    } else if (action === 'set_delegate' || action === 'set_main_teacher') {
        const is_checked = target.checked;
        
        const data = {
            action: action,
            assignment_pk: assignment_pk,
            is_delegate: is_checked, 
            is_main_teacher: is_checked, 
        };

        // Rétablissement immédiat de l'état en cas d'échec
        const initial_state = !is_checked;

        const result = await sendApiRequest(data);
        
        if (result.success) {
            showNotification(result.message, true);

            // Mise à jour de l'état local après succès
            if (action === 'set_delegate') {
                const student = assignedStudents.find(s => s.pk == assignment_pk);
                if (student) student.is_delegate = is_checked;
                // Mise à jour du label visuellement
                const label = target.closest('label').querySelector('.delegate-label');
                if (label) label.textContent = is_checked ? 'Délégué' : 'Non Délégué';

            } else if (action === 'set_main_teacher') {
                 // Gérer l'unicité du Prof Principal localement
                assignedTeachers.forEach(t => {
                    t.is_main_teacher = (t.pk == assignment_pk && is_checked);
                });
            }
            
            // Re-render nécessaire uniquement pour l'unicité du Prof Principal
            if (action === 'set_main_teacher') {
                renderAllLists(); 
            }

        } else {
            // Rétablir l'état du toggle visuellement si l'API a échoué
            target.checked = initial_state;
        }
    }
}


// --- 6. Initialisation ---

window.onload = function() {
    renderAllLists();
    
    // Événements d'ajout
    studentSelect.addEventListener('change', () => addStudentBtn.disabled = !studentSelect.value);
    addStudentBtn.addEventListener('click', handleAddStudent);
    
    teacherSelect.addEventListener('change', () => addTeacherBtn.disabled = !teacherSelect.value);
    addTeacherBtn.addEventListener('click', handleAddTeacher);
    
    // Événement délégué/supprimer (utilise la délégation d'événements)
    assignedStudentsList.addEventListener('click', handleAssignedListClick);
    assignedTeachersList.addEventListener('click', handleAssignedListClick);
    
    // Événements du Modal (CORRECTION 2)
    modalCancelBtn.addEventListener('click', hideConfirmationModal);
    modalConfirmBtn.addEventListener('click', () => {
        hideConfirmationModal();
        executePendingUnlink(); // Exécute l'action de suppression
    });
    // Fermer le modal en cliquant sur l'arrière-plan
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideConfirmationModal();
        }
    });
};
