// ====================================================================
// LOGIQUE JAVASCRIPT POUR le HUB D'ÉVALUATIONS (grades_dashboard.js)
// VERSION SÉCURISÉE (CSP Compliant) & CORRIGÉE
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('grades-dashboard-container');
    
    // Récupération robuste du CSRF (Input standard Django ou custom)
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]') || document.getElementById('csrf-token');
    const CSRF_TOKEN_VALUE = csrfInput ? csrfInput.value : '';

    if (!container) {
        console.error("Erreur critique : Conteneur principal introuvable.");
        return;
    }

    if (!CSRF_TOKEN_VALUE) {
        console.error("Erreur critique : Token CSRF introuvable.");
    }

    // Récupération de la configuration depuis les data-attributes
    const CONFIG = {
        staffPk: container.dataset.staffPk,
        canEdit: container.dataset.canEdit === 'true',
        urls: {
            getTermData: container.dataset.apiGetTerm,
            manageEval: container.dataset.apiManageEval
        },
        csrfToken: CSRF_TOKEN_VALUE
    };

    // État global de l'application
    const STATE = {
        mainClassData: {},
        taughtClassesData: {},
        onConfirmCallback: null // Fonction à exécuter après confirmation
    };


    // --- 2. ÉLÉMENTS DU DOM ---
    const mainClassContainer = document.getElementById('main-class-container');
    const subjectClassContainer = document.getElementById('subject-class-container');
    const notificationArea = document.getElementById('notification-area');

    // Modales
    const genericConfirmModal = document.getElementById('generic-confirm-modal');
    const evaluationModal = document.getElementById('evaluation-modal');
    const evaluationForm = document.getElementById('evaluation-form');
    
    // Champs Formulaire Évaluation
    const evalIdInput = document.getElementById('eval-id-input');
    const evalClassIdInput = document.getElementById('eval-class-id-input');
    const evalTsIdInput = document.getElementById('eval-ts-id-input');
    const evalTermIdInput = document.getElementById('eval-term-id-input');
    const evalNameInput = document.getElementById('eval-name-input');
    const evalCoeffInput = document.getElementById('eval-coeff-input');
    const evalMaxGradeInput = document.getElementById('eval-max-grade-input');
    const evalIsMainInput = document.getElementById('eval-is-main-input');
    
    const studentGradesListContainer = document.getElementById('student-grades-list-container');
    
    // Boutons Modales
    const evaluationModalCancelBtn = document.getElementById('evaluation-modal-cancel-btn');
    const evaluationModalSaveBtn = document.getElementById('evaluation-modal-save-btn');
    const genericConfirmCancelBtn = document.getElementById('generic-confirm-cancel-btn');
    const genericConfirmConfirmBtn = document.getElementById('generic-confirm-confirm-btn');


    // --- 3. FONCTIONS UTILITAIRES ---

    function showNotification(message, type) {
        if (!notificationArea) return;
        
        const colorClass = type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border shadow-md flex items-center mb-4 transition-all duration-300 ${colorClass}`;
        div.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

        notificationArea.prepend(div);
        
        // Animation d'entrée
        setTimeout(() => div.classList.remove('opacity-0', '-translate-y-2'), 10);
        // Disparition auto
        setTimeout(() => {
            div.classList.add('opacity-0', '-translate-y-2');
            div.addEventListener('transitionend', () => div.remove());
        }, 5000);
    }

    /**
     * Fonction d'appel API centralisée
     */
    async function apiFetch(url, payload) {
        // On ajoute toujours l'ID du staff pour le contexte
        payload.staff_id = CONFIG.staffPk;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CONFIG.csrfToken,
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 403) {
                console.error("Erreur 403 Forbidden : Problème de CSRF ou de Permissions.");
                showNotification("Accès refusé. Vérifiez vos droits ou rafraîchissez la page.", 'error');
                return { success: false };
            }

            const json = await response.json();

            if (!response.ok) {
                showNotification(json.message || "Erreur serveur.", 'error');
                return { success: false };
            }

            // Notification de succès (sauf pour lecture seule)
            if (json.success && payload.action !== 'get_details' && url !== CONFIG.urls.getTermData) {
                showNotification(json.message, 'success');
            }

            return json;

        } catch (error) {
            console.error("Erreur API :", error);
            showNotification("Erreur de connexion.", 'error');
            return { success: false };
        }
    }

    function parseInitialData() {
        try {
            const scriptTag = document.getElementById('initial-dashboard-data');
            if (scriptTag) {
                const data = JSON.parse(scriptTag.textContent);
                STATE.mainClassData = data.main_class_data || {};
                STATE.taughtClassesData = data.taught_classes_data || {}; // Clé snake_case venant de Django
                console.log("Données chargées.");
            }
        } catch (e) {
            console.error("Erreur parsing JSON:", e);
            showNotification("Erreur critique au chargement des données.", 'error');
        }
    }


    // --- 4. LOGIQUE DE RENDU & PERMISSIONS ---

    function updateBlockPermissions(contextKey, activeTermId) {
        const block = document.querySelector(`[data-context-key="${contextKey}"]`);
        if (!block) return;

        let dataBlock;
        // Détermine si c'est un bloc matière (ex: "1-5") ou prof principal (ex: "1")
        if (contextKey.includes('-')) {
            dataBlock = STATE.taughtClassesData[contextKey];
        } else {
            dataBlock = STATE.mainClassData[contextKey];
        }

        if (!dataBlock) return;

        // Si l'ID du terme n'est pas fourni, on cherche celui de l'onglet actif
        if (!activeTermId) {
            const activeTab = block.querySelector('.border-b-2'); // Classe de l'onglet actif
            if (activeTab) {
                activeTermId = activeTab.dataset.termId;
            } else {
                activeTermId = dataBlock.current_term_id;
            }
        }
        activeTermId = parseInt(activeTermId);
        
        const termInfo = dataBlock.available_terms.find(t => t.id == activeTermId);
        
        // RÈGLE : Modifiable si Admin/Prof (CONFIG.canEdit) ET Trimestre NON FINI
        const isFinished = termInfo ? termInfo.finished : true;
        const isEditable = CONFIG.canEdit && !isFinished;

        // 1. Bouton "Ajouter Évaluation"
        const addBtn = block.querySelector('.add-eval-btn');
        if (addBtn) {
            addBtn.disabled = !isEditable;
            if (isEditable) {
                addBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
                addBtn.classList.add('bg-teal-600', 'hover:bg-teal-700', 'shadow-md', 'cursor-pointer');
                addBtn.style.pointerEvents = 'auto'; 
            } else {
                addBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
                addBtn.classList.remove('bg-teal-600', 'hover:bg-teal-700', 'shadow-md', 'hover:bg-gray-500', 'cursor-pointer');
                addBtn.style.pointerEvents = 'none'; 
            }
        }

        // 2. Boutons d'édition
        block.querySelectorAll('.edit-eval-btn').forEach(btn => {
            const textSpan = btn.querySelector('span');
            if (textSpan) {
                textSpan.textContent = isEditable ? 'Voir / Modifier' : 'Voir les notes';
            }
        });
        
        // 3. Boutons Supprimer
        block.querySelectorAll('.delete-eval-btn').forEach(btn => {
            btn.disabled = !isEditable;
            btn.style.display = isEditable ? 'inline-block' : 'none';
        });
    }

    function renderMainClassBlock(contextKey, data) {
        const avgContainer = document.getElementById(`main-avg-container-${contextKey}`);
        const studentListContainer = document.getElementById(`student-main-avg-${contextKey}`);

        if (avgContainer) {
            avgContainer.textContent = data.overall_class_average || 'N/A';
        }
        
        if (studentListContainer) {
            let studentsHtml = '';
            const studentsData = data.student_averages || [];
            studentsData.sort((a, b) => a.student_name.localeCompare(b.student_name));

            studentsData.forEach(student => {
                // Balise pour le nom d'utilisateur s'il existe
                const usernameHtml = student.username ? `<span class="text-xs text-gray-400 ml-1">(${student.username})</span>` : '';
                
                studentsHtml += `
                    <li class="flex justify-between items-center text-sm py-1">
                        <span class="text-gray-700">
                            ${student.student_name}
                            ${usernameHtml}
                        </span>
                        <span class="font-bold text-gray-900">${student.average}</span>
                    </li>
                `;
            });
            studentListContainer.innerHTML = studentsHtml || '<li class="text-sm text-gray-500 italic">Aucune moyenne à afficher.</li>';
        }
    }

    function renderSubjectClassBlock(contextKey, data) {
        // Met à jour la moyenne et la liste des évaluations
        const avgContainer = document.getElementById(`subject-avg-container-${contextKey}`);
        
        if (avgContainer) {
            avgContainer.textContent = data.class_average || 'N/A';
        }
        
        updateSubjectBlockDOM(contextKey, data);
    }

    function updateSubjectBlockDOM(contextKey, data) {
        // Mise à jour de la liste des évaluations (DOM)
        const listContainer = document.getElementById(`eval-list-container-${contextKey}`);
        
        if(listContainer) {
            let html = '';
            if(data.evaluations && data.evaluations.length > 0) {
                data.evaluations.forEach(ev => {
                    const editButtonText = CONFIG.canEdit ? 'Voir / Modifier' : 'Voir les notes';
                    const deleteButtonHtml = CONFIG.canEdit ? `
                        <button data-action="delete-eval" data-eval-id="${ev.id}" data-eval-name="${ev.name}" class="delete-eval-btn can-edit-hide px-3 py-1 text-sm text-red-600 hover:text-red-800 transition" title="Supprimer l'évaluation">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '';

                    html += `
                    <div class="flex justify-between items-center p-2 bg-white border rounded-md transition-colors duration-200 ${ev.is_main_grade ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}">
                        <div class="text-sm">
                            <strong class="text-gray-800">${ev.name}</strong>
                            ${ev.is_main_grade ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"><i class="fas fa-star mr-1 text-amber-600"></i> Principale</span>' : ''}
                            <span class="text-gray-500 ml-1">(Coeff: ${ev.coefficient} / Sur: ${ev.max_grade})</span>
                        </div>
                        <div>
                            <button data-action="view-eval" data-eval-id="${ev.id}" class="edit-eval-btn px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800" title="${editButtonText}">
                                <i class="fas fa-edit mr-1"></i> <span>${editButtonText}</span>
                            </button>
                            ${deleteButtonHtml}
                        </div>
                    </div>`;
                });
            } else {
                html = '<p class="text-sm text-gray-500 italic">Aucune évaluation pour ce trimestre.</p>';
            }
            listContainer.innerHTML = html;
        }

        // Mise à jour de la liste des moyennes élèves
        const studentListContainer = document.getElementById(`student-subject-avg-${contextKey}`);
        if (studentListContainer) {
            const ul = studentListContainer.querySelector('ul');
            if (ul) {
                let studentsHtml = '';
                if (data.student_averages && data.student_averages.length > 0) {
                    data.student_averages.sort((a, b) => a.student_name.localeCompare(b.student_name));
                    data.student_averages.forEach(student => {
                        // Balise pour le nom d'utilisateur s'il existe
                        const usernameHtml = student.username ? `<span class="text-xs text-gray-400 ml-1">(${student.username})</span>` : '';
                        
                        studentsHtml += `
                            <li class="flex justify-between items-center text-sm py-1">
                                <span class="text-gray-700">
                                    ${student.student_name}
                                    ${usernameHtml}
                                </span>
                                <span class="font-bold text-gray-900">${student.average}</span>
                            </li>
                        `;
                    });
                }
                ul.innerHTML = studentsHtml;
            }
        }
    }


    // --- 5. LOGIQUE DE NAVIGATION ---

    async function handleTermChange(btn) {
        const contextKey = btn.dataset.contextKey;
        const newTermId = btn.dataset.termId;
        const type = btn.dataset.type; // 'main' ou 'subject'

        // UI Active Tab
        document.querySelectorAll(`.term-tab-${contextKey}`).forEach(t => {
            t.classList.remove('border-indigo-500', 'text-indigo-600', 'border-teal-500', 'text-teal-600', 'border-b-2');
            t.classList.add('border-transparent', 'text-gray-500');
        });
        
        const activeClass = (type === 'main') ? ['border-indigo-500', 'text-indigo-600', 'border-b-2'] : ['border-teal-500', 'text-teal-600', 'border-b-2'];
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add(...activeClass);

        // Appel API
        const result = await apiFetch(CONFIG.urls.getTermData, {
            term_id: newTermId,
            class_id: contextKey.split('-')[0],
            ts_id: type === 'subject' ? contextKey.split('-')[1] : null,
            is_global: type === 'main'
        });

        if (result.success) {
            // Mise à jour de l'état local + Rendu
            if (type === 'main') {
                STATE.mainClassData[contextKey] = { ...STATE.mainClassData[contextKey], ...result.data };
                renderMainClassBlock(contextKey, result.data);
            } else {
                STATE.taughtClassesData[contextKey] = { ...STATE.taughtClassesData[contextKey], ...result.data };
                renderSubjectClassBlock(contextKey, result.data);
            }
            
            // Mise à jour des permissions (Boutons Ajouter/Supprimer)
            updateBlockPermissions(contextKey, newTermId);
        }
    }

    // --- 6. GESTION DES MODALES (Eval & Confirm) ---

    // -- Helpers Modale --
    function showModal(m) { m.classList.remove('opacity-0', 'pointer-events-none'); m.querySelector('div').classList.remove('translate-y-4'); }
    function closeModal(m) { m.classList.add('opacity-0', 'pointer-events-none'); m.querySelector('div').classList.add('translate-y-4'); }

    // -- Modale Évaluation --
    function openEvaluationModal(mode, data) {
        evaluationForm.reset();
        
        // Remplissage des IDs
        evalClassIdInput.value = data.classId;
        evalTsIdInput.value = data.tsId;
        
        // Détection du trimestre actif
        let activeTermId = null;
        document.querySelectorAll(`.term-tab-${data.contextKey}`).forEach(tab => {
            if (!tab.classList.contains('border-transparent')) {
                activeTermId = tab.dataset.termId;
            }
        });
        evalTermIdInput.value = activeTermId;

        // Permissions
        const dataBlock = STATE.taughtClassesData[data.contextKey];
        const termInfo = dataBlock.available_terms.find(t => t.id == activeTermId);
        const isFinished = termInfo ? termInfo.finished : true;
        const isReadOnly = !CONFIG.canEdit || isFinished;

        setupModalFields(isReadOnly);

        const studentList = STATE.taughtClassesData[data.contextKey].student_averages;
        let maxGrade = 20.0;

        if (mode === 'add') {
            document.getElementById('evaluation-modal-title').textContent = "Ajouter une Évaluation";
            evalIdInput.value = '';
            evalMaxGradeInput.value = '20.0';
            if(evalIsMainInput) evalIsMainInput.checked = false;
            
            renderStudentGrades(studentList, [], isReadOnly, maxGrade);
            showModal(evaluationModal);

        } else { // Edit
            document.getElementById('evaluation-modal-title').textContent = "Modifier l'Évaluation";
            evalIdInput.value = data.evalId;
            evalNameInput.value = data.evalName;
            evalCoeffInput.value = data.evalCoeff;
            evalMaxGradeInput.value = data.evalMaxGrade;
            maxGrade = parseFloat(data.evalMaxGrade);

            // Charger les détails
            apiFetch(CONFIG.urls.manageEval, {
                action: 'get_details',
                evaluation_id: data.evalId
            }).then(result => {
                if (result.success) {
                    if (evalIsMainInput && result.details) {
                        evalIsMainInput.checked = result.details.is_main_grade;
                    }
                    renderStudentGrades(studentList, result.grades, isReadOnly, maxGrade);
                    showModal(evaluationModal);
                }
            });
        }
    }

    function setupModalFields(isReadOnly) {
        const inputs = [evalNameInput, evalCoeffInput, evalMaxGradeInput, evalIsMainInput];
        inputs.forEach(input => { if(input) input.disabled = isReadOnly; });
        
        if (evaluationModalSaveBtn) evaluationModalSaveBtn.style.display = isReadOnly ? 'none' : 'block';
    }

    function renderStudentGrades(students, grades, isReadOnly, maxGrade) {
        studentGradesListContainer.innerHTML = '';
        const gradeMap = {};
        grades.forEach(g => gradeMap[g.student_id] = g);

        students.sort((a, b) => a.student_name.localeCompare(b.student_name));

        students.forEach(student => {
            const gradeInfo = gradeMap[student.student_id] || {};
            const val = (gradeInfo.grade_value !== undefined && gradeInfo.grade_value !== null) ? gradeInfo.grade_value : '';
            const isAbsent = gradeInfo.is_absent || false;
            const disabled = isReadOnly || isAbsent ? 'disabled' : '';

            // Affichage du nom d'utilisateur dans la liste de saisie (avec passage à la ligne sur mobile)
            const usernameHtml = student.username ? `<span class="text-xs text-gray-400 block sm:inline sm:ml-1">(${student.username})</span>` : '';

            const html = `
                <div class="grid grid-cols-3 gap-4 items-center p-2 hover:bg-gray-50 border-b">
                    <label class="text-sm font-medium text-gray-700">
                        ${student.student_name}
                        ${usernameHtml}
                    </label>
                    <input type="number" step="any" min="0" max="${maxGrade}" 
                           class="grade-input w-full p-2 border rounded"
                           data-student-id="${student.student_id}"
                           value="${val}" ${disabled}>
                    <div class="flex items-center">
                        <input type="checkbox" class="absent-checkbox mr-2"
                               data-student-id="${student.student_id}"
                               ${isAbsent ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                        <span class="text-sm">Absent</span>
                    </div>
                </div>
            `;
            studentGradesListContainer.insertAdjacentHTML('beforeend', html);
        });
    }


    // --- 7. ACTION HANDLERS ---

    async function handleEvaluationFormSubmit(e) {
        e.preventDefault();
        
        if (!CONFIG.canEdit) {
            showNotification("Action non autorisée.", 'error');
            return;
        }

        const max = parseFloat(evalMaxGradeInput.value);
        if (isNaN(max) || max <= 0) {
            showNotification("Veuillez entrer un 'Noté sur' valide.", "error");
            evalMaxGradeInput.focus();
            return;
        }

        // Validation
        const grades = [];
        let hasError = false;
        studentGradesListContainer.querySelectorAll('.grade-input').forEach(input => {
            input.classList.remove('border-red-500');
            const val = input.value;
            const sid = input.dataset.studentId;
            const row = input.closest('.grid');
            const absentCb = row.querySelector('.absent-checkbox');
            const isAbsent = absentCb ? absentCb.checked : false;

            if (!isAbsent && val !== '') {
                const num = parseFloat(val);
                if (num > max) {
                    input.classList.add('border-red-500');
                    hasError = true;
                } else {
                    grades.push({ student_id: sid, grade: num, absent: false });
                }
            } else if (isAbsent) {
                grades.push({ student_id: sid, grade: null, absent: true });
            }
        });

        if (hasError) {
            showNotification("Certaines notes dépassent le maximum.", 'error');
            return;
        }

        const payload = {
            action: evalIdInput.value ? 'update' : 'create',
            evaluation_id: evalIdInput.value || null,
            class_id: evalClassIdInput.value,
            ts_id: evalTsIdInput.value,
            term_id: evalTermIdInput.value,
            name: evalNameInput.value,
            coefficient: evalCoeffInput.value,
            max_grade: max,
            is_main_grade: evalIsMainInput ? evalIsMainInput.checked : false,
            grades: grades
        };

        const result = await apiFetch(CONFIG.urls.manageEval, payload);

        if (result.success) {
            closeModal(evaluationModal);
            // Rafraîchir l'onglet actif pour voir les nouvelles données
            const contextKey = `${payload.class_id}-${payload.ts_id}`;
            const termBtn = document.querySelector(`.term-tab-${contextKey}[data-term-id="${payload.term_id}"]`);
            if (termBtn) {
                handleTermChange(termBtn); // Appel direct de la fonction
            }
        }
    }

    function handleDeleteEvaluation(button) {
        const evalId = button.dataset.evalId;
        const evalName = button.dataset.evalName;
        const container = button.closest('[data-context-key]');
        const contextKey = container.dataset.contextKey;
        
        const termButton = container.querySelector(`.term-tab-${contextKey}.border-b-2`);

        document.getElementById('generic-confirm-title').textContent = "Supprimer l'évaluation";
        document.getElementById('generic-confirm-message').innerHTML = `Êtes-vous sûr de vouloir supprimer <strong>${evalName}</strong> ?<br>Toutes les notes associées seront perdues.`;

        STATE.onConfirmCallback = async () => {
            const result = await apiFetch(CONFIG.urls.manageEval, {
                action: 'delete',
                evaluation_id: evalId
            });
            if (result.success && termButton) {
                handleTermChange(termButton);
            }
        };
        
        showModal(genericConfirmModal);
    }


    // --- 8. INITIALISATION & DÉLÉGATION ---

    parseInitialData();
    // Initialise les permissions au chargement
    document.querySelectorAll('#subject-class-container [data-context-key]').forEach(c => {
        const key = c.dataset.contextKey;
        if(STATE.taughtClassesData[key]) updateBlockPermissions(key, STATE.taughtClassesData[key].current_term_id);
    });
    if(mainClassContainer) {
        document.querySelectorAll('#main-class-container [data-context-key]').forEach(c => {
            const key = c.dataset.contextKey;
            if(STATE.mainClassData[key]) updateBlockPermissions(key, STATE.mainClassData[key].current_term_id);
        });
    }

    // Écouteur global pour les événements dynamiques
    document.body.addEventListener('click', (e) => {
        
        const termBtn = e.target.closest('button[data-action="change-term"]');
        if (termBtn) handleTermChange(termBtn);

        const toggleBtn = e.target.closest('[data-action="toggle-student-avg"]');
        if (toggleBtn) {
            e.preventDefault();
            const targetEl = document.getElementById(toggleBtn.dataset.target);
            if (targetEl) targetEl.classList.toggle('hidden');
        }
        
        const addBtn = e.target.closest('.add-eval-btn');
        if (addBtn && !addBtn.disabled) {
            const container = addBtn.closest('[data-context-key]');
            openEvaluationModal('add', {
                classId: addBtn.dataset.classId,
                tsId: addBtn.dataset.tsId,
                subjectName: addBtn.dataset.subjectName,
                className: addBtn.dataset.className,
                contextKey: container.dataset.contextKey
            });
        }
        
        const editBtn = e.target.closest('.edit-eval-btn');
        if (editBtn && !editBtn.disabled) {
            const container = editBtn.closest('[data-context-key]');
            const contextKey = container.dataset.contextKey;
            const evalData = STATE.taughtClassesData[contextKey].evaluations.find(ev => ev.id == editBtn.dataset.evalId);
            
            if(evalData) {
                openEvaluationModal('edit', {
                    evalId: evalData.id,
                    evalName: evalData.name,
                    evalCoeff: evalData.coefficient,
                    evalMaxGrade: evalData.max_grade,
                    classId: container.dataset.classId,
                    tsId: container.dataset.tsId,
                    contextKey: contextKey
                });
            }
        }

        const deleteBtn = e.target.closest('.delete-eval-btn');
        if (deleteBtn && !deleteBtn.disabled) {
            handleDeleteEvaluation(deleteBtn);
        }

        // Checkbox Absent
        if (e.target.matches('.absent-checkbox')) {
            const input = e.target.closest('.grid').querySelector('.grade-input');
            input.disabled = e.target.checked;
            if(e.target.checked) input.value = '';
        }
    });

    // Formulaire & Modales
    if (evaluationForm) evaluationForm.addEventListener('submit', handleEvaluationFormSubmit);
    if (evaluationModalCancelBtn) evaluationModalCancelBtn.addEventListener('click', () => closeModal(evaluationModal));
    if (genericConfirmCancelBtn) genericConfirmCancelBtn.addEventListener('click', () => closeModal(genericConfirmModal));
    
    if (genericConfirmConfirmBtn) genericConfirmConfirmBtn.addEventListener('click', () => {
        if (STATE.onConfirmCallback) STATE.onConfirmCallback();
        closeModal(genericConfirmModal);
    });

});