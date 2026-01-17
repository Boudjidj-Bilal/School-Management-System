// ====================================================================
// LOGIQUE JAVASCRIPT POUR LES APPRÉCIATIONS (appreciations_dashboard.js)
// VERSION SÉCURISÉE (CSP Compliant)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 0. CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('appreciations-dashboard-container');
    const csrfInput = document.getElementById('csrf-token');

    if (!container) {
        console.error("Erreur : Conteneur #appreciations-dashboard-container introuvable.");
        return;
    }

    // Configuration centralisée récupérée depuis le DOM
    const CONFIG = {
        staffPk: container.dataset.staffPk,
        canEdit: container.dataset.canEdit === 'true',
        urls: {
            getTermData: container.dataset.apiGetTerm,
            saveAppreciations: container.dataset.apiSave
        },
        csrfToken: csrfInput ? csrfInput.value : ''
    };

    // État global local
    const STATE = {
        // Stocke les données actuelles pour chaque bloc (clé: contextKey)
        blocksData: {} 
    };


    // --- 1. Utilitaires ---

    function showNotification(message, type) {
        const notificationArea = document.getElementById('notification-area');
        if (!notificationArea) return;

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
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            notificationDiv.classList.remove('opacity-0', '-translate-y-2');
        });

        // Disparition automatique
        setTimeout(() => {
            notificationDiv.classList.add('opacity-0', '-translate-y-2');
            notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
        }, 5000);
    }

    async function apiFetch(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CONFIG.csrfToken,
                },
                body: JSON.stringify(data),
            });
            const json = await response.json();
            if (!response.ok) {
                showNotification(json.message || `Erreur serveur (${response.status})`, 'error');
                return { success: false, ...json };
            }
            return json;
        } catch (error) {
            console.error("Erreur API:", error);
            showNotification("Erreur de connexion réseau.", 'error');
            return { success: false };
        }
    }


    // --- 2. Initialisation et Parsing ---

    function parseInitialData() {
        try {
            const scriptTag = document.getElementById('initial-dashboard-data');
            if (!scriptTag) return;
            
            const rawData = JSON.parse(scriptTag.textContent);
            
            // On aplatit la structure pour faciliter l'accès par clé unique
            // 1. Données "Mes Matières"
            if (rawData.taught_classes_list) {
                rawData.taught_classes_list.forEach(item => {
                    STATE.blocksData[item.key] = item;
                });
            }
            // 2. Données "Prof Principal"
            if (rawData.main_classes_data) {
                Object.entries(rawData.main_classes_data).forEach(([key, item]) => {
                    STATE.blocksData[key] = item; 
                });
            }
            
            console.log("Données Appréciations chargées.");
            
            // Initialise l'UI pour chaque bloc
            initializeUI();

        } catch (e) {
            console.error("Erreur parsing initial data:", e);
        }
    }

    function initializeUI() {
        document.querySelectorAll('.appreciation-block').forEach(block => {
            const contextKey = block.dataset.contextKey;
            const data = STATE.blocksData[contextKey];
            
            if (data) {
                const currentTermId = data.current_term_id;
                const currentTerm = data.available_terms.find(t => t.id == currentTermId);
                
                const isFinished = currentTerm ? currentTerm.finished : true;
                const isReadOnly = !CONFIG.canEdit || isFinished; 
                
                updateBlockReadOnlyState(block, isReadOnly);
                
                block.querySelectorAll('textarea').forEach(textarea => {
                    updateCharCount(textarea);
                });
            }
        });
    }

    /**
     * Active ou désactive les champs d'un bloc.
     */
    function updateBlockReadOnlyState(blockElement, isReadOnly) {
        const inputs = blockElement.querySelectorAll('textarea, select, button[type="submit"]');
        const statusDiv = blockElement.querySelector('.save-status');
        
        inputs.forEach(input => {
            input.disabled = isReadOnly;
            if (isReadOnly) {
                input.classList.add('bg-gray-100', 'cursor-not-allowed');
            } else {
                input.classList.remove('bg-gray-100', 'cursor-not-allowed');
            }
        });

        // Feedback visuel
        if (isReadOnly && statusDiv) {
            const message = CONFIG.canEdit ? '<i class="fas fa-lock mr-1"></i> Trimestre clos' : '<i class="fas fa-eye mr-1"></i> Mode Consultation ';
            
            statusDiv.innerHTML = `<span class="text-gray-500">${message}</span>`;
            statusDiv.classList.remove('opacity-0');
            
            const submitBtn = blockElement.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.style.display = 'none';

        } else if (statusDiv) {
            statusDiv.classList.add('opacity-0');
            statusDiv.innerHTML = '';
            const submitBtn = blockElement.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.style.display = 'inline-block';
        }
    }


    // --- 3. Navigation (Changement de Trimestre) ---

    async function handleTermChange(e) {
        const button = e.target.closest('button[data-action="change-term"]');
        if (!button) return;
        e.preventDefault();

        const contextKey = button.dataset.contextKey;
        const termId = parseInt(button.dataset.termId);
        const block = button.closest('.appreciation-block');
        const type = block.dataset.type; // 'main' ou 'subject'
        const classId = block.dataset.classId;
        const tsId = block.dataset.tsId || null;

        // 1. UI Tabs
        block.querySelectorAll('.term-tab').forEach(btn => {
            btn.className = 'term-tab px-3 py-1 text-sm font-medium rounded-t-md transition-colors duration-150 text-gray-500 hover:bg-white hover:text-gray-700';
        });
        const activeColorClass = (type === 'main') ? 'text-indigo-700 border-yellow-200' : 'text-teal-700 border-gray-200';
        button.className = `term-tab px-3 py-1 text-sm font-medium rounded-t-md transition-colors duration-150 bg-white border-t border-l border-r font-bold shadow-sm ${activeColorClass}`;

        // 2. Appel API
        const result = await apiFetch(CONFIG.urls.getTermData, {
            term_id: termId,
            class_id: classId,
            ts_id: tsId,
            is_global: (type === 'main')
        });

        if (result.success) {
            // Met à jour l'état local
            STATE.blocksData[contextKey].students_data = result.data.students_data;
            STATE.blocksData[contextKey].current_term_id = termId;

            // Vérifie si ce trimestre est "finished"
            const termInfo = STATE.blocksData[contextKey].available_terms.find(t => t.id == termId);
            const isFinished = termInfo ? termInfo.finished : true;
            const isReadOnly = !CONFIG.canEdit || isFinished;

            // 3. Rendu du DOM
            renderStudentList(block, result.data.students_data, type === 'main', STATE.blocksData[contextKey].mentions_choices, isReadOnly);
            
            // 4. Mise à jour lecture seule
            updateBlockReadOnlyState(block, isReadOnly);
        }
    }

    function renderStudentList(block, studentsData, isGlobal, mentionsChoices, isReadOnly) {
        const container = block.querySelector('.student-list-container');
        container.innerHTML = '';

        if (studentsData.length === 0) {
            container.innerHTML = '<p class="text-gray-500 italic text-center py-4">Aucun élève trouvé.</p>';
            return;
        }

        const focusColor = isGlobal ? 'indigo' : 'teal';
        const disabledClass = isReadOnly ? 'bg-gray-100 cursor-not-allowed' : '';
        const disabledAttr = isReadOnly ? 'disabled' : '';

        studentsData.forEach(student => {
            let mentionHtml = '';
            
            if (isGlobal) {
                let optionsHtml = '<option value="">-- Aucune --</option>';
                if (mentionsChoices) {
                    mentionsChoices.forEach(([code, label]) => {
                        const selected = (student.mention === code) ? 'selected' : '';
                        optionsHtml += `<option value="${code}" ${selected}>${label}</option>`;
                    });
                }
                
                mentionHtml = `
                    <div class="mt-2">
                        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Mention</label>
                        <select name="mention_${student.student_id}" 
                                class="mention-select w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-${focusColor}-500 focus:ring focus:ring-${focusColor}-200 focus:ring-opacity-50 ${disabledClass}"
                                ${disabledAttr}>
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }

            const itemHtml = `
                <div class="student-item bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start" data-student-id="${student.student_id}">
                    <div class="md:w-1/4 pt-2">
                        <span class="font-bold text-gray-800 text-lg md:text-base">${student.name}</span>
                        ${mentionHtml}
                    </div>
                    <div class="md:w-3/4 relative w-full">
                        ${isGlobal ? '<label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Appréciation Globale</label>' : ''}
                        <textarea name="content_${student.student_id}" 
                                  rows="${isGlobal ? 3 : 2}" 
                                  maxlength="500"
                                  class="appreciation-input w-full text-sm border-gray-300 rounded-md focus:border-${focusColor}-500 focus:ring focus:ring-${focusColor}-200 focus:ring-opacity-50 resize-y ${disabledClass}"
                                  placeholder="Appréciation..."
                                  ${disabledAttr}>${student.appreciation_content || ''}</textarea>
                        <div class="text-right text-xs text-gray-400 mt-0.5 char-count">
                            <span class="current">${(student.appreciation_content || '').length}</span>/500
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);
        });

        block.querySelectorAll('textarea').forEach(textarea => {
            updateCharCount(textarea);
        });
    }


    // --- 4. Gestion de la Sauvegarde ---

    async function handleSaveBlock(e) {
        e.preventDefault();
        
        if (!CONFIG.canEdit) {
            showNotification("Action non autorisée (Mode Lecture Seule).", "error");
            return;
        }

        const form = e.target;
        const block = form.closest('.appreciation-block');
        const contextKey = block.dataset.contextKey;
        const type = block.dataset.type;
        
        const saveBtn = form.querySelector('button[type="submit"]');
        const statusDiv = form.querySelector('.save-status');
        
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        statusDiv.innerHTML = '';
        statusDiv.classList.remove('opacity-0');

        const termId = STATE.blocksData[contextKey].current_term_id;
        const studentsPayload = [];

        block.querySelectorAll('.student-item').forEach(item => {
            const studentId = item.dataset.studentId;
            const content = item.querySelector('textarea').value;
            const mentionSelect = item.querySelector('select');
            
            studentsPayload.push({
                student_id: studentId,
                content: content,
                mention: mentionSelect ? mentionSelect.value : null
            });
        });

        const result = await apiFetch(CONFIG.urls.saveAppreciations, {
            term_id: termId,
            ts_id: block.dataset.tsId || null,
            is_global: (type === 'main'),
            students_data: studentsPayload
        });

        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;

        if (result.success) {
            showNotification("Enregistré avec succès !", 'success');
            statusDiv.innerHTML = '<span class="text-green-600"><i class="fas fa-check mr-1"></i> Enregistré</span>';
            
            setTimeout(() => {
                statusDiv.classList.add('opacity-0');
            }, 3000);
            
        } else {
            statusDiv.innerHTML = '<span class="text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i> Erreur</span>';
        }
    }


    // --- 5. Compteur de caractères ---

    function updateCharCount(textarea) {
        const maxLength = textarea.getAttribute('maxlength');
        const currentLength = textarea.value.length;
        const counter = textarea.parentElement.querySelector('.char-count .current');
        
        if (counter) {
            counter.textContent = currentLength;
            if (currentLength >= maxLength) {
                counter.classList.add('text-red-500', 'font-bold');
            } else {
                counter.classList.remove('text-red-500', 'font-bold');
            }
        }
    }


    // --- Main Listeners (Délégation) ---

    // Initialisation
    parseInitialData();

    // Clics (Changement de trimestre)
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('button[data-action="change-term"]')) {
            handleTermChange(e);
        }
    });

    // Input (Compteur de caractères)
    document.body.addEventListener('input', (e) => {
        if (e.target.matches('.appreciation-input')) {
            updateCharCount(e.target);
        }
    });

    // Submit (Sauvegarde)
    document.querySelectorAll('.student-list-form').forEach(form => {
        form.addEventListener('submit', handleSaveBlock);
    });
});