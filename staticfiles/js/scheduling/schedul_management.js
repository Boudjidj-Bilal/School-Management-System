// ====================================================================
// LOGIQUE JAVASCRIPT POUR schedul_management.js (Partie 1/2)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', (event) => {
            event.preventDefault(); 
            window.history.back();  
        });
    }

    // --- 0. CONFIGURATION & DONNÉES CONTEXTUELLES ---
    const container = document.getElementById('schedule-manager-container');
    if (!container) {
        console.error("Conteneur principal #schedule-manager-container introuvable.");
        return;
    }

    // Récupération des traductions dynamiques
    const msgErrCritical = container.getAttribute('data-msg-err-critical') || "Erreur critique au chargement des données.";
    const msgSchoolHours = container.getAttribute('data-msg-school-hours') || "Horaires de l'école:";
    const msgTimeExceptions = container.getAttribute('data-msg-time-exceptions') || "Exceptions horaires (pauses):";
    const msgSelectSubjectTeacher = container.getAttribute('data-msg-select-subject-teacher') || "-- Sélectionnez Matière/Prof --";
    const msgSelectRoom = container.getAttribute('data-msg-select-room') || "-- Sélectionnez une Salle --";
    const msgLoading = container.getAttribute('data-msg-loading') || "Chargement...";
    const msgServerError = container.getAttribute('data-msg-server-error') || "Erreur serveur (Status {status}).";
    const msgOperationFailed = container.getAttribute('data-msg-operation-failed') || "Opération échouée.";
    const msgConnectionError = container.getAttribute('data-msg-connection-error') || "Erreur de connexion au serveur : {error}";
    const msgNetworkError = container.getAttribute('data-msg-network-error') || "Erreur de connexion réseau.";
    const msgWeeklyTotal = container.getAttribute('data-msg-weekly-total') || "Total Hebdomadaire:";
    const msgTooltipSelectTemplate = container.getAttribute('data-msg-tooltip-select-template') || "Veuillez d'abord sélectionner ou sauvegarder un modèle.";
    const msgNoWorkDay = container.getAttribute('data-msg-no-work-day') || "Jour non travaillé";

    const msgUnknownDay = container.getAttribute('data-msg-unknown-day') || 'Jour inconnu';
    const msgSubjectUnknown = container.getAttribute('data-msg-subject-unknown') || 'Matière ?';
    const msgTeacherUnknown = container.getAttribute('data-msg-teacher-unknown') || 'Prof ?';
    const msgRoomUnknown = container.getAttribute('data-msg-room-unknown') || 'Salle ?';
    const msgInactiveTs = container.getAttribute('data-msg-inactive-ts') || "Prof/Matière Inactif";
    const msgInactiveTsTitle = container.getAttribute('data-msg-inactive-ts-title') || "Cette affectation professeur/matière n'est plus active.";
    const msgInactiveRoom = container.getAttribute('data-msg-inactive-room') || "Salle Inactive";
    const msgInactiveRoomTitle = container.getAttribute('data-msg-inactive-room-title') || "Cette salle n'est plus active.";
    const msgDeleteCourseTitle = container.getAttribute('data-msg-delete-course-title') || "Supprimer ce cours";
    
    const msgConfirmDelTitle = container.getAttribute('data-msg-confirm-del-title') || "Confirmation Suppression";
    const msgConfirmDelBody = container.getAttribute('data-msg-confirm-del-body') || "Voulez-vous retirer ce cours du modèle de planning ?";
    const msgFillAllFields = container.getAttribute('data-msg-fill-all-fields') || "Veuillez remplir tous les champs (jour, début, fin, prof, salle).";
    const msgEndBeforeStart = container.getAttribute('data-msg-end-before-start') || "L'heure de fin doit être après l'heure de début.";
    const msgConflictSchoolHours = container.getAttribute('data-msg-conflict-school-hours') || "Ce créneau chevauche les bornes horaires de l'école ou une pause (ex: déjeuner).";
    const msgConflictTemplate = container.getAttribute('data-msg-conflict-template') || "Conflit de classe: Ce créneau chevauche un autre cours déjà défini dans le modèle pour ce jour.";
    
    const msgNewTemplate = container.getAttribute('data-msg-new-template') || "Nouveau Modèle";
    const msgTemplateNameLabel = container.getAttribute('data-msg-template-name-label') || "Nom du modèle :";
    const msgSaveTemplateTitle = container.getAttribute('data-msg-save-template-title') || "Enregistrer le Modèle";
    const msgNameCannotBeEmpty = container.getAttribute('data-msg-name-cannot-be-empty') || "Le nom ne peut pas être vide.";
    
    const msgErrEmptyTemplate = container.getAttribute('data-msg-err-empty-template') || "Le modèle de semaine est vide ou non sauvegardé.";
    const msgSchoolYearDuration = container.getAttribute('data-msg-school-year-duration') || "Année scolaire :";
    const msgStartDateMonday = container.getAttribute('data-msg-start-date-monday') || "Date de début (Lundi)";
    const msgMustBeMonday = container.getAttribute('data-msg-must-be-monday') || "Doit être un Lundi, dans l'année scolaire.";
    const msgEndDateSunday = container.getAttribute('data-msg-end-date-sunday') || "Date de fin (Dimanche)";
    const msgMustBeSunday = container.getAttribute('data-msg-must-be-sunday') || "Doit être un Dimanche, dans l'année scolaire.";
    const msgGenerateRealCourses = container.getAttribute('data-msg-generate-real-courses') || "Générer les Cours Réels";
    const msgBothDatesRequired = container.getAttribute('data-msg-both-dates-required') || "Les deux dates (début et fin) sont obligatoires.";
    const msgDatesOutsideYear = container.getAttribute('data-msg-dates-outside-year') || "Les dates doivent être à l'intérieur de l'année scolaire.";
    const msgErrNotMonday = container.getAttribute('data-msg-err-not-monday') || "La date de début doit être un LUNDI.";
    const msgErrNotSunday = container.getAttribute('data-msg-err-not-sunday') || "La date de fin doit être un DIMANCHE.";
    const msgExceptionConflict = container.getAttribute('data-msg-exception-conflict') || "La date de début tombe pendant : {type}.";
    const msgNoCoursesToGenerate = container.getAttribute('data-msg-no-courses-to-generate') || "Aucun cours à générer (tous tombent sur des jours d'exception ou plage invalide).";
    
    const msgConfirmGenTitle = container.getAttribute('data-msg-confirm-gen-title') || "Génération en Masse";
    const msgConfirmGenBody = container.getAttribute('data-msg-confirm-gen-body') || "Confirmez-vous la création de {count} cours réels du {start} au {end} ?";
    const msgConfirmGenSkipped = container.getAttribute('data-msg-confirm-gen-skipped') || " ({count} cours ignorés car tombant sur des jours d'exception).";

    const CONFIG = {
        classPk: container.dataset.classPk,
        yearPk: container.dataset.yearPk,
        yearMinTime: container.dataset.yearMinTime,
        yearMaxTime: container.dataset.yearMaxTime,
        yearStartDate: container.dataset.yearStartDate,
        yearEndDate: container.dataset.yearEndDate,
        urls: {
            manageTemplate: container.dataset.apiManageTemplate,
            manageCourse: container.dataset.apiManageCourse,
            createScheduled: container.dataset.apiCreateScheduled
        },
        csrfToken: document.getElementById('csrf-token') ? document.getElementById('csrf-token').value : ''
    };

    // --- 1. Récupération des Éléments du DOM ---
    const notificationArea = document.getElementById('notification-area');
    const scheduleGridContainer = document.getElementById('schedule-grid-container');
    const noCoursesMessage = document.getElementById('no-courses-message');
    const templateSelect = document.getElementById('template-select');

    // Éléments du formulaire
    const teacherSubjectSelect = document.getElementById('teacher-subject-select');
    const classroomSelect = document.getElementById('classroom-select');
    const daySelect = document.getElementById('course-day-select');
    const startTimeInput = document.getElementById('course-start-time');
    const endTimeInput = document.getElementById('course-end-time');
    const addCourseBtn = document.getElementById('add-course-template-btn');

    const createScheduledCoursesBtn = document.getElementById('create-scheduled-courses-btn');

    // Modal de Confirmation (O/N)
    const confirmModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn'); 
    
    // Modal de Saisie (Texte/Date)
    const inputModal = document.getElementById('input-modal');
    const modalInputTitle = document.getElementById('modal-input-title');
    const modalInputContent = document.getElementById('modal-input-content');
    const modalInputCancelBtn = document.getElementById('modal-input-cancel-btn');
    const modalInputConfirmBtn = document.getElementById('modal-input-confirm-btn');

    // Bloc d'info horaire
    const schoolHoursInfoBox = document.getElementById('school-hours-info');

    // Élément pour afficher le total des heures
    const templateTotalHoursEl = document.getElementById('template-total-hours');


    // --- 2. Modèle de Données Global ---
    let DATA = {}; 
    let currentTemplateId = null; 
    let currentCourseTemplates = []; 
    
    // Jours de la semaine traduits dynamiquement
    const DAYS_OF_WEEK = [
        { key: 1, name: container.getAttribute('data-msg-monday') || 'Lundi' },
        { key: 2, name: container.getAttribute('data-msg-tuesday') || 'Mardi' },
        { key: 3, name: container.getAttribute('data-msg-wednesday') || 'Mercredi' },
        { key: 4, name: container.getAttribute('data-msg-thursday') || 'Jeudi' },
        { key: 5, name: container.getAttribute('data-msg-friday') || 'Vendredi' },
        { key: 6, name: container.getAttribute('data-msg-saturday') || 'Samedi' },
        { key: 7, name: container.getAttribute('data-msg-sunday') || 'Dimanche' },
    ];


    // --- 3. Fonctions d'Utilité (CSRF, JSON Parsing, API) ---

    const parseInitialData = () => {
        try {
            const getData = (id) => {
                const scriptTag = document.getElementById(id);
                if (!scriptTag) {
                    console.error(`Erreur: json_script tag #${id} introuvable.`);
                    return [];
                }
                return JSON.parse(scriptTag.textContent);
            };

            DATA.classrooms = getData('classrooms_data'); 
            DATA.teacher_subjects = getData('teacher_subjects_data');
            DATA.weekly_templates = getData('weekly_templates_data');
            DATA.course_templates = getData('course_templates_data');
            DATA.exception_days = getData('exception_days_data');
            DATA.exception_times = getData('exception_times_data');

            currentTemplateId = templateSelect.value === 'NEW' ? null : parseInt(templateSelect.value);
            
            renderSchoolHoursInfo();
            populateSelects();
            updateCurrentCourseTemplates(); 

        } catch (e) {
            console.error("Erreur de parsing des données initiales:", e);
            showNotification(msgErrCritical, 'error');
        }
    };

    function renderSchoolHoursInfo() {
        if (!schoolHoursInfoBox) return;

        // MODIFICATION : flex et gap-2 pour espacer l'icône et le texte, pas de margin
        let html = `<div class="flex items-center gap-2"><i class="fas fa-info-circle"></i><strong>${msgSchoolHours}</strong> <span dir="ltr">${CONFIG.yearMinTime} - ${CONFIG.yearMaxTime}</span></div>`;

        if (DATA.exception_times && DATA.exception_times.length > 0) {
            // MODIFICATION RTL : ml-2 devient ps-2
            html += `<div class="font-semibold mt-2 pt-2 border-t border-teal-200">${msgTimeExceptions}</div><ul class="list-disc list-inside ps-2 mt-1">`;
            DATA.exception_times.forEach(ex => {
                const start = ex.start_time.substring(0, 5);
                const end = ex.end_time.substring(0, 5);
                // Utilisation de dir="ltr" pour les heures (RTL safe)
                html += `<li dir="ltr">${start} - ${end}</li>`;
            });
            html += `</ul>`;
        }
        schoolHoursInfoBox.innerHTML = html;
    }

    function populateSelects() {
        if (!teacherSubjectSelect || !classroomSelect) return;
        
        teacherSubjectSelect.innerHTML = `<option value="" disabled selected>${msgSelectSubjectTeacher}</option>`;
        classroomSelect.innerHTML = `<option value="" disabled selected>${msgSelectRoom}</option>`;

        DATA.teacher_subjects
            .filter(ts => ts.is_active === true)
            .forEach(ts => {
                const text = `${ts.teacher_name} (${ts.subject_name})`;
                const option = new Option(text, ts.js_pk);
                teacherSubjectSelect.add(option);
            });

        DATA.classrooms
            .filter(room => room.is_active === true)
            .forEach(room => {
                const text = `${room.name}`;
                const option = new Option(text, room.pk);
                classroomSelect.add(option);
            });
    }

    function showNotification(message, type) {
        if (!notificationArea) return;
        
        const colorMap = {
            success: 'bg-green-100 text-green-800 border-green-400',
            error: 'bg-red-100 text-red-800 border-red-400',
            info: 'bg-blue-100 text-blue-800 border-blue-400',
        };
        const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-times-circle' : 'fa-info-circle');

        const notificationDiv = document.createElement('div');
        // MODIFICATION : flex items-center gap-3, suppression de mr-3 sur l'icône
        notificationDiv.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center gap-3 transition duration-300 opacity-0 transform translate-y-2`;
        notificationDiv.innerHTML = `<i class="fas ${icon} text-lg"></i><p class="font-semibold">${message}</p>`;

        notificationArea.prepend(notificationDiv);
        
        setTimeout(() => notificationDiv.classList.remove('opacity-0', 'translate-y-2'), 10);
        setTimeout(() => {
            notificationDiv.classList.add('opacity-0', 'translate-y-2');
            notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
        }, 15000);
    }

    async function apiFetch(url, data) {
        const allActionBtns = [
            document.getElementById('save-template-btn'),
            createScheduledCoursesBtn,
            addCourseBtn
        ].filter(Boolean);

        const originalTexts = new Map();
        
        allActionBtns.forEach(btn => {
            if (!btn.disabled) {
                originalTexts.set(btn, btn.innerHTML);
                btn.disabled = true;
                // MODIFICATION : Injection de gap-2
                btn.innerHTML = `<div class="flex items-center justify-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>${msgLoading}</span></div>`;
            }
        });

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
                const message = json.message || msgServerError.replace('{status}', response.status);
                showNotification(message, 'error');
                return { success: false, ...json };
            }

            if (!json.success) {
                showNotification(json.message || msgOperationFailed, 'error');
            } else if (json.message) {
                showNotification(json.message, 'success');
            }
            
            return json;

        } catch (error) {
            console.error("Erreur réseau/générale:", error);
            showNotification(msgConnectionError.replace('{error}', error.message), 'error');
            return { success: false, message: msgNetworkError };
        } finally {
            allActionBtns.forEach(btn => {
                if (originalTexts.has(btn)) {
                    btn.innerHTML = originalTexts.get(btn);
                }
                btn.disabled = false;
            });
            updateGenerateButtonState();
        }
    }


    // --- 4. Logique de Rendu du Planning ---

    function parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + (minutes || 0);
    }

    function updateTemplateTotalHoursDisplay() {
        if (!templateTotalHoursEl) return;

        let totalMinutes = 0;
        currentCourseTemplates.forEach(course => {
            const startMinutes = parseTimeToMinutes(course.start_time);
            const endMinutes = parseTimeToMinutes(course.end_time);
            const duration = endMinutes - startMinutes;
            if (duration > 0) {
                totalMinutes += duration;
            }
        });

        if (totalMinutes > 0) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            templateTotalHoursEl.textContent = `${msgWeeklyTotal} ${hours}h ${String(minutes).padStart(2, '0')}m`;
            templateTotalHoursEl.style.display = 'block';
        } else {
            templateTotalHoursEl.style.display = 'none';
        }
    }

    function updateCurrentCourseTemplates() {
        if (currentTemplateId) {
            currentCourseTemplates = DATA.course_templates.filter(
                course => course.weekly_template__id == currentTemplateId
            );
        } else {
            currentCourseTemplates = [];
        }
        renderSchedule();
        updateGenerateButtonState();
        updateTemplateTotalHoursDisplay();
    }

    function updateGenerateButtonState() {
        if (createScheduledCoursesBtn) createScheduledCoursesBtn.disabled = !currentCourseTemplates.length;
        
        const formDisabled = !currentTemplateId;
        [daySelect, startTimeInput, endTimeInput, teacherSubjectSelect, classroomSelect, addCourseBtn].forEach(
            el => { if(el) el.disabled = formDisabled; }
        );
        if (addCourseBtn) {
            if (formDisabled) {
                addCourseBtn.title = msgTooltipSelectTemplate;
            } else {
                addCourseBtn.title = "";
            }
        }
    }

    function isTimeInExceptions(startTime, endTime) {
        if (startTime < CONFIG.yearMinTime || endTime > CONFIG.yearMaxTime || endTime < CONFIG.yearMinTime || startTime > CONFIG.yearMaxTime) {
            return true;
        }
        
        for (const ex of DATA.exception_times) {
            const ex_start = ex.start_time.substring(0, 5);
            const ex_end = ex.end_time.substring(0, 5);
            if (startTime < ex_end && endTime > ex_start) {
                return true;
            }
        }
        return false;
    }

    function isTemplateConflict(day, startTime, endTime) {
        const coursesOnSameDay = currentCourseTemplates.filter(
            course => course.day_of_week == day
        );

        for (const course of coursesOnSameDay) {
            const course_start = course.start_time.substring(0, 5);
            const course_end = course.end_time.substring(0, 5);

            if (startTime < course_end && endTime > course_start) {
                return true;
            }
        }
        return false;
    }

    function getDayExceptionType(checkDate) {
        const checkDateStr = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        for (const ex of DATA.exception_days) {
            if (checkDateStr >= ex.start_date && checkDateStr <= ex.end_date) {
                return ex.type || msgNoWorkDay;
            }
        }
        return null;
    }
    
    function renderSchedule() {
        if (!scheduleGridContainer) return;
        scheduleGridContainer.innerHTML = '';
        
        if (currentCourseTemplates.length === 0) {
            if(noCoursesMessage) noCoursesMessage.classList.remove('hidden');
            return;
        }
        
        if(noCoursesMessage) noCoursesMessage.classList.add('hidden');

        const sortedCourses = [...currentCourseTemplates].sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) {
                return a.day_of_week - b.day_of_week;
            }
            return a.start_time.localeCompare(b.start_time);
        });

        let currentDay = -1;
        let dayContainer = null;

        sortedCourses.forEach(course => {
            if (course.day_of_week !== currentDay) {
                currentDay = course.day_of_week;
                const dayName = DAYS_OF_WEEK.find(d => d.key == currentDay)?.name || msgUnknownDay;
                
                dayContainer = document.createElement('div');
                dayContainer.className = "col-span-1 md:col-span-1";
                dayContainer.innerHTML = `<h3 class="text-lg font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-3">${dayName}</h3>`;
                scheduleGridContainer.appendChild(dayContainer);
            }

            const ts = DATA.teacher_subjects.find(t => t.js_pk === course.teacher_subject__id);
            const classroom = DATA.classrooms.find(r => r.pk === course.classroom__id);
            
            const subjectName = ts ? ts.subject_name : msgSubjectUnknown;
            const teacherName = ts ? ts.teacher_name : msgTeacherUnknown;
            const roomName = classroom ? classroom.name : msgRoomUnknown;
            
            const tsInactive = (ts && ts.is_active === false);
            const roomInactive = (classroom && classroom.is_active === false);

            // MODIFICATION RTL: border-l-4 devient border-s-4
            let inactiveClass = 'border-s-4 border-transparent';
            if (tsInactive || roomInactive) {
                inactiveClass = 'opacity-60 border-s-4 border-red-500';
            }

            const courseCard = document.createElement('div');
            // MODIFICATION: Suppression de relative, ajout de flex et group pour le bouton delete
            courseCard.className = `group bg-white p-3 rounded-lg shadow-md border border-gray-200 mb-3 transition hover:shadow-lg flex justify-between items-start ${inactiveClass}`;
            
            let inactiveHtml = '';
            if (tsInactive) {
                // MODIFICATION : flex gap-1
                inactiveHtml += `<p class="flex items-center gap-1 text-xs text-red-600 font-semibold mt-1" title="${msgInactiveTsTitle}"><i class="fas fa-exclamation-triangle"></i> <span>${msgInactiveTs}</span></p>`;
            }
            if (roomInactive) {
                // MODIFICATION : flex gap-1
                inactiveHtml += `<p class="flex items-center gap-1 text-xs text-red-600 font-semibold mt-1" title="${msgInactiveRoomTitle}"><i class="fas fa-exclamation-triangle"></i> <span>${msgInactiveRoom}</span></p>`;
            }

            // MODIFICATION: Le contenu de la carte est dans une div (flex-1), et le bouton delete à côté, le tout géré par le flex-parent
            courseCard.innerHTML = `
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-900">${subjectName}</p>
                    <p class="text-sm text-gray-600">${teacherName}</p>
                    <p class="flex items-center gap-1 text-xs text-gray-500 mt-1"><i class="fas fa-door-open"></i> <span>${roomName}</span></p>
                    <p class="flex items-center gap-1 text-sm font-semibold text-indigo-600 mt-2" dir="ltr">
                        <i class="fas fa-clock"></i>
                        <span>${course.start_time.substring(0, 5)} - ${course.end_time.substring(0, 5)}</span>
                    </p>
                    ${inactiveHtml}
                </div>
                <button class="delete-course-btn text-gray-300 hover:text-red-600 transition p-1"
                        data-course-pk="${course.pk}" title="${msgDeleteCourseTitle}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            
            if (dayContainer) dayContainer.appendChild(courseCard);
        });

        document.querySelectorAll('.delete-course-btn').forEach(btn => {
            if (typeof handleDeleteCourseClick === 'function') {
                btn.addEventListener('click', handleDeleteCourseClick);
            }
        });
    }

    // --- 5. Logique d'Interaction (Ajout/Suppression de Cours) ---

    function handleDeleteCourseClick(e) {
        const course_pk = e.currentTarget.dataset.coursePk;
        if (!course_pk) return;

        openConfirmModal(msgConfirmDelTitle, msgConfirmDelBody, () => 
            handleManageCourse('delete', parseInt(course_pk))
        );
    }

    async function handleAddCourseClick() {
        if (!currentTemplateId) {
            showNotification(msgTooltipSelectTemplate, 'error');
            return;
        }

        const day_of_week = parseInt(daySelect.value);
        const start_time = startTimeInput.value;
        const end_time = endTimeInput.value;
        const teacher_subject_id = parseInt(teacherSubjectSelect.value);
        const classroom_id = parseInt(classroomSelect.value);

        if (!start_time || !end_time || !teacher_subject_id || !classroom_id) {
            showNotification(msgFillAllFields, 'error');
            return;
        }
        if (end_time <= start_time) {
            showNotification(msgEndBeforeStart, 'error');
            return;
        }

        if (isTimeInExceptions(start_time, end_time)) {
            showNotification(msgConflictSchoolHours, 'error');
            return;
        }

        if (isTemplateConflict(day_of_week, start_time, end_time)) {
            showNotification(msgConflictTemplate, 'error');
            return;
        }

        await handleManageCourse('add', null, teacher_subject_id, classroom_id, day_of_week, start_time, end_time);
    }

    async function handleManageCourse(action, course_pk, teacher_subject_id = null, classroom_id = null, day_of_week = null, start_time = null, end_time = null) {
        const data = {
            action: action,
            weekly_template_pk: currentTemplateId,
            course_pk: course_pk
        };

        if (action === 'add') {
            Object.assign(data, {
                day_of_week: day_of_week,
                start_time: start_time,
                end_time: end_time,
                classroom_id: classroom_id,
                teacher_subject_id: teacher_subject_id
            });
            data.start_time = `${start_time}:00`;
            data.end_time = `${end_time}:00`;
        }

        const result = await apiFetch(CONFIG.urls.manageCourse, data);

        if (result.success) {
            if (action === 'add' && result.course_id) {
                const newCourse = {
                    pk: result.course_id,
                    weekly_template__id: currentTemplateId,
                    day_of_week: day_of_week,
                    start_time: data.start_time,
                    end_time: data.end_time,
                    classroom__id: classroom_id,
                    teacher_subject__id: teacher_subject_id
                };
                DATA.course_templates.push(newCourse);
            } else if (action === 'delete') {
                DATA.course_templates = DATA.course_templates.filter(c => c.pk !== course_pk);
            }
            updateCurrentCourseTemplates(); 
        }
    }


    // --- 6. Logique de Gestion des Templates Hebdomadaires ---

    async function handleSaveTemplate() {
        const isNew = templateSelect.value === 'NEW';
        const action = isNew ? 'create' : 'update';
        
        const currentName = isNew ? msgNewTemplate : templateSelect.options[templateSelect.selectedIndex].text;
        
        const contentHtml = `
            <label for="modal-input-field" class="block text-sm font-semibold text-gray-700">${msgTemplateNameLabel}</label>
            <input type="text" id="modal-input-field" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm" value="${currentName}">
        `;

        openInputModal(msgSaveTemplateTitle, contentHtml, async (inputValue) => {
            const templateName = inputValue.name;
            if (!templateName) {
                showNotification(msgNameCannotBeEmpty, 'error');
                return;
            }

            const data = {
                action: action,
                name: templateName,
                year_id: CONFIG.yearPk,
                class_id: CONFIG.classPk,
            };
            if (!isNew) {
                data.template_id = currentTemplateId;
            }

            const result = await apiFetch(CONFIG.urls.manageTemplate, data);

            if (result.success && result.template_id) {
                const newName = result.template_name || templateName;
                if (isNew) {
                    const newTemplate = { pk: result.template_id, name: newName };
                    DATA.weekly_templates.push(newTemplate);
                    const newOption = new Option(newName, result.template_id, true, true);
                    templateSelect.add(newOption);
                    currentTemplateId = result.template_id;
                } else {
                    const optionToUpdate = templateSelect.querySelector(`option[value="${currentTemplateId}"]`);
                    if (optionToUpdate) {
                        optionToUpdate.textContent = newName;
                    }
                }
                updateCurrentCourseTemplates();
            }
        });
    }


    // --- 7. Logique de Génération des Cours Réels ---

    async function handleCreateScheduledCourses() {
        if (!currentTemplateId || currentCourseTemplates.length === 0) {
            showNotification(msgErrEmptyTemplate, 'error');
            return;
        }

        const contentHtml = `
            <div class="space-y-4">
                <div class="p-3 rounded-lg bg-gray-100 text-sm text-gray-700" dir="ltr">
                    <p><strong>${msgSchoolYearDuration}</strong> <span dir="ltr">${CONFIG.yearStartDate} - ${CONFIG.yearEndDate}</span></p>
                </div>
                <div>
                    <label for="modal-input-start-date" class="block text-sm font-semibold text-gray-700">${msgStartDateMonday}</label>
                    <input type="date" id="modal-input-start-date" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm"
                           min="${CONFIG.yearStartDate}" max="${CONFIG.yearEndDate}">
                    <p class="text-xs text-gray-500">${msgMustBeMonday}</p>
                </div>
                <div>
                    <label for="modal-input-end-date" class="block text-sm font-semibold text-gray-700">${msgEndDateSunday}</label>
                    <input type="date" id="modal-input-end-date" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm"
                           min="${CONFIG.yearStartDate}" max="${CONFIG.yearEndDate}">
                    <p class="text-xs text-gray-500">${msgMustBeSunday}</p>
                </div>
            </div>
        `;

        openInputModal(msgGenerateRealCourses, contentHtml, (inputs) => {
            const { dateDebut, dateFin } = inputs;

            if (!dateDebut || !dateFin) {
                showNotification(msgBothDatesRequired, 'error');
                return;
            }
            if (dateFin < dateDebut) {
                showNotification(msgEndBeforeStart, 'error');
                return;
            }
            if (dateDebut < CONFIG.yearStartDate || dateFin > CONFIG.yearEndDate) {
                showNotification(msgDatesOutsideYear, 'error');
                return;
            }

            const startDate = new Date(dateDebut.replace(/-/g, '/'));
            const endDate = new Date(dateFin.replace(/-/g, '/'));

            if (startDate.getDay() !== 1) { 
                showNotification(msgErrNotMonday, 'error');
                return;
            }
            if (endDate.getDay() !== 0) { 
                showNotification(msgErrNotSunday, 'error');
                return;
            }

            const exceptionType = getDayExceptionType(startDate);
            if (exceptionType) {
                showNotification(msgExceptionConflict.replace('{type}', exceptionType), 'error');
                return;
            }
            
            let allCourses_list = [];
            let totalSkippedCount = 0;
            let currentMonday = new Date(startDate.getTime());
            
            while (currentMonday <= endDate) {
                let skippedCoursesCount = 0;

                const coursesForThisWeek = currentCourseTemplates.map(course => {
                    const dayOffset = course.day_of_week - 1; 
                    const courseDate = new Date(currentMonday.getTime());
                    courseDate.setDate(currentMonday.getDate() + dayOffset);
                    
                    if (getDayExceptionType(courseDate)) {
                        skippedCoursesCount++;
                        return null;
                    }
                    if (courseDate > endDate) return null;
                    
                    const [start_h, start_m] = course.start_time.split(':').map(Number);
                    const [end_h, end_m] = course.end_time.split(':').map(Number);

                    const start_datetime = new Date(courseDate.getFullYear(), courseDate.getMonth(), courseDate.getDate(), start_h, start_m);
                    const end_datetime = new Date(courseDate.getFullYear(), courseDate.getMonth(), courseDate.getDate(), end_h, end_m);

                    const toLocalISOString = (date) => {
                        const tzOffset = date.getTimezoneOffset() * 60000;
                        return (new Date(date - tzOffset)).toISOString().slice(0, -1);
                    };

                    return {
                        teacher_subject_id: course.teacher_subject__id,
                        classroom_id: course.classroom__id,
                        student_class_id: parseInt(CONFIG.classPk),
                        start_datetime: toLocalISOString(start_datetime),
                        end_datetime: toLocalISOString(end_datetime),
                    };
                }).filter(Boolean);
                
                allCourses_list.push(...coursesForThisWeek);
                totalSkippedCount += skippedCoursesCount;
                currentMonday.setDate(currentMonday.getDate() + 7);
            }

            if (allCourses_list.length === 0) {
                showNotification(msgNoCoursesToGenerate, 'info');
                return;
            }

            let confirmationMessage = msgConfirmGenBody.replace('{count}', allCourses_list.length).replace('{start}', dateDebut).replace('{end}', dateFin);
            if (totalSkippedCount > 0) {
                confirmationMessage += msgConfirmGenSkipped.replace('{count}', totalSkippedCount);
            }

            openConfirmModal(msgConfirmGenTitle, confirmationMessage, async () => {
                const payload = { courses_list: allCourses_list, year_id: CONFIG.yearPk };
                const result = await apiFetch(CONFIG.urls.createScheduled, payload);

                if (!result.success && result.errors) {
                    const errorMessages = result.errors.map(err => `<li>${err.reason}</li>`).join('');
                    showNotification(`${result.message}<br><ul class="list-disc ms-4 mt-2">${errorMessages}</ul>`, 'error');
                } else if (result.success) {
                    showNotification(result.message, 'success');
                }
            });
        });
    }


    // --- 8. Logique des Modales ---

    function openConfirmModal(title, message, onConfirm) {
        modalTitle.innerHTML = title;
        modalMessage.innerHTML = message;
        
        let currentConfirmBtn = document.getElementById('modal-confirm-btn');
        const newConfirmBtn = currentConfirmBtn.cloneNode(true);
        currentConfirmBtn.parentNode.replaceChild(newConfirmBtn, currentConfirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            closeConfirmModal();
        });

        confirmModal.classList.remove('opacity-0', 'pointer-events-none');
        confirmModal.querySelector('div').classList.remove('translate-y-4');
    }

    function closeConfirmModal() {
        confirmModal.classList.add('opacity-0', 'pointer-events-none');
        confirmModal.querySelector('div').classList.add('translate-y-4');
    }

    function openInputModal(title, contentHtml, onConfirm) {
        modalInputTitle.innerHTML = title;
        modalInputContent.innerHTML = contentHtml;
        
        let currentConfirmBtn = document.getElementById('modal-input-confirm-btn');
        const newConfirmBtn = currentConfirmBtn.cloneNode(true);
        currentConfirmBtn.parentNode.replaceChild(newConfirmBtn, currentConfirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            const inputField = document.getElementById('modal-input-field');
            const startDateField = document.getElementById('modal-input-start-date');
            const endDateField = document.getElementById('modal-input-end-date');
            
            let value;
            if (inputField) {
                value = { name: inputField.value };
            } else if (startDateField && endDateField) {
                value = {
                    dateDebut: startDateField.value,
                    dateFin: endDateField.value
                };
            }

            onConfirm(value);
            closeInputModal();
        });

        setTimeout(() => {
            const firstInput = document.getElementById('modal-input-field') || document.getElementById('modal-input-start-date');
            if(firstInput) firstInput.focus();
        }, 100);

        inputModal.classList.remove('opacity-0', 'pointer-events-none');
        inputModal.querySelector('div').classList.remove('translate-y-4');
    }

    function closeInputModal() {
        inputModal.classList.add('opacity-0', 'pointer-events-none');
        inputModal.querySelector('div').classList.add('translate-y-4');
        modalInputContent.innerHTML = ''; 
    }


    // --- 9. Initialisation et Événements ---

    parseInitialData();
    populateSelects();

    if(templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            currentTemplateId = e.target.value === 'NEW' ? null : parseInt(e.target.value);
            updateCurrentCourseTemplates();
        });
    }

    if(document.getElementById('save-template-btn')) document.getElementById('save-template-btn').addEventListener('click', handleSaveTemplate);
    if(createScheduledCoursesBtn) createScheduledCoursesBtn.addEventListener('click', handleCreateScheduledCourses);
    if(addCourseBtn) addCourseBtn.addEventListener('click', handleAddCourseClick); 
    
    if(modalCancelBtn) modalCancelBtn.addEventListener('click', closeConfirmModal);
    if(modalInputCancelBtn) modalInputCancelBtn.addEventListener('click', closeInputModal);

    updateGenerateButtonState();
});