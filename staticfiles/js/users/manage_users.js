document.addEventListener('DOMContentLoaded', function() {
    const userForm = document.getElementById('user-form');
    const createBtn = document.getElementById('create-btn');
    const userLinks = document.querySelectorAll('.user-link');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const userIdInput = document.getElementById('user-id');
    const userTypeInput = document.getElementById('user-type-input');
    const firstNameInput = document.getElementById('first_name');
    const lastNameInput = document.getElementById('last_name');
    const emailInput = document.getElementById('email');
    const passwordField = document.getElementById('password-field');
    const passwordInput = document.getElementById('password');
    const staffTypeField = document.getElementById('staff-type-field');
    const addressInput = document.getElementById('address');
    const genderInput = document.getElementById('gender');
    const birthDateInput = document.getElementById('birth_date');
    
    // Champ pour le numéro national
    const nationalNumberInput = document.getElementById('national_number');

    const formUserAvatar = document.getElementById('form-user-avatar');
    const formUserInitials = document.getElementById('form-user-initials');

    const toggleStatusButtons = document.querySelectorAll('.toggle-status-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const userType = userTypeInput.value;
    const userSchoolId = userForm.getAttribute('data-school-id');

    function showCreateMode() {
        formTitle.textContent = 'Créer un nouvel utilisateur';
        submitBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Créer';
        userIdInput.value = '';
        userForm.reset();
        passwordField.style.display = 'none';
        
        cancelBtn.style.display = 'none'; // Hide cancel button in create mode

        formUserAvatar.classList.add('hidden');
        formUserAvatar.src = '';
        formUserInitials.classList.remove('hidden');
        formUserInitials.innerHTML = '<i class="fas fa-user"></i>';

        if (userType === 'staff') {
            staffTypeField.style.display = 'block';
        } else if (userType === 'parent') {
            staffTypeField.style.display = 'none';
        } else {
            staffTypeField.style.display = 'none';
        }
    }

    function showEditMode(user) {
        formTitle.textContent = 'Modifier un utilisateur';
        submitBtn.innerHTML = '<i class="fas fa-edit mr-2"></i> Mettre à jour';
        userIdInput.value = user.id;
        firstNameInput.value = user.firstName;
        lastNameInput.value = user.lastName;
        emailInput.value = user.email;
        addressInput.value = user.address;
        genderInput.value = user.gender;
        birthDateInput.value = user.birthDate;

        // Remplissage du numéro national s'il existe (Uniquement pour les élèves)
        if (nationalNumberInput) {
            nationalNumberInput.value = user.nationalNumber || '';
        }

        // Gestion de l'affichage Photo vs Initiales
        if (user.profilePictureUrl && user.profilePictureUrl !== 'None' && user.profilePictureUrl !== '') {
            // Cas 1 : Il y a une photo
            formUserAvatar.src = user.profilePictureUrl;
            formUserAvatar.classList.remove('hidden');
            formUserInitials.classList.add('hidden');
        } else {
            // Cas 2 : Pas de photo, on affiche l'initiale du prénom
            formUserAvatar.classList.add('hidden');
            formUserInitials.classList.remove('hidden');
            // On met la première lettre du prénom en majuscule
            const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() : '?';
            formUserInitials.innerHTML = `<span class="text-3xl">${initial}</span>`;
        }

        passwordField.style.display = 'block';
        passwordInput.required = false;
        cancelBtn.style.display = 'block'; // Show cancel button in edit mode

        if (user.staffType) {
            staffTypeField.style.display = 'block';
            document.getElementById('staff_type').value = user.staffType;
        } else {
            staffTypeField.style.display = 'none';
        }

    }

    createBtn.addEventListener('click', showCreateMode);
    cancelBtn.addEventListener('click', showCreateMode);

    userLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const user = {
                id: this.getAttribute('data-user-id'),
                firstName: this.getAttribute('data-first-name'),
                lastName: this.getAttribute('data-last-name'),
                email: this.getAttribute('data-email'),
                staffType: this.getAttribute('data-staff-type'),
                address: this.getAttribute('data-address'),
                gender: this.getAttribute('data-gender'),
                birthDate: this.getAttribute('data-birth-date'),
                profilePictureUrl: this.getAttribute('data-profile-picture-url'),
                // Extraction du numéro national de l'attribut data
                nationalNumber: this.getAttribute('data-national-number')
            };
            showEditMode(user);
        });
    });

    userForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = {};
        formData.forEach((value, key) => (data[key] = value));

        if (userSchoolId) {
            data['school_id'] = userSchoolId;
        }

        fetch('/create-user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showCustomMessage(data.message);
                window.location.reload();
            } else {
                showCustomMessage('Erreur: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Erreur :', error);
            showCustomMessage('Une erreur est survenue lors de l\'opération.');
        });
    });

    toggleStatusButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const action = this.getAttribute('data-action');
            const userName = this.getAttribute('data-user-name');

            let message = '';
            let confirmBtnClass = '';
            if (action === 'deactivate') {
                message = `Êtes-vous sûr de vouloir désactiver l'utilisateur "${userName}" ?`;
                confirmBtnClass = 'bg-red-600 hover:bg-red-700';
            } else {
                message = `Êtes-vous sûr de vouloir activer l'utilisateur "${userName}" ?`;
                confirmBtnClass = 'bg-green-600 hover:bg-green-700';
            }

            modalMessage.textContent = message;
            modalConfirmBtn.className = `px-4 py-2 text-white rounded-lg text-sm font-medium transition duration-300 ${confirmBtnClass}`;
            
            confirmationModal.classList.remove('hidden');

            modalConfirmBtn.onclick = () => {
                confirmationModal.classList.add('hidden');
                fetch('/toggle-user-status/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        action: action
                    })
                })
                .then(response => response.json())
                .then(data => {
                    showCustomMessage(data.message);
                    if (data.success) {
                        window.location.reload();
                    }
                })
                .catch(error => {
                    console.error('Erreur:', error);
                    showCustomMessage('Une erreur est survenue lors de l\'opération.');
                });
            };

            modalCancelBtn.onclick = () => {
                confirmationModal.classList.add('hidden');
            };
        });
    });

    function showCustomMessage(message) {
      const messageBox = document.createElement('div');
      messageBox.textContent = message;
      messageBox.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: sans-serif;
        font-size: 16px;
        text-align: center;
      `;
      document.body.appendChild(messageBox);
      setTimeout(() => messageBox.remove(), 3000);
    }
    
    // Call the function on page load to initialize the form correctly
    showCreateMode();
});
