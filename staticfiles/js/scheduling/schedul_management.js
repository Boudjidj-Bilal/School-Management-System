// ====================================================================
// LOGIQUE JAVASCRIPT POUR schedul_management.js (Refactorisé v14)
// Ajoute le calcul et l'affichage du total des heures du template
// ====================================================================

// --- 1. Récupération des Éléments du DOM ---
const notificationArea = document.getElementById('notification-area');
const scheduleGridContainer = document.getElementById('schedule-grid-container');
const noCoursesMessage = document.getElementById('no-courses-message');
const templateSelect = document.getElementById('template-select');

// Nouveaux éléments du formulaire
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

// Modal de Saisie (Texte/Date)
const inputModal = document.getElementById('input-modal');
const modalInputTitle = document.getElementById('modal-input-title');
const modalInputContent = document.getElementById('modal-input-content');
const modalInputCancelBtn = document.getElementById('modal-input-cancel-btn');
const modalInputConfirmBtn = document.getElementById('modal-input-confirm-btn');

// Bloc d'info horaire
const schoolHoursInfoBox = document.getElementById('school-hours-info');

// [NOUVEAU] Élément pour afficher le total des heures
const templateTotalHoursEl = document.getElementById('template-total-hours');


// --- 2. Modèle de Données Global ---
let DATA = {}; // Contient les données JSON du backend
let currentTemplateId = null; // ID du WeeklyScheduleTemplate en cours d'édition
let currentCourseTemplates = []; // Liste des cours du template actuel


// --- 3. Fonctions d'Utilité (CSRF, JSON Parsing, API) ---

/** * Parse les données JSON injectées dans le DOM.
 */
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

        DATA.classrooms = getData('classrooms_data'); // Contient 'is_active'
        DATA.teacher_subjects = getData('teacher_subjects_data'); // Contient 'is_active'
        DATA.weekly_templates = getData('weekly_templates_data');
        DATA.course_templates = getData('course_templates_data');
        DATA.exception_days = getData('exception_days_data');
        DATA.exception_times = getData('exception_times_data');

        console.log("Données initiales chargées:", DATA);

        currentTemplateId = templateSelect.value === 'NEW' ? null : parseInt(templateSelect.value);
        
        renderSchoolHoursInfo();
        
        updateCurrentCourseTemplates(); // Appel initial

    } catch (e) {
        console.error("Erreur de parsing des données initiales:", e);
        showNotification("Erreur critique au chargement des données.", 'error');
    }
};

/**
 * Affiche les bornes horaires et les exceptions (pauses) de l'école.
 */
function renderSchoolHoursInfo() {
    if (!schoolHoursInfoBox) return;

    let html = `<div class="flex items-center"><i class="fas fa-info-circle mr-2"></i><strong class="mr-1">Horaires de l'école:</strong> ${YEAR_MIN_TIME} - ${YEAR_MAX_TIME}</div>`;

    if (DATA.exception_times && DATA.exception_times.length > 0) {
        html += `<div class="font-semibold mt-2 pt-2 border-t border-teal-200">Exceptions horaires (pauses):</div><ul class="list-disc list-inside ml-2">`;
        DATA.exception_times.forEach(ex => {
            const start = ex.start_time.substring(0, 5);
            const end = ex.end_time.substring(0, 5);
            html += `<li>${start} - ${end}</li>`;
        });
        html += `</ul>`;
    }
    schoolHoursInfoBox.innerHTML = html;
}

/**
 * Remplit les listes <select> au démarrage.
 * Filtre maintenant sur ts.is_active ET room.is_active
 */
function populateSelects() {
    teacherSubjectSelect.innerHTML = '<option value="" disabled selected>-- Sélectionnez Matière/Prof --</option>';
    classroomSelect.innerHTML = '<option value="" disabled selected>-- Sélectionnez une Salle --</option>';

    // Filtre les profs/matières actifs
    DATA.teacher_subjects
        .filter(ts => ts.is_active === true)
        .forEach(ts => {
            const text = `${ts.teacher_name} (${ts.subject_name})`;
            const option = new Option(text, ts.js_pk);
            teacherSubjectSelect.add(option);
        });

    // Filtre les salles actives
    DATA.classrooms
        .filter(room => room.is_active === true)
        .forEach(room => {
            const text = `${room.name}`;
            const option = new Option(text, room.pk);
            classroomSelect.add(option);
        });
}

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
    notificationDiv.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center transition duration-300 opacity-0 transform translate-y-2`;
    notificationDiv.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

    notificationArea.prepend(notificationDiv);
    
    setTimeout(() => notificationDiv.classList.remove('opacity-0', 'translate-y-2'), 10);
    setTimeout(() => {
        notificationDiv.classList.add('opacity-0', 'translate-y-2');
        notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
    }, 15000);
}

/**
 * Fonction d'appel API générique.
 */
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
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Chargement...';
        }
    });

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

        if (!json.success) {
            showNotification(json.message || "Opération échouée.", 'error');
        } else if (json.message) {
            showNotification(json.message, 'success');
        }
        
        return json;

    } catch (error) {
        console.error("Erreur réseau/générale:", error);
        showNotification(`Erreur de connexion au serveur : ${error.message}`, 'error');
        return { success: false, message: "Erreur de connexion réseau." };
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

/** [NOUVEAU] Helper pour convertir "HH:MM:SS" en minutes. */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
}

/** [NOUVEAU] Calcule et affiche le total des heures pour le template actuel. */
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
        templateTotalHoursEl.textContent = `Total Hebdomadaire: ${hours}h ${String(minutes).padStart(2, '0')}m`;
        templateTotalHoursEl.style.display = 'block';
    } else {
        templateTotalHoursEl.style.display = 'none';
    }
}

/**
 * [MODIFIÉ] Met à jour les cours affichés ET le total des heures.
 */
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
    updateTemplateTotalHoursDisplay(); // [APPEL AJOUTÉ]
}

/** Active/Désactive le bouton de génération */
function updateGenerateButtonState() {
    createScheduledCoursesBtn.disabled = !currentCourseTemplates.length;
    // Gère l'état du formulaire d'ajout
    const formDisabled = !currentTemplateId;
    [daySelect, startTimeInput, endTimeInput, teacherSubjectSelect, classroomSelect, addCourseBtn].forEach(
        el => el.disabled = formDisabled
    );
    if (formDisabled) {
        addCourseBtn.title = "Veuillez d'abord sélectionner ou sauvegarder un modèle.";
    } else {
        addCourseBtn.title = "";
    }
}

/**
 * Vérifie si un créneau chevauche les exceptions horaires.
 */
function isTimeInExceptions(startTime, endTime) {
    // 1. Vérifie les bornes min/max de l'année
    if (startTime < YEAR_MIN_TIME || endTime > YEAR_MAX_TIME || endTime < YEAR_MIN_TIME || startTime > YEAR_MAX_TIME) {
        return true;
    }
    
    // 2. Vérifie les exceptions (ex: pause déjeuner 12:30-13:30)
    for (const ex of DATA.exception_times) {
        const ex_start = ex.start_time.substring(0, 5); // "10:10:00" -> "10:10"
        const ex_end = ex.end_time.substring(0, 5);     // "10:30:00" -> "10:30"
        if (startTime < ex_end && endTime > ex_start) {
            return true;
        }
    }
    return false;
}

/**
 * Vérifie si le créneau chevauche un autre cours DÉJÀ PRÉSENT
 * dans le modèle de la classe.
 */
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


/**
 * Vérifie si une date tombe sur un jour d'exception (vacances, etc.)
 */
function getDayExceptionType(checkDate) {
    // Assure que la date est en UTC pour la comparaison
    const checkDateStr = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    for (const ex of DATA.exception_days) {
        if (checkDateStr >= ex.start_date && checkDateStr <= ex.end_date) {
            return ex.type || "Jour non travaillé";
        }
    }
    return null;
}


/**
 * Rend les cartes de cours au lieu d'une grille statique.
 */
function renderSchedule() {
    // Vide le conteneur
    scheduleGridContainer.innerHTML = '';
    
    if (currentCourseTemplates.length === 0) {
        noCoursesMessage.classList.remove('hidden');
        return;
    }
    
    noCoursesMessage.classList.add('hidden');

    // Trier les cours par jour, puis par heure de début
    const sortedCourses = [...currentCourseTemplates].sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) {
            return a.day_of_week - b.day_of_week;
        }
        return a.start_time.localeCompare(b.start_time);
    });

    let currentDay = -1;
    let dayContainer = null;

    sortedCourses.forEach(course => {
        // Crée un nouveau conteneur de jour si nécessaire
        if (course.day_of_week !== currentDay) {
            currentDay = course.day_of_week;
            const dayName = DAYS_OF_WEEK.find(d => d.key == currentDay)?.name || 'Jour inconnu';
            
            dayContainer = document.createElement('div');
            dayContainer.className = "col-span-1 md:col-span-1";
            dayContainer.innerHTML = `<h3 class="text-lg font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-3">${dayName}</h3>`;
            scheduleGridContainer.appendChild(dayContainer);
        }

        // Informations du cours
        const ts = DATA.teacher_subjects.find(t => t.js_pk === course.teacher_subject__id);
        const classroom = DATA.classrooms.find(r => r.pk === course.classroom__id);
        
        const subjectName = ts ? ts.subject_name : 'Matière ?';
        const teacherName = ts ? ts.teacher_name : 'Prof ?';
        const roomName = classroom ? classroom.name : 'Salle ?';
        
        const tsInactive = (ts && ts.is_active === false);
        const roomInactive = (classroom && classroom.is_active === false);

        let inactiveClass = 'border-l-4 border-transparent';
        if (tsInactive || roomInactive) {
            inactiveClass = 'opacity-60 border-l-4 border-red-500';
        }

        // Crée la carte du cours
        const courseCard = document.createElement('div');
        courseCard.className = `bg-white p-3 rounded-lg shadow-md border border-gray-200 mb-3 relative transition hover:shadow-lg ${inactiveClass}`;
        
        let inactiveHtml = '';
        if (tsInactive) {
            inactiveHtml += `<p class="text-xs text-red-600 font-semibold mt-1" title="Cette affectation professeur/matière n'est plus active."><i class="fas fa-exclamation-triangle mr-1"></i> Prof/Matière Inactif</p>`;
        }
        if (roomInactive) {
            inactiveHtml += `<p class="text-xs text-red-600 font-semibold mt-1" title="Cette salle n'est plus active."><i class="fas fa-exclamation-triangle mr-1"></i> Salle Inactive</p>`;
        }


        courseCard.innerHTML = `
            <p class="text-sm font-bold text-gray-900">${subjectName}</p>
            <p class="text-sm text-gray-600">${teacherName}</p>
            <p class="text-xs text-gray-500 mt-1"><i class="fas fa-door-open mr-1"></i> ${roomName}</p>
            <p class="text-sm font-semibold text-indigo-600 mt-2">
                <i class="fas fa-clock mr-1"></i>
                ${course.start_time.substring(0, 5)} - ${course.end_time.substring(0, 5)}
            </p>
            ${inactiveHtml}
            <button class="delete-course-btn absolute top-2 right-2 text-red-400 hover:text-red-600 transition"
                    data-course-pk="${course.pk}" title="Supprimer ce cours">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        
        dayContainer.appendChild(courseCard);
    });

    // Ajouter les écouteurs pour les nouveaux boutons supprimer
    document.querySelectorAll('.delete-course-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteCourseClick);
    });
}


// --- 5. Logique d'Interaction (Ajout/Suppression de Cours) ---

/**
 * Gère le clic sur le bouton "Supprimer" d'une carte de cours.
 */
function handleDeleteCourseClick(e) {
    const course_pk = e.currentTarget.dataset.coursePk;
    if (!course_pk) return;

    openConfirmModal("Confirmation Suppression", "Voulez-vous retirer ce cours du modèle de planning ?", () => 
        handleManageCourse('delete', parseInt(course_pk))
    );
}

/**
 * Gère le clic sur "Ajouter ce cours au modèle".
 */
async function handleAddCourseClick() {
    if (!currentTemplateId) {
        showNotification("Veuillez d'abord enregistrer ou sélectionner un modèle.", 'error');
        return;
    }

    // 1. Récupérer les valeurs
    const day_of_week = parseInt(daySelect.value);
    const start_time = startTimeInput.value; // "HH:MM"
    const end_time = endTimeInput.value;     // "HH:MM"
    const teacher_subject_id = parseInt(teacherSubjectSelect.value);
    const classroom_id = parseInt(classroomSelect.value);

    // 2. Validation
    if (!start_time || !end_time || !teacher_subject_id || !classroom_id) {
        showNotification("Veuillez remplir tous les champs (jour, début, fin, prof, salle).", 'error');
        return;
    }
    if (end_time <= start_time) {
        showNotification("L'heure de fin doit être après l'heure de début.", 'error');
        return;
    }

    // 3. Validation des exceptions (Bornes et Pauses)
    if (isTimeInExceptions(start_time, end_time)) {
        showNotification("Ce créneau chevauche les bornes horaires de l'école ou une pause (ex: déjeuner).", 'error');
        return;
    }

    // 4. Validation des conflits de classe (chevauchement interne)
    if (isTemplateConflict(day_of_week, start_time, end_time)) {
        showNotification("Conflit de classe: Ce créneau chevauche un autre cours déjà défini dans le modèle pour ce jour.", 'error');
        return;
    }

    // 5. Appel API (via la fonction générique)
    await handleManageCourse('add', null, teacher_subject_id, classroom_id, day_of_week, start_time, end_time);
}

/**
 * Gère l'ajout/suppression d'un CourseTemplate via l'API.
 */
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
    }
    
    if(action === 'add') {
        data.start_time = `${start_time}:00`;
        data.end_time = `${end_time}:00`;
    }

    const result = await apiFetch(API_URLS.MANAGE_COURSE, data);

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
        updateCurrentCourseTemplates(); // Met à jour l'affichage ET le total d'heures
    }
}

// --- 6. Logique de Gestion des Templates Hebdomadaires ---

/**
 * Utilise la modale de saisie au lieu de prompt()
 */
async function handleSaveTemplate() {
    const isNew = templateSelect.value === 'NEW';
    const action = isNew ? 'create' : 'update';
    
    const currentName = isNew ? "Nouveau Modèle" : templateSelect.options[templateSelect.selectedIndex].text;
    
    const contentHtml = `
        <label for="modal-input-field" class="block text-sm font-semibold text-gray-700">Nom du modèle :</label>
        <input type="text" id="modal-input-field" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm" value="${currentName}">
    `;

    openInputModal("Enregistrer le Modèle", contentHtml, async (inputValue) => {
        const templateName = inputValue.name; // 'name' vient de l'objet retourné par openInputModal
        if (!templateName) {
            showNotification("Le nom ne peut pas être vide.", 'error');
            return;
        }

        const data = {
            action: action,
            name: templateName,
            year_id: YEAR_PK,
            class_id: CLASS_PK,
        };
        if (!isNew) {
            data.template_id = currentTemplateId;
        }

        const result = await apiFetch(API_URLS.MANAGE_TEMPLATE, data);

        if (result.success && result.template_id) {
            const newName = result.template_name || templateName; // Utilise le nom retourné par l'API
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

// --- 7. Logique de Génération des Cours Réels (ScheduledCourse) ---

/**
 * Gère la génération multi-semaines.
 */
async function handleCreateScheduledCourses() {
    if (!currentTemplateId || currentCourseTemplates.length === 0) {
        showNotification("Le modèle de semaine est vide ou non sauvegardé.", 'error');
        return;
    }

    // HTML pour deux champs de date + infos des bornes
    const contentHtml = `
        <div class="space-y-4">
            <div class="p-3 rounded-lg bg-gray-100 text-sm text-gray-700">
                <p><strong>Année scolaire :</strong> du ${YEAR_START_DATE} au ${YEAR_END_DATE}</p>
            </div>
            <div>
                <label for="modal-input-start-date" class="block text-sm font-semibold text-gray-700">Date de début (Lundi)</label>
                <input type="date" id="modal-input-start-date" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm"
                       min="${YEAR_START_DATE}" max="${YEAR_END_DATE}">
                <p class="text-xs text-gray-500">Doit être un Lundi, dans l'année scolaire.</p>
            </div>
            <div>
                <label for="modal-input-end-date" class="block text-sm font-semibold text-gray-700">Date de fin (Dimanche)</label>
                <input type="date" id="modal-input-end-date" class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm"
                       min="${YEAR_START_DATE}" max="${YEAR_END_DATE}">
                <p class="text-xs text-gray-500">Doit être un Dimanche, dans l'année scolaire.</p>
            </div>
        </div>
    `;

    // Ouvre la modale de saisie. La confirmation gère maintenant un objet.
    openInputModal("Générer les Cours Réels", contentHtml, (inputs) => {
        
        const { dateDebut, dateFin } = inputs;

        // --- Validation ---
        if (!dateDebut || !dateFin) {
            showNotification("Les deux dates (début et fin) sont obligatoires.", 'error');
            return;
        }
        if (dateFin < dateDebut) {
            showNotification("La date de fin doit être après la date de début.", 'error');
            return;
        }

        if (dateDebut < YEAR_START_DATE || dateFin > YEAR_END_DATE) {
            showNotification("Les dates doivent être à l'intérieur de l'année scolaire.", 'error');
            return;
        }

        const startDate = new Date(dateDebut.replace(/-/g, '/'));
        const endDate = new Date(dateFin.replace(/-/g, '/'));

        if (startDate.getDay() !== 1) { 
            showNotification("La date de début doit être un LUNDI.", 'error');
            return;
        }
        if (endDate.getDay() !== 0) { 
            showNotification("La date de fin doit être un DIMANCHE.", 'error');
            return;
        }

        const exceptionType = getDayExceptionType(startDate);
        if (exceptionType) {
            showNotification(`La date de début tombe pendant : ${exceptionType}.`, 'error');
            return;
        }
        
        // --- Boucle de génération multi-semaines ---
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
                
                if (courseDate > endDate) {
                    return null;
                }
                
                const [start_h, start_m] = course.start_time.split(':').map(Number);
                const [end_h, end_m] = course.end_time.split(':').map(Number);

                const start_datetime = new Date(courseDate.getFullYear(), courseDate.getMonth(), courseDate.getDate(), start_h, start_m);
                const end_datetime = new Date(courseDate.getFullYear(), courseDate.getMonth(), courseDate.getDate(), end_h, end_m);

                return {
                    teacher_subject_id: course.teacher_subject__id,
                    classroom_id: course.classroom__id,
                    student_class_id: parseInt(CLASS_PK),
                    start_datetime: start_datetime.toISOString(),
                    end_datetime: end_datetime.toISOString(),
                };
            }).filter(Boolean);
            
            allCourses_list.push(...coursesForThisWeek);
            totalSkippedCount += skippedCoursesCount;
            
            currentMonday.setDate(currentMonday.getDate() + 7);
        }
        // --- Fin de la boucle ---

        if (allCourses_list.length === 0) {
            showNotification("Aucun cours à générer. Tous les cours tombent sur des jours d'exception ou la plage est invalide.", 'info');
            return;
        }

        let confirmationMessage = `Confirmez-vous la création de ${allCourses_list.length} cours réels du ${dateDebut} au ${dateFin} ?`;
        if (totalSkippedCount > 0) {
            confirmationMessage += ` (${totalSkippedCount} cours ont été ignorés car ils tombaient sur des jours d'exception).`;
        }

        openConfirmModal(`Génération en Masse`, confirmationMessage, async () => {
            const payload = { courses_list: allCourses_list, year_id: YEAR_PK };
            const result = await apiFetch(API_URLS.CREATE_SCHEDULED_COURSES, payload);

            if (!result.success && result.errors) {
                const errorMessages = result.errors.map(err => `<li>${err.reason}</li>`).join('');
                showNotification(`${result.message}<br><ul>${errorMessages}</ul>`, 'error');
            } else if (result.success && result.errors_count > 0) {
                const errorMessages = result.errors.map(err => `<li>${err.reason || err.error}</li>`).join('');
                showNotification(`${result.message}<br><ul>${errorMessages}</ul>`, 'info');
            }
        });
    });
}


// --- 8. Logique des Modales ---

/**
 * Gère la modale de Confirmation (O/N).
 */
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

/**
 * Gère la modale de Saisie (Input).
 */
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
            value = { name: inputField.value }; // Retourne un objet
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
        firstInput?.focus();
    }, 100);

    inputModal.classList.remove('opacity-0', 'pointer-events-none');
    inputModal.querySelector('div').classList.remove('translate-y-4');
}

function closeInputModal() {
    inputModal.classList.add('opacity-0', 'pointer-events-none');
    inputModal.querySelector('div').classList.add('translate-y-4');
    modalInputContent.innerHTML = ''; // Nettoyer
}


// --- 9. Initialisation et Événements ---

document.addEventListener('DOMContentLoaded', () => {
    parseInitialData();
    populateSelects(); // Remplir les listes <select>

    templateSelect.addEventListener('change', (e) => {
        currentTemplateId = e.target.value === 'NEW' ? null : parseInt(e.target.value);
        updateCurrentCourseTemplates(); // Met à jour les cartes et l'état des formulaires
    });

    // Écouteurs des boutons d'action
    document.getElementById('save-template-btn').addEventListener('click', handleSaveTemplate);
    createScheduledCoursesBtn.addEventListener('click', handleCreateScheduledCourses);
    addCourseBtn.addEventListener('click', handleAddCourseClick); 
    
    // Écouteurs des modales
    modalCancelBtn.addEventListener('click', closeConfirmModal);
    modalInputCancelBtn.addEventListener('click', closeInputModal);

    // Mettre à jour l'état initial des formulaires (désactivés si "Nouveau Modèle")
    updateGenerateButtonState();
});

