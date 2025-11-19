// ====================================================================
// LOGIQUE JAVASCRIPT POUR le HUB D'ÉVALUATIONS (grades_dashboard.js)
// v4 - Corrige le bug 'contextKey' dans initializeUIPermissions
// ====================================================================

// État global de l'application
const STATE = {
    // [MODIFIÉ] Structure de données pour la nouvelle logique
    mainClassData: {},
    taughtClassesData: {},
    
    // Pour la modale de confirmation
    onConfirmCallback: null,
};

// --- 1. Récupération des Éléments du DOM ---
const mainClassContainer = document.getElementById('main-class-container');
const subjectClassContainer = document.getElementById('subject-class-container');
const notificationArea = document.getElementById('notification-area');

// Modale de Confirmation (Suppression)
const genericConfirmModal = document.getElementById('generic-confirm-modal');
const genericConfirmTitle = document.getElementById('generic-confirm-title');
const genericConfirmMessage = document.getElementById('generic-confirm-message');
const genericConfirmCancelBtn = document.getElementById('generic-confirm-cancel-btn');
const genericConfirmConfirmBtn = document.getElementById('generic-confirm-confirm-btn');

// Modale d'Évaluation (Ajout/Modification)
const evaluationModal = document.getElementById('evaluation-modal');
const evaluationModalTitle = document.getElementById('evaluation-modal-title');
const evaluationForm = document.getElementById('evaluation-form');
const evalIdInput = document.getElementById('eval-id-input');
const evalClassIdInput = document.getElementById('eval-class-id-input');
const evalTsIdInput = document.getElementById('eval-ts-id-input');
const evalTermIdInput = document.getElementById('eval-term-id-input');
const evalNameInput = document.getElementById('eval-name-input');
const evalCoeffInput = document.getElementById('eval-coeff-input');
const evalMaxGradeInput = document.getElementById('eval-max-grade-input'); // <-- AJOUTÉ
const studentGradesListContainer = document.getElementById('student-grades-list-container');
const evaluationModalCancelBtn = document.getElementById('evaluation-modal-cancel-btn');
const evaluationModalSaveBtn = document.getElementById('evaluation-modal-save-btn');
const evaluationModalFooter = document.getElementById('evaluation-modal-footer');


// --- 2. Fonctions d'Utilité (Helpers) ---

/**
 * Affiche une notification.
 */
function showNotification(message, type) {
    const colorMap = {
        success: 'bg-green-100 text-green-800 border-green-400',
        error: 'bg-red-100 text-red-800 border-red-400',
        info: 'bg-blue-100 text-blue-800 border-blue-400',
    };
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-times-circle' : 'fa-info-circle');

    const notificationDiv = document.createElement('div');
    notificationDiv.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center transition-all duration-300 opacity-0 transform -translate-y-2 mb-4`;
    notificationDiv.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

    notificationArea.prepend(notificationDiv);
    
    setTimeout(() => notificationDiv.classList.remove('opacity-0', '-translate-y-2'), 10);
    setTimeout(() => {
        notificationDiv.classList.add('opacity-0', '-translate-y-2');
        notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
    }, 12000); // 12 secondes
}

/**
 * Fonction d'appel API générique.
 */
async function apiFetch(url, data) {
    // Ajoute le staff_pk global à toutes les requêtes API
    data.staff_id = STAFF_PK;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN,
            },
            body: JSON.stringify(data),
        });

        const json = await response.json();
        
        if (!response.ok) {
            const message = json.message || `Erreur serveur (Status ${response.status}).`;
            showNotification(message, 'error');
            return { success: false, ...json };
        }

        if (json.message && json.success) {
            // N'affiche pas de notif pour 'get_details' ou 'get-term-data'
            if (data.action !== "get_details" && url !== API_URLS.GET_TERM_DATA) {
                 showNotification(json.message, 'success');
            }
        }
        
        return json;

    } catch (error) {
        console.error("Erreur API:", error);
        showNotification(`Erreur de connexion au serveur : ${error.message}`, 'error');
        return { success: false, message: "Erreur de connexion réseau." };
    }
}

/**
 * Parse les données JSON initiales depuis le HTML.
 */
function parseInitialData() {
    try {
        const data = JSON.parse(document.getElementById('initial-dashboard-data').textContent);
        
        STATE.mainClassData = data.main_class_data;
        
        // [CORRECTION] La clé doit être 'taught_classes_data' (snake_case)
        // pour correspondre au JSON envoyé par Django, et non 'taughtClassesData'.
        STATE.taughtClassesData = data.taught_classes_data;
        
        console.log("Données initiales chargées:", STATE);
    } catch (e) {
        console.error("Erreur de parsing JSON initial:", e);
        showNotification("Erreur critique: Impossible de lire les données.", 'error');
    }
}




// --- 3. Logique de Rendu ---

/**
 * Met à jour l'état (lecture seule / modifiable) pour un bloc spécifique.
 */
function updateBlockPermissions(contextKey, newTermId) {
    const block = document.querySelector(`[data-context-key="${contextKey}"]`);
    if (!block) return;

    // Trouve le `current_term_id` (trimestre actif) pour ce bloc, tel que défini dans le HTML initial
    let dataBlock;
    if (contextKey.includes('-')) {
        dataBlock = STATE.taughtClassesData[contextKey];
    } else {
        dataBlock = STATE.mainClassData[contextKey];
    }

    // [CORRIGÉ] S'assure que dataBlock existe avant de lire 'current_term_id'
    if (!dataBlock) {
        console.warn(`Aucune donnée de bloc trouvée pour la clé ${contextKey} lors de la mise à jour des permissions.`);
        return; 
    }

    const actualCurrentTermId = dataBlock.current_term_id;
    
    // L'édition est possible SI l'utilisateur a la permission GLOBALE
    // ET SI le terme sélectionné EST le terme "en cours"
    const isEditable = CAN_EDIT_GRADES && (parseInt(newTermId) === parseInt(actualCurrentTermId));

    // Masque/Affiche le bouton "Ajouter Évaluation"
    const addBtn = block.querySelector('.add-eval-btn');
    if (addBtn) {
        addBtn.disabled = !isEditable;
        addBtn.style.display = CAN_EDIT_GRADES ? 'inline-block' : 'none';
    }

    // Met à jour les boutons "Modifier" et "Supprimer"
    block.querySelectorAll('.edit-eval-btn').forEach(btn => {
        const textSpan = btn.querySelector('span');
        if (textSpan) textSpan.textContent = isEditable ? 'Voir / Modifier' : 'Voir les notes';
    });
    
    block.querySelectorAll('.delete-eval-btn').forEach(btn => {
        btn.disabled = !isEditable;
        btn.style.display = CAN_EDIT_GRADES ? 'inline-block' : 'none';
    });
}


/**
 * (Re)Dessine le contenu d'un bloc "Professeur Principal".
 * @param {string} contextKey - L'ID de la classe (ex: "1")
 * @param {object} data - Les nouvelles données (moyennes)
 */
function renderMainClassBlock(contextKey, data) {
    const avgContainer = document.getElementById(`main-avg-container-${contextKey}`);
    const studentListContainer = document.getElementById(`student-main-avg-${contextKey}`);

    if (avgContainer) {
        // [CORRECTION] La clé envoyée par l'API est 'overall_class_average'
        avgContainer.textContent = data.overall_class_average || 'N/A';
    }
    
    if (studentListContainer) {
        let studentsHtml = '';
        // S'assure que la liste existe
        const studentsData = data.student_averages || [];
        
        studentsData.sort((a, b) => a.student_name.localeCompare(b.student_name));

        studentsData.forEach(student => {
            studentsHtml += `
                <li class="flex justify-between items-center text-sm py-1">
                    <span class="text-gray-700">${student.student_name}</span>
                    <span class="font-bold text-gray-900">${student.average}</span>
                </li>
            `;
        });
        studentListContainer.innerHTML = studentsHtml || '<li class="text-sm text-gray-500 italic">Aucune moyenne à afficher.</li>';
    }
}


/**
 * (Re)Dessine le contenu d'un bloc "Matière".
 * @param {string} contextKey - L'ID (ex: "1-5")
 * @param {object} data - Les nouvelles données (évaluations, moyennes)
 */
function renderSubjectClassBlock(contextKey, data) {
    const avgContainer = document.getElementById(`subject-avg-container-${contextKey}`);
    const evalListContainer = document.getElementById(`eval-list-container-${contextKey}`);
    const studentListContainer = document.getElementById(`student-subject-avg-${contextKey}`); // Le <div> caché

    // 1. Met à jour la moyenne de la classe
    if (avgContainer) {
        avgContainer.textContent = data.class_average || 'N/A';
    }

    // 2. Met à jour la liste des évaluations
    if (evalListContainer) {
        evalListContainer.innerHTML = ''; // Vide l'ancienne liste
        if (data.evaluations && data.evaluations.length > 0) {
            data.evaluations.forEach(evalData => {
                
                const editButtonText = CAN_EDIT_GRADES ? 'Voir / Modifier' : 'Voir les notes';
                const deleteButtonHtml = CAN_EDIT_GRADES ? `
                    <button data-action="delete-eval" data-eval-id="${evalData.id}" data-eval-name="${evalData.name}" class="delete-eval-btn can-edit-hide px-3 py-1 text-sm text-red-600 hover:text-red-800 transition" title="Supprimer l'évaluation">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '';

                const evalHtml = `
                    <div class="flex justify-between items-center p-2 bg-white border rounded-md">
                        <div class="text-sm">
                            <strong class="text-gray-800">${evalData.name}</strong>
                            <span class="text-gray-500">(Coeff: ${evalData.coefficient})</span>
                        </div>
                        <div>
                            <button data-action="view-eval" data-eval-id="${evalData.id}" class="edit-eval-btn px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800" title="${editButtonText}">
                                <i class="fas fa-edit mr-1"></i> <span>${editButtonText}</span>
                            </button>
                            ${deleteButtonHtml}
                        </div>
                    </div>
                `;
                evalListContainer.innerHTML += evalHtml;
            });
        } else {
            evalListContainer.innerHTML = '<p class="text-sm text-gray-500 italic">Aucune évaluation pour ce trimestre.</p>';
        }
    }

    // 3. Met à jour la liste des moyennes des élèves
    if (studentListContainer) {
        const ul = studentListContainer.querySelector('ul');
        if (ul) ul.innerHTML = ''; // Vide l'ancien <ul>
        if (data.student_averages && data.student_averages.length > 0) {
            let studentsHtml = '';
            data.student_averages.sort((a, b) => a.student_name.localeCompare(b.student_name));
            data.student_averages.forEach(student => {
                studentsHtml += `
                    <li class="flex justify-between items-center text-sm py-1">
                        <span class="text-gray-700">${student.student_name}</span>
                        <span class="font-bold text-gray-900">${student.average}</span>
                    </li>
                `;
            });
            if (ul) ul.innerHTML = studentsHtml;
        }
    }
}


// --- 4. Logique de Navigation (Trimestres) ---

/**
 * Appelé lorsque l'utilisateur change le trimestre/semestre
 */
async function handleTermChange(e) {
    const button = e.target.closest('button[data-action="change-term"]');
    if (!button) return;

    const newTermId = parseInt(button.dataset.termId);
    const contextKey = button.dataset.contextKey;
    const type = button.dataset.type; // "main" ou "subject"
    
    // Met à jour l'UI des onglets
    const tabs = document.querySelectorAll(`.term-tab-${contextKey}`);
    tabs.forEach(tab => {
        tab.classList.remove('border-indigo-500', 'text-indigo-600', 'border-b-2', 'border-teal-500', 'text-teal-600');
        tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    });
    
    const activeClass = (type === 'main') ? ['border-indigo-500', 'text-indigo-600', 'border-b-2'] : ['border-teal-500', 'text-teal-600', 'border-b-2'];
    button.classList.add(...activeClass);
    button.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');

    // Appelle l'API pour récupérer les nouvelles données
    const result = await apiFetch(API_URLS.GET_TERM_DATA, {
        term_id: newTermId,
        class_id: contextKey.split('-')[0], // "1"
        ts_id: (type === 'subject') ? contextKey.split('-')[1] : null // "5" ou null
    });

    if (result.success) {
        // Met à jour l'état global (les données ont déjà la bonne structure)
        if (type === 'main') {
            // Met à jour les données dans l'état global
            STATE.mainClassData[contextKey] = { ...STATE.mainClassData[contextKey], ...result.data };
            renderMainClassBlock(contextKey, result.data);
        } else {
            STATE.taughtClassesData[contextKey] = { ...STATE.taughtClassesData[contextKey], ...result.data };
            renderSubjectClassBlock(contextKey, result.data);
        }
        
        // Met à jour les permissions pour les boutons (Suppr, Modif)
        updateBlockPermissions(contextKey, newTermId);
    }
}


// --- 5. Logique des Modales ---

/**
 * Ouvre la modale de confirmation (pour la suppression).
 */
function openConfirmModal(title, message, onConfirm) {
    genericConfirmTitle.textContent = title;
    genericConfirmMessage.innerHTML = message;
    STATE.onConfirmCallback = onConfirm; // Stocke la fonction

    genericConfirmModal.classList.remove('opacity-0', 'pointer-events-none');
    genericConfirmModal.querySelector('div').classList.remove('translate-y-4');
}

/**
 * Ferme la modale de confirmation générique.
 */
function closeConfirmModal() {
    genericConfirmModal.classList.add('opacity-0', 'pointer-events-none');
    genericConfirmModal.querySelector('div').classList.add('translate-y-4');
    STATE.onConfirmCallback = null; // Nettoie le callback
}

/**
 * Ouvre la modale d'évaluation (pour Ajout ou Modification).
 * @param {string} mode - 'add' ou 'edit'
 * @param {object} data - Données (IDs, etc.)
 */
async function openEvaluationModal(mode, data) {
    evaluationForm.reset();
    
    // Détermine le terme actif pour ce bloc
    const termTabs = document.querySelectorAll(`.term-tab-${data.contextKey}`);
    let activeTermId = null;
    termTabs.forEach(tab => {
        if (!tab.classList.contains('border-transparent')) {
            activeTermId = tab.dataset.termId;
        }
    });
    
    evalTermIdInput.value = activeTermId;
    evalClassIdInput.value = data.classId;
    evalTsIdInput.value = data.tsId;
    
    const studentListKey = data.contextKey;
    const studentList = STATE.taughtClassesData[studentListKey].student_averages;
    
    if (!studentList) {
        showNotification("Erreur: Impossible de trouver la liste des élèves pour cette classe.", "error");
        return;
    }

    const dataBlock = STATE.taughtClassesData[studentListKey];
    const actualCurrentTermId = dataBlock ? dataBlock.current_term_id : null;
    const isReadOnly = !CAN_EDIT_GRADES || (parseInt(activeTermId) !== parseInt(actualCurrentTermId));

    if (isReadOnly) {
        evaluationModalSaveBtn.style.display = 'none';
        evalNameInput.disabled = true;
        evalCoeffInput.disabled = true;
        evalMaxGradeInput.disabled = true;
    } else {
        evaluationModalSaveBtn.style.display = 'block';
        evalNameInput.disabled = false;
        evalCoeffInput.disabled = false;
        evalMaxGradeInput.disabled = false;
    }

    // [MODIFICATION] Variable pour la validation
    let maxGrade;

    if (mode === 'add') {
        evaluationModalTitle.textContent = `Ajouter une Évaluation (${data.subjectName} - ${data.className})`;
        evalIdInput.value = ''; 
        evalMaxGradeInput.value = '20.0';
        maxGrade = 20.0; // Pour le rendu des inputs
        
        renderStudentGradeInputs(studentList, [], isReadOnly, maxGrade); // Passe maxGrade
        evaluationModal.classList.remove('opacity-0', 'pointer-events-none');
        evaluationModal.querySelector('div').classList.remove('translate-y-4');
    
    } else { // mode === 'edit' (ou 'view')
        evaluationModalTitle.textContent = `Détails de l'Évaluation (${data.subjectName} - ${data.className})`;
        evalIdInput.value = data.evalId;
        evalNameInput.value = data.evalName;
        evalCoeffInput.value = data.evalCoeff;
        evalMaxGradeInput.value = data.evalMaxGrade;
        maxGrade = parseFloat(data.evalMaxGrade); // Pour le rendu des inputs

        const result = await apiFetch(API_URLS.MANAGE_EVAL, {
            action: "get_details",
            evaluation_id: data.evalId
        });

        let existingGrades = [];
        if (result.success) {
            existingGrades = result.grades;
        } else {
             showNotification("Erreur: impossible de charger les notes existantes.", "error");
        }

        renderStudentGradeInputs(studentList, existingGrades, isReadOnly, maxGrade); // Passe maxGrade
        evaluationModal.classList.remove('opacity-0', 'pointer-events-none');
        evaluationModal.querySelector('div').classList.remove('translate-y-4');
    }
}


/**
 * Construit la liste des inputs de notes pour la modale.
 * @param {Array} studentList - Liste des élèves [{student_id, student_name}, ...]
 * @param {Array} gradesList - Liste des notes [{student_id, grade_value, is_absent}, ...]
 * @param {boolean} isReadOnly - Si les champs doivent être désactivés
 */
function renderStudentGradeInputs(studentList, gradesList, isReadOnly = false, maxGrade = 20.0) {
    studentGradesListContainer.innerHTML = '';
    
    const gradeMap = gradesList.reduce((acc, grade) => {
        acc[grade.student_id] = grade;
        return acc;
    }, {});

    studentList.sort((a, b) => a.student_name.localeCompare(b.student_name));

    studentList.forEach(student => {
        const grade = gradeMap[student.student_id] || {};
        const gradeValue = (grade.grade_value !== null && grade.grade_value !== undefined) ? grade.grade_value : '';
        const isAbsent = grade.is_absent || false;
        
        const disabledAttr = (isReadOnly || isAbsent) ? 'disabled' : '';
        const checkboxDisabledAttr = isReadOnly ? 'disabled' : '';

        const inputHtml = `
            <div class="grid grid-cols-3 gap-4 items-center p-2 hover:bg-gray-50 rounded-md">
                <label for="grade-student-${student.student_id}" class="text-sm font-medium text-gray-700 col-span-1">${student.student_name}</label>
                <div class="col-span-1">
                    <!-- [CORRECTION] step="0.5" est remplacé par step="any" pour autoriser 11.3, 12.7, etc. -->
                    <input type="number" step="any" min="0" 
                           max="${maxGrade}"
                           id="grade-student-${student.student_id}"
                           data-student-id="${student.student_id}"
                           class="grade-input w-full p-2 border border-gray-300 rounded-lg shadow-sm disabled:bg-gray-100"
                           value="${gradeValue}"
                           ${disabledAttr}>
                </div>
                <div class="col-span-1 flex items-center">
                    <input type="checkbox"
                           id="absent-student-${student.student_id}"
                           data-student-id="${student.student_id}"
                           class="absent-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded disabled:bg-gray-100"
                           ${isAbsent ? 'checked' : ''}
                           ${checkboxDisabledAttr}>
                    <label for="absent-student-${student.student_id}" class="ml-2 text-sm text-gray-600">Absent</label>
                </div>
            </div>
        `;
        studentGradesListContainer.innerHTML += inputHtml;
    });
}

/**
 * Ferme la modale d'évaluation.
 */
function closeEvaluationModal() {
    evaluationModal.classList.add('opacity-0', 'pointer-events-none');
    evaluationModal.querySelector('div').classList.add('translate-y-4');
    evaluationForm.reset();
    studentGradesListContainer.innerHTML = '';
}

/**
 * Gère la soumission du formulaire d'évaluation (Créer ou Modifier).
 */
async function handleEvaluationFormSubmit(e) {
    e.preventDefault();
    
    if (!CAN_EDIT_GRADES) {
        showNotification("Action non autorisée.", "error");
        return;
    }

    // --- [NOUVELLE VALIDATION] ---
    const maxGrade = parseFloat(evalMaxGradeInput.value);
    if (isNaN(maxGrade) || maxGrade <= 0) {
        showNotification("Veuillez entrer un 'Noté sur' valide.", "error");
        evalMaxGradeInput.focus();
        return;
    }

    // Vide les anciennes erreurs
    studentGradesListContainer.querySelectorAll('.grade-input.border-red-500').forEach(input => {
        input.classList.remove('border-red-500');
    });

    const gradesList = [];
    let validationError = false; // Flag

    studentGradesListContainer.querySelectorAll('.grade-input').forEach(input => {
        if (validationError) return; // Arrête la boucle si une erreur est trouvée

        const studentId = input.dataset.studentId;
        const isAbsent = document.getElementById(`absent-student-${studentId}`).checked;
        const gradeValueStr = input.value;
        
        let finalGrade = null;

        if (!isAbsent && gradeValueStr) {
            finalGrade = parseFloat(gradeValueStr);
            
            // Vérifie si la note dépasse le max
            if (finalGrade > maxGrade) {
                const studentName = input.closest('.grid').querySelector('label').textContent;
                showNotification(`Erreur: La note ${finalGrade} pour ${studentName} dépasse le maximum (${maxGrade}).`, 'error');
                input.focus(); // Met le focus sur le champ erroné
                input.classList.add('border-red-500', 'border-2'); // Surligne en rouge
                validationError = true; // Active le flag
            }
        }
        
        gradesList.push({
            student_id: studentId,
            grade: finalGrade,
            absent: isAbsent
        });
    });

    if (validationError) {
        return; // Stoppe la soumission si une erreur a été trouvée
    }
    // --- [FIN VALIDATION] ---


    const action = evalIdInput.value ? 'update' : 'create';
    
    const evalData = {
        action: action,
        evaluation_id: evalIdInput.value || null,
        class_id: evalClassIdInput.value,
        ts_id: evalTsIdInput.value,
        term_id: evalTermIdInput.value,
        name: evalNameInput.value,
        coefficient: evalCoeffInput.value,
        max_grade: maxGrade, // Utilise la variable déjà parsée
        grades: gradesList // Utilise la liste validée
    };
    
    const result = await apiFetch(API_URLS.MANAGE_EVAL, evalData);

    if (result.success) {
        closeEvaluationModal();
        const contextKey = `${evalData.class_id}-${evalData.ts_id}`;
        const termButton = document.querySelector(`.term-tab-${contextKey}[data-term-id="${evalData.term_id}"]`);
        if (termButton) {
            handleTermChange({ target: termButton });
        } else {
            console.warn("Impossible de trouver l'onglet de rechargement, rechargement annulé.");
        }
    } else {
        // La vue peut aussi renvoyer une erreur de validation (doubles sécurité)
        showNotification(result.message || "Erreur lors de l'enregistrement.", "error");
    }
}

/**
 * Gère la suppression d'une évaluation.
 */
function handleDeleteEvaluation(button) {
    const evalId = button.dataset.evalId;
    const evalName = button.dataset.evalName;
    const container = button.closest('[data-context-key]');
    const contextKey = container.dataset.contextKey;
    
    // Trouve l'onglet de terme actif pour ce bloc
    const termButton = container.querySelector('.term-tab-' + contextKey + '.border-b-2');

    openConfirmModal(
        "Supprimer l'Évaluation",
        `Êtes-vous sûr de vouloir supprimer l'évaluation "${evalName}" ?<br>Toutes les notes associées seront perdues.`,
        async () => {
            const result = await apiFetch(API_URLS.MANAGE_EVAL, {
                action: 'delete',
                evaluation_id: evalId
            });
            if (result.success) {
                // Recharge les données pour voir les changements
                handleTermChange({ target: termButton });
            }
        }
    );
}


// --- 6. Initialisation et Écouteurs ---

/**
 * [MODIFIÉ] Initialise l'état des permissions sur toute la page.
 */
function initializeUIPermissions() {
    
    // [CORRIGÉ] Boucle sur tous les blocs de matière en utilisant le bon sélecteur
    // Le HTML utilise 'data-context-key' pour les blocs de matière
    document.querySelectorAll('#subject-class-container [data-context-key]').forEach(container => {
        
        // [CORRIGÉ] Lit 'dataset.contextKey' au lieu de 'id.split'
        const contextKey = container.dataset.contextKey; 
        
        const data = STATE.taughtClassesData[contextKey];
        if (data) {
            updateBlockPermissions(contextKey, data.current_term_id);
        } else {
            console.warn(`Aucune donnée trouvée pour la clé ${contextKey} dans STATE.taughtClassesData`);
        }
    });
    
    // Boucle sur tous les blocs de prof principal (cette partie était déjà correcte)
    if (mainClassContainer) {
        document.querySelectorAll('#main-class-container [data-context-key]').forEach(container => {
            const contextKey = container.dataset.contextKey;
            const data = STATE.mainClassData[contextKey];
            if (data) {
                updateBlockPermissions(contextKey, data.current_term_id);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Parse les données initiales
    parseInitialData();
    
    // 2. Affiche les données initiales (déjà fait par Django)
    // On doit juste initialiser les permissions
    initializeUIPermissions();

    // 3. Écouteurs pour les modales (via délégation)
    document.body.addEventListener('click', (e) => {
        
        // Clic sur un onglet de Trimestre/Semestre
        const termBtn = e.target.closest('button[data-action="change-term"]');
        if (termBtn) {
            handleTermChange({ target: termBtn });
        }

        // Clic sur "Afficher/Masquer les moyennes"
        const toggleBtn = e.target.closest('[data-action="toggle-student-avg"]');
        if (toggleBtn) {
            e.preventDefault();
            const targetEl = document.getElementById(toggleBtn.dataset.target);
            if (targetEl) {
                targetEl.classList.toggle('hidden');
            }
        }
        
        // Clic sur "Ajouter Évaluation"
        const addBtn = e.target.closest('.add-eval-btn');
        if (addBtn && !addBtn.disabled) {
            const container = addBtn.closest('[data-context-key]');
            const contextKey = container.dataset.contextKey;
            const [classId, tsId] = contextKey.split('-');
            
            openEvaluationModal('add', {
                classId: classId,
                tsId: tsId,
                className: addBtn.dataset.className,
                subjectName: addBtn.dataset.subjectName,
                contextKey: contextKey,
                currentTermId: STATE.taughtClassesData[contextKey].current_term_id
            });
        }
        
        // Clic sur "Voir / Modifier" (Édition/Vue)
        const editBtn = e.target.closest('.edit-eval-btn');
        if (editBtn && !editBtn.disabled) {
            const container = editBtn.closest('[data-context-key]');
            const contextKey = container.dataset.contextKey;
            const [classId, tsId] = contextKey.split('-');
            
            // [MODIFICATION] Récupère toutes les données de l'évaluation, 
            // y compris 'max_grade' (grâce à utils.py)
            const evalData = STATE.taughtClassesData[contextKey].evaluations.find(ev => ev.id == editBtn.dataset.evalId);
            
            if (!evalData) {
                console.error("Impossible de trouver les données de l'évaluation dans STATE.");
                showNotification("Erreur: Données d'évaluation introuvables.", "error");
                return;
            }

            // [MODIFICATION] Passe 'evalData.max_grade' à la modale
            openEvaluationModal('edit', {
                evalId: evalData.id,
                evalName: evalData.name,
                evalCoeff: evalData.coefficient,
                evalMaxGrade: evalData.max_grade, // <-- AJOUTÉ
                classId: classId,
                tsId: tsId,
                // Recherche le nom de la classe et de la matière dans les éléments parents
                className: container.closest('.p-4.border.rounded-lg.bg-gray-50').querySelector('h3').textContent.replace('Classe : ',''),
                subjectName: container.querySelector('h4').textContent,
                contextKey: contextKey,
                currentTermId: STATE.taughtClassesData[contextKey].current_term_id
            });
        }

        // Clic sur "Supprimer" (Évaluation)
        const deleteBtn = e.target.closest('.delete-eval-btn');
        if (deleteBtn && !deleteBtn.disabled) {
            handleDeleteEvaluation(deleteBtn);
        }

        // Clic sur une checkbox "Absent" dans la modale
        const absentCheckbox = e.target.closest('.absent-checkbox');
        if (absentCheckbox && !absentCheckbox.disabled) {
            const studentId = absentCheckbox.dataset.studentId;
            const gradeInput = document.getElementById(`grade-student-${studentId}`);
            if (gradeInput) {
                gradeInput.disabled = absentCheckbox.checked;
                if (absentCheckbox.checked) {
                    gradeInput.value = '';
                }
            }
        }
    });

    // 4. Écouteurs pour les modales (Annuler, Soumettre)
    evaluationModalCancelBtn.addEventListener('click', closeEvaluationModal);
    evaluationForm.addEventListener('submit', handleEvaluationFormSubmit);

    genericConfirmCancelBtn.addEventListener('click', closeConfirmModal);
    genericConfirmConfirmBtn.addEventListener('click', () => {
        if (typeof STATE.onConfirmCallback === 'function') {
            STATE.onConfirmCallback();
        }
        closeConfirmModal();
    });
});