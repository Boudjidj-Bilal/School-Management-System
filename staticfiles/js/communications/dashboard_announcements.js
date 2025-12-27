// ====================================================================
// LOGIQUE JAVASCRIPT POUR LES ANNONCES (dashboard_announcements.js)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURATION ---
    const API = window.API_URLS;
    const CSRF = window.CSRF_TOKEN;
    const TARGETS_CONFIG = window.AVAILABLE_TARGETS || {};

    if (!API) {
        console.error("ERREUR CRITIQUE : API_URLS non défini dans le HTML.");
        return;
    }

    // --- ÉLÉMENTS DOM ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const loader = document.getElementById('loader');
    const badgeInboxUnread = document.getElementById('badge-inbox-unread');
    const notificationArea = document.getElementById('notification-area');

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
    const checkReadLabel = document.getElementById('label-check-read'); // Le parent label
    const readConfirmation = document.getElementById('read-confirmation');
    const readOnlyMsg = document.getElementById('read-only-msg'); // [AJOUT]
    
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
    // 0. UTILITAIRE NOTIFICATIONS
    // =================================================================

    function showNotification(message, type = 'success') {
        if (!notificationArea) return;
        const notif = document.createElement('div');
        let colors = 'bg-white border-l-4 border-green-500 text-gray-800';
        let icon = '<i class="fas fa-check-circle text-green-500 text-xl"></i>';
        if (type === 'error') {
            colors = 'bg-white border-l-4 border-red-500 text-gray-800';
            icon = '<i class="fas fa-exclamation-circle text-red-500 text-xl"></i>';
        }
        notif.className = `${colors} shadow-lg rounded-r-lg p-4 flex items-center space-x-3 transform transition-all duration-300 translate-x-full pointer-events-auto min-w-[300px]`;
        notif.innerHTML = `<div>${icon}</div><div class="font-medium text-sm">${message}</div><button class="ml-auto text-gray-400 hover:text-gray-600 focus:outline-none" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
        notificationArea.appendChild(notif);
        requestAnimationFrame(() => notif.classList.remove('translate-x-full'));
        setTimeout(() => { notif.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => notif.remove(), 300); }, 4000);
    }


    // =================================================================
    // 1. NAVIGATION & LISTING
    // =================================================================

    loadAnnouncements();

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active-tab', 'border-indigo-500', 'text-indigo-600'));
            tabBtns.forEach(b => b.classList.add('border-transparent', 'text-gray-500'));
            
            btn.classList.add('active-tab', 'border-indigo-500', 'text-indigo-600');
            btn.classList.remove('border-transparent', 'text-gray-500');

            const tabName = btn.dataset.tab;
            
            tabContents.forEach(c => c.classList.add('hidden'));
            const targetContent = document.getElementById(`tab-content-${tabName}`);
            if(targetContent) targetContent.classList.remove('hidden');
        });
    });

    async function loadAnnouncements() {
        try {
            const response = await fetch(API.LIST);
            const data = await response.json();
            
            if (data.success) {
                renderList('inbox', data.data.inbox);
                if (document.getElementById('tab-content-sent')) {
                    renderList('sent', data.data.sent);
                }
                // [AJOUT] Rendu de l'onglet 'all' s'il existe
                if (document.getElementById('tab-content-all')) {
                    renderList('all', data.data.all);
                }
                
                const unreadCount = data.data.inbox.filter(a => !a.is_read).length;
                if (unreadCount > 0 && badgeInboxUnread) {
                    badgeInboxUnread.textContent = unreadCount;
                    badgeInboxUnread.classList.remove('hidden');
                } else if (badgeInboxUnread) {
                    badgeInboxUnread.classList.add('hidden');
                }
            }
            
            if (loader) loader.classList.add('hidden');
            
            const activeBtn = document.querySelector('.tab-btn.active-tab');
            const activeTabName = activeBtn ? activeBtn.dataset.tab : 'inbox';
            
            tabContents.forEach(c => c.classList.add('hidden'));
            const activeContent = document.getElementById(`tab-content-${activeTabName}`);
            if (activeContent) activeContent.classList.remove('hidden');

        } catch (e) {
            console.error(e);
            if (loader) loader.innerHTML = '<p class="text-red-500">Erreur de chargement.</p>';
            showNotification("Impossible de charger les annonces.", 'error');
        }
    }

    function renderList(type, items) {
        const container = document.getElementById(`tab-content-${type}`);
        if (!container) return;
        
        container.innerHTML = '';

        if (!items || items.length === 0) {
            const template = document.getElementById('empty-state-template');
            if (template) {
                const clone = template.content.cloneNode(true);
                container.appendChild(clone);
            } else {
                container.innerHTML = '<p class="text-center text-gray-500 py-8">Aucune annonce.</p>';
            }
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            // Pour 'all', on affiche comme 'inbox' mais sans bordure bleue si non lu (sauf si destinataire)
            const isUnread = (type === 'inbox' && !item.is_read) || (type === 'all' && item.is_recipient && !item.is_read);
            
            el.className = `bg-white p-4 rounded-lg border ${isUnread ? 'border-l-4 border-l-indigo-500 border-gray-200 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'} shadow-sm cursor-pointer transition-all hover:shadow-md`;
            
            let iconClass = 'fa-info-circle text-blue-500';
            if (item.type_code === 'HOMEWORK') iconClass = 'fa-book text-orange-500';
            if (item.type_code === 'TEST') iconClass = 'fa-file-alt text-red-500';
            if (item.type_code === 'COURSE') iconClass = 'fa-graduation-cap text-green-500';

            // Cible affichée : pour 'inbox' c'est "De:", pour 'sent' et 'all' c'est "Pour:" ou "De:" selon contexte
            let infoLine = "";
            if (type === 'inbox') {
                infoLine = `De : <span class="font-medium">${item.sender}</span>`;
            } else if (type === 'sent') {
                infoLine = `Pour : ${item.targets_summary || 'Destinataires multiples'}`;
            } else if (type === 'all') {
                // Dans la vue globale, on affiche l'expéditeur
                infoLine = `De : <span class="font-medium">${item.sender}</span>`;
            }

            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3 overflow-hidden">
                        <div class="mt-1 flex-shrink-0">
                            <i class="fas ${iconClass} text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-base font-bold text-gray-900 truncate pr-2">${item.title}</h4>
                            <p class="text-sm text-gray-500">
                                ${infoLine}
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
        
        if(viewTitle) viewTitle.textContent = item.title;
        if(viewSender) viewSender.textContent = item.sender || "Moi";
        if(viewDate) viewDate.textContent = item.date;
        if(viewContent) viewContent.innerHTML = item.content.replace(/\n/g, '<br>');
        if(viewTypeBadge) viewTypeBadge.textContent = item.type;
        
        // Pièces jointes
        if (item.attachments && item.attachments.length > 0) {
            if(viewAttachmentsContainer) viewAttachmentsContainer.classList.remove('hidden');
            if(viewAttachmentsList) {
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
            }
        } else {
            if(viewAttachmentsContainer) viewAttachmentsContainer.classList.add('hidden');
        }

        // --- GESTION DU FOOTER SELON LE TYPE ET LE RÔLE ---
        if (type === 'sent') {
            // Mode Expéditeur : Stats uniquement
            if(viewFooterAction) viewFooterAction.classList.add('hidden');
            if(viewStatsContainer) viewStatsContainer.classList.remove('hidden');
            document.getElementById('view-stats-read').textContent = item.stats.read;
            document.getElementById('view-stats-total').textContent = item.stats.total;
            document.getElementById('view-stats-percent').textContent = item.stats.percent + '%';
            document.getElementById('view-stats-bar').style.width = item.stats.percent + '%';
        } else {
            // Mode Inbox ou All
            if(viewFooterAction) viewFooterAction.classList.remove('hidden');
            if(viewStatsContainer) viewStatsContainer.classList.add('hidden');
            
            // Si c'est 'all' et que je ne suis PAS destinataire -> Lecture seule
            if (type === 'all' && !item.is_recipient) {
                if(checkReadLabel) checkReadLabel.classList.add('hidden');
                if(readConfirmation) readConfirmation.classList.add('hidden');
                if(readOnlyMsg) readOnlyMsg.classList.remove('hidden'); // Affiche "Mode consultation"
            } else {
                // Je suis destinataire (ou inbox normal)
                if(readOnlyMsg) readOnlyMsg.classList.add('hidden');
                
                if (item.is_read) {
                    // Déjà lu
                    if(checkReadLabel) checkReadLabel.classList.add('hidden');
                    if(readConfirmation) readConfirmation.classList.remove('hidden');
                    document.getElementById('read-date').textContent = item.read_at || '';
                } else {
                    // Pas encore lu
                    if(checkReadLabel) checkReadLabel.classList.remove('hidden');
                    if(checkRead) {
                        checkRead.checked = false;
                        checkRead.disabled = false;
                    }
                    if(readConfirmation) readConfirmation.classList.add('hidden');
                }
            }
        }

        openModal(modalView);
    }

    if (checkRead) {
        checkRead.addEventListener('change', async (e) => {
            if (e.target.checked) {
                try {
                    const response = await fetch(API.READ, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
                        body: JSON.stringify({ announcement_id: currentAnnouncementId, is_read: true })
                    });
                    if (response.ok) {
                        e.target.disabled = true;
                        e.target.parentElement.classList.add('hidden'); // Cache la case
                        if(readConfirmation) readConfirmation.classList.remove('hidden');
                        document.getElementById('read-date').textContent = "à l'instant";
                        loadAnnouncements(); 
                        showNotification("Annonce marquée comme lue.", 'success');
                    }
                } catch (err) {
                    console.error(err);
                    e.target.checked = false;
                    showNotification("Erreur lors de la validation.", 'error');
                }
            }
        });
    }


    // =================================================================
    // 3. CRÉATION D'ANNONCE
    // =================================================================

    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            renderTargetSelectors(); 
            openModal(modalCreate);
        });

        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const targets = {
                classes: getCheckedValues('target-class'),
                staff_groups: getCheckedValues('target-group'),
                students: [],
                staff_individuals: []
            };

            if (targets.classes.length === 0 && targets.staff_groups.length === 0) {
                showNotification("Veuillez sélectionner au moins un destinataire.", "error");
                return;
            }

            const formData = new FormData(formCreate);
            formData.append('targets', JSON.stringify(targets));

            const submitBtn = document.getElementById('btn-submit-announcement');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Envoi...';

            try {
                const response = await fetch(API.CREATE, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': CSRF },
                    body: formData
                });
                
                const json = await response.json();
                
                if (json.success) {
                    closeModal(modalCreate);
                    formCreate.reset();
                    if(fileList) fileList.innerHTML = '';
                    if(targetsSummary) targetsSummary.classList.add('hidden');
                    loadAnnouncements();
                    
                    showNotification("Annonce envoyée avec succès !", 'success');
                } else {
                    showNotification("Erreur : " + json.message, 'error');
                }

            } catch (err) {
                console.error(err);
                showNotification("Erreur technique lors de l'envoi.", 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        if(fileInput) {
            fileInput.addEventListener('change', (e) => {
                if(fileList) {
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
                }
            });
        }
    }

    function renderTargetSelectors() {
        if (!targetsContainer) return;
        if (targetsContainer.innerHTML.trim() !== '' && targetsContainer.querySelector('input')) return;
        
        targetsContainer.innerHTML = '';

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

        targetsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateTargetsSummary);
        });
    }

    function updateTargetsSummary() {
        if(!targetsSummary) return;
        const count = targetsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
        targetsSummary.textContent = `${count} destinataire(s) sélectionné(s)`;
        targetsSummary.classList.remove('hidden');
    }

    function getCheckedValues(className) {
        return Array.from(document.querySelectorAll(`.${className}:checked`)).map(cb => cb.value);
    }


    // --- UTILITAIRES UI ---

    function openModal(modalEl) {
        if(!modalEl) return;
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
        if(!modalEl) return;
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

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.fixed');
            closeModal(modal);
        });
    });

    function getFileIcon(type) {
        if (type === 'IMAGE') return 'fa-image';
        if (type === 'VIDEO') return 'fa-video';
        return 'fa-file-alt';
    }

});