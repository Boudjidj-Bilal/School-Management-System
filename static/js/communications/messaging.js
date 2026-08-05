// ====================================================================
// LOGIQUE JAVASCRIPT POUR LA MESSAGERIE (messaging.js)
// VERSION SÉCURISÉE (CSP Compliant), MULTILINGUE ET COMPATIBLE RTL
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    console.log("Messaging JS chargé.");

    // --- 0. CONFIGURATION & CONTEXTE ---
    const container = document.getElementById('messaging-container');
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]') || document.getElementById('csrf-token');

    if (!container) {
        console.error("ERREUR CRITIQUE : Conteneur #messaging-container introuvable.");
        return;
    }

    // Récupération des traductions dynamiques (data-attributes)
    const msgErrorGeneric = container.getAttribute('data-msg-error-generic') || "Une erreur est survenue.";
    const msgNoConversations = container.getAttribute('data-msg-no-conversations') || "Aucune discussion.";
    const msgStartNewConv = container.getAttribute('data-msg-start-new') || "Commencer une nouvelle";
    const msgLoading = container.getAttribute('data-msg-loading') || "Chargement...";
    const msgStartChat = container.getAttribute('data-msg-start-chat') || "Début de la conversation.";
    const msgLoadingContacts = container.getAttribute('data-msg-loading') || "Chargement...";
    const msgErrorContactsLoad = container.getAttribute('data-msg-error-contacts') || "Erreur: Impossible de charger les contacts.";
    const msgNetworkError = container.getAttribute('data-msg-network-error') || "Erreur réseau.";
    const msgNoContacts = container.getAttribute('data-msg-no-contacts') || "Aucun contact disponible.";
    const msgNoUserFound = container.getAttribute('data-msg-no-user-found') || "Aucun utilisateur trouvé.";

    const CONFIG = {
        userId: container.dataset.userId,
        urls: {
            listConversations: container.dataset.apiListUrl,
            listContacts: container.dataset.apiContactsUrl,
            createConversation: container.dataset.apiCreateUrl,
            messagesBase: container.dataset.apiMessagesBase,
            sendBase: container.dataset.apiSendBase
        },
        csrfToken: csrfInput ? csrfInput.value : ''
    };

    if (!CONFIG.urls.listConversations) {
        console.error("ERREUR CRITIQUE : URLs API non définies. Vérifiez les data-attributes HTML.");
        showToast(msgErrorGeneric, "error");
        return;
    }

    // --- ÉTAT GLOBAL ---
    let currentConversationId = null;
    let conversationList = [];
    let pollingInterval = null;

    // --- ÉLÉMENTS DOM ---
    const leftCol = document.getElementById('left-col');
    const rightCol = document.getElementById('right-col');
    const btnBackList = document.getElementById('btn-back-list');

    const conversationsListEl = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const headerAvatar = document.getElementById('header-avatar');
    const headerName = document.getElementById('header-name');
    const headerRole = document.getElementById('header-role');
    const headerStatusIndicator = document.getElementById('header-status-indicator');
    
    const messagesContainer = document.getElementById('messages-container');
    const inputArea = document.getElementById('input-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');

    // Modale
    const btnNewConv = document.getElementById('btn-new-conversation');
    const modal = document.getElementById('new-conversation-modal');
    const btnCloseModal = document.getElementById('close-modal-btn');
    const contactSearch = document.getElementById('contact-search');
    const contactsListEl = document.getElementById('contacts-list');

    // --- 1. GESTION DES CONVERSATIONS ---

    async function loadConversations() {
        try {
            const response = await fetch(CONFIG.urls.listConversations);
            const data = await response.json();
            
            if (data.success) {
                conversationList = data.conversations;
                renderConversationsList();
            }
        } catch (error) {
            console.error("Erreur chargement conversations:", error);
            showToast(msgErrorGeneric, "error");
        }
    }

    function renderConversationsList() {
        conversationsListEl.innerHTML = '';

        if (conversationList.length === 0) {
            conversationsListEl.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <p>${msgNoConversations}</p>
                    <button class="mt-2 text-indigo-600 hover:underline text-sm" id="btn-new-conv-link">
                        ${msgStartNewConv}
                    </button>
                </div>`;
            
            const linkBtn = document.getElementById('btn-new-conv-link');
            if(linkBtn) {
                linkBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openModalNewConv();
                });
            }
            return;
        }

        conversationList.forEach(conv => {
            const isActive = (conv.id === currentConversationId);
            const activeClass = isActive ? 'bg-white border-s-4 border-indigo-600 shadow-sm' : (conv.unread_count > 0 ? 'bg-indigo-50 border-s-4 border-indigo-500' : 'hover:bg-gray-100 border-s-4 border-transparent');
            const textWeight = conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700';
            
            const div = document.createElement('div');
            div.className = `p-4 cursor-pointer transition-all duration-200 border-b border-gray-100 ${activeClass}`;
            div.onclick = () => openConversation(conv.id);

            // Séparateur logique avec gap-3
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-sm">
                            ${getInitials(conv.interlocutor_name)}
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-sm ${textWeight} truncate" dir="auto">${escapeHtml(conv.interlocutor_name)}</h4>
                        </div>
                    </div>
                </div>
            `;
            conversationsListEl.appendChild(div);
        });
    }

    async function openConversation(id) {
        currentConversationId = id;
        
        if (leftCol && rightCol) {
            leftCol.classList.add('hidden');
            rightCol.classList.remove('hidden');
            rightCol.classList.add('flex');
        }

        if (chatHeader) chatHeader.classList.remove('hidden');
        if (messagesContainer) {
            messagesContainer.classList.remove('hidden');
            // Séparation icône + texte avec gap-2
            messagesContainer.innerHTML = `<div class="flex justify-center items-center gap-2 h-full text-gray-400"><i class="fas fa-spinner fa-spin"></i> <span>${msgLoading}</span></div>`;
        }

        try {
            const url = `${CONFIG.urls.messagesBase}${id}/`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                if (headerName) headerName.textContent = data.interlocutor_name;
                if (headerAvatar) headerAvatar.textContent = getInitials(data.interlocutor_name);
                if (headerRole) headerRole.textContent = data.interlocutor_role;
                if (headerStatusIndicator) headerStatusIndicator.className = `w-2 h-2 rounded-full flex-shrink-0 ${data.is_active ? 'bg-green-500' : 'bg-gray-400'}`;

                if (inputArea) inputArea.classList.remove('hidden');

                if (messageForm) {
                    messageForm.classList.remove('hidden');
                }
                if (messageInput) {
                    messageInput.disabled = !data.is_active;

                    if (data.is_active) {
                        messageInput.focus();
                    }
                }

                const sendBtn = document.getElementById('send-btn');
                if (sendBtn) {
                    sendBtn.disabled = !data.is_active;
                }

                renderMessages(data.messages);
                loadConversations();
            }
        } catch (error) {
            console.error("Erreur API messages:", error);
            showToast(msgErrorGeneric, "error");
        }
    }

    if (btnBackList) {
        btnBackList.addEventListener('click', () => {
            rightCol.classList.add('hidden');
            rightCol.classList.remove('flex');
            leftCol.classList.remove('hidden');
            leftCol.classList.add('flex');
            currentConversationId = null;
            loadConversations();
        });
    }

    function renderMessages(messages) {
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            // Séparation icône + texte verticale avec gap-2
            messagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 h-full text-gray-400">
                    <i class="fas fa-paper-plane text-2xl text-gray-300"></i>
                    <span class="text-sm">${msgStartChat}</span>
                </div>`;
            return;
        }

        messages.forEach(msg => {
            const isMe = msg.is_me;
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`;

            const bubbleContent = `
                <div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <div class="px-4 py-2 rounded-2xl shadow-sm text-sm break-words ${
                        isMe 
                        ? 'bg-indigo-600 text-white rounded-ee-none' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-es-none'
                    }" dir="auto">
                        ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                    </div>
                    <span class="text-[10px] text-gray-400 mt-1 px-1" dir="ltr">
                        ${msg.date}
                    </span>
                </div>
            `;
            bubbleDiv.innerHTML = bubbleContent;
            messagesContainer.appendChild(bubbleDiv);
        });

        scrollToBottom();
    }

    // --- 2. ENVOI DE MESSAGES ---

    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = messageInput.value.trim();
            if (!content || !currentConversationId) return;

            messageInput.value = '';
            messageInput.style.height = 'auto';

            try {
                const response = await fetch(CONFIG.urls.sendBase, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CONFIG.csrfToken
                    },
                    body: JSON.stringify({
                        conversation_id: currentConversationId,
                        content: content
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    const msg = data.message;
                    const bubbleDiv = document.createElement('div');
                    bubbleDiv.className = `flex w-full mb-4 justify-end`;
                    
                    bubbleDiv.innerHTML = `
                        <div class="max-w-[75%] flex flex-col items-end">
                            <div class="px-4 py-2 rounded-2xl shadow-sm text-sm bg-indigo-600 text-white rounded-ee-none break-words" dir="auto">
                                ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                            </div>
                            <span class="text-[10px] text-gray-400 mt-1 px-1" dir="ltr">
                                ${msg.date}
                            </span>
                        </div>
                    `;
                    
                    if (messagesContainer.querySelector('.fa-paper-plane')) {
                        messagesContainer.innerHTML = '';
                    }
                    
                    messagesContainer.appendChild(bubbleDiv);
                    scrollToBottom();
                    loadConversations();
                }
            } catch (e) {
                console.error(e);
                showToast(msgErrorGeneric, "error");
            }
        });

        if (messageInput) {
            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
                if (this.value === '') this.style.height = 'auto';
            });

            messageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    messageForm.dispatchEvent(new Event('submit'));
                }
            });
        }
    }

    // --- 3. MODALE NOUVELLE DISCUSSION ---

    function openModalNewConv() {
        if (modal) {
            modal.classList.remove('hidden');
            
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                const modalCard = modal.querySelector('div.bg-white');
                if (modalCard) {
                    modalCard.classList.remove('scale-95', 'opacity-0');
                    modalCard.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
            
            loadContacts();
        } else {
            console.error("Modale introuvable dans le DOM");
            showToast(msgErrorGeneric, "error");
        }
    }

    if (btnNewConv) {
        btnNewConv.addEventListener('click', (e) => {
            e.preventDefault();
            openModalNewConv();
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', closeModal);
    }

    function closeModal() {
        if (!modal) return;
        
        modal.classList.add('opacity-0');
        const modalCard = modal.querySelector('div.bg-white');
        if (modalCard) {
            modalCard.classList.remove('scale-100', 'opacity-100');
            modalCard.classList.add('scale-95', 'opacity-0');
        }
        setTimeout(() => {
            modal.classList.add('hidden');
            if(contactSearch) contactSearch.value = '';
        }, 300);
    }

    async function loadContacts() {
        if (!contactsListEl) return;
        // Séparation icône + texte avec gap-2
        contactsListEl.innerHTML = `<div class="p-8 text-center text-gray-500 flex items-center justify-center gap-2"><i class="fas fa-spinner fa-spin"></i> <span>${msgLoadingContacts}</span></div>`;
        
        try {
            const response = await fetch(CONFIG.urls.listContacts);
            const data = await response.json();

            if (data.success) {
                renderContacts(data.contacts);
            } else {
                contactsListEl.innerHTML = `<p class="text-center text-red-500 p-4">${msgErrorContactsLoad}</p>`;
            }
        } catch (e) {
            console.error("Erreur fetch contacts:", e);
            showToast(msgErrorGeneric, "error");
            contactsListEl.innerHTML = `<p class="text-center text-red-500 p-4">${msgNetworkError}</p>`;
        }
    }

    function renderContacts(contacts) {
        if (!contacts || contacts.length === 0) {
            contactsListEl.innerHTML = `<div class="p-8 text-center text-gray-400">${msgNoContacts}</div>`;
            return;
        }

        window.availableContacts = contacts;

        let html = '';
        contacts.forEach(contact => {
            html += buildContactItem(contact);
        });
        contactsListEl.innerHTML = html;
        
        attachContactListeners();
    }

    function buildContactItem(contact) {

        const config = {
            principal: {
                icon: 'fa-user-tie',
                color: 'text-red-600 bg-red-100'
            },
            teacher: {
                icon: 'fa-chalkboard-teacher',
                color: 'text-blue-600 bg-blue-100'
            },
            cpe: {
                icon: 'fa-user-shield',
                color: 'text-purple-600 bg-purple-100'
            },
            administrator: {
                icon: 'fa-briefcase',
                color: 'text-amber-600 bg-amber-100'
            },
            parent: {
                icon: 'fa-user',
                color: 'text-orange-600 bg-orange-100'
            },
            student: {
                icon: 'fa-user-graduate',
                color: 'text-green-600 bg-green-100'
            }
        };
    
        const current = config[contact.type] || {
            icon: 'fa-user',
            color: 'text-gray-600 bg-gray-100'
        };
    
        const displayLabel = `${contact.name} (@${contact.username})`;
    
        // Séparateur logique avec gap-3
        return `
            <div
                class="contact-item p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-gray-50"
                data-id="${contact.id}"
                data-type="${contact.type}"
            >
                <div class="w-10 h-10 rounded-full ${current.color} flex-shrink-0 flex items-center justify-center">
                    <i class="fas ${current.icon}"></i>
                </div>
    
                <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 text-sm truncate" dir="auto">
                        ${escapeHtml(displayLabel)}
                    </p>
                    <p class="text-xs text-gray-500 truncate" dir="auto">
                        ${escapeHtml(contact.role)}
                    </p>
                </div>
            </div>
        `;
    }

    function attachContactListeners() {
        document.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', async () => {
                const targetId = item.dataset.id;
                const targetType = item.dataset.type;
                
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';

                try {
                    const response = await fetch(CONFIG.urls.createConversation, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': CONFIG.csrfToken
                        },
                        body: JSON.stringify({ target_id: targetId, target_type: targetType })
                    });
                    const data = await response.json();
                    if (data.success) {
                        closeModal();
                        await loadConversations();
                        openConversation(data.conversation_id);
                    } else {
                        showToast(data.message, "error");
                        item.style.opacity = '1';
                        item.style.pointerEvents = 'auto';
                    }
                } catch (e) {
                    console.error(e);
                    showToast(msgErrorGeneric, "error");
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                }
            });
        });
    }

    if (contactSearch) {
        contactSearch.addEventListener('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
    
            if (!window.availableContacts) {
                return;
            }
    
            const filtered = window.availableContacts.filter(contact => {
                return (
                    contact.name.toLowerCase().includes(term) ||
                    contact.username.toLowerCase().includes(term) ||
                    contact.role.toLowerCase().includes(term)
                );
            });
    
            if (filtered.length === 0) {
                contactsListEl.innerHTML = `
                    <div class="p-8 text-center text-gray-400">
                        ${msgNoUserFound}
                    </div>
                `;
                return;
            }
    
            contactsListEl.innerHTML = filtered
                .map(buildContactItem)
                .join("");
    
            attachContactListeners();
        });
    }

    // Affichage des toasts avec gap-2
    function showToast(message, type = "error") {
        const container = document.getElementById("toast-container");
        if (!container) return;
    
        const colors = {
            success: "bg-green-600",
            error: "bg-red-600",
            warning: "bg-yellow-500",
            info: "bg-indigo-600"
        };
    
        const icons = {
            success: "fa-check-circle",
            error: "fa-circle-exclamation",
            warning: "fa-triangle-exclamation",
            info: "fa-circle-info"
        };
    
        const toast = document.createElement("div");
    
        toast.className = `
            ${colors[type]}
            text-white
            rounded-lg
            shadow-xl
            px-4
            py-3
            min-w-[320px]
            max-w-[420px]
            flex
            items-center
            gap-2
            pointer-events-auto
            opacity-0
            translate-x-8
            transition-all
            duration-300
        `;
    
        toast.innerHTML = `
            <i class="fas ${icons[type]} text-lg flex-shrink-0"></i>
            <span class="flex-1" dir="auto">${escapeHtml(message)}</span>
        `;
    
        container.appendChild(toast);
    
        requestAnimationFrame(() => {
            toast.classList.remove("opacity-0", "translate-x-8");
        });
    
        setTimeout(() => {
            toast.classList.add("opacity-0", "translate-x-8");
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    // --- UTILITAIRES UI ---

    function scrollToBottom() {
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // --- INIT ---
    loadConversations();
    
    pollingInterval = setInterval(() => {
        loadConversations(); 
    }, 30000);

});