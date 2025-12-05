// ====================================================================
// LOGIQUE JAVASCRIPT POUR LES ANNONCES (dashboard.js)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURATION ---
    const API = window.API_URLS;
    // AVAILABLE_TARGETS est défini dans le HTML via Django
    // Structure attendue : { classes: [...], staff_groups: [...], can_target_individual_staff: bool }
    const TARGETS_CONFIG = typeof AVAILABLE_TARGETS !== 'undefined' ? AVAILABLE_TARGETS : {}; 

    // --- ÉLÉMENTS DOM ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const loader = document.getElementById('loader');
    const badgeInboxUnread = document.getElementById('badge-inbox-unread');

    // Modale Vue
    const modalView = document.getElementById('modal-view');
    const viewTitle = document.getElementById('view-title');
    const viewSender = document.getElementById('view-sender');
    const viewDate = document.getElementById('view-date');
    const viewContent = document.getElementById('view-content');
    const viewTypeBadge = document.getElementById('view-type-badge');
    const viewAttachmentsContainer = document.getElementById('view-attachments-container');
    const viewAttachmentsList = document.getElementById('view-attachments-list');
    const viewStatsContainer = document.getElementById('view-stats-container');
    const viewFooterAction = document.getElementById('view-footer-action');
    const checkRead = document.getElementById('check-read');
    const readConfirmation = document.getElementById('read-confirmation');
    let currentAnnouncementId = null;

    // Modale Création
    const btnCreate = document.getElementById('btn-create-announcement');
    const modalCreate = document.getElementById('modal-create');
    const formCreate = document.getElementById('create-announcement-form');
    const targetsContainer = document.getElementById('targets-container');
    const targetsSummary = document.getElementById('targets-summary');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');


    // =================================================================
    // 1. NAVIGATION & LISTING
    // =================================================================

    // Initialisation
    loadAnnouncements();

    // Gestion des onglets
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Switch
            tabBtns.forEach(b => b.classList.remove('active-tab', 'border-indigo-500', 'text-indigo-600'));
            tabBtns.forEach(b => b.classList.add('border-transparent', 'text-gray-500'));
            
            btn.classList.add('active-tab', 'border-indigo-500', 'text-indigo-600');
            btn.classList.remove('border-transparent', 'text-gray-500');

            const tabName = btn.dataset.tab; // 'inbox' ou 'sent'
            
            // Content Switch
            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
        });
    });

    async function loadAnnouncements() {
        try {
            const response = await fetch(API.LIST);
            const data = await response.json();
            
            if (data.success) {
                renderList('inbox', data.data.inbox);
                renderList('sent', data.data.sent);
                
                // Mise à jour du badge non-lu
                const unreadCount = data.data.inbox.filter(a => !a.is_read).length;
                if (unreadCount > 0) {
                    badgeInboxUnread.textContent = unreadCount;
                    badgeInboxUnread.classList.remove('hidden');
                } else {
                    badgeInboxUnread.classList.add('hidden');
                }
            }
            
            loader.classList.add('hidden');
            // Affiche l'onglet par défaut (inbox)
            document.getElementById('tab-content-inbox').classList.remove('hidden');

        } catch (e) {
            console.error(e);
            loader.innerHTML = '<p class="text-red-500">Erreur de chargement.</p>';
        }
    }

    function renderList(type, items) {
        const container = document.getElementById(`tab-content-${type}`);
        container.innerHTML = '';

        if (items.length === 0) {
            const template = document.getElementById('empty-state-template').content.cloneNode(true);
            container.appendChild(template);
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            // Style différent si non lu (pour inbox)
            const isUnread = (type === 'inbox' && !item.is_read);
            el.className = `bg-white p-4 rounded-lg border ${isUnread ? 'border-l-4 border-l-indigo-500 border-gray-200 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'} shadow-sm cursor-pointer transition-all hover:shadow-md`;
            
            // Icône selon le type
            let iconClass = 'fa-info-circle text-blue-500';
            if (item.type_code === 'HOMEWORK') iconClass = 'fa-book text-orange-500';
            if (item.type_code === 'TEST') iconClass = 'fa-file-alt text-red-500';
            if (item.type_code === 'COURSE') iconClass = 'fa-graduation-cap text-green-500';

            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3 overflow-hidden">
                        <div class="mt-1 flex-shrink-0">
                            <i class="fas ${iconClass} text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-base font-bold text-gray-900 truncate pr-2">${item.title}</h4>
                            <p class="text-sm text-gray-500">
                                ${type === 'inbox' ? `De : <span class="font-medium">${item.sender}</span>` : `Pour : ${item.targets_summary || 'Destinataires multiples'}`}
                                <span class="mx-1">•</span> ${item.date}
                            </p>
                            <p class="text-sm text-gray-600 mt-1 line-clamp-2">${item.content.substring(0, 150)}...</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end space-y-2 flex-shrink-0 ml-2">
                        ${item.attachments && item.attachments.length > 0 ? '<i class="fas fa-paperclip text-gray-400" title="Pièces jointes"></i>' : ''}
                        ${type === 'sent' ? renderSentStats(item.stats) : ''}
                    </div>
                </div>
            `;
            
            el.onclick = () => openViewModal(type, item);
            container.appendChild(el);
        });
    }

    function renderSentStats(stats) {
        // Petite barre de progression pour l'expéditeur
        let color = 'bg-indigo-600';
        if (stats.percent < 30) color = 'bg-red-500';
        else if (stats.percent < 70) color = 'bg-orange-500';
        else color = 'bg-green-500';

        return `
            <div class="w-24 text-right">
                <div class="text-xs text-gray-500 mb-1">${stats.read}/${stats.total} lus</div>
                <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full ${color}" style="width: ${stats.percent}%"></div>
                </div>
            </div>
        `;
    }


    // =================================================================
    // 2. LECTURE & MODALE VIEW
    // =================================================================

    function openViewModal(type, item) {
        currentAnnouncementId = item.id;
        
        // Remplissage
        viewTitle.textContent = item.title;
        viewSender.textContent = item.sender || "Moi"; // Si c'est 'sent', sender n'est pas toujours rempli, on adapte
        viewDate.textContent = item.date;
        
        // Contenu avec sauts de ligne
        viewContent.innerHTML = item.content.replace(/\n/g, '<br>');
        
        // Badge Type
        viewTypeBadge.textContent = item.type;
        
        // Gestion Pièces Jointes
        if (item.attachments && item.attachments.length > 0) {
            viewAttachmentsContainer.classList.remove('hidden');
            viewAttachmentsList.innerHTML = item.attachments.map(file => `
                <a href="${file.url}" target="_blank" class="flex items-center p-3 rounded border border-gray-200 hover:bg-gray-50 group transition-colors">
                    <div class="p-2 bg-indigo-50 text-indigo-600 rounded mr-3 group-hover:bg-indigo-100">
                        <i class="fas ${getFileIcon(file.type)}"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-700 truncate">${file.name}</p>
                        <p class="text-xs text-gray-500">Télécharger</p>
                    </div>
                </a>
            `).join('');
        } else {
            viewAttachmentsContainer.classList.add('hidden');
        }

        // Gestion Footer (Action de lecture)
        if (type === 'inbox') {
            viewFooterAction.classList.remove('hidden');
            viewStatsContainer.classList.add('hidden');
            
            if (item.is_read) {
                // Déjà lu -> Mode lecture seule
                checkRead.checked = true;
                checkRead.disabled = true;
                document.getElementById('check-read-label').classList.add('text-gray-400');
                readConfirmation.classList.remove('hidden');
                document.getElementById('read-date').textContent = item.read_at || '';
            } else {
                // Pas lu -> Actif
                checkRead.checked = false;
                checkRead.disabled = false;
                document.getElementById('check-read-label').classList.remove('text-gray-400');
                readConfirmation.classList.add('hidden');
            }
        } else {
            // Mode 'sent' -> On affiche les stats, on cache l'action de lecture
            viewFooterAction.classList.add('hidden');
            viewStatsContainer.classList.remove('hidden');
            
            document.getElementById('view-stats-read').textContent = item.stats.read;
            document.getElementById('view-stats-total').textContent = item.stats.total;
            document.getElementById('view-stats-percent').textContent = item.stats.percent + '%';
            document.getElementById('view-stats-bar').style.width = item.stats.percent + '%';
        }

        // Affichage Modale
        openModal(modalView);
    }

    // Action "Marquer comme lu"
    if (checkRead) {
        checkRead.addEventListener('change', async (e) => {
            if (e.target.checked) {
                try {
                    const response = await fetch(API.READ, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
                        body: JSON.stringify({ announcement_id: currentAnnouncementId, is_read: true })
                    });
                    if (response.ok) {
                        // UI Feedback immédiat
                        e.target.disabled = true;
                        readConfirmation.classList.remove('hidden');
                        document.getElementById('read-date').textContent = "à l'instant";
                        
                        // Recharger la liste en fond pour mettre à jour le badge
                        loadAnnouncements(); 
                    }
                } catch (err) {
                    console.error(err);
                    e.target.checked = false; // Revert
                    alert("Erreur lors de la validation.");
                }
            }
        });
    }


    // =================================================================
    // 3. CRÉATION D'ANNONCE
    // =================================================================

    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            renderTargetSelectors(); // Génère les checkboxes
            openModal(modalCreate);
        });

        // Gestionnaire de soumission
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 1. Récupération des cibles
            const targets = {
                classes: getCheckedValues('target-class'),
                staff_groups: getCheckedValues('target-group'),
                students: [], // TODO: Si on implémente la sélection élève par élève plus tard
                staff_individuals: []
            };

            if (targets.classes.length === 0 && targets.staff_groups.length === 0 && targets.students.length === 0) {
                alert("Veuillez sélectionner au moins un destinataire.");
                return;
            }

            // 2. Construction FormData (pour les fichiers)
            const formData = new FormData(formCreate);
            formData.append('targets', JSON.stringify(targets)); // On passe les cibles en JSON string

            // UI Loading
            const submitBtn = document.getElementById('btn-submit-announcement');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Envoi...';

            try {
                const response = await fetch(API.CREATE, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': CSRF_TOKEN }, // Pas de Content-Type pour FormData !
                    body: formData
                });
                
                const json = await response.json();
                
                if (json.success) {
                    closeModal(modalCreate);
                    formCreate.reset();
                    fileList.innerHTML = ''; // Reset fichiers
                    targetsSummary.classList.add('hidden');
                    loadAnnouncements(); // Rafraichir la liste 'Envoyés'
                    alert("Annonce envoyée avec succès !");
                } else {
                    alert("Erreur : " + json.message);
                }

            } catch (err) {
                console.error(err);
                alert("Erreur technique lors de l'envoi.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        // Gestion input fichier
        fileInput.addEventListener('change', (e) => {
            fileList.innerHTML = '';
            Array.from(e.target.files).forEach(file => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm';
                div.innerHTML = `
                    <span class="truncate"><i class="fas fa-file mr-2 text-gray-400"></i> ${file.name}</span>
                    <span class="text-xs text-gray-500">${(file.size / 1024).toFixed(0)} KB</span>
                `;
                fileList.appendChild(div);
            });
        });
    }

    function renderTargetSelectors() {
        // Si déjà rendu, on ne refait pas (sauf si on veut reset)
        if (targetsContainer.innerHTML.trim() !== '' && targetsContainer.querySelector('input')) return;
        
        targetsContainer.innerHTML = '';

        // A. Classes
        if (TARGETS_CONFIG.classes && TARGETS_CONFIG.classes.length > 0) {
            const section = document.createElement('div');
            section.className = 'mb-3';
            section.innerHTML = `<h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Classes</h4>`;
            
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 gap-2';
            
            TARGETS_CONFIG.classes.forEach(cls => {
                grid.innerHTML += `
                    <label class="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-indigo-300">
                        <input type="checkbox" value="${cls.id}" class="target-class form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                        <span class="text-sm text-gray-700 select-none">${cls.name}</span>
                    </label>
                `;
            });
            section.appendChild(grid);
            targetsContainer.appendChild(section);
        }

        // B. Groupes Staff (Admin seulement)
        if (TARGETS_CONFIG.staff_groups && TARGETS_CONFIG.staff_groups.length > 0) {
            const section = document.createElement('div');
            section.className = 'mb-3 pt-3 border-t border-gray-100';
            section.innerHTML = `<h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Personnel</h4>`;
            
            TARGETS_CONFIG.staff_groups.forEach(grp => {
                section.innerHTML += `
                    <label class="flex items-center space-x-2 cursor-pointer mb-2">
                        <input type="checkbox" value="${grp.code}" class="target-group form-checkbox h-4 w-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500">
                        <span class="text-sm text-gray-700">${grp.name}</span>
                    </label>
                `;
            });
            targetsContainer.appendChild(section);
        }

        // Listeners pour le résumé
        targetsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateTargetsSummary);
        });
    }

    function updateTargetsSummary() {
        const count = targetsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
        targetsSummary.textContent = `${count} destinataire(s) sélectionné(s)`;
        targetsSummary.classList.remove('hidden');
    }

    function getCheckedValues(className) {
        return Array.from(document.querySelectorAll(`.${className}:checked`)).map(cb => cb.value);
    }


    // --- UTILITAIRES UI ---

    function openModal(modalEl) {
        modalEl.classList.remove('hidden');
        setTimeout(() => {
            modalEl.classList.remove('opacity-0');
            const card = modalEl.querySelector('div[class*="transform"]');
            if(card) {
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }
        }, 10);
    }

    function closeModal(modalEl) {
        modalEl.classList.add('opacity-0');
        const card = modalEl.querySelector('div[class*="transform"]');
        if(card) {
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
        }
        setTimeout(() => {
            modalEl.classList.add('hidden');
        }, 300);
    }

    // Fermeture générique
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.fixed'); // Trouve la modale parente
            closeModal(modal);
        });
    });

    function getFileIcon(type) {
        if (type === 'IMAGE') return 'fa-image';
        if (type === 'VIDEO') return 'fa-video';
        return 'fa-file-alt';
    }

});