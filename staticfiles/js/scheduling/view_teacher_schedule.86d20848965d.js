// ====================================================================
// LOGIQUE JAVASCRIPT POUR l'AFFICHAGE DU PLANNING PROFESSEUR
// VERSION SÉCURISÉE (CSP Compliant)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 0. CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('schedule-viewer-container');
    const csrfInput = document.getElementById('csrf-token');

    if (!container) {
        console.error("Erreur : Conteneur #schedule-viewer-container introuvable.");
        return;
    }

    // Récupération de la configuration depuis les data-attributes
    const CONFIG = {
        staffPk: container.dataset.staffPk,
        isAdmin: container.dataset.isAdmin === 'true',
        isTeacherOwner: container.dataset.isTeacherOwner === 'true',
        yearMinTime: container.dataset.yearMinTime,
        yearMaxTime: container.dataset.yearMaxTime,
        yearStartDateIso: container.dataset.yearStartDate,
        yearEndDateIso: container.dataset.yearEndDate,
        currentWeekStartIso: container.dataset.currentWeekStart,
        urls: {
            getWeek: container.dataset.apiGetWeek,
            manageStatus: container.dataset.apiManageStatus
        },
        csrfToken: csrfInput ? csrfInput.value : ''
    };

    // État global
    const STATE = {
        courses: [], 
        exceptionTimes: [],
        currentMonday: null, 
        gridStartMinutes: 0, 
        gridEndMinutes: 0, 
        minuteHeightPx: 1.0, 
        selectedCourseId: null, 
        dayColumnElements: [], 
        onConfirmCallback: null, 
    };

    // --- 1. Récupération des Éléments du DOM ---
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const weekDisplay = document.getElementById('week-display');
    const scheduleTimesColumn = document.getElementById('schedule-times-column');
    const scheduleGridBackground = document.getElementById('schedule-grid-background');
    const scheduleCoursesContainer = document.getElementById('schedule-courses-container');
    const scheduleContainer = document.getElementById('schedule-container');
    const btnBack = document.getElementById('btn-back');

    // Modale d'action
    const actionModal = document.getElementById('action-modal');
    const modalCourseTitle = document.getElementById('modal-course-title');
    const modalCourseDetails = document.getElementById('modal-course-details');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    
    // Conteneurs d'action spécifiques (Teacher vs Admin)
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

    function parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + (minutes || 0);
    }

    function showNotification(message, type) {
        const notificationArea = document.querySelector('.max-w-7xl.mx-auto'); 
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
        }, 12000); 
    }

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
        return colorMap[colorName] || 'bg-gray-100 border-gray-400 text-gray-800';
    }

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

    function formatDateToISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseISODate(isoDate) {
        return new Date(`${isoDate}T00:00:00`);
    }

    function formatSimpleDate(date) {
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function formatDayHeader(date) {
        const day = date.toLocaleDateString('fr-FR', { weekday: 'short' }); 
        const dayNum = String(date.getDate()).padStart(2, '0');
        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
        const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
        return `${dayCapitalized} ${dayNum}/${monthNum}`;
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

    function drawGridBackground() {
        scheduleTimesColumn.innerHTML = '';
        scheduleGridBackground.innerHTML = '';
        scheduleCoursesContainer.innerHTML = ''; 
        STATE.dayColumnElements = []; 

        STATE.gridStartMinutes = parseTimeToMinutes(CONFIG.yearMinTime);
        STATE.gridEndMinutes = parseTimeToMinutes(CONFIG.yearMaxTime);
        const totalDuration = STATE.gridEndMinutes - STATE.gridStartMinutes;
        const slotDuration = 30; 
        const totalSlots = totalDuration / slotDuration;
        const slotHeight = slotDuration * STATE.minuteHeightPx;

        const exceptionSlots = new Set();
        if(STATE.exceptionTimes) {
            STATE.exceptionTimes.forEach(ex => {
                const exStart = parseTimeToMinutes(ex.start_time);
                const exEnd = parseTimeToMinutes(ex.end_time);
                for (let t = STATE.gridStartMinutes; t < STATE.gridEndMinutes; t += slotDuration) {
                    if (t < exEnd && (t + slotDuration) > exStart) {
                        exceptionSlots.add(t);
                    }
                }
            });
        }

        for (let i = 0; i < totalSlots; i++) {
            const slotTimeInMinutes = STATE.gridStartMinutes + (i * slotDuration);
            const hour = Math.floor(slotTimeInMinutes / 60);
            const minutes = slotTimeInMinutes % 60;
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'text-center text-xs font-semibold text-gray-500 border-b border-r border-gray-200';
            timeLabel.style.height = `${slotHeight}px`;
            
            if(minutes === 0) {
                timeLabel.textContent = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            scheduleTimesColumn.appendChild(timeLabel);

            for (let j = 0; j < 7; j++) {
                const cell = document.createElement('div');
                let cellClass = 'border-b border-gray-200';
                if (j < 6) cellClass += ' border-r'; 
                cell.className = cellClass;
                cell.style.height = `${slotHeight}px`;
                scheduleGridBackground.appendChild(cell);
            }
        }

        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'relative'; 
            if (i < 6) dayColumn.classList.add('border-r', 'border-gray-200');
            scheduleCoursesContainer.appendChild(dayColumn);
            STATE.dayColumnElements.push(dayColumn); 
        }
        
        const totalGridHeight = totalDuration * STATE.minuteHeightPx;
        scheduleContainer.style.height = `${totalGridHeight}px`;
    }

    function renderSchedule() {
        STATE.dayColumnElements.forEach(col => col.innerHTML = '');

        STATE.courses.forEach(course => {
            const dayOfWeek = new Date(course.start_datetime).getUTCDay(); 
            const dayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; 

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

            let contentHtml = '';
            const statusText = (course.status === 'ACTIVE') ? '' : course.status_display;

            if (height > 45) {
                contentHtml = `
                    <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                        <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                        <p class="text-xs truncate">${course.class_name}</p>
                        <p class="text-xs truncate"><i class="fas fa-door-open fa-fw mr-1 opacity-60"></i>${course.classroom_name}</p>
                    </div>
                    <p class="text-xs font-medium mt-auto flex-shrink-0">${statusText}</p>
                `;
            } else if (height > 25) {
                 contentHtml = `
                    <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                        <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                        <p class="text-xs truncate">${course.class_name}</p>
                    </div>
                    <p class="text-xs font-medium mt-auto flex-shrink-0">${statusText}</p>
                `;
            } else {
                 contentHtml = `
                    <div class="flex-grow flex flex-col items-center justify-center w-full overflow-hidden text-center">
                        <strong class="text-xs font-bold truncate">${course.subject_name}</strong>
                    </div>
                `;
            }
            
            courseEl.innerHTML = contentHtml;
            courseEl.dataset.courseId = course.id;

            // Rendre le cours cliquable pour l'Admin OU le Professeur propriétaire
            if (CONFIG.isAdmin || CONFIG.isTeacherOwner) {
                courseEl.classList.add('cursor-pointer', 'hover:shadow-lg', 'hover:opacity-100');
                courseEl.addEventListener('click', handleCourseClick);
            }

            if (STATE.dayColumnElements[dayIndex]) {
                STATE.dayColumnElements[dayIndex].appendChild(courseEl);
            }
        });
    }


    // --- 4. Logique de Navigation ---

    function updateWeekView() {
        const start = STATE.currentMonday;

        weekDisplay.textContent = `Semaine du ${formatSimpleDate(start)}`;
        const weekSubEl = document.querySelector('p.text-sm.text-gray-500');
        if(weekSubEl) weekSubEl.textContent = `Semaine`;

        for (let i = 0; i < 7; i++) {
            const dayHeaderEl = document.getElementById(`day-header-${i}`);
            if (dayHeaderEl) {
                const currentDayDate = new Date(start.getTime());
                currentDayDate.setDate(start.getDate() + i);
                dayHeaderEl.textContent = formatDayHeader(currentDayDate);
            }
        }
        
        const yearStart = parseISODate(CONFIG.yearStartDateIso);
        const yearEnd = parseISODate(CONFIG.yearEndDateIso);

        if(prevWeekBtn) prevWeekBtn.disabled = start <= yearStart;
        
        const nextWeekStart = new Date(start.getTime());
        nextWeekStart.setDate(start.getDate() + 7);
        if(nextWeekBtn) nextWeekBtn.disabled = nextWeekStart > yearEnd;
        
        renderSchedule();
    }

    async function fetchWeekData(dateISO) {
        if(prevWeekBtn) prevWeekBtn.disabled = true;
        if(nextWeekBtn) nextWeekBtn.disabled = true;
        weekDisplay.textContent = "Chargement...";
        
        // Appel API avec l'ID du professeur (Staff PK)
        const result = await apiFetch(CONFIG.urls.getWeek, {
            start_date: dateISO,
            staff_id: CONFIG.staffPk 
        });

        if (result.success) {
            STATE.courses = result.courses;
            STATE.currentMonday = parseISODate(dateISO); 
            updateWeekView(); 
        } else {
            updateWeekView();
        }
    }

    function handleNavigation(direction) {
        const newDate = new Date(STATE.currentMonday.getTime());
        newDate.setDate(newDate.getDate() + direction);
        fetchWeekData(formatDateToISO(newDate));
    }


    // --- 5. Logique d'Actions (Admin & Prof) ---

    function handleCourseClick(e) {
        const courseEl = e.currentTarget;
        const courseId = parseInt(courseEl.dataset.courseId);
        
        const course = STATE.courses.find(c => c.id === courseId);
        if (!course) return;

        STATE.selectedCourseId = courseId; 

        modalCourseTitle.textContent = `${course.subject_name} (${course.start_time_local} - ${course.end_time_local})`;
        modalCourseDetails.textContent = `${course.class_name} / ${course.classroom_name}`;

        // Affichage conditionnel des actions selon le rôle
        if (CONFIG.isTeacherOwner) {
            // Vue Professeur
            teacherActions.style.display = 'block';
            adminActions.style.display = 'none';
            deleteSection.style.display = 'none';
            
            // Highlight du statut actuel
            document.querySelectorAll('#teacher-actions .action-btn-teacher').forEach(btn => {
                const action = btn.dataset.action.replace('SET_', '');
                if (action === course.status) {
                    btn.classList.add('ring-4', 'ring-offset-2', 'ring-indigo-500');
                } else {
                    btn.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-500');
                }
            });

        } else if (CONFIG.isAdmin) {
            // Vue Admin
            teacherActions.style.display = 'none';
            adminActions.style.display = 'block';
            deleteSection.style.display = 'block';

            // Highlight du statut actuel
            document.querySelectorAll('#admin-actions .action-btn-admin').forEach(btn => {
                const action = btn.dataset.action.replace('SET_', '');
                if (action === course.status) {
                    btn.classList.add('ring-4', 'ring-offset-2', 'ring-indigo-500');
                } else {
                    btn.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-500');
                }
            });
        } else {
            return;
        }

        actionModal.classList.remove('opacity-0', 'pointer-events-none');
        actionModal.querySelector('div').classList.remove('translate-y-4');
    }

    function closeActionModal() {
        actionModal.classList.add('opacity-0', 'pointer-events-none');
        actionModal.querySelector('div').classList.add('translate-y-4');
    }

    function openGenericConfirmModal(title, message, onConfirm) {
        genericConfirmTitle.textContent = title;
        genericConfirmMessage.innerHTML = message;
        STATE.onConfirmCallback = onConfirm; 

        genericConfirmModal.classList.remove('opacity-0', 'pointer-events-none');
        genericConfirmModal.querySelector('div').classList.remove('translate-y-4');
    }

    function closeGenericConfirmModal() {
        genericConfirmModal.classList.add('opacity-0', 'pointer-events-none');
        genericConfirmModal.querySelector('div').classList.add('translate-y-4');
        STATE.onConfirmCallback = null; 
        STATE.selectedCourseId = null; 
    }

    async function executeDelete() {
        const courseId = STATE.selectedCourseId;
        if (!courseId) return; 

        const result = await apiFetch(CONFIG.urls.manageStatus, {
            course_id: courseId,
            action: 'DELETE'
        });

        if (result.success) {
            STATE.courses = STATE.courses.filter(c => c.id !== courseId);
            renderSchedule(); 
        }
    }

    async function handleActionClick(e) {
        const action = e.currentTarget.dataset.action;
        const courseId = STATE.selectedCourseId;

        if (!action || !courseId) return;
        
        if (action === 'DELETE') {
            openGenericConfirmModal(
                "Confirmation de Suppression",
                "Êtes-vous sûr de vouloir supprimer ce cours ?<br>Cette action est irréversible.",
                executeDelete 
            );
            closeActionModal(); 
            return;
        }

        const result = await apiFetch(CONFIG.urls.manageStatus, {
            course_id: courseId,
            action: action
        });

        if (result.success) {
            if (action !== 'DELETE') {
                const courseToUpdate = STATE.courses.find(c => c.id === courseId);
                if (courseToUpdate) {
                    courseToUpdate.status = result.new_status_key;
                    courseToUpdate.status_display = result.new_status;
                }
            }
            renderSchedule(); 
        }
        
        closeActionModal();
        STATE.selectedCourseId = null;
    }


    // --- 6. Initialisation ---

    try {
        const coursesEl = document.getElementById('courses_data');
        const exceptionsEl = document.getElementById('exception_times_data');
        if(coursesEl) STATE.courses = JSON.parse(coursesEl.textContent);
        if(exceptionsEl) STATE.exceptionTimes = JSON.parse(exceptionsEl.textContent);
    } catch (e) {
        console.error("Erreur de parsing JSON initial:", e);
        showNotification("Erreur critique: Impossible de lire les données du planning.", 'error');
        return;
    }

    // Initialisation affichage
    STATE.currentMonday = parseISODate(CONFIG.currentWeekStartIso); 
    drawGridBackground();
    updateWeekView();

    // Event Listeners Navigation
    if(prevWeekBtn) prevWeekBtn.addEventListener('click', () => handleNavigation(-7));
    if(nextWeekBtn) nextWeekBtn.addEventListener('click', () => handleNavigation(7));
    
    // Back button
    if(btnBack) {
        btnBack.addEventListener('click', (e) => {
            e.preventDefault();
            history.back();
        });
    }

    // Écouteurs pour la modale (Admin OU Prof)
    if (CONFIG.isAdmin || CONFIG.isTeacherOwner) {
        if(modalCancelBtn) {
            modalCancelBtn.addEventListener('click', () => {
                closeActionModal();
                STATE.selectedCourseId = null; 
            });
        }
        // Attache les événements aux boutons admin ET prof
        document.querySelectorAll('#action-modal .action-btn-teacher, #action-modal .action-btn-admin').forEach(btn => {
            btn.addEventListener('click', handleActionClick);
        });
        
        if(genericConfirmCancelBtn) genericConfirmCancelBtn.addEventListener('click', closeGenericConfirmModal);
        if(genericConfirmConfirmBtn) genericConfirmConfirmBtn.addEventListener('click', () => {
            if (typeof STATE.onConfirmCallback === 'function') {
                STATE.onConfirmCallback();
            }
            closeGenericConfirmModal();
        });
    }
});