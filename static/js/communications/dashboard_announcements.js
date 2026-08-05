// ====================================================================
// LOGIQUE JAVASCRIPT POUR LES ANNONCES (dashboard_announcements.js)
// VERSION SÉCURISÉE (CSP Compliant), MULTILINGUE ET COMPATIBLE RTL
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('announcements-container');
    const csrfInput = document.getElementById('csrf-token');

    if (!container) {
        console.error("ERREUR CRITIQUE : Conteneur #announcements-container introuvable.");
        return;
    }

    // Récupération des traductions dynamiques (data-attributes)
    const msgLoadError = container.getAttribute('data-msg-load-error') || "Erreur de chargement.";
    const msgLoadErrorToast = container.getAttribute('data-msg-load-error-toast') || "Impossible de charger les annonces.";
    const msgNoAnnouncements = container.getAttribute('data-msg-no-announcements') || "Aucune annonce.";
    const msgMultipleRecipients = container.getAttribute('data-msg-multiple-recipients') || "Destinataires multiples";
    const msgWithSubmission = container.getAttribute('data-msg-with-submission') || "Avec rendu";
    const msgWithoutSubmission = container.getAttribute('data-msg-without-submission') || "Sans rendu";
    const msgSenderLabel = container.getAttribute('data-msg-sender') || "De :";
    const msgRecipientLabel = container.getAttribute('data-msg-recipient') || "Pour :";

    // --- Récupération des traductions dynamiques supplémentaires (data-attributes) ---
    const msgMe = container.getAttribute('data-msg-me') || "Moi";
    const msgViewSubmissions = container.getAttribute('data-msg-view-submissions') || "Consulter les rendus des élèves";
    const msgManageSubmission = container.getAttribute('data-msg-manage-submission') || "Gérer / Déposer mon rendu";
    const msgDownload = container.getAttribute('data-msg-download') || "Télécharger";
    const msgJustNow = container.getAttribute('data-msg-just-now') || "à l'instant";
    const msgReadSuccess = container.getAttribute('data-msg-read-success') || "Annonce marquée comme lue.";
    const msgReadError = container.getAttribute('data-msg-read-error') || "Erreur lors de la validation.";
    const msgNoRecipientError = container.getAttribute('data-msg-no-recipient-error') || "Veuillez sélectionner au moins un destinataire.";
    const msgSending = container.getAttribute('data-msg-sending') || "Envoi...";
    const msgSendSuccess = container.getAttribute('data-msg-send-success') || "Annonce envoyée avec succès !";
    const msgTechError = container.getAttribute('data-msg-tech-error') || "Erreur technique lors de l'envoi.";
    const msgClassesLabel = container.getAttribute('data-msg-classes') || "Classes";
    const msgStaffLabel = container.getAttribute('data-msg-staff') || "Personnel";
    const msgNoRecipientAvailable = container.getAttribute('data-msg-no-recipient-available') || "Aucun destinataire disponible.";
    const msgRecipientSummaryFormat = container.getAttribute('data-msg-recipient-summary') || "{count} destinataire(s) sélectionné(s)";


    // 1. Récupération des URLs depuis les data-attributes
    const API = {
        LIST: container.dataset.apiListUrl,
        CREATE: container.dataset.apiCreateUrl,
        READ: container.dataset.apiReadUrl
    };

    // 2. Récupération du Token CSRF
    const CSRF = csrfInput ? csrfInput.value : '';

    // 3. Récupération des cibles (Targets) depuis le script JSON sécurisé
    let TARGETS_CONFIG = {};
    try {
        const targetsScript = document.getElementById('available-targets-data');
        if (targetsScript) {
            const rawContent = JSON.parse(targetsScript.textContent);
            if (typeof rawContent === 'string') {
                TARGETS_CONFIG = JSON.parse(rawContent);
            } else {
                TARGETS_CONFIG = rawContent;
            }
        }
    } catch (e) {
        console.error("Erreur parsing targets data:", e);
    }

    if (!API.LIST) {
        console.error("ERREUR CRITIQUE : URLs API non définies dans le HTML.");
        return;
    }

    // --- ÉLÉMENTS DOM ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const loader = document.getElementById('loader');
    const badgeInboxUnread = document.getElementById('badge-inbox-unread');
    const notificationArea = document.getElementById('notification-area');
    
    const announcementTypeSelect = document.querySelector('select[name="type"]');
    const requiresSubmissionContainer = document.getElementById('requires-submission-container');
    const homeworkActionContainer = document.getElementById('homework-action-container');
    const linkHomeworkDetail = document.getElementById('link-homework-detail');
    const homeworkLinkText = document.getElementById('homework-link-text');

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
    const checkReadLabel = document.getElementById('label-check-read'); 
    const readConfirmation = document.getElementById('read-confirmation');
    const readOnlyMsg = document.getElementById('read-only-msg');
    
    let currentAnnouncementId = null;

    // Modale Création
    const btnCreate = document.getElementById('btn-create-announcement');
    const modalCreate = document.getElementById('modal-create');
    const formCreate = document.getElementById('create-announcement-form');
    const targetsContainer = document.getElementById('targets-container');
    const targetsSummary = document.getElementById('targets-summary');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');

    if (announcementTypeSelect && requiresSubmissionContainer) {
        function toggleSubmissionField() {
            if (announcementTypeSelect.value === 'HOMEWORK') {
                requiresSubmissionContainer.classList.remove('hidden');
            } else {
                requiresSubmissionContainer.classList.add('hidden');
                const checkbox = document.getElementById('id_requires_submission');
                if (checkbox) checkbox.checked = false;
            }
        }
        announcementTypeSelect.addEventListener('change', toggleSubmissionField);
        toggleSubmissionField();
    }

    // =================================================================
    // 0. UTILITAIRE NOTIFICATIONS
    // =================================================================

    function showNotification(message, type = 'success') {
        if (!notificationArea) return;
        const notif = document.createElement('div');
        let colors = 'bg-white border-s-4 border-green-500 text-gray-800';
        let icon = '<i class="fas fa-check-circle text-green-500 text-xl"></i>';
        if (type === 'error') {
            colors = 'bg-white border-s-4 border-red-500 text-gray-800';
            icon = '<i class="fas fa-exclamation-circle text-red-500 text-xl"></i>';
        }
        // Séparation icône + texte avec gap-3, ms-auto pour le bouton de fermeture
        notif.className = `${colors} shadow-lg rounded-e-lg p-4 flex items-center gap-3 transform transition-all duration-300 translate-x-full pointer-events-auto min-w-[300px] mb-3`;
        notif.innerHTML = `<div>${icon}</div><div class="font-medium text-sm flex-1" dir="auto">${message}</div><button class="ms-auto text-gray-400 hover:text-gray-600 focus:outline-none" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
        notificationArea.appendChild(notif);
        
        requestAnimationFrame(() => notif.classList.remove('translate-x-full'));
        
        setTimeout(() => { 
            notif.classList.add('translate-x-full', 'opacity-0'); 
            setTimeout(() => notif.remove(), 300); 
        }, 4000);
    }

    // =================================================================
    // 1. NAVIGATION & LISTING
    // =================================================================

    loadAnnouncements();

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active-tab', 'border-indigo-500', 'text-indigo-600');
                b.classList.add('border-transparent', 'text-gray-500');
            });
            
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
            if (loader) loader.innerHTML = `<p class="text-red-500">${msgLoadError}</p>`;
            showNotification(msgLoadErrorToast, 'error');
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
                container.innerHTML = `<p class="text-center text-gray-500 py-8">${msgNoAnnouncements}</p>`;
            }
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            const isUnread = (type === 'inbox' && !item.is_read) || (type === 'all' && item.is_recipient && !item.is_read);
            
            // MODIFICATION RTL : border-s-4 à la place de border-l-4
            el.className = `bg-white p-4 rounded-lg border ${isUnread ? 'border-s-4 border-s-indigo-500 border-gray-200 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'} shadow-sm cursor-pointer transition-all hover:shadow-md`;
            
            let iconClass = 'fa-info-circle text-blue-500';
            if (item.type_code === 'HOMEWORK') iconClass = 'fa-book text-orange-500';
            if (item.type_code === 'TEST') iconClass = 'fa-file-alt text-red-500';
            if (item.type_code === 'COURSE') iconClass = 'fa-graduation-cap text-green-500';

            let homeworkBadge = '';
            if (item.type_code === 'HOMEWORK') {
                if (item.requires_submission) {
                    homeworkBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 ms-2">
                        <i class="fas fa-upload"></i> <span>${msgWithSubmission}</span>
                    </span>`;
                } else {
                    homeworkBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 ms-2">
                        <span>${msgWithoutSubmission}</span>
                    </span>`;
                }
            }

            let infoLine = "";
            if (type === 'inbox') {
                infoLine = `${msgSenderLabel} <span class="font-medium">${item.sender}</span>`;
            } else if (type === 'sent') {
                infoLine = `${msgRecipientLabel} ${item.targets_summary || msgMultipleRecipients}`;
            } else if (type === 'all') {
                infoLine = `${msgSenderLabel} <span class="font-medium">${item.sender}</span>`;
            }

            el.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-start gap-3 overflow-hidden">
                        <div class="mt-1 flex-shrink-0">
                            <i class="fas ${iconClass} text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center flex-wrap gap-1">
                                <h4 class="text-base font-bold text-gray-900 truncate" dir="auto">${escapeHtml(item.title)}</h4>
                                ${homeworkBadge}
                            </div>
                            <p class="text-sm text-gray-500" dir="auto">
                                ${infoLine}
                                <span class="mx-1">•</span> <span dir="ltr">${item.date}</span>
                            </p>
                            <p class="text-sm text-gray-600 mt-1 line-clamp-2" dir="auto">${escapeHtml(item.content.substring(0, 150))}...</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2 flex-shrink-0 ms-2">
                        ${item.attachments && item.attachments.length > 0 ? '<i class="fas fa-paperclip text-gray-400" title="Pièces jointes"></i>' : ''}
                        ${type === 'sent' ? renderSentStats(item.stats) : ''}
                    </div>
                </div>
            `;
            
            el.addEventListener('click', () => openViewModal(type, item));
            container.appendChild(el);
        });
    }

    function renderSentStats(stats) {
        if (!stats) return '';
        let color = 'bg-indigo-600';
        if (stats.percent < 30) color = 'bg-red-500';
        else if (stats.percent < 70) color = 'bg-orange-500';
        else color = 'bg-green-500';

        return `
            <div class="w-24 text-end">
                <div class="text-xs text-gray-500 mb-1" dir="ltr">${stats.read}/${stats.total} lus</div>
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
    if(viewSender) viewSender.textContent = item.sender || msgMe;
    if(viewDate) viewDate.textContent = item.date;
    if(viewContent) viewContent.innerHTML = item.content.replace(/\n/g, '<br>');
    if(viewTypeBadge) viewTypeBadge.textContent = item.type;

    if (homeworkActionContainer && linkHomeworkDetail) {
        if (item.type_code === 'HOMEWORK' && item.requires_submission) {
            linkHomeworkDetail.href = `/communications/homework/${item.id}/`;
            
            if (type === 'sent' || item.is_sender) {
                if (homeworkLinkText) homeworkLinkText.textContent = msgViewSubmissions;
            } else {
                if (homeworkLinkText) homeworkLinkText.textContent = msgManageSubmission;
            }
            
            homeworkActionContainer.classList.remove('hidden');
        } else {
            homeworkActionContainer.classList.add('hidden');
        }
    }
    
    if (item.attachments && item.attachments.length > 0) {
        if(viewAttachmentsContainer) viewAttachmentsContainer.classList.remove('hidden');
        if(viewAttachmentsList) {
            viewAttachmentsList.innerHTML = item.attachments.map(file => `
                <a href="${file.url}" target="_blank" class="flex items-center gap-3 p-3 rounded border border-gray-200 hover:bg-gray-50 group transition-colors">
                    <div class="p-2 bg-indigo-50 text-indigo-600 rounded group-hover:bg-indigo-100 flex-shrink-0">
                        <i class="fas ${getFileIcon(file.type)}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-700 truncate" dir="auto">${escapeHtml(file.name)}</p>
                        <p class="text-xs text-gray-500">${msgDownload}</p>
                    </div>
                </a>
            `).join('');
        }
    } else {
        if(viewAttachmentsContainer) viewAttachmentsContainer.classList.add('hidden');
    }

    // Gestion du footer
    if (type === 'sent') {
        if(viewFooterAction) viewFooterAction.classList.add('hidden');
        if(viewStatsContainer) {
            viewStatsContainer.classList.remove('hidden');
            if (item.stats) {
                document.getElementById('view-stats-read').textContent = item.stats.read;
                document.getElementById('view-stats-total').textContent = item.stats.total;
                document.getElementById('view-stats-percent').textContent = item.stats.percent + '%';
                document.getElementById('view-stats-bar').style.width = item.stats.percent + '%';
            }
        }
    } else {
        if(viewFooterAction) viewFooterAction.classList.remove('hidden');
        if(viewStatsContainer) viewStatsContainer.classList.add('hidden');
        
        if (type === 'all' && !item.is_recipient) {
            if(checkReadLabel) checkReadLabel.classList.add('hidden');
            if(readConfirmation) readConfirmation.classList.add('hidden');
            if(readOnlyMsg) readOnlyMsg.classList.remove('hidden');
        } else {
            if(readOnlyMsg) readOnlyMsg.classList.add('hidden');
            
            if (item.is_read) {
                if(checkReadLabel) checkReadLabel.classList.add('hidden');
                if(readConfirmation) readConfirmation.classList.remove('hidden');
                document.getElementById('read-date').textContent = item.read_at || '';
            } else {
                if(checkReadLabel) checkReadLabel.classList.remove('hidden');
                if(checkRead) {
                    checkRead.checked = false;
                    checkRead.disabled = false;
                    checkRead.parentElement.classList.remove('hidden'); 
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
                    e.target.parentElement.classList.add('hidden'); 
                    if(readConfirmation) readConfirmation.classList.remove('hidden');
                    document.getElementById('read-date').textContent = msgJustNow;
                    loadAnnouncements(); 
                    showNotification(msgReadSuccess, 'success');
                }
            } catch (err) {
                console.error(err);
                e.target.checked = false;
                showNotification(msgReadError, 'error');
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

    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const targets = {
                classes: getCheckedValues('target-class'),
                staff_groups: getCheckedValues('target-group'),
                students: [],
                staff_individuals: []
            };

            if (targets.classes.length === 0 && targets.staff_groups.length === 0) {
                showNotification(msgNoRecipientError, "error");
                return;
            }

            const formData = new FormData(formCreate);
            formData.append('targets', JSON.stringify(targets));

            const submitBtn = document.getElementById('btn-submit-announcement');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            // Séparation icône + texte avec gap-2
            submitBtn.innerHTML = `<div class="inline-flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>${msgSending}</span></div>`;

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
                    
                    showNotification(msgSendSuccess, 'success');
                } else {
                    showNotification("Erreur : " + json.message, 'error');
                }

            } catch (err) {
                console.error(err);
                showNotification(msgTechError, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            if(fileList) {
                fileList.innerHTML = '';
                Array.from(e.target.files).forEach(file => {
                    const div = document.createElement('div');
                    // Séparation icône + texte avec gap-2
                    div.className = 'flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm gap-2';
                    div.innerHTML = `
                        <span class="truncate inline-flex items-center gap-2" dir="auto">
                            <i class="fas fa-file text-gray-400"></i>
                            <span>${escapeHtml(file.name)}</span>
                        </span>
                        <span class="text-xs text-gray-500 flex-shrink-0" dir="ltr">${(file.size / 1024).toFixed(0)} KB</span>
                    `;
                    fileList.appendChild(div);
                });
            }
        });
    }
}

function renderTargetSelectors() {
    if (!targetsContainer) return;
    
    targetsContainer.innerHTML = '';

    if (TARGETS_CONFIG.classes && TARGETS_CONFIG.classes.length > 0) {
        const section = document.createElement('div');
        section.className = 'mb-3';
        section.innerHTML = `<h4 class="text-xs font-bold text-gray-500 uppercase mb-2">${msgClassesLabel}</h4>`;
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';
        
        TARGETS_CONFIG.classes.forEach(cls => {
            const label = document.createElement('label');
            // Séparation avec gap-2
            label.className = 'flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-indigo-300';
            label.innerHTML = `
                <input type="checkbox" value="${cls.id}" class="target-class form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <span class="text-sm text-gray-700 select-none" dir="auto">${escapeHtml(cls.name)}</span>
            `;
            grid.appendChild(label);
        });
        section.appendChild(grid);
        targetsContainer.appendChild(section);
    }

    if (TARGETS_CONFIG.staff_groups && TARGETS_CONFIG.staff_groups.length > 0) {
        const section = document.createElement('div');
        section.className = 'mb-3 pt-3 border-t border-gray-100';
        section.innerHTML = `<h4 class="text-xs font-bold text-gray-500 uppercase mb-2">${msgStaffLabel}</h4>`;
        
        TARGETS_CONFIG.staff_groups.forEach(grp => {
            const label = document.createElement('label');
            // Séparation avec gap-2
            label.className = 'flex items-center gap-2 cursor-pointer mb-2';
            label.innerHTML = `
                <input type="checkbox" value="${grp.code}" class="target-group form-checkbox h-4 w-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500">
                <span class="text-sm text-gray-700" dir="auto">${escapeHtml(grp.name)}</span>
            `;
            section.appendChild(label);
        });
        targetsContainer.appendChild(section);
    }
    
    if ((!TARGETS_CONFIG.classes || TARGETS_CONFIG.classes.length === 0) && (!TARGETS_CONFIG.staff_groups || TARGETS_CONFIG.staff_groups.length === 0)) {
        targetsContainer.innerHTML = `<p class="text-sm text-red-500 italic">${msgNoRecipientAvailable}</p>`;
    }

    targetsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateTargetsSummary);
    });
}

function updateTargetsSummary() {
    if(!targetsSummary) return;
    const count = targetsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
    targetsSummary.textContent = msgRecipientSummaryFormat.replace('{count}', count);
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

});