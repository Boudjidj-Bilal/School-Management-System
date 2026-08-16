// ====================================================================
// LOGIQUE JAVASCRIPT POUR le HUB D'ÉVALUATIONS (grades_dashboard.js)
// VERSION SÉCURISÉE (CSP Compliant), CORRIGÉE & MULTILINGUE (Partie 1/2)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('grades-dashboard-container');
    
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]') || document.getElementById('csrf-token');
    const CSRF_TOKEN_VALUE = csrfInput ? csrfInput.value : '';

    if (!container) {
        console.error("Erreur critique : Conteneur principal introuvable.");
        return;
    }

    // Récupération des traductions dynamiques (via dataset du conteneur HTML)
    const msgErrorNoCsrf = container.getAttribute('data-msg-error-no-csrf') || 'Erreur critique : Token CSRF introuvable.';
    const msgAccessDenied = container.getAttribute('data-msg-access-denied') || 'Accès refusé. Vérifiez vos droits ou rafraîchissez la page.';
    const msgServerError = container.getAttribute('data-msg-server-error') || 'Erreur serveur.';
    const msgConnectionError = container.getAttribute('data-msg-connection-error') || 'Erreur de connexion.';
    const msgDataLoadError = container.getAttribute('data-msg-data-load-error') || 'Erreur critique au chargement des données.';
    const msgEditView = container.getAttribute('data-msg-edit-view') || 'Voir / Modifier';
    const msgViewGrades = container.getAttribute('data-msg-view-grades') || 'Voir les notes';
    const msgDeleteEval = container.getAttribute('data-msg-delete-eval') || "Supprimer l'évaluation";
    const msgNoAverages = container.getAttribute('data-msg-no-averages') || 'Aucune moyenne à afficher.';
    const msgMainEval = container.getAttribute('data-msg-main-eval') || 'Principale';
    const msgCoeff = container.getAttribute('data-msg-coeff') || 'Coeff:';
    const msgOutOf = container.getAttribute('data-msg-out-of') || 'Sur:';
    const msgNoEvaluations = container.getAttribute('data-msg-no-evaluations') || 'Aucune évaluation pour ce trimestre.';
    const msgNa = container.getAttribute('data-msg-na') || 'N/A';

    const msgAddEvalTitle = container.getAttribute('data-msg-add-eval-title') || "Ajouter une Évaluation";
    const msgEditEvalTitle = container.getAttribute('data-msg-edit-eval-title') || "Modifier l'Évaluation";
    const msgAbsent = container.getAttribute('data-msg-absent') || "Absent";
    const msgUnauthorized = container.getAttribute('data-msg-unauthorized') || "Action non autorisée.";
    const msgInvalidMaxGrade = container.getAttribute('data-msg-invalid-max-grade') || "Veuillez entrer un 'Noté sur' valide.";
    const msgGradesExceedMax = container.getAttribute('data-msg-grades-exceed-max') || "Certaines notes dépassent le maximum.";
    const msgDeleteEvalTitle = container.getAttribute('data-msg-delete-eval-title') || "Supprimer l'évaluation";
    const msgDeleteEvalBody = container.getAttribute('data-msg-delete-eval-body') || "Êtes-vous sûr de vouloir supprimer <strong>{name}</strong> ?<br>Toutes les notes associées seront perdues.";    

    if (!CSRF_TOKEN_VALUE) {
        console.error(msgErrorNoCsrf);
    }

    const CONFIG = {
        staffPk: container.dataset.staffPk,
        canEdit: container.dataset.canEdit === 'true',
        urls: {
            getTermData: container.dataset.apiGetTerm,
            manageEval: container.dataset.apiManageEval
        },
        csrfToken: CSRF_TOKEN_VALUE
    };

    const STATE = {
        mainClassData: {},
        taughtClassesData: {},
        onConfirmCallback: null 
    };


    // --- 2. ÉLÉMENTS DU DOM ---
    const mainClassContainer = document.getElementById('main-class-container');
    const subjectClassContainer = document.getElementById('subject-class-container');
    const notificationArea = document.getElementById('notification-area');

    const genericConfirmModal = document.getElementById('generic-confirm-modal');
    const evaluationModal = document.getElementById('evaluation-modal');
    const evaluationForm = document.getElementById('evaluation-form');
    
    const evalIdInput = document.getElementById('eval-id-input');
    const evalClassIdInput = document.getElementById('eval-class-id-input');
    const evalTsIdInput = document.getElementById('eval-ts-id-input');
    const evalTermIdInput = document.getElementById('eval-term-id-input');
    const evalNameInput = document.getElementById('eval-name-input');
    const evalCoeffInput = document.getElementById('eval-coeff-input');
    const evalMaxGradeInput = document.getElementById('eval-max-grade-input');
    const evalIsMainInput = document.getElementById('eval-is-main-input');
    
    const studentGradesListContainer = document.getElementById('student-grades-list-container');
    
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
        // MODIFICATION : flex items-center gap-3 pour espacer l'icône du texte
        div.className = `p-4 rounded-xl border shadow-md flex items-center gap-3 mb-4 transition-all duration-300 ${colorClass}`;
        div.innerHTML = `<i class="fas ${icon} text-lg"></i><p class="font-semibold">${message}</p>`;

        notificationArea.prepend(div);
        
        setTimeout(() => div.classList.remove('opacity-0', '-translate-y-2'), 10);
        setTimeout(() => {
            div.classList.add('opacity-0', '-translate-y-2');
            div.addEventListener('transitionend', () => div.remove());
        }, 5000);
    }

    async function apiFetch(url, payload) {
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
                console.error("Erreur 403 Forbidden");
                showNotification(msgAccessDenied, 'error');
                return { success: false };
            }

            const json = await response.json();

            if (!response.ok) {
                showNotification(json.message || msgServerError, 'error');
                return { success: false };
            }

            if (json.success && payload.action !== 'get_details' && url !== CONFIG.urls.getTermData) {
                showNotification(json.message, 'success');
            }

            return json;

        } catch (error) {
            console.error("Erreur API :", error);
            showNotification(msgConnectionError, 'error');
            return { success: false };
        }
    }

    function parseInitialData() {
        try {
            const scriptTag = document.getElementById('initial-dashboard-data');
            if (scriptTag) {
                const data = JSON.parse(scriptTag.textContent);
                STATE.mainClassData = data.main_class_data || {};
                STATE.taughtClassesData = data.taught_classes_data || {}; 
            }
        } catch (e) {
            console.error("Erreur parsing JSON:", e);
            showNotification(msgDataLoadError, 'error');
        }
    }


    // --- 4. LOGIQUE DE RENDU & PERMISSIONS ---

    function updateBlockPermissions(contextKey, activeTermId) {
        const block = document.querySelector(`[data-context-key="${contextKey}"]`);
        if (!block) return;

        let dataBlock;
        if (contextKey.includes('-')) {
            dataBlock = STATE.taughtClassesData[contextKey];
        } else {
            dataBlock = STATE.mainClassData[contextKey];
        }

        if (!dataBlock) return;

        if (!activeTermId) {
            const activeTab = block.querySelector('.border-b-2'); 
            if (activeTab) {
                activeTermId = activeTab.dataset.termId;
            } else {
                activeTermId = dataBlock.current_term_id;
            }
        }
        activeTermId = parseInt(activeTermId);
        
        const termInfo = dataBlock.available_terms.find(t => t.id == activeTermId);
        
        const isFinished = termInfo ? termInfo.finished : true;
        const isEditable = CONFIG.canEdit && !isFinished;

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

        block.querySelectorAll('.edit-eval-btn').forEach(btn => {
            const textSpan = btn.querySelector('span');
            if (textSpan) {
                textSpan.textContent = isEditable ? msgEditView : msgViewGrades;
            }
        });
        
        block.querySelectorAll('.delete-eval-btn').forEach(btn => {
            btn.disabled = !isEditable;
            btn.style.display = isEditable ? 'inline-block' : 'none';
        });
    }

    function renderMainClassBlock(contextKey, data) {
        const avgContainer = document.getElementById(`main-avg-container-${contextKey}`);
        const studentListContainer = document.getElementById(`student-main-avg-${contextKey}`);

        if (avgContainer) {
            avgContainer.textContent = data.overall_class_average || msgNa;
        }
        
        if (studentListContainer) {
            let studentsHtml = '';
            const studentsData = data.student_averages || [];
            studentsData.sort((a, b) => a.student_name.localeCompare(b.student_name));

            studentsData.forEach(student => {
                // MODIFICATION : flex gap-2 au lieu de margins pour la structure du nom d'utilisateur
                const usernameHtml = student.username ? `<span class="text-xs text-gray-400" dir="ltr">(${student.username})</span>` : '';
                
                studentsHtml += `
                    <li class="flex justify-between items-center text-sm py-1">
                        <span class="text-gray-700 flex items-center gap-2">
                            <span>${student.student_name}</span>
                            ${usernameHtml}
                        </span>
                        <span class="font-bold text-gray-900" dir="ltr">${student.average}</span>
                    </li>
                `;
            });
            studentListContainer.innerHTML = studentsHtml || `<li class="text-sm text-gray-500 italic">${msgNoAverages}</li>`;
        }
    }

    function renderSubjectClassBlock(contextKey, data) {
        const avgContainer = document.getElementById(`subject-avg-container-${contextKey}`);
        
        if (avgContainer) {
            avgContainer.textContent = data.class_average || msgNa;
        }
        
        updateSubjectBlockDOM(contextKey, data);
    }

    function updateSubjectBlockDOM(contextKey, data) {
        const listContainer = document.getElementById(`eval-list-container-${contextKey}`);
        
        if(listContainer) {
            let html = '';
            if(data.evaluations && data.evaluations.length > 0) {
                data.evaluations.forEach(ev => {
                    const editButtonText = CONFIG.canEdit ? msgEditView : msgViewGrades;
                    const deleteButtonHtml = CONFIG.canEdit ? `
                        <button data-action="delete-eval" data-eval-id="${ev.id}" data-eval-name="${ev.name}" class="delete-eval-btn can-edit-hide px-3 py-1 text-sm text-red-600 hover:text-red-800 transition" title="${msgDeleteEval}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '';

                    // MODIFICATION : Utilisation de gap-2 pour le badge principal et les boutons
                    html += `
                    <div class="flex justify-between items-center p-2 bg-white border rounded-md transition-colors duration-200 ${ev.is_main_grade ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}">
                        <div class="text-sm flex flex-wrap items-center gap-2">
                            <strong class="text-gray-800">${ev.name}</strong>
                            ${ev.is_main_grade ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"><i class="fas fa-star text-amber-600"></i> <span>${msgMainEval}</span></span>` : ''}
                            <span class="text-gray-500" dir="ltr">(${msgCoeff} ${ev.coefficient} / ${msgOutOf} ${ev.max_grade})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button data-action="view-eval" data-eval-id="${ev.id}" class="edit-eval-btn flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800" title="${editButtonText}">
                                <i class="fas fa-edit"></i> <span>${editButtonText}</span>
                            </button>
                            ${deleteButtonHtml}
                        </div>
                    </div>`;
                });
            } else {
                html = `<p class="text-sm text-gray-500 italic">${msgNoEvaluations}</p>`;
            }
            listContainer.innerHTML = html;
        }

        const studentListContainer = document.getElementById(`student-subject-avg-${contextKey}`);
        if (studentListContainer) {
            const ul = studentListContainer.querySelector('ul');
            if (ul) {
                let studentsHtml = '';
                if (data.student_averages && data.student_averages.length > 0) {
                    data.student_averages.sort((a, b) => a.student_name.localeCompare(b.student_name));
                    data.student_averages.forEach(student => {
                        const usernameHtml = student.username ? `<span class="text-xs text-gray-400" dir="ltr">(${student.username})</span>` : '';
                        
                        studentsHtml += `
                            <li class="flex justify-between items-center text-sm py-1">
                                <span class="text-gray-700 flex items-center gap-2">
                                    <span>${student.student_name}</span>
                                    ${usernameHtml}
                                </span>
                                <span class="font-bold text-gray-900" dir="ltr">${student.average}</span>
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
        const type = btn.dataset.type; 

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
            if (type === 'main') {
                STATE.mainClassData[contextKey] = { ...STATE.mainClassData[contextKey], ...result.data };
                renderMainClassBlock(contextKey, result.data);
            } else {
                STATE.taughtClassesData[contextKey] = { ...STATE.taughtClassesData[contextKey], ...result.data };
                renderSubjectClassBlock(contextKey, result.data);
            }
            
            updateBlockPermissions(contextKey, newTermId);
        }
    }

    // --- 6. GESTION DES MODALES (Eval & Confirm) ---

    function showModal(m) { m.classList.remove('opacity-0', 'pointer-events-none'); m.querySelector('div').classList.remove('translate-y-4'); }
    function closeModal(m) { m.classList.add('opacity-0', 'pointer-events-none'); m.querySelector('div').classList.add('translate-y-4'); }

    function openEvaluationModal(mode, data) {
        evaluationForm.reset();
        
        evalClassIdInput.value = data.classId;
        evalTsIdInput.value = data.tsId;
        
        let activeTermId = null;
        document.querySelectorAll(`.term-tab-${data.contextKey}`).forEach(tab => {
            if (!tab.classList.contains('border-transparent')) {
                activeTermId = tab.dataset.termId;
            }
        });
        evalTermIdInput.value = activeTermId;

        const dataBlock = STATE.taughtClassesData[data.contextKey];
        const termInfo = dataBlock.available_terms.find(t => t.id == activeTermId);
        const isFinished = termInfo ? termInfo.finished : true;
        const isReadOnly = !CONFIG.canEdit || isFinished;

        setupModalFields(isReadOnly);

        const studentList = STATE.taughtClassesData[data.contextKey].student_averages;
        let maxGrade = 20.0;

        if (mode === 'add') {
            document.getElementById('evaluation-modal-title').textContent = msgAddEvalTitle;
            evalIdInput.value = '';
            evalMaxGradeInput.value = '20.0';
            if(evalIsMainInput) evalIsMainInput.checked = false;
            
            renderStudentGrades(studentList, [], isReadOnly, maxGrade);
            showModal(evaluationModal);

        } else { // Edit
            document.getElementById('evaluation-modal-title').textContent = msgEditEvalTitle;
            evalIdInput.value = data.evalId;
            evalNameInput.value = data.evalName;
            evalCoeffInput.value = data.evalCoeff;
            evalMaxGradeInput.value = data.evalMaxGrade;
            maxGrade = parseFloat(data.evalMaxGrade);

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

            // MODIFICATION : Sécurisation LTR pour les noms d'utilisateurs
            const usernameHtml = student.username ? `<span class="text-xs text-gray-400 block sm:inline" dir="ltr">(${student.username})</span>` : '';

            // MODIFICATION : flex gap-2 pour le label, dir="ltr" pour l'input number, flex gap-2 au lieu de mr-2 pour la checkbox
            const html = `
                <div class="grid grid-cols-3 gap-4 items-center p-2 hover:bg-gray-50 border-b border-gray-100">
                    <label class="text-sm font-medium text-gray-700 flex flex-wrap items-center gap-1">
                        <span>${student.student_name}</span>
                        ${usernameHtml}
                    </label>
                    <input type="number" step="any" min="0" max="${maxGrade}" 
                           class="grade-input w-full p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                           data-student-id="${student.student_id}"
                           value="${val}" ${disabled} dir="ltr">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="absent-checkbox rounded text-indigo-600 focus:ring-indigo-500"
                               data-student-id="${student.student_id}"
                               ${isAbsent ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                        <span class="text-sm text-gray-700">${msgAbsent}</span>
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
            showNotification(msgUnauthorized, 'error');
            return;
        }

        const max = parseFloat(evalMaxGradeInput.value);
        if (isNaN(max) || max <= 0) {
            showNotification(msgInvalidMaxGrade, "error");
            evalMaxGradeInput.focus();
            return;
        }

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
            showNotification(msgGradesExceedMax, 'error');
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
            const contextKey = `${payload.class_id}-${payload.ts_id}`;
            const termBtn = document.querySelector(`.term-tab-${contextKey}[data-term-id="${payload.term_id}"]`);
            if (termBtn) {
                handleTermChange(termBtn); 
            }
        }
    }

    function handleDeleteEvaluation(button) {
        const evalId = button.dataset.evalId;
        const evalName = button.dataset.evalName;
        const container = button.closest('[data-context-key]');
        const contextKey = container.dataset.contextKey;
        
        const termButton = container.querySelector(`.term-tab-${contextKey}.border-b-2`);

        document.getElementById('generic-confirm-title').textContent = msgDeleteEvalTitle;
        document.getElementById('generic-confirm-message').innerHTML = msgDeleteEvalBody.replace('{name}', evalName);

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

        if (e.target.matches('.absent-checkbox')) {
            const input = e.target.closest('.grid').querySelector('.grade-input');
            input.disabled = e.target.checked;
            if(e.target.checked) input.value = '';
        }
    });

    if (evaluationForm) evaluationForm.addEventListener('submit', handleEvaluationFormSubmit);
    if (evaluationModalCancelBtn) evaluationModalCancelBtn.addEventListener('click', () => closeModal(evaluationModal));
    if (genericConfirmCancelBtn) genericConfirmCancelBtn.addEventListener('click', () => closeModal(genericConfirmModal));
    
    if (genericConfirmConfirmBtn) genericConfirmConfirmBtn.addEventListener('click', () => {
        if (STATE.onConfirmCallback) STATE.onConfirmCallback();
        closeModal(genericConfirmModal);
    });

});