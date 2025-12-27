// Logique d'interaction pour la page d'attribution des matières
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Récupération des éléments du DOM et des données passées par Django
    const subjectsDataEl = document.getElementById('subjects-data');
    const linksDataEl = document.getElementById('links-data');
    const statusMessageEl = document.getElementById('status-message');
    const subjectLegendEl = document.getElementById('subject-legend');
    
    let subjectsData = [];
    let linksData = {};

    try {
        subjectsData = JSON.parse(subjectsDataEl.dataset.subjects || '[]');
        linksData = JSON.parse(linksDataEl.dataset.links || '{}');
    } catch (e) {
        console.error("Erreur critique lors du parsing des données :", e);
        // Afficher une erreur si les données JSON ne sont pas valides
        displayStatusMessage("Erreur de chargement des données initiales. Vérifiez la console.", false);
        return; 
    }
    
    // Sécurité CSRF pour les requêtes POST
    const csrftoken = document.getElementById('csrf-token').value;

    /**
     * Affiche un message de statut à l'utilisateur.
     * @param {string} message - Le message à afficher.
     * @param {boolean} isSuccess - True pour le succès, false pour l'erreur.
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
     * @param {Object} subject - Objet de la matière {id, name, color}.
     * @param {boolean} isAssigned - Indique si elle est déjà attribuée.
     * @param {string} teacherId - ID du professeur (requis si c'est un tag cliquable).
     * @param {boolean} isLegend - Indique si c'est pour la légende (non cliquable).
     * @returns {HTMLElement} L'élément span créé.
     */
    const createSubjectTag = (subject, isAssigned, teacherId, isLegend = false) => {
        const tag = document.createElement('span');
        tag.dataset.subjectId = subject.id;
        tag.dataset.subjectName = subject.name;
        tag.dataset.teacherId = teacherId || ''; // Peut être vide pour la légende

        // Classes de base
        let classes = [
            'px-3', 'py-1', 'rounded-full', 'select-none', 
            'transition', 'duration-150', 'ease-in-out', 'whitespace-nowrap'
        ];

        // Style pour la légende (non cliquable)
        if (isLegend) {
            tag.textContent = subject.name;
            classes.push('text-xs', 'font-normal', 'shadow-sm', 'bg-gray-200', 'text-gray-800');
            tag.style.cursor = 'default';
        } 
        // Style pour l'attribution dans le tableau (cliquable)
        else {
            classes.push('cursor-pointer', 'shadow-sm', 'text-sm', 'font-medium');

            if (isAssigned) {
                // Style Attribué (Linké)
                tag.textContent = subject.name;
                classes.push(
                    'bg-white', // Fond blanc (ou transparent du parent)
                    'text-gray-900', 
                    'border', 
                    'border-gray-400', 
                    'hover:bg-gray-100', // Gris très léger au survol
                    'font-semibold'
                );                tag.dataset.action = 'unlink';
                tag.addEventListener('click', (e) => handleAssignmentToggle(teacherId, subject.id, subject.name, 'unlink', e.currentTarget));
            } else {
                // Style Non Attribué (Fantôme pour Link)
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
     * @param {string} teacherId - ID du professeur.
     * @param {string} subjectId - ID de la matière.
     * @param {string} subjectName - Nom de la matière.
     * @param {string} action - 'link' (ajouter) ou 'unlink' (retirer).
     * @param {HTMLElement} tagElement - L'élément cliqué pour désactiver pendant l'appel.
     */
    const handleAssignmentToggle = async (teacherId, subjectId, subjectName, action, tagElement) => {
        // Sauvegarde de l'état original pour la restauration en cas d'erreur
        const originalText = tagElement.textContent; 
        const originalClasses = tagElement.className; 
        const isLinking = action === 'link';

        // Désactiver et indiquer le chargement
        tagElement.textContent = isLinking ? 'Attribution...' : 'Retrait...';
        tagElement.classList.add('opacity-50', 'pointer-events-none'); 
        tagElement.classList.remove('hover:bg-indigo-700', 'hover:border-primary-blue'); // Nettoyer les hover

        try {
            const response = await fetch('/subjects/api/toggle-assignment/', { // L'URL de votre API
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken 
                },
                body: JSON.stringify({
                    teacher_id: teacherId,
                    subject_id: subjectId,
                    action: action // 'link' ou 'unlink'
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                // Afficher l'erreur retournée par l'API
                throw new Error(result.message || "Erreur serveur lors de la mise à jour.");
            }

            // --- Succès ---
            displayStatusMessage(result.message, true);
            
            const assignmentContainer = document.getElementById(`assignments-${teacherId}`);
            const subject = subjectsData.find(s => s.id === subjectId);

            // 1. Suppression de l'ancien tag (linké ou unlinked)
            tagElement.remove();
            
            // 2. Création et insertion du nouveau tag avec l'état opposé
            const newTag = createSubjectTag(subject, isLinking, teacherId, false); // isLinking est le nouvel état d'attribution
            
            // Ajouter le nouveau tag à la fin du conteneur
            assignmentContainer.appendChild(newTag);

        } catch (error) {
            console.error("Erreur d'attribution:", error);
            displayStatusMessage(error.message || "Erreur réseau ou serveur. Veuillez réessayer.", false);

            // --- Échec: Restauration de l'état visuel ---
            tagElement.textContent = originalText;
            tagElement.className = originalClasses;
            
        } finally {
            // Réactiver le tag (il a été supprimé ou restauré)
            if (tagElement.parentNode) {
                tagElement.classList.remove('opacity-50', 'pointer-events-none'); 
            }
        }
    };


    // 2. Initialisation : Affichage de la légende des matières
    subjectsData.forEach(subject => {
        const tag = createSubjectTag(subject, false, null, true); // true pour isLegend
        subjectLegendEl.appendChild(tag);
    });

    
    // 3. Initialisation : Remplissage du tableau des attributions
    const teacherRows = document.querySelectorAll('#teacher-assignment-body tr[data-teacher-id]');
    
    teacherRows.forEach(row => {
        const teacherId = row.dataset.teacherId;
        const assignmentContainer = document.getElementById(`assignments-${teacherId}`);
        // linksData[teacherId] est un tableau d'IDs de matières attribuées
        const assignedSubjectIds = linksData[teacherId] || [];

        // Pour chaque matière, déterminer si elle est attribuée ou non
        subjectsData.forEach(subject => {
            const subjectId = subject.id;
            const isAssigned = assignedSubjectIds.includes(subjectId);
            
            const tag = createSubjectTag(subject, isAssigned, teacherId, false); // false pour isLegend
            assignmentContainer.appendChild(tag);
        });
        
    });
});
