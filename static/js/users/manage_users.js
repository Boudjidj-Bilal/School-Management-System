document.addEventListener('DOMContentLoaded', function() {
    const userForm = document.getElementById('user-form');
    const createBtn = document.getElementById('create-btn');
    const userLinks = document.querySelectorAll('.user-link');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const userIdInput = document.getElementById('user-id');
    const userTypeInput = document.getElementById('user-type-input');
    const firstNameInput = document.getElementById('first_name');
    const lastNameInput = document.getElementById('last_name');
    const emailInput = document.getElementById('email');
    const passwordField = document.getElementById('password-field');
    const passwordInput = document.getElementById('password');
    const staffTypeField = document.getElementById('staff-type-field');
    const parentTypeField = document.getElementById('parent-type-field');
    const addressInput = document.getElementById('address');
    const genderInput = document.getElementById('gender');
    const birthDateInput = document.getElementById('birth_date');

    passwordField.style.display = 'none';
    passwordInput.required = false;
    
    // Récupération des données du template Django
    const userType = userTypeInput.value;
    const userSchoolId = userForm.getAttribute('data-school-id');

    // Fonction pour afficher le mode de création
    function showCreateMode() {
        formTitle.textContent = 'Créer un nouvel utilisateur';
        submitBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Créer';
        userIdInput.value = '';
        userForm.reset();
        // passwordField.style.display = 'block';
        // passwordInput.required = true;
        cancelBtn.style.display = 'none';

        passwordField.style.display = 'none';
        passwordInput.required = false;
        
        // Affichage/masquage des champs spécifiques
        if (userType === 'staff') {
            staffTypeField.style.display = 'block';
            parentTypeField.style.display = 'none';
        } else if (userType === 'parent') {
            staffTypeField.style.display = 'none';
            parentTypeField.style.display = 'block';
        } else {
            staffTypeField.style.display = 'none';
            parentTypeField.style.display = 'none';
        }
    }

    // Fonction pour afficher le mode de modification
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

        // Cacher le champ mot de passe en mode modification
        passwordField.style.display = 'block';
        passwordInput.required = false;

        cancelBtn.style.display = 'block';

        if (user.staffType) {
            staffTypeField.style.display = 'block';
            document.getElementById('staff_type').value = user.staffType;
        } else {
            staffTypeField.style.display = 'none';
        }

        if (user.parentType) {
            parentTypeField.style.display = 'block';
            document.getElementById('parent_type').value = user.parentType;
        } else {
            parentTypeField.style.display = 'none';
        }
    }

    // Écouteur pour le bouton 'Créer'
    createBtn.addEventListener('click', showCreateMode);

    // Écouteur pour le bouton 'Annuler'
    cancelBtn.addEventListener('click', showCreateMode);

    // Écouteurs pour les liens d'utilisateurs
    userLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const user = {
                id: this.getAttribute('data-user-id'),
                firstName: this.getAttribute('data-first-name'),
                lastName: this.getAttribute('data-last-name'),
                email: this.getAttribute('data-email'),
                staffType: this.getAttribute('data-staff-type'),
                parentType: this.getAttribute('data-parent-type'),
                address: this.getAttribute('data-address'),
                gender: this.getAttribute('data-gender'),
                birthDate: this.getAttribute('data-birth-date')
            };
            showEditMode(user);
        });
    });

    // Gestion de la soumission du formulaire
    userForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = {};
        formData.forEach((value, key) => (data[key] = value));

        // Ajout de l'ID de l'école (récupéré depuis le contexte Django)
        if (userSchoolId) {
            data['school_id'] = userSchoolId;
        }

        fetch('/create-user/', { // J'ai remplacé 'this.action' par l'URL de la vue de création/modification
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
                // Utiliser une boîte de dialogue personnalisée au lieu d'alert()
                // pour une meilleure expérience utilisateur
                // window.location.reload();
                showCustomMessage(data.message);
            } else {
                showCustomMessage('Erreur: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showCustomMessage('Une erreur est survenue lors de l\'opération.');
        });
    });

    // Simple fonction pour remplacer l'alerte
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

    // Afficher les champs spécifiques au chargement de la page
    if (userType === 'staff') {
        staffTypeField.style.display = 'block';
    } else if (userType === 'parent') {
        parentTypeField.style.display = 'block';
    }
});
