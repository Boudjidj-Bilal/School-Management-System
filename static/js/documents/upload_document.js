/**
 * Gestion du formulaire de dépôt de document (Dropdown & File Input).
 * VERSION SÉCURISÉE (CSP Compliant).
 */

document.addEventListener('DOMContentLoaded', function() {
    const dropdownButton = document.getElementById('dropdown-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const searchInput = document.getElementById('student-search-input');
    const studentList = document.getElementById('student-list');
    const studentOptions = document.querySelectorAll('.student-option');
    
    const hiddenInput = document.getElementById('selected-student-id');
    const dropdownLabel = document.getElementById('dropdown-label');

    let isOpen = false;

    // 1. Ouvrir / Fermer le menu
    function toggleDropdown() {
        isOpen = !isOpen;
        if (isOpen) {
            dropdownMenu.classList.remove('hidden');
            searchInput.focus();
        } else {
            dropdownMenu.classList.add('hidden');
        }
    }

    if (dropdownButton) {
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
    }

    // 2. Fermer si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (dropdownButton && dropdownMenu && !dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
            isOpen = false;
            dropdownMenu.classList.add('hidden');
        }
    });

    // 3. Filtrage en temps réel (Recherche)
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();

            studentOptions.forEach(option => {
                const searchData = option.dataset.search.toLowerCase();
                if (searchData.includes(term)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
        });
    }

    // 4. Sélection d'un élève
    studentOptions.forEach(option => {
        option.addEventListener('click', function() {
            const id = this.dataset.id;
            const name = this.dataset.name;
            const className = this.dataset.class;

            // Mise à jour de l'UI
            if (dropdownLabel) {
                dropdownLabel.textContent = `${name} (${className})`;
                dropdownLabel.classList.remove('text-gray-500');
                dropdownLabel.classList.add('text-gray-900', 'font-bold');
            }

            // Mise à jour de l'input caché (Pour le formulaire)
            if (hiddenInput) hiddenInput.value = id;

            // Fermer le menu
            toggleDropdown();
        });
    });

    // 5. Gestion de l'upload de fichier (Nom du fichier)
    const fileInput = document.getElementById('pdf_file');
    const filenameDisplay = document.getElementById('filename-display');
    const uploadIcon = document.getElementById('upload-icon');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                if (filenameDisplay) {
                    filenameDisplay.textContent = this.files[0].name;
                    filenameDisplay.classList.add('text-indigo-600');
                }
                if (uploadIcon) {
                    uploadIcon.classList.remove('text-gray-400');
                    uploadIcon.classList.add('text-indigo-600');
                }
            } else {
                if (filenameDisplay) filenameDisplay.textContent = "";
                if (uploadIcon) {
                    uploadIcon.classList.add('text-gray-400');
                    uploadIcon.classList.remove('text-indigo-600');
                }
            }
        });
    }
});