// ====================================================================
// LOGIQUE JAVASCRIPT POUR l'AFFICHAGE DU PLANNING (view_teacher_schedule.js)
// Basé sur view_schedule.js, mais adapté pour la vue Professeur
// ====================================================================

// État global de l'application
const STATE = {
    courses: [], // Sera rempli avec les cours de la semaine
    exceptionTimes: [], // Sera rempli avec les pauses (ex: déjeuner)
    currentMonday: null, // Date (objet) du Lundi de la semaine affichée
    gridStartMinutes: 0, // Heure de début de la grille en minutes (ex: 480 pour 8h00)
    gridEndMinutes: 0, // Heure de fin de la grille en minutes (ex: 1080 pour 18h00)
    minuteHeightPx: 1.0, // 1px par minute. 10h = 600px.
    selectedCourseId: null, // ID du cours cliqué par un admin/prof
    dayColumnElements: [], // Stocke les 7 divs des colonnes de jour
    onConfirmCallback: null, // Stocke la fonction à exécuter lors de la confirmation
};

// --- 1. Récupération des Éléments du DOM ---
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const weekDisplay = document.getElementById('week-display');
const scheduleTimesColumn = document.getElementById('schedule-times-column');
const scheduleGridBackground = document.getElementById('schedule-grid-background');
const scheduleCoursesContainer = document.getElementById('schedule-courses-container');
const scheduleContainer = document.getElementById('schedule-container');

// Modale d'action
const actionModal = document.getElementById('action-modal');
const modalCourseTitle = document.getElementById('modal-course-title');
const modalCourseDetails = document.getElementById('modal-course-details');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
// [NOUVEAU] Conteneurs d'action spécifiques
const teacherActions = document.getElementById('teacher-actions');
const adminActions = document.getElementById('admin-actions');
const deleteSection = document.getElementById('delete-section');

// Modale de confirmation générique
const genericConfirmModal = document.getElementById('generic-confirm-modal');
const genericConfirmTitle = document.getElementById('generic-confirm-title');
const genericConfirmMessage = document.getElementById('generic-confirm-message');
const genericConfirmCancelBtn = document.getElementById('generic-confirm-cancel-btn');
const genericConfirmConfirmBtn = document.getElementById('generic-confirm-confirm-btn');


// --- 2. Fonctions d'Utilité (Helpers) ---

/**
 * Convertit une chaîne "HH:MM" ou "HH:MM:SS" en minutes totales.
 * @param {string} timeStr - ex: "08:30"
 * @returns {number} - ex: 510
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
}

/**
 * Affiche une notification.
 * @param {string} message - Le message à afficher.
 * @param {('success'|'error'|'info')} type - Le type de notification.
 */
function showNotification(message, type) {
    const notificationArea = document.querySelector('.max-w-7xl.mx-auto'); // Cible le conteneur principal
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
    
    setTimeout(() => notificationDiv.classList.remove('opacity-0', '-translate-y-2'), 10);
    setTimeout(() => {
        notificationDiv.classList.add('opacity-0', '-translate-y-2');
        notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
    }, 12000); // 12 secondes
}

/**
 * Mappe un nom de couleur de la BDD à une classe Tailwind.
 * @param {string} colorName - ex: "RED", "BLUE"
 */
function getColorClass(colorName) {
    const colorMap = {
        "RED": "bg-red-100 border-red-400 text-red-800",
        "BLUE": "bg-blue-100 border-blue-400 text-blue-800",
        "GREEN": "bg-green-100 border-green-400 text-green-800",
        "YELLOW": "bg-yellow-100 border-yellow-400 text-yellow-800",
        "ORANGE": "bg-orange-100 border-orange-400 text-orange-800",
        "PURPLE": "bg-purple-100 border-purple-400 text-purple-800",
        "GRAY": "bg-gray-100 border-gray-400 text-gray-800",
    };
    // Renvoie une couleur de fond plus claire pour le bloc
    return colorMap[colorName] || 'bg-gray-100 border-gray-400 text-gray-800';
}

/**
 * Mappe un statut de cours à une classe CSS.
 * @param {string} statusKey - ex: "CANCELLED"
 */
function getStatusClass(statusKey) {
    switch (statusKey) {
        case 'CANCELLED':
            return 'opacity-50 line-through';
        case 'TEACHER_ABSENT':
            return 'opacity-70 border-l-4 border-yellow-500';
        case 'ACTIVE':
        default:
            return '';
    }
}

/**
 * Convertit un objet Date en string "YYYY-MM-DD" (heure locale).
 * @param {Date} date
 */
function formatDateToISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Crée un objet Date à partir d'un string "YYYY-MM-DD" (heure locale).
 * @param {string} isoDate
 */
function parseISODate(isoDate) {
    return new Date(`${isoDate}T00:00:00`);
}


/**
 * Formate une date (objet) en "DD MMM YYYY".
 * @param {Date} date
 */
function formatSimpleDate(date) {
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Formate une date (objet) en "Jour XX/MM".
 * @param {Date} date
 */
function formatDayHeader(date) {
    const day = date.toLocaleDateString('fr-FR', { weekday: 'short' }); // "lun."
    const dayNum = String(date.getDate()).padStart(2, '0');
    const monthNum = String(date.getMonth() + 1).padStart(2, '0');
    // Capitalise la première lettre: "lun." -> "Lun."
    const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
    return `${dayCapitalized} ${dayNum}/${monthNum}`;
}


/**
 * Fonction d'appel API générique.
 * @param {string} url - L'URL API.
 * @param {Object} data - Les données à envoyer.
 * @returns {Promise<Object>} - La réponse JSON.
 */
async function apiFetch(url, data) {
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
            showNotification(json.message, 'success');
        }
        
        return json;

    } catch (error) {
        console.error("Erreur API:", error);
        showNotification(`Erreur de connexion au serveur : ${error.message}`, 'error');
        return { success: false, message: "Erreur de connexion réseau." };
    }
}


// --- 3. Logique de Rendu de la Grille ---

/**
 * Dessine l'arrière-plan de la grille (lignes horaires, pauses).
 * Ne s'exécute qu'une fois au chargement.
 */
function drawGridBackground() {
    scheduleTimesColumn.innerHTML = '';
    scheduleGridBackground.innerHTML = '';
    scheduleCoursesContainer.innerHTML = ''; 
    STATE.dayColumnElements = []; 

    STATE.gridStartMinutes = parseTimeToMinutes(YEAR_MIN_TIME);
    STATE.gridEndMinutes = parseTimeToMinutes(YEAR_MAX_TIME);
    const totalDuration = STATE.gridEndMinutes - STATE.gridStartMinutes;
    const slotDuration = 30; // Tranches de 30 minutes
    const totalSlots = totalDuration / slotDuration;
    const slotHeight = slotDuration * STATE.minuteHeightPx; // ex: 30 * 1.0 = 30px

    const exceptionSlots = new Set();
    STATE.exceptionTimes.forEach(ex => {
        const exStart = parseTimeToMinutes(ex.start_time);
        const exEnd = parseTimeToMinutes(ex.end_time);
        for (let t = STATE.gridStartMinutes; t < STATE.gridEndMinutes; t += slotDuration) {
            if (t < exEnd && (t + slotDuration) > exStart) {
                exceptionSlots.add(t);
            }
        }
    });

    // Créer les lignes (heures et grille de fond)
    for (let i = 0; i < totalSlots; i++) {
        const slotTimeInMinutes = STATE.gridStartMinutes + (i * slotDuration);
        
        // 1. Crée l'étiquette de l'heure
        const hour = Math.floor(slotTimeInMinutes / 60);
        const minutes = slotTimeInMinutes % 60;
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'text-center text-xs font-semibold text-gray-500 border-b border-r border-gray-200';
        timeLabel.style.height = `${slotHeight}px`;
        
        // N'affiche l'heure que toutes les heures (pour ne pas surcharger)
        if(minutes === 0) {
            timeLabel.textContent = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        
        scheduleTimesColumn.appendChild(timeLabel);

        // 2. Crée l'arrière-plan de la grille (7 colonnes)
        for (let j = 0; j < 7; j++) {
            const cell = document.createElement('div');
            let cellClass = 'border-b border-gray-200';
            if (j < 6) cellClass += ' border-r'; 
            
            cell.className = cellClass;
            cell.style.height = `${slotHeight}px`;
            scheduleGridBackground.appendChild(cell);
        }
    }

    // Crée les 7 colonnes (conteneurs de jour) pour les cours
    for (let i = 0; i < 7; i++) {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'relative'; 
        if (i < 6) {
            dayColumn.classList.add('border-r', 'border-gray-200');
        }
        scheduleCoursesContainer.appendChild(dayColumn);
        STATE.dayColumnElements.push(dayColumn); 
    }
    
    // Définit la hauteur totale du conteneur de cours
    const totalGridHeight = totalDuration * STATE.minuteHeightPx;
    scheduleContainer.style.height = `${totalGridHeight}px`;
}

/**
 * Affiche les cours (STATE.courses) sur la grille.
 */
function renderSchedule() {
    STATE.dayColumnElements.forEach(col => col.innerHTML = '');

    STATE.courses.forEach(course => {
        const dayOfWeek = new Date(course.start_datetime).getUTCDay(); // 0=Dim, 1=Lun
        const dayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Convertit en 0=Lun, 6=Dim

        const startMinutes = parseTimeToMinutes(course.start_time_local);
        const endMinutes = parseTimeToMinutes(course.end_time_local);

        if (endMinutes <= STATE.gridStartMinutes || startMinutes >= STATE.gridEndMinutes) {
            return;
        }

        const duration = endMinutes - startMinutes;
        
        const top = (startMinutes - STATE.gridStartMinutes) * STATE.minuteHeightPx;
        const height = duration * STATE.minuteHeightPx;

        const courseEl = document.createElement('div');
        
        courseEl.className = `absolute left-0 right-0 p-1 border overflow-hidden ${getColorClass(course.subject_color)} ${getStatusClass(course.status)} flex flex-col items-center justify-center`; 
        courseEl.style.top = `${top}px`;
        courseEl.style.height = `${height}px`;

        // --- Contenu dynamique basé sur la hauteur ---
        let contentHtml = '';
        
        const statusText = (course.status === 'ACTIVE') ? '' : course.status_display;

        // [MODIFIÉ] Affiche la CLASSE au lieu du Professeur
        if (height > 45) {
            contentHtml = `
                <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                    <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                    <p class="text-xs truncate">${course.class_name}</p>
                    <p class="text-xs truncate"><i class="fas fa-door-open fa-fw mr-1 opacity-60"></i>${course.classroom_name}</p>
                </div>
                <p class="text-xs font-medium mt-auto flex-shrink-0">${statusText}</p>
            `;
        } 
        else if (height > 25) {
             contentHtml = `
                <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                    <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                    <p class="text-xs truncate">${course.class_name}</p>
                </div>
                <p class="text-xs font-medium mt-auto flex-shrink-0">${statusText}</p>
            `;
        }
        else {
             contentHtml = `
                <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                    <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                </div>
            `;
        }
        
        courseEl.innerHTML = contentHtml;
        // --- Fin de la modification ---
        
        courseEl.dataset.courseId = course.id;

        // [MODIFIÉ] Un cours est TOUJOURS cliquable (pour le prof ou l'admin)
        courseEl.classList.add('cursor-pointer', 'hover:shadow-lg', 'hover:opacity-100');
        courseEl.addEventListener('click', handleCourseClick);


        if (STATE.dayColumnElements[dayIndex]) {
            STATE.dayColumnElements[dayIndex].appendChild(courseEl);
        }
    });
}


// --- 4. Logique de Navigation ---

/**
 * Met à jour l'affichage de la semaine (titre) et les en-têtes des jours.
 */
function updateWeekView() {
    const start = STATE.currentMonday;

    weekDisplay.textContent = `Semaine du ${formatSimpleDate(start)}`;
    document.querySelector('p.text-sm.text-gray-500').textContent = `Semaine`;


    for (let i = 0; i < 7; i++) {
        const dayHeaderEl = document.getElementById(`day-header-${i}`);
        if (dayHeaderEl) {
            const currentDayDate = new Date(start.getTime());
            currentDayDate.setDate(start.getDate() + i);
            dayHeaderEl.textContent = formatDayHeader(currentDayDate);
        }
    }
    
    const yearStart = parseISODate(YEAR_START_DATE_ISO);
    const yearEnd = parseISODate(YEAR_END_DATE_ISO);

    prevWeekBtn.disabled = start <= yearStart;
    
    const nextWeekStart = new Date(start.getTime());
    nextWeekStart.setDate(start.getDate() + 7);
    nextWeekBtn.disabled = nextWeekStart > yearEnd;
    
    renderSchedule();
}

/**
 * Récupère les données d'une semaine depuis l'API.
 * @param {string} dateISO - Le Lundi de la semaine à charger (ex: "2025-11-03")
 */
async function fetchWeekData(dateISO) {
    prevWeekBtn.disabled = true;
    nextWeekBtn.disabled = true;
    weekDisplay.textContent = "Chargement...";
    
    // [MODIFIÉ] Appelle la nouvelle API et envoie 'staff_id'
    const result = await apiFetch(API_URLS.GET_WEEK, {
        start_date: dateISO,
        staff_id: STAFF_PK 
    });

    if (result.success) {
        STATE.courses = result.courses;
        STATE.currentMonday = parseISODate(dateISO); 
        updateWeekView(); 
    } else {
        updateWeekView();
    }
}

/**
 * Gère les clics sur les flèches de navigation.
 * @param {number} direction - (-7) pour précédent, (7) pour suivant.
 */
function handleNavigation(direction) {
    const newDate = new Date(STATE.currentMonday.getTime());
    newDate.setDate(newDate.getDate() + direction);
    fetchWeekData(formatDateToISO(newDate));
}


// --- 5. Logique d'Actions (Admin) ---

/**
 * Ouvre la modale lorsqu'un admin clique sur un cours.
 */
function handleCourseClick(e) {
    const courseEl = e.currentTarget;
    const courseId = parseInt(courseEl.dataset.courseId);
    
    const course = STATE.courses.find(c => c.id === courseId);
    if (!course) return;

    STATE.selectedCourseId = courseId; 

    // [MODIFIÉ] Affiche la Classe et la Salle
    modalCourseTitle.textContent = `${course.subject_name} (${course.start_time_local} - ${course.end_time_local})`;
    modalCourseDetails.textContent = `${course.class_name} / ${course.classroom_name}`;

    // [MODIFIÉ] Logique d'affichage des boutons
    if (IS_TEACHER_OWNER) {
        // Affiche les actions du Professeur
        teacherActions.style.display = 'block';
        adminActions.style.display = 'none';
        deleteSection.style.display = 'none';
        
        // Met en surbrillance le statut actuel pour le prof
        document.querySelectorAll('#teacher-actions .action-btn-teacher').forEach(btn => {
            const action = btn.dataset.action.replace('SET_', '');
            if (action === course.status) {
                btn.classList.add('ring-4', 'ring-offset-2', 'ring-indigo-500');
            } else {
                btn.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-500');
            }
        });

    } else if (IS_ADMIN_USER) {
        // Affiche les actions de l'Admin
        teacherActions.style.display = 'none';
        adminActions.style.display = 'block';
        deleteSection.style.display = 'block';

        // Met en surbrillance le statut actuel pour l'admin
        document.querySelectorAll('#admin-actions .action-btn-admin').forEach(btn => {
            const action = btn.dataset.action.replace('SET_', '');
            if (action === course.status) {
                btn.classList.add('ring-4', 'ring-offset-2', 'ring-indigo-500');
            } else {
                btn.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-500');
            }
        });
    } else {
        // Utilisateur non autorisé (ne devrait pas arriver si le clic est désactivé)
        return;
    }

    actionModal.classList.remove('opacity-0', 'pointer-events-none');
    actionModal.querySelector('div').classList.remove('translate-y-4');
}

/**
 * Ferme la modale d'action.
 */
function closeActionModal() {
    actionModal.classList.add('opacity-0', 'pointer-events-none');
    actionModal.querySelector('div').classList.add('translate-y-4');
    // N'efface pas selectedCourseId ici
}

/**
 * Ouvre la modale de confirmation générique.
 */
function openGenericConfirmModal(title, message, onConfirm) {
    genericConfirmTitle.textContent = title;
    genericConfirmMessage.innerHTML = message;
    STATE.onConfirmCallback = onConfirm; // Stocke la fonction

    genericConfirmModal.classList.remove('opacity-0', 'pointer-events-none');
    genericConfirmModal.querySelector('div').classList.remove('translate-y-4');
}

/**
 * Ferme la modale de confirmation générique.
 */
function closeGenericConfirmModal() {
    genericConfirmModal.classList.add('opacity-0', 'pointer-events-none');
    genericConfirmModal.querySelector('div').classList.add('translate-y-4');
    STATE.onConfirmCallback = null; // Nettoie le callback
    STATE.selectedCourseId = null; // Efface l'ID à la fin de l'action
}

/**
 * Fonction à exécuter lors de la confirmation de suppression
 */
async function executeDelete() {
    const courseId = STATE.selectedCourseId;
    if (!courseId) return; 

    const result = await apiFetch(API_URLS.MANAGE_STATUS, {
        course_id: courseId,
        action: 'DELETE'
    });

    if (result.success) {
        STATE.courses = STATE.courses.filter(c => c.id !== courseId);
        renderSchedule(); 
    }
}

/**
 * Gère le clic sur un bouton d'action dans la modale (ex: Annuler, Supprimer).
 */
async function handleActionClick(e) {
    const action = e.currentTarget.dataset.action;
    const courseId = STATE.selectedCourseId;

    if (!action || !courseId) return;
    
    if (action === 'DELETE') {
        openGenericConfirmModal(
            "Confirmation de Suppression",
            "Êtes-vous sûr de vouloir supprimer ce cours ?<br>Cette action est irréversible.",
            executeDelete // Passe la fonction à exécuter
        );
        closeActionModal(); 
        return;
    }

    // Gère les autres actions (changement de statut ET placeholders)
    const result = await apiFetch(API_URLS.MANAGE_STATUS, {
        course_id: courseId,
        action: action
    });

    if (result.success) {
        if (action !== 'DELETE' && action !== "Faire l'appel" && action !== "Mettre des notes") {
            const courseToUpdate = STATE.courses.find(c => c.id === courseId);
            if (courseToUpdate) {
                courseToUpdate.status = result.new_status_key;
                courseToUpdate.status_display = result.new_status;
            }
        }
        renderSchedule(); 
    }
    
    // L'action est finie, on ferme la modale ET on efface l'ID
    closeActionModal();
    STATE.selectedCourseId = null;
}


// --- 6. Initialisation ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Parse les données JSON
    try {
        STATE.courses = JSON.parse(document.getElementById('courses_data').textContent);
        STATE.exceptionTimes = JSON.parse(document.getElementById('exception_times_data').textContent);
    } catch (e) {
        console.error("Erreur de parsing JSON initial:", e);
        showNotification("Erreur critique: Impossible de lire les données du planning.", 'error');
        return;
    }

    // 2. Initialise la date de la semaine (localement et sans risque)
    STATE.currentMonday = parseISODate(currentWeekStartDateISO); 

    // 3. Dessine la grille de fond (heures, lignes, pauses)
    drawGridBackground();
    
    // 4. Affiche les cours et met à jour les boutons de nav
    updateWeekView();

    // 5. Ajoute les écouteurs d'événements
    prevWeekBtn.addEventListener('click', () => handleNavigation(-7));
    nextWeekBtn.addEventListener('click', () => handleNavigation(7));
    
    // [MODIFIÉ] Écouteurs pour la modale (Admin ET Prof)
    // On attache aux deux sets de boutons
    modalCancelBtn.addEventListener('click', () => {
        closeActionModal();
        STATE.selectedCourseId = null; // Efface l'ID si on annule
    });
    document.querySelectorAll('#action-modal .action-btn-teacher, #action-modal .action-btn-admin').forEach(btn => {
        btn.addEventListener('click', handleActionClick);
    });
    
    // Écouteur pour la modale de confirmation (inchangé)
    genericConfirmCancelBtn.addEventListener('click', closeGenericConfirmModal);
    genericConfirmConfirmBtn.addEventListener('click', () => {
        if (typeof STATE.onConfirmCallback === 'function') {
            STATE.onConfirmCallback();
        }
        closeGenericConfirmModal();
    });
});