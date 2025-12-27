document.addEventListener('DOMContentLoaded', () => {
    // Définition de l'ordre des étapes de l'année scolaire
    const STATUS_ORDER = [
        { key: 'creation', label: 'Création' },
        { key: 'registration', label: 'Enregistrement' },
        { key: 'running', label: 'Déroulement en cours' },
        { key: 'end_year', label: 'Fin d\'année' },
        { key: 'finished', label: 'Terminée' }
    ];

    // Éléments du DOM
    const yearForm = document.getElementById('year-form');
    const createBtn = document.getElementById('create-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    
    // Contrôles de statut NOUVEAUX
    const statusControls = document.getElementById('statusControls');
    const prevStatusBtn = document.getElementById('prevStatusBtn');
    const nextStatusBtn = document.getElementById('nextStatusBtn');
    
    // Champs du formulaire
    const yearIdInput = document.getElementById('year-id');
    const nameInput = document.getElementById('name');
    const startDateInput = document.getElementById('start_date');
    const endDateInput = document.getElementById('end_date');
    const minTimeInput = document.getElementById('min_time');
    const maxTimeInput = document.getElementById('max_time');

    // Affichage du statut
    const statusDisplay = document.getElementById('status-display');
    const currentStatusText = document.getElementById('current-status');
    const currentYearFlag = document.getElementById('current-year-flag');

    // Modal de message
    const messageModal = document.getElementById('message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Modal de Cycle de Vie
    const lifecycleModal = document.getElementById('lifecycle-modal');
    const lifecycleTitle = document.getElementById('lifecycle-modal-title');
    const lifecycleMessage = document.getElementById('lifecycle-modal-message');
    const lifecycleConfirmBtn = document.getElementById('lifecycle-confirm-btn');
    const lifecycleCancelBtn = document.getElementById('lifecycle-cancel-btn');
    
    let pendingDirection = 0; // Pour stocker si on avance (+1) ou recule (-1)

    // URL de l'API
    const apiUrl = '/schools/api/years/'; 
    const schoolId = yearForm.getAttribute('data-school-id');
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    /**
     * Affiche le modal avec un message de succès ou d'erreur.
     * @param {string} message - Le corps du message.
     * @param {boolean} isSuccess - Indique si c'est un succès.
     */
    function showModal(message, isSuccess) {
        modalTitle.textContent = isSuccess ? 'Succès' : 'Erreur';
        modalMessage.innerHTML = message;

        // Définition des classes en fonction du succès/erreur
        const titleClasses = isSuccess ? 'text-green-600' : 'text-red-600';
        const buttonClasses = isSuccess ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

        // Nettoyer et appliquer les classes
        modalTitle.classList.remove('text-green-600', 'text-red-600');
        modalCloseBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-red-600', 'hover:bg-red-700');
        
        modalTitle.classList.add(...titleClasses.split(' ')); 
        modalCloseBtn.classList.add(...buttonClasses.split(' '));

        messageModal.classList.remove('hidden');

        // Recharge la page si succès après un délai (pour actualiser la liste et les statuts)
        if (isSuccess) {
            setTimeout(() => window.location.reload(), 1500);
        }
    }

    modalCloseBtn.addEventListener('click', () => {
        messageModal.classList.add('hidden');
    });

    /**
     * Réinitialise le formulaire au mode "Création".
     */
    function resetForm() {
        yearForm.reset();
        yearIdInput.value = '';
        formTitle.textContent = 'Créer une nouvelle année scolaire';
        submitBtn.textContent = 'Créer l\'année';
        submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        cancelBtn.style.display = 'none';
        
        // Cacher les contrôles de statut
        statusControls.classList.add('hidden'); // NOUVEAU
        statusDisplay.classList.add('hidden');
        currentYearFlag.classList.add('hidden');
        
        // Retirer la surbrillance de tous les liens
        document.querySelectorAll('.year-link').forEach(l => l.classList.remove('bg-gray-200', 'border-indigo-400', 'border-l-4'));
    }

    /**
     * Détermine le statut actuel de l'année à partir des data-attributes.
     * @param {object} dataset - Les data-attributes du lien sélectionné.
     * @returns {object} L'objet statut (key, label) et son index.
     */
    function getCurrentStatus(dataset) {
        let currentStatusKey = 'creation'; // Statut par défaut
        
        // On parcourt les étapes dans l'ordre pour trouver la première à 'true'
        for (const status of STATUS_ORDER) {
            if (dataset[status.key] === 'true') {
                currentStatusKey = status.key;
                break;
            }
        }
        
        const currentStatusIndex = STATUS_ORDER.findIndex(s => s.key === currentStatusKey);
        
        return {
            status: STATUS_ORDER[currentStatusIndex],
            index: currentStatusIndex
        };
    }

    /**
     * Met à jour le formulaire pour le mode "Modification".
     * @param {Element} link - L'élément de lien de l'année sélectionnée.
     */
    function loadYearForEdit(link) {
        const yearId = link.dataset.yearId;
        const yearName = link.dataset.name;
        const startDate = link.dataset.startDate;
        const endDate = link.dataset.endDate;
        const minTime = link.dataset.minTime;
        const maxTime = link.dataset.maxTime;
        const isCurrent = link.dataset.current === 'true';

        const { status: currentStatus, index: currentStatusIndex } = getCurrentStatus(link.dataset);

        // Remplir les champs
        yearIdInput.value = yearId;
        nameInput.value = yearName;
        startDateInput.value = startDate;
        endDateInput.value = endDate;
        minTimeInput.value = minTime;
        maxTimeInput.value = maxTime;

        // Mettre à jour le titre et les boutons
        formTitle.textContent = `Modifier l'année : ${yearName}`;
        submitBtn.textContent = 'Sauvegarder les modifications';
        submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        cancelBtn.style.display = 'block';

        // Afficher le statut
        statusDisplay.classList.remove('hidden');
        currentStatusText.textContent = currentStatus.label;
        if (isCurrent) {
            currentYearFlag.classList.remove('hidden');
        } else {
            currentYearFlag.classList.add('hidden');
        }

        // --- NOUVEAU: Gestion des contrôles de statut (si l'année est l'année actuelle) ---
        if (isCurrent) {
            statusControls.classList.remove('hidden');
            
            // Gérer l'état des boutons Précédent/Suivant
            // Précédent désactivé si on est à la première étape
            prevStatusBtn.disabled = currentStatusIndex <= 0; 
            // Suivant désactivé si on est à la dernière étape
            nextStatusBtn.disabled = currentStatusIndex >= STATUS_ORDER.length - 1; 

        } else {
            statusControls.classList.add('hidden');
        }
    }

    /**
     * Appelle l'API pour changer le statut de l'année.
     * @param {string} yearId - L'ID de l'année à modifier.
     * @param {string} newStatusKey - La clé du nouveau statut (ex: 'registration').
     */
    async function changeYearStatus(yearId, newStatusKey) {
        // Désactiver les boutons pendant le traitement
        prevStatusBtn.disabled = true;
        nextStatusBtn.disabled = true;

        const url = `${apiUrl}${yearId}/change_status/`; 
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ new_status: newStatusKey })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showModal(result.message, true);
            } else {
                // Réactiver les boutons si erreur (pas de rechargement)
                prevStatusBtn.disabled = false;
                nextStatusBtn.disabled = false;
                showModal(result.message || 'Échec du changement de statut.', false);
            }

        } catch (error) {
            // Réactiver les boutons si erreur
            prevStatusBtn.disabled = false;
            nextStatusBtn.disabled = false;
            showModal('Erreur de connexion lors du changement de statut.', false);
            console.error('Erreur API changement de statut:', error);
        }
    }

    /**
     * Gère le clic sur les boutons Précédent/Suivant.
     * @param {number} direction - -1 pour précédent, 1 pour suivant.
     */
    function handleStatusChange(direction) {
        const yearId = yearIdInput.value;
        const activeLink = document.querySelector('.year-link.bg-gray-200');

        if (!yearId || !activeLink) {
            showModal('Veuillez sélectionner une année scolaire actuelle.', false);
            return;
        }

        // Récupérer le statut actuel à partir des data-attributes du lien
        const { index: currentStatusIndex } = getCurrentStatus(activeLink.dataset);
        
        const newStatusIndex = currentStatusIndex + direction;

        // Vérifier les limites
        if (newStatusIndex >= 0 && newStatusIndex < STATUS_ORDER.length) {
            const newStatusKey = STATUS_ORDER[newStatusIndex].key;
            changeYearStatus(yearId, newStatusKey);
        }
    }

    /**
     * Ouvre le modal de confirmation pour le cycle de vie
     * @param {number} direction - -1 (précédent) ou 1 (suivant)
     */
    function openLifecycleModal(direction) {
        pendingDirection = direction;
        lifecycleModal.classList.remove('hidden');

        if (direction === 1) {
            // Configuration pour AVANCER
            lifecycleTitle.textContent = "Passer à l'étape suivante ?";
            lifecycleTitle.className = "text-lg font-bold leading-6 text-indigo-900";
            lifecycleMessage.innerHTML = `
                Vous êtes sur le point d'avancer dans le cycle de vie de l'année. 
                <br><br>
                <ul class="list-disc pl-5 text-left text-xs text-gray-500">
                    <li>Assurez-vous que toutes les tâches de l'étape actuelle sont terminées.</li>
                    <li>Cette action peut ouvrir l'accès aux utilisateurs.</li>
                </ul>`;
            
            lifecycleConfirmBtn.className = "inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto transition-colors";
            lifecycleConfirmBtn.innerHTML = 'Confirmer et Avancer <i class="fas fa-arrow-right ml-2"></i>';
        
        } else {
            // Configuration pour RECULER
            lifecycleTitle.textContent = "Revenir à l'étape précédente ?";
            lifecycleTitle.className = "text-lg font-bold leading-6 text-orange-800";
            lifecycleMessage.innerHTML = `
                <strong class="text-orange-600">Attention :</strong> Vous allez reculer dans le cycle de vie.
                <br><br>
                Cela peut avoir des conséquences sur les données enregistrées ou les permissions d'accès. 
                Êtes-vous sûr de vouloir continuer ?`;

            lifecycleConfirmBtn.className = "inline-flex w-full justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:ml-3 sm:w-auto transition-colors";
            lifecycleConfirmBtn.innerHTML = '<i class="fas fa-undo mr-2"></i> Confirmer le retour';
        }
    }

    function closeLifecycleModal() {
        lifecycleModal.classList.add('hidden');
        pendingDirection = 0;
    }

    // Écouteurs INTERNES au modal
    lifecycleCancelBtn.addEventListener('click', closeLifecycleModal);
    
    lifecycleConfirmBtn.addEventListener('click', () => {
        // C'est ici qu'on lance la vraie action
        handleStatusChange(pendingDirection);
        closeLifecycleModal();
    });

    // Écouteurs pour les boutons de statut (Déclenchent le MODAL maintenant)
    prevStatusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLifecycleModal(-1);
    });

    nextStatusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLifecycleModal(1);
    });

    // Gestion de la sélection d'une année
    document.querySelectorAll('.year-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Retirer la surbrillance de tous les liens
            document.querySelectorAll('.year-link').forEach(l => l.classList.remove('bg-gray-200', 'border-indigo-400', 'border-l-4'));

            // Appliquer la surbrillance au lien sélectionné
            link.classList.add('bg-gray-200', 'border-indigo-400', 'border-l-4');

            loadYearForEdit(link);
        });
    });

    // Bouton Créer/Nouvelle Année
    createBtn.addEventListener('click', resetForm);

    // Bouton Annuler la modification
    cancelBtn.addEventListener('click', resetForm);

    // Soumission du formulaire (création/modification des détails de l'année)
    yearForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            year_id: yearIdInput.value || null,
            name: nameInput.value,
            start_date: startDateInput.value,
            end_date: endDateInput.value,
            min_time: minTimeInput.value,
            max_time: maxTimeInput.value,
            school_id: schoolId
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showModal(result.message, true);
            } else {
                showModal(result.message || 'Une erreur inconnue est survenue lors de la sauvegarde.', false);
            }

        } catch (error) {
            showModal('Erreur de connexion ou du serveur. Veuillez réessayer.', false);
            console.error('Erreur lors de la soumission du formulaire:', error);
        }
    });

    // Charger par défaut l'année actuelle si elle existe
    const currentYearLink = document.querySelector('#year-list-current .year-link');
    if (currentYearLink) {
        // Appliquer la surbrillance initiale à l'année actuelle
        currentYearLink.classList.add('bg-gray-200', 'border-indigo-400', 'border-l-4'); 
        loadYearForEdit(currentYearLink);
        // On masque le bouton d'annulation pour la sélection initiale de l'année actuelle
        cancelBtn.style.display = 'none'; 
    } else {
        resetForm(); // Réinitialiser pour un état de création propre
    }
});
