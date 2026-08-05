/**
 * class_assignment.js
 * Gestion de l'affectation des élèves et professeurs (Mode Production Safe, Multilingue & RTL)
 */

document.addEventListener('DOMContentLoaded', function() {

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            history.back();
        });
    }
    
    // --- 1. Initialisation & Configuration (Extraction depuis le DOM) ---
    
    const container = document.getElementById('assignment-container');
    
    if (!container) {
        console.error("Erreur critique : Le conteneur #assignment-container est introuvable.");
        return;
    }

    const API_URL = container.dataset.apiUrl;
    const CLASS_PK = container.dataset.classPk;

    // Récupération des traductions dynamiques (data-attributes)
    const msgSelectPrompt = container.getAttribute('data-msg-select') || "-- Sélectionnez --";
    const msgNoStudents = container.getAttribute('data-msg-no-students') || "Aucun élève affecté.";
    const msgNoTeachers = container.getAttribute('data-msg-no-teachers') || "Aucun professeur affecté.";
    const msgDelegateYes = container.getAttribute('data-msg-delegate-yes') || "Délégué";
    const msgDelegateNo = container.getAttribute('data-msg-delegate-no') || "Non Délégué";
    const msgPrincipalYes = container.getAttribute('data-msg-principal-yes') || "Principal";
    const msgPrincipalNo = container.getAttribute('data-msg-principal-no') || "Non Principal";
    const msgUnlinkConfirmFormat = container.getAttribute('data-msg-unlink-confirm') || "Retirer {name} de cette classe ?";
    const msgCritiqueError = container.getAttribute('data-msg-critique-error') || "Une erreur est survenue.";

    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    if (!API_URL || !CSRF_TOKEN) {
        console.error("Configuration manquante : API_URL ou CSRF_TOKEN introuvable.");
    }

    // --- 2. Récupération des données JSON injectées ---
    
    function getInitialData(id) {
        const scriptTag = document.getElementById(id);
        if (scriptTag) {
            try {
                const rawJson = scriptTag.textContent.trim();
                if (!rawJson || rawJson.length < 2 || rawJson === '[]') return []; 
                
                let contentToParse = rawJson;
                if (contentToParse.startsWith('"') && contentToParse.endsWith('"')) {
                    contentToParse = JSON.parse(contentToParse);
                }
                return JSON.parse(contentToParse);
            } catch (e) {
                console.error(`Erreur de parsage pour ${id}:`, e);
                return [];
            }
        }
        return [];
    }

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

    let pendingAction = null;


    // --- 3. Fonctions d'Utilité ---

    function showNotification(message, isSuccess) {
        const alertClass = isSuccess 
            ? 'bg-green-100 text-green-800 border-green-400' 
            : 'bg-red-100 text-red-800 border-red-400';
        
        const notification = document.createElement('div');
        notification.className = `p-4 rounded-xl shadow-md border ${alertClass} transition-opacity duration-500 ease-in-out opacity-0`;
        notification.innerHTML = `<p class="font-medium" dir="auto">${message}</p>`;

        notificationArea.prepend(notification);
        
        requestAnimationFrame(() => {
            notification.classList.remove('opacity-0');
        });

        setTimeout(() => {
            notification.classList.add('opacity-0');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 5000);
    }

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
                throw new Error(result.message || `Erreur HTTP ${response.status}`);
            }

            return result;

        } catch (error) {
            showNotification(error.message, false);
            console.error("Erreur API:", error);
            return { success: false, message: error.message };
        }
    }


    // --- 4. Logique du Modal ---

    function showConfirmationModal(actionDetails, message) {
        modalMessage.textContent = message;
        pendingAction = actionDetails;
        
        modal.classList.remove('opacity-0', 'pointer-events-none');
        const modalContent = modal.querySelector('div');
        if(modalContent) modalContent.classList.remove('translate-y-4');
    }

    function hideConfirmationModal() {
        const modalContent = modal.querySelector('div');
        if(modalContent) modalContent.classList.add('translate-y-4');
        
        setTimeout(() => {
            modal.classList.add('opacity-0', 'pointer-events-none');
            pendingAction = null;
        }, 300);
    }

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
            
            if (action === 'unlink_student') {
                const unlinkedIndex = assignedStudents.findIndex(s => s.pk == assignment_pk);
                if (unlinkedIndex > -1) {
                    const unlinkedStudent = assignedStudents.splice(unlinkedIndex, 1)[0];
                    const studentId = unlinkedStudent.student_id;
                    const isAlreadyAvailable = availableStudents.some(s => s.pk == studentId);
                    
                    if (!isAlreadyAvailable) {
                        availableStudents.push({
                            pk: studentId,
                            user__first_name: unlinkedStudent.student__user__first_name,
                            user__last_name: unlinkedStudent.student__user__last_name,
                            user__username: unlinkedStudent.student__user__username,
                        });
                        availableStudents.sort((a, b) => (a.user__last_name > b.user__last_name) ? 1 : -1);
                    }
                }
            } else if (action === 'unlink_teacher') {
                const unlinkedIndex = assignedTeachers.findIndex(t => t.pk == assignment_pk);
                if (unlinkedIndex > -1) {
                    const unlinkedTeacher = assignedTeachers.splice(unlinkedIndex, 1)[0];
                    const tsId = unlinkedTeacher.teacher_id;
                    const isAlreadyAvailable = availableTeachers.some(t => t.pk == tsId);
                    
                    if (!isAlreadyAvailable) {
                        availableTeachers.push({
                            pk: tsId,
                            subject__name: unlinkedTeacher.teacher__subject__name,
                            teacher__user__first_name: unlinkedTeacher.teacher__teacher__user__first_name,
                            teacher__user__last_name: unlinkedTeacher.teacher__teacher__user__last_name,
                        });
                        availableTeachers.sort((a, b) => (a.teacher__user__last_name > b.teacher__user__last_name) ? 1 : -1);
                    }
                }
            }
            renderAllLists(); 
        }
    }


    // --- 5. Fonctions de Rendu (DOM Generation) ---

    function renderAssignedStudent(student) {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-indigo-100';
        item.id = `student-link-${student.pk}`;
        
        const name = `${student.student__user__last_name} ${student.student__user__first_name}`;
        const username = student.student__user__username;

        // Séparateur logique avec gap-3
        item.innerHTML = `
            <div class="flex-grow min-w-0">
                <p class="font-medium text-gray-800 truncate" dir="auto">${escapeHtml(name)}</p>
                <p class="text-sm text-gray-500 truncate" dir="ltr">@${escapeHtml(username)}</p>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <label class="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" 
                           data-action="set_delegate"
                           data-assignment-pk="${student.pk}"
                           ${student.is_delegate ? 'checked' : ''} 
                           class="sr-only peer delegate-toggle">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span class="ms-3 text-sm font-medium text-gray-900 delegate-label">${student.is_delegate ? msgDelegateYes : msgDelegateNo}</span>
                </label>
                <button data-action="unlink_student" 
                        data-assignment-pk="${student.pk}"
                        data-name="${escapeHtml(name)} (@${escapeHtml(username)})"
                        class="unlink-btn text-red-500 hover:text-red-700 transition duration-150 p-2 rounded-full hover:bg-red-50 inline-flex items-center justify-center" title="Retirer">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        return item;
    }

    function renderAssignedTeacher(teacher) {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-teal-100';
        item.id = `teacher-link-${teacher.pk}`;

        const name = `${teacher.teacher__teacher__user__last_name} ${teacher.teacher__teacher__user__first_name}`;
        const subjectName = teacher.teacher__subject__name;

        // Séparateur logique avec gap-3
        item.innerHTML = `
            <div class="flex-grow min-w-0">
                <p class="font-medium text-gray-800 truncate" dir="auto">${escapeHtml(name)}</p>
                <p class="text-sm text-teal-600 font-semibold truncate" dir="auto">${escapeHtml(subjectName)}</p>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <label class="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" 
                           data-action="set_main_teacher"
                           data-assignment-pk="${teacher.pk}"
                           ${teacher.is_main_teacher ? 'checked' : ''} 
                           class="sr-only peer main-teacher-toggle">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    <span class="ms-3 text-sm font-medium text-gray-900 principal-label">${teacher.is_main_teacher ? msgPrincipalYes : msgPrincipalNo}</span>
                </label>
                <button data-action="unlink_teacher" 
                        data-assignment-pk="${teacher.pk}"
                        data-name="${escapeHtml(name)} (${escapeHtml(subjectName)})"
                        class="unlink-btn text-red-500 hover:text-red-700 transition duration-150 p-2 rounded-full hover:bg-red-50 inline-flex items-center justify-center" title="Retirer">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        return item;
    }

    function updateAvailableStudentsSelect() {
        studentSelect.innerHTML = `<option value="" disabled selected>${msgSelectPrompt}</option>`;
        availableStudents.forEach(student => {
            const option = document.createElement('option');
            option.value = student.pk;
            option.textContent = `${student.user__last_name} ${student.user__first_name} (${student.user__username})`;
            studentSelect.appendChild(option);
        });
        studentSelect.disabled = availableStudents.length === 0;
        addStudentBtn.disabled = !studentSelect.value || availableStudents.length === 0;
    }

    function updateAvailableTeachersSelect() {
        teacherSelect.innerHTML = `<option value="" disabled selected>${msgSelectPrompt}</option>`;
        availableTeachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.pk;
            option.textContent = `${teacher.teacher__user__last_name} ${teacher.teacher__user__first_name} (${teacher.subject__name})`;
            teacherSelect.appendChild(option);
        });
        teacherSelect.disabled = availableTeachers.length === 0;
        addTeacherBtn.disabled = !teacherSelect.value || availableTeachers.length === 0;
    }

    function renderAllLists() {
        assignedStudentsList.innerHTML = '';
        if (assignedStudents.length === 0) {
             assignedStudentsList.innerHTML = `<p class="text-center p-4 text-gray-500 italic" dir="auto">${msgNoStudents}</p>`;
        } else {
            assignedStudents.forEach(s => assignedStudentsList.appendChild(renderAssignedStudent(s)));
        }

        assignedTeachersList.innerHTML = '';
        if (assignedTeachers.length === 0) {
             assignedTeachersList.innerHTML = `<p class="text-center p-4 text-gray-500 italic" dir="auto">${msgNoTeachers}</p>`;
        } else {
            assignedTeachers.forEach(t => assignedTeachersList.appendChild(renderAssignedTeacher(t)));
        }

        updateAvailableStudentsSelect();
        updateAvailableTeachersSelect();
    }


    // --- 6. Gestionnaires d'Événements ---

    async function handleAddStudent() {
        const student_id = studentSelect.value;
        if (!student_id) return;
        
        addStudentBtn.disabled = true;
        const data = { action: 'link_student', student_id: student_id };
        const result = await sendApiRequest(data);

        if (result.success) {
            showNotification(result.message, true);
            
            const addedIndex = availableStudents.findIndex(s => s.pk == student_id);
            if(addedIndex > -1) {
                const addedStudent = availableStudents.splice(addedIndex, 1)[0];
                assignedStudents.push({
                    pk: result.assignment_pk,
                    student_id: addedStudent.pk,
                    is_delegate: false,
                    student__user__first_name: addedStudent.user__first_name,
                    student__user__last_name: addedStudent.user__last_name,
                    student__user__username: addedStudent.user__username,
                });
                assignedStudents.sort((a, b) => (a.student__user__last_name > b.student__user__last_name) ? 1 : -1);
            }
            studentSelect.value = '';
            renderAllLists(); 
        } else {
            addStudentBtn.disabled = false;
        }
    }

    async function handleAddTeacher() {
        const teacher_subject_id = teacherSelect.value;
        if (!teacher_subject_id) return;
        
        addTeacherBtn.disabled = true;
        const data = { action: 'link_teacher', teacher_subject_id: teacher_subject_id };
        const result = await sendApiRequest(data);

        if (result.success) {
            showNotification(result.message, true);
            
            const addedIndex = availableTeachers.findIndex(t => t.pk == teacher_subject_id);
            if(addedIndex > -1) {
                const addedTeacher = availableTeachers.splice(addedIndex, 1)[0];
                assignedTeachers.push({
                    pk: result.assignment_pk,
                    teacher_id: addedTeacher.pk,
                    is_main_teacher: false,
                    teacher__subject__name: addedTeacher.subject__name,
                    teacher__teacher__user__first_name: addedTeacher.teacher__user__first_name,
                    teacher__teacher__user__last_name: addedTeacher.teacher__user__last_name,
                });
                assignedTeachers.sort((a, b) => (a.teacher__subject__name > b.teacher__subject__name) ? 1 : -1);
            }
            teacherSelect.value = '';
            renderAllLists(); 
        } else {
             addTeacherBtn.disabled = false;
        }
    }

    async function handleAssignedListClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const assignment_pk = target.dataset.assignmentPk;

        if (action.startsWith('unlink_')) {
            const entityName = target.dataset.name;
            const message = msgUnlinkConfirmFormat.replace('{name}', entityName);
            showConfirmationModal({ action, assignment_pk }, message);

        } else if (action === 'set_delegate' || action === 'set_main_teacher') {
            const is_checked = target.checked;
            const data = {
                action: action,
                assignment_pk: assignment_pk,
                is_delegate: is_checked, 
                is_main_teacher: is_checked, 
            };
            const initial_state = !is_checked;

            const result = await sendApiRequest(data);
            
            if (result.success) {
                showNotification(result.message, true);
                if (action === 'set_delegate') {
                    const student = assignedStudents.find(s => s.pk == assignment_pk);
                    if (student) student.is_delegate = is_checked;
                    const label = target.closest('label').querySelector('.delegate-label');
                    if (label) label.textContent = is_checked ? msgDelegateYes : msgDelegateNo;

                } else if (action === 'set_main_teacher') {
                    assignedTeachers.forEach(t => t.is_main_teacher = (t.pk == assignment_pk && is_checked));
                    renderAllLists(); 
                }
            } else {
                target.checked = initial_state;
            }
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- 7. Lancement ---
    renderAllLists();
    
    if(studentSelect) studentSelect.addEventListener('change', () => addStudentBtn.disabled = !studentSelect.value);
    if(addStudentBtn) addStudentBtn.addEventListener('click', handleAddStudent);
    
    if(teacherSelect) teacherSelect.addEventListener('change', () => addTeacherBtn.disabled = !teacherSelect.value);
    if(addTeacherBtn) addTeacherBtn.addEventListener('click', handleAddTeacher);
    
    if(assignedStudentsList) assignedStudentsList.addEventListener('click', handleAssignedListClick);
    if(assignedTeachersList) assignedTeachersList.addEventListener('click', handleAssignedListClick);
    
    if(modalCancelBtn) modalCancelBtn.addEventListener('click', hideConfirmationModal);
    if(modalConfirmBtn) modalConfirmBtn.addEventListener('click', () => {
        hideConfirmationModal();
        executePendingUnlink();
    });
    if(modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) hideConfirmationModal();
    });

});