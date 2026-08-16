document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('homework-submission-form');
    if (!form) return;

    // --- Récupération des traductions dynamiques (data-attributes) ---
    const msgSending = form.getAttribute('data-msg-sending') || "Envoi en cours...";
    const msgSuccess = form.getAttribute('data-msg-success') || "Rendu enregistré avec succès.";
    const msgNewFile = form.getAttribute('data-msg-new-file') || "Nouveau fichier envoyé";
    const msgEditSub = form.getAttribute('data-msg-edit-submission') || "Modifier mon rendu";
    const msgErrSave = form.getAttribute('data-msg-error-save') || "Une erreur est survenue lors de l'enregistrement.";
    const msgErrNetwork = form.getAttribute('data-msg-error-network') || "Une erreur réseau est survenue.";

    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const successAlert = document.getElementById('success-alert');
    const successMessage = document.getElementById('success-message');
    const btnSubmit = document.getElementById('btn-submit-submission');
    const btnText = document.getElementById('btn-submit-text');

    // Éléments de prévisualisation avant envoi
    const filesInput = document.getElementById('files-input');
    const selectedFilesPreview = document.getElementById('selected-files-preview');
    const selectedFilesCount = document.getElementById('selected-files-count');
    const selectedFilesList = document.getElementById('selected-files-list');

    // Éléments du rendu actuel
    const currentSubContainer = document.getElementById('current-submission-container');
    const subUpdatedAt = document.getElementById('submission-updated-at');
    const subFilesList = document.getElementById('submission-files-list');

    // 1. Écouteur pour afficher les fichiers sélectionnés avant l'envoi (Feedback visuel)
    if (filesInput) {
        filesInput.addEventListener('change', function() {
            const files = this.files;
            if (files.length > 0) {
                selectedFilesCount.textContent = files.length;
                selectedFilesList.innerHTML = '';

                Array.from(files).forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} Ko)`;
                    selectedFilesList.appendChild(li);
                });
                selectedFilesPreview.classList.remove('hidden');
            } else {
                selectedFilesPreview.classList.add('hidden');
            }
        });
    }

    // 2. Gestion de la soumission en AJAX
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        errorAlert.classList.add('hidden');
        successAlert.classList.add('hidden');

        const originalBtnText = btnText.textContent;
        btnSubmit.disabled = true;
        btnText.textContent = msgSending;

        const formData = new FormData(form);
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken
            },
            body: formData
        })
        .then(response => response.json().then(data => ({ status: response.ok, body: data })))
        .then(result => {
            if (result.status && result.body.success) {
                successMessage.textContent = result.body.message || msgSuccess;
                successAlert.classList.remove('hidden');
                
                // Mettre à jour la date dynamiquement (avec attribut dir="ltr")
                if (subUpdatedAt && result.body.updated_at) {
                    subUpdatedAt.textContent = result.body.updated_at;
                    subUpdatedAt.setAttribute('dir', 'ltr');
                }

                // Mettre à jour dynamiquement la liste des fichiers affichés sans rafraîchir
                if (subFilesList && filesInput && filesInput.files.length > 0) {
                    subFilesList.innerHTML = '';
                    Array.from(filesInput.files).forEach(file => {
                        const fileDiv = document.createElement('div');
                        fileDiv.className = "flex items-center gap-2 text-xs text-emerald-800 bg-white p-2 rounded border border-emerald-100";
                        fileDiv.setAttribute('dir', 'ltr');
                        fileDiv.innerHTML = `
                            <i class="fas fa-file-alt text-emerald-600 flex-shrink-0"></i>
                            <span class="truncate">${file.name} (${msgNewFile})</span>
                        `;
                        subFilesList.appendChild(fileDiv);
                    });
                }

                // Afficher le conteneur du rendu s'il était caché
                if (currentSubContainer) {
                    currentSubContainer.classList.remove('hidden');
                }

                // Réinitialiser l'input file et cacher la prévisualisation
                if (filesInput) filesInput.value = '';
                if (selectedFilesPreview) selectedFilesPreview.classList.add('hidden');

                // Changer le texte du bouton en mode modification (traduit)
                btnText.textContent = msgEditSub;

            } else {
                errorMessage.textContent = result.body.error || msgErrSave;
                errorAlert.classList.remove('hidden');
            }
        })
        .catch(error => {
            console.error('Erreur réseau:', error);
            errorMessage.textContent = msgErrNetwork;
            errorAlert.classList.add('hidden');
        })
        .finally(() => {
            btnSubmit.disabled = false;
            btnText.textContent = btnText.textContent === msgSending ? originalBtnText : btnText.textContent;
        });
    });
});