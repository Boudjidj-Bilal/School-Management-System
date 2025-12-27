document.addEventListener('DOMContentLoaded', () => {
    
    console.log("Messaging JS chargé.");

    // --- RÉCUPÉRATION CONFIGURATION ---
    const API = window.API_URLS;
    const CSRF = window.CSRF_TOKEN;
    const USER_ID = window.USER_ID;

    if (!API) {
        console.error("ERREUR CRITIQUE : API_URLS non défini. Vérifiez le template HTML.");
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
    const blockedMessage = document.getElementById('blocked-message');

    // Modale
    const btnNewConv = document.getElementById('btn-new-conversation');
    const modal = document.getElementById('new-conversation-modal');
    const btnCloseModal = document.getElementById('close-modal-btn');
    const contactSearch = document.getElementById('contact-search');
    const contactsListEl = document.getElementById('contacts-list');

    // --- 1. GESTION DES CONVERSATIONS ---

    async function loadConversations() {
        try {
            const response = await fetch(API.LIST_CONVERSATIONS);
            const data = await response.json();
            
            if (data.success) {
                conversationList = data.conversations;
                renderConversationsList();
            }
        } catch (error) {
            console.error("Erreur chargement conversations:", error);
        }
    }

    function renderConversationsList() {
        conversationsListEl.innerHTML = '';

        if (conversationList.length === 0) {
            conversationsListEl.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <p>Aucune discussion.</p>
                    <button class="mt-2 text-indigo-600 hover:underline text-sm" id="btn-new-conv-link">
                        Commencer une nouvelle
                    </button>
                </div>`;
            
            // Attache le clic sur le lien dans le texte vide
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
            const activeClass = isActive ? 'bg-white border-l-4 border-indigo-600 shadow-sm' : (conv.unread_count > 0 ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-100 border-l-4 border-transparent');
            const textWeight = conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700';
            
            const div = document.createElement('div');
            div.className = `p-4 cursor-pointer transition-all duration-200 border-b border-gray-100 ${activeClass}`;
            div.onclick = () => openConversation(conv.id);

            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center overflow-hidden">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold mr-3 text-sm">
                            ${getInitials(conv.interlocutor_name)}
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-sm ${textWeight} truncate">${conv.interlocutor_name}</h4>
                        </div>
                    </div>
                </div>
            `;
            conversationsListEl.appendChild(div);
        });
    }

    async function openConversation(id) {
        currentConversationId = id;
        
        // Bascule Responsive (Si on est sur mobile, on cache la liste)
        // Note : Sur desktop, le CSS gère l'affichage simultané si configuré, 
        // sinon notre HTML actuel force une vue à la fois. On respecte le HTML.
        if (leftCol && rightCol) {
            leftCol.classList.add('hidden');
            rightCol.classList.remove('hidden');
            rightCol.classList.add('flex');
        }

        // UI Reset
        if (chatHeader) chatHeader.classList.remove('hidden');
        if (messagesContainer) {
            messagesContainer.classList.remove('hidden');
            messagesContainer.innerHTML = '<div class="flex justify-center items-center h-full text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Chargement...</div>';
        }

        try {
            const url = `${API.GET_MESSAGES_BASE}${id}/`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                if (headerName) headerName.textContent = data.interlocutor_name;
                if (headerAvatar) headerAvatar.textContent = getInitials(data.interlocutor_name);
                if (headerRole) headerRole.textContent = data.is_active ? 'Actif' : 'Inactif';
                if (headerStatusIndicator) headerStatusIndicator.className = `w-2 h-2 rounded-full mr-1 ${data.is_active ? 'bg-green-500' : 'bg-gray-400'}`;

                if (data.is_active) {
                    if (inputArea) inputArea.classList.remove('hidden');
                    if (blockedMessage) blockedMessage.classList.add('hidden');
                    if (messageInput) {
                        messageInput.disabled = false;
                        messageInput.focus();
                    }
                } else {
                    if (inputArea) inputArea.classList.remove('hidden');
                    if (messageForm) messageForm.classList.add('hidden');
                    if (blockedMessage) blockedMessage.classList.remove('hidden');
                }

                renderMessages(data.messages);
                loadConversations(); // Update unread counts
            }
        } catch (error) {
            console.error("Erreur API messages:", error);
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
            messagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                    <i class="fas fa-paper-plane text-2xl text-gray-300"></i>
                    <p class="text-sm">Début de la conversation.</p>
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
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                    }">
                        ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                    </div>
                    <span class="text-[10px] text-gray-400 mt-1 px-1">
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
                const response = await fetch(API.SEND_MESSAGE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF
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
                            <div class="px-4 py-2 rounded-2xl shadow-sm text-sm bg-indigo-600 text-white rounded-br-none break-words">
                                ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                            </div>
                            <span class="text-[10px] text-gray-400 mt-1 px-1">
                                ${msg.date}
                            </span>
                        </div>
                    `;
                    
                    if (messagesContainer.querySelector('.fa-paper-plane')) {
                        messagesContainer.innerHTML = '';
                    }
                    
                    messagesContainer.appendChild(bubbleDiv);
                    scrollToBottom();
                    loadConversations(); // Pour mettre à jour le dernier message dans la liste
                }
            } catch (e) {
                console.error(e);
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
        console.log("Ouverture modale...");
        if (modal) {
            modal.classList.remove('hidden');
            
            // Force le repaint pour l'animation
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                const modalCard = modal.querySelector('div.bg-white'); // La carte interne
                if (modalCard) {
                    modalCard.classList.remove('scale-95', 'opacity-0');
                    modalCard.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
            
            loadContacts();
        } else {
            console.error("Modale introuvable dans le DOM");
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
        contactsListEl.innerHTML = '<div class="p-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Chargement...</div>';
        
        try {
            console.log("Appel API Contacts:", API.LIST_CONTACTS);
            const response = await fetch(API.LIST_CONTACTS);
            const data = await response.json();
            
            console.log("Données contacts reçues:", data);

            if (data.success) {
                renderContacts(data.contacts);
            } else {
                contactsListEl.innerHTML = '<p class="text-center text-red-500 p-4">Erreur: Impossible de charger les contacts.</p>';
            }
        } catch (e) {
            console.error("Erreur fetch contacts:", e);
            contactsListEl.innerHTML = '<p class="text-center text-red-500 p-4">Erreur réseau.</p>';
        }
    }

    function renderContacts(contacts) {
        if (!contacts || contacts.length === 0) {
            contactsListEl.innerHTML = '<div class="p-8 text-center text-gray-400">Aucun contact disponible.</div>';
            return;
        }

        // Sauvegarde globale pour la recherche
        window.availableContacts = contacts;

        let html = '';
        contacts.forEach(contact => {
            html += buildContactItem(contact);
        });
        contactsListEl.innerHTML = html;
        
        attachContactListeners();
    }

    function buildContactItem(contact) {
        const icon = contact.type === 'student' ? 'fa-user-graduate' : (contact.type === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user');
        const color = contact.type === 'student' ? 'text-green-600 bg-green-100' : (contact.type === 'teacher' ? 'text-blue-600 bg-blue-100' : 'text-orange-600 bg-orange-100');
        
        return `
            <div class="contact-item p-3 hover:bg-gray-50 cursor-pointer flex items-center transition-colors border-b border-gray-50" 
                 data-id="${contact.id}" data-type="${contact.type}">
                <div class="w-10 h-10 rounded-full ${color} flex-shrink-0 flex items-center justify-center mr-3">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="min-w-0">
                    <p class="font-semibold text-gray-800 text-sm truncate">${contact.name}</p>
                    <p class="text-xs text-gray-500 capitalize">${contact.type === 'teacher' ? 'Professeur' : (contact.type === 'student' ? 'Élève' : 'Parent')}</p>
                </div>
            </div>
        `;
    }

    function attachContactListeners() {
        document.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', async () => {
                const targetId = item.dataset.id;
                const targetType = item.dataset.type;
                
                // Feedback visuel immédiat
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';

                try {
                    const response = await fetch(API.CREATE_CONVERSATION, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': CSRF
                        },
                        body: JSON.stringify({ target_id: targetId, target_type: targetType })
                    });
                    const data = await response.json();
                    if (data.success) {
                        closeModal();
                        await loadConversations();
                        openConversation(data.conversation_id);
                    } else {
                        alert(data.message);
                        // Restore item state
                        item.style.opacity = '1';
                        item.style.pointerEvents = 'auto';
                    }
                } catch (e) {
                    console.error(e);
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                }
            });
        });
    }

    if (contactSearch) {
        contactSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (!window.availableContacts) return;
            
            const filtered = window.availableContacts.filter(c => c.name.toLowerCase().includes(term));
            let html = '';
            if (filtered.length === 0) {
                html = '<div class="p-4 text-center text-gray-400">Aucun résultat.</div>';
            } else {
                filtered.forEach(c => html += buildContactItem(c));
            }
            contactsListEl.innerHTML = html;
            attachContactListeners();
        });
    }


    // --- UTILITAIRES UI ---

    function scrollToBottom() {
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    function formatDate(dateStr) {
        return dateStr; 
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // --- INIT ---
    loadConversations();
    
    pollingInterval = setInterval(() => {
        // Rafraichit la liste pour les nouveaux messages
        // Si on est dans une conv, on pourrait aussi rafraichir les messages actifs
        // Pour l'instant, on recharge juste la liste pour les badges non lus
        loadConversations(); 
    }, 30000);

});