// Logique d'interaction pour la page d'attribution des matières
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Récupération des éléments du DOM et des données passées par Django
    const subjectsDataEl = document.getElementById('subjects-data');
    const linksDataEl = document.getElementById('links-data');
    const statusMessageEl = document.getElementById('status-message');
    const subjectLegendEl = document.getElementById('subject-legend');
    
    // Récupération de l'URL API
    const API_TOGGLE_URL = subjectsDataEl.dataset.apiUrl; 

    // Récupération des traductions depuis le HTML
    const msgErrorInit = subjectsDataEl.dataset.msgErrorInit;
    const msgLinking = subjectsDataEl.dataset.msgLinking;
    const msgUnlinking = subjectsDataEl.dataset.msgUnlinking;
    const msgErrorServer = subjectsDataEl.dataset.msgErrorServer;
    const msgErrorNetwork = subjectsDataEl.dataset.msgErrorNetwork;

    let subjectsData = [];
    let linksData = {};

    try {
        subjectsData = JSON.parse(subjectsDataEl.dataset.subjects || '[]');
        linksData = JSON.parse(linksDataEl.dataset.links || '{}');
    } catch (e) {
        console.error("Erreur critique lors du parsing des données :", e);
        displayStatusMessage(msgErrorInit, false);
        return; 
    }
    
    // Sécurité CSRF pour les requêtes POST
    const csrftokenInput = document.getElementById('csrf-token');
    const csrftoken = csrftokenInput ? csrftokenInput.value : '';

    /**
     * Affiche un message de statut à l'utilisateur.
     */
    const displayStatusMessage = (message, isSuccess) => {
        statusMessageEl.textContent = message;
        statusMessageEl.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-accent-green/10', 'text-accent-green');
        
        if (isSuccess) {
            statusMessageEl.classList.add('bg-accent-green/10', 'text-accent-green', 'border', 'border-accent-green/30');
            statusMessageEl.classList.remove('bg-red-100', 'text-red-800');
        } else {
            statusMessageEl.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-400');
            statusMessageEl.classList.remove('bg-accent-green/10', 'text-accent-green');
        }
        
        statusMessageEl.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessageEl.classList.add('hidden');
        }, 4000);
    };
    
    /**
     * Crée la pastille HTML d'une matière.
     */
    const createSubjectTag = (subject, isAssigned, teacherId, isLegend = false) => {
        const tag = document.createElement('span');
        tag.dataset.subjectId = subject.id;
        tag.dataset.subjectName = subject.name;
        tag.dataset.teacherId = teacherId || ''; 

        let classes = [
            'px-3', 'py-1', 'rounded-full', 'select-none', 
            'transition', 'duration-150', 'ease-in-out', 'whitespace-nowrap'
        ];

        if (isLegend) {
            tag.textContent = subject.name;
            classes.push('text-xs', 'font-normal', 'shadow-sm', 'bg-gray-200', 'text-gray-800');
            tag.style.cursor = 'default';
        } 
        else {
            classes.push('cursor-pointer', 'shadow-sm', 'text-sm', 'font-medium');

            if (isAssigned) {
                tag.textContent = subject.name;
                classes.push(
                    'bg-white', 
                    'text-gray-900', 
                    'border', 
                    'border-gray-400', 
                    'hover:bg-gray-100', 
                    'font-semibold'
                );                
                tag.dataset.action = 'unlink';
                tag.addEventListener('click', (e) => handleAssignmentToggle(teacherId, subject.id, subject.name, 'unlink', e.currentTarget));
            } else {
                tag.textContent = `+ ${subject.name}`;
                classes.push('bg-gray-50', 'text-gray-400', 'border', 'border-dashed', 'border-gray-300', 'hover:bg-primary-light', 'hover:border-primary-blue', 'text-xs');
                tag.dataset.action = 'link';
                tag.addEventListener('click', (e) => handleAssignmentToggle(teacherId, subject.id, subject.name, 'link', e.currentTarget));
            }
        }
        
        tag.className = classes.join(' ');
        return tag;
    };

    /**
     * Gère le clic sur une pastille de matière pour attribuer/retirer via l'API.
     */
    const handleAssignmentToggle = async (teacherId, subjectId, subjectName, action, tagElement) => {
        const originalText = tagElement.textContent; 
        const originalClasses = tagElement.className; 
        const isLinking = action === 'link';

        // Utilisation des messages traduits
        tagElement.textContent = isLinking ? msgLinking : msgUnlinking;
        tagElement.classList.add('opacity-50', 'pointer-events-none'); 
        tagElement.classList.remove('hover:bg-indigo-700', 'hover:border-primary-blue'); 

        try {
            if (!API_TOGGLE_URL) throw new Error("URL de l'API introuvable dans le DOM.");

            const response = await fetch(API_TOGGLE_URL, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken 
                },
                body: JSON.stringify({
                    teacher_id: teacherId,
                    subject_id: subjectId,
                    action: action
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || msgErrorServer);
            }

            // --- Succès ---
            displayStatusMessage(result.message, true); // Le message du backend est déjà traduit
            
            const assignmentContainer = document.getElementById(`assignments-${teacherId}`);
            const subject = subjectsData.find(s => s.id === subjectId);

            tagElement.remove();
            
            const newTag = createSubjectTag(subject, isLinking, teacherId, false);
            
            assignmentContainer.appendChild(newTag);

        } catch (error) {
            console.error("Erreur d'attribution:", error);
            displayStatusMessage(error.message || msgErrorNetwork, false);

            // --- Échec: Restauration ---
            tagElement.textContent = originalText;
            tagElement.className = originalClasses;
            
        } finally {
            if (tagElement.parentNode) {
                tagElement.classList.remove('opacity-50', 'pointer-events-none'); 
            }
        }
    };

    // 2. Initialisation : Affichage de la légende des matières
    if (subjectsData.length > 0) {
        subjectsData.forEach(subject => {
            const tag = createSubjectTag(subject, false, null, true); 
            subjectLegendEl.appendChild(tag);
        });
    }

    // 3. Initialisation : Remplissage du tableau des attributions
    const teacherRows = document.querySelectorAll('#teacher-assignment-body tr[data-teacher-id]');
    
    teacherRows.forEach(row => {
        const teacherId = row.dataset.teacherId;
        const assignmentContainer = document.getElementById(`assignments-${teacherId}`);
        const assignedSubjectIds = linksData[teacherId] || [];

        subjectsData.forEach(subject => {
            const subjectId = subject.id;
            const isAssigned = assignedSubjectIds.includes(subjectId);
            
            const tag = createSubjectTag(subject, isAssigned, teacherId, false); 
            assignmentContainer.appendChild(tag);
        });
        
    });
});