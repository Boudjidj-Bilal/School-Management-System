/**
 * create_session.js
 * Logique de saisie d'appel (Mode Production Safe)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // 1. CONFIGURATION & RÉFÉRENCES (Extraction depuis le DOM)
    // ----------------------------------------------------------------------

    // Récupération du conteneur de configuration
    const container = document.getElementById('attendance-container');
    if (!container) {
        console.error("Erreur critique : Le conteneur #attendance-container est introuvable.");
        return;
    }

    // Extraction des données de configuration (Data Attributes)
    // Note: data-class-id devient dataset.classId en JS
    const CLASS_ID = container.dataset.classId;
    const API_URLS = {
        SAVE_SESSION: container.dataset.apiSaveUrl,
        GET_DETAILS: container.dataset.apiDetailsUrl
    };

    // Récupération du CSRF Token depuis le formulaire
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    if (!CLASS_ID || !API_URLS.SAVE_SESSION || !CSRF_TOKEN) {
        console.error("Configuration manquante (ID classe, API URLs ou CSRF).");
    }

    // --- ÉLÉMENTS DOM ---
    const form = document.getElementById('attendance-form');
    const sessionIdInput = document.getElementById('session-id');
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start_time');
    const endTimeInput = document.getElementById('end_time');
    const submitBtn = document.getElementById('submit-btn');
    const newSessionBtn = document.getElementById('btn-new-session');
    const notificationArea = document.getElementById('notification-area');
    const historyItems = document.querySelectorAll('.history-item');


    // ----------------------------------------------------------------------
    // 2. UTILITAIRES
    // ----------------------------------------------------------------------

    function showNotification(message, type) {
        const colorMap = {
            success: 'bg-green-100 text-green-800 border-green-400',
            error: 'bg-red-100 text-red-800 border-red-400',
        };
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-times-circle';

        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center transition-all duration-300 opacity-0 transform translate-y-2`;
        div.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

        if (notificationArea) {
            notificationArea.appendChild(div);
            
            requestAnimationFrame(() => div.classList.remove('opacity-0', 'translate-y-2'));
            setTimeout(() => {
                div.classList.add('opacity-0', 'translate-y-2');
                div.addEventListener('transitionend', () => div.remove());
            }, 4000);
        } else {
            // Fallback si la zone de notif n'existe pas
            alert(message);
        }
    }

    async function apiFetch(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN,
                },
                body: JSON.stringify(data),
            });
            
            // On vérifie d'abord si la réponse est du JSON valide
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const json = await response.json();
                if (!response.ok) {
                    showNotification(json.message || `Erreur serveur (${response.status})`, 'error');
                    return { success: false, ...json };
                }
                return json;
            } else {
                // Erreur non-JSON (ex: erreur 500 HTML brute)
                showNotification(`Erreur critique serveur (${response.status})`, 'error');
                return { success: false };
            }

        } catch (error) {
            console.error("Erreur API:", error);
            showNotification("Erreur de connexion.", 'error');
            return { success: false };
        }
    }

    // ----------------------------------------------------------------------
    // 3. GESTION DU FORMULAIRE (ENREGISTREMENT)
    // ----------------------------------------------------------------------

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // UI Loading
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';

            // 1. Collecte des données de session
            const payload = {
                session_id: sessionIdInput.value || null, // Null si création
                class_id: CLASS_ID, 
                date: dateInput.value,
                start_time: startTimeInput.value,
                end_time: endTimeInput.value,
                attendances: []
            };

            // 2. Collecte des statuts élèves
            document.querySelectorAll('.student-row').forEach(row => {
                const studentId = row.dataset.studentId;
                // Trouve le radio coché dans cette ligne
                const checkedRadio = row.querySelector(`input[name="status_${studentId}"]:checked`);
                
                // Si une radio est cochée et qu'elle n'est pas désactivée (cas justifié)
                if (checkedRadio && !checkedRadio.disabled) {
                    payload.attendances.push({
                        student_id: studentId,
                        status: checkedRadio.value // "" (Présent), "DELAY", "ABSENCE"
                    });
                }
            });

            // 3. Envoi API
            const result = await apiFetch(API_URLS.SAVE_SESSION, payload);

            if (result.success) {
                showNotification("Appel enregistré avec succès !", 'success');
                // Rechargement après court délai pour mettre à jour l'historique à droite
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }


    // ----------------------------------------------------------------------
    // 4. CHARGEMENT D'UNE SESSION (HISTORIQUE)
    // ----------------------------------------------------------------------

    // Écouteur sur les éléments de l'historique
    if (historyItems) {
        historyItems.forEach(item => {
            item.addEventListener('click', async () => {
                // Vérifie si l'élément est verrouillé (cadenas)
                if (item.querySelector('.fa-lock')) {
                    showNotification("Ce trimestre est clos, modification impossible.", "error");
                    return;
                }

                const sessionId = item.dataset.sessionId;
                loadSession(sessionId);
            });
        });
    }

    async function loadSession(sessionId) {
        // UI Feedback sur l'historique
        historyItems.forEach(i => i.classList.remove('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300'));
        const activeItem = document.querySelector(`.history-item[data-session-id="${sessionId}"]`);
        if (activeItem) activeItem.classList.add('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300');

        // Appel API
        const result = await apiFetch(API_URLS.GET_DETAILS, { session_id: sessionId });

        if (result.success) {
            const data = result.data;

            // 1. Remplir les infos de base
            sessionIdInput.value = data.id;
            dateInput.value = data.date;
            startTimeInput.value = data.start_time;
            endTimeInput.value = data.end_time;

            // Changement visuel du bouton submit
            submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.innerHTML = '<i class="fas fa-edit mr-2"></i> Modifier l\'appel';

            // 2. Remplir les statuts élèves
            const attendancesMap = data.attendances || {};

            document.querySelectorAll('.student-row').forEach(row => {
                const studentId = row.dataset.studentId;
                const studentData = attendancesMap[studentId]; // { status: 'ABSENCE', justified: true/false }
                
                // Reset de la ligne avant application
                resetStudentRow(row);

                if (studentData) {
                    // Appliquer le statut (Absent ou Retard)
                    // Note: Sélecteur CSS robuste pour gérer la valeur vide ""
                    const radioToCheck = row.querySelector(`input[name="status_${studentId}"][value="${studentData.status}"]`);
                    if (radioToCheck) radioToCheck.checked = true;

                    // Gérer le cas JUSTIFIÉ (Verrouillage)
                    if (studentData.justified) {
                        lockStudentRow(row, "Absence justifiée (CPE)");
                    }
                } else {
                    // Si pas de données, c'est "Présent" (valeur "")
                    const radioPresent = row.querySelector(`input[name="status_${studentId}"][value=""]`);
                    if (radioPresent) radioPresent.checked = true;
                }
            });

            showNotification("Session chargée pour modification.", "success");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // ----------------------------------------------------------------------
    // 5. GESTION DU NOUVEL APPEL (RESET)
    // ----------------------------------------------------------------------

    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => {
            // Reset des champs
            sessionIdInput.value = "";
            
            // Remise à zéro visuelle du bouton
            submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Enregistrer l\'appel';

            // Reset de la sélection visuelle historique
            historyItems.forEach(i => i.classList.remove('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300'));

            // Reset de toutes les lignes élèves
            document.querySelectorAll('.student-row').forEach(row => {
                resetStudentRow(row);
                // Remet à "Présent" par défaut
                const radioPresent = row.querySelector(`input[value=""]`);
                if (radioPresent) radioPresent.checked = true;
            });

            showNotification("Mode création activé.", "success");
        });
    }


    // ----------------------------------------------------------------------
    // 6. HELPERS UI
    // ----------------------------------------------------------------------

    function resetStudentRow(row) {
        // Réactive tous les inputs
        row.querySelectorAll('input[type="radio"]').forEach(input => {
            input.disabled = false;
            input.parentElement.classList.remove('opacity-50', 'cursor-not-allowed');
        });

        // Cache le badge "Justifié"
        const badge = row.querySelector('.justification-badge');
        if (badge) {
            badge.classList.add('hidden');
            badge.textContent = '';
        }
        
        row.classList.remove('bg-gray-100');
    }

    function lockStudentRow(row, message) {
        // Désactive tous les inputs
        row.querySelectorAll('input[type="radio"]').forEach(input => {
            input.disabled = true;
            input.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
        });

        // Affiche le badge
        const badge = row.querySelector('.justification-badge');
        if (badge) {
            badge.textContent = message;
            badge.classList.remove('hidden');
            badge.classList.add('bg-green-100', 'text-green-800', 'border-green-200');
        }

        row.classList.add('bg-gray-50');
    }

});