document.addEventListener('DOMContentLoaded', function() {
    const userForm = document.getElementById('user-form');
    if (!userForm) return;

    const createBtn = document.getElementById('create-btn');
    const userLinks = document.querySelectorAll('.user-link');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const userIdInput = document.getElementById('user-id');
    const userTypeInput = document.getElementById('user-type-input');
    const firstNameInput = document.getElementById('first_name');
    const lastNameInput = document.getElementById('last_name');
    const emailInput = document.getElementById('email');
    const phoneNumberInput = document.getElementById('phone_number');
    const passwordField = document.getElementById('password-field');
    const passwordInput = document.getElementById('password');
    const staffTypeField = document.getElementById('staff-type-field');
    const addressInput = document.getElementById('address');
    const genderInput = document.getElementById('gender');
    const birthDateInput = document.getElementById('birth_date');
    const nationalNumberInput = document.getElementById('national_number');

    const formUserAvatar = document.getElementById('form-user-avatar');
    const formUserInitials = document.getElementById('form-user-initials');

    const toggleStatusButtons = document.querySelectorAll('.toggle-status-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const userType = userTypeInput ? userTypeInput.value : '';
    const userSchoolId = userForm.getAttribute('data-school-id');

    // --- Récupération des traductions ---
    const msgCreateTitle = userForm.dataset.msgCreateTitle || "Créer un nouvel utilisateur";
    const msgCreateBtn = userForm.dataset.msgCreateBtn || "Créer";
    const msgEditTitle = userForm.dataset.msgEditTitle || "Modifier un utilisateur";
    const msgEditBtn = userForm.dataset.msgEditBtn || "Mettre à jour";
    const msgDeactivateConfirm = userForm.dataset.msgDeactivateConfirm || "Êtes-vous sûr de vouloir désactiver l'utilisateur";
    const msgActivateConfirm = userForm.dataset.msgActivateConfirm || "Êtes-vous sûr de vouloir activer l'utilisateur";
    const msgErrorPrefix = userForm.dataset.msgErrorPrefix || "Erreur :";
    const msgErrorGeneral = userForm.dataset.msgErrorGeneral || "Une erreur est survenue lors de l'opération.";

    function showCreateMode() {
        formTitle.textContent = msgCreateTitle;
        // Remplacement de mr-2 par me-2 pour l'icône en RTL
        submitBtn.innerHTML = `<i class="fas fa-plus-circle me-2"></i> ${msgCreateBtn}`;
        userIdInput.value = '';
        userForm.reset();
        passwordField.style.display = 'none';
        
        cancelBtn.style.display = 'none'; 

        formUserAvatar.classList.add('hidden');
        formUserAvatar.src = '';
        formUserInitials.classList.remove('hidden');
        formUserInitials.innerHTML = '<i class="fas fa-user"></i>';

        if (staffTypeField) {
            if (userType === 'staff') {
                staffTypeField.style.display = 'block';
            } else {
                staffTypeField.style.display = 'none';
            }
        }
    }

    function showEditMode(user) {
        formTitle.textContent = msgEditTitle;
        // Remplacement de mr-2 par me-2 pour l'icône en RTL
        submitBtn.innerHTML = `<i class="fas fa-edit me-2"></i> ${msgEditBtn}`;
        userIdInput.value = user.id;
        firstNameInput.value = user.firstName;
        lastNameInput.value = user.lastName;
        emailInput.value = user.email;
        addressInput.value = user.address;
        genderInput.value = user.gender;
        birthDateInput.value = user.birthDate;

        if (nationalNumberInput) {
            nationalNumberInput.value = user.nationalNumber || '';
        }
        if (user.phoneNumber !== "None"){
            phoneNumberInput.value = user.phoneNumber;
        } else {
            phoneNumberInput.value = '';
        }

        if (user.profilePictureUrl && user.profilePictureUrl !== 'None' && user.profilePictureUrl !== '') {
            formUserAvatar.src = user.profilePictureUrl;
            formUserAvatar.classList.remove('hidden');
            formUserInitials.classList.add('hidden');
        } else {
            formUserAvatar.classList.add('hidden');
            formUserInitials.classList.remove('hidden');
            const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() : '?';
            formUserInitials.innerHTML = `<span class="text-3xl">${initial}</span>`;
        }

        passwordField.style.display = 'block';
        passwordInput.required = false;
        cancelBtn.style.display = 'block'; 

        if (staffTypeField) {
            if (user.staffType) {
                staffTypeField.style.display = 'block';
                document.getElementById('staff_type').value = user.staffType;
            } else {
                staffTypeField.style.display = 'none';
            }
        }
    }

    if (createBtn) createBtn.addEventListener('click', showCreateMode);
    if (cancelBtn) cancelBtn.addEventListener('click', showCreateMode);

    userLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const user = {
                id: this.getAttribute('data-user-id'),
                firstName: this.getAttribute('data-first-name'),
                lastName: this.getAttribute('data-last-name'),
                email: this.getAttribute('data-email'),
                phoneNumber: this.getAttribute('data-phone-number'),
                staffType: this.getAttribute('data-staff-type'),
                address: this.getAttribute('data-address'),
                gender: this.getAttribute('data-gender'),
                birthDate: this.getAttribute('data-birth-date'),
                profilePictureUrl: this.getAttribute('data-profile-picture-url'),
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
                showCustomMessage(`${msgErrorPrefix} ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Erreur :', error);
            showCustomMessage(msgErrorGeneral);
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
                message = `${msgDeactivateConfirm} "${userName}" ?`;
                confirmBtnClass = 'bg-red-600 hover:bg-red-700';
            } else {
                message = `${msgActivateConfirm} "${userName}" ?`;
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
                    showCustomMessage(msgErrorGeneral);
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
      // Le positionnement au centre (left: 50%, translate -50%) fonctionne identiquement en RTL/LTR
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
    
    showCreateMode();
});