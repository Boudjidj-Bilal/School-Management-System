# ProjectSchool

Django + Django REST Framework + django-allauth scaffold for a multi-school management platform (middle/high school).

## Requirements
- Python 3.10+
- macOS (dev)
- Virtualenv recommended

## Quickstart

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install django djangorestframework django-allauth dj-rest-auth

django-admin startproject ProjectSchool
cd ProjectSchool

# Apps already created in this repo structure:
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

```

Explication du fonctionnement des annonces (devoirs, cours evaluation et message), j'ai fait cela car les quatre table possédais les mêmes attribus, et donc j'ai tout réuni en une seule table.
J'ai fait la même chose pour le personnel (proviseur, professeur, cpe, administrateur de l'école).

Il y a deux types d'administrateur : 
1. Administrateur du site (super administrateur)
2. Administrateur de l'école (celui qui est en charge des inscriptions et du suivis administratif des élèves)

Gestion de l'héritage des utilisateurs avec la classe abstract user qui gèrent automatiquement les comptes utilisateurs.
Utilisation du managers.py dans la app users pour créer des utilisateurs (super user / user)

Environnement de travail : vscode, macos, python3, django, etc.

Pour faire l'uml j'ai utiliser db diagrame

Fonctionnement du planning : on créer un model de planning puis on le copie colle sur les semaines que l'on veut, on peut créer plein de modèle, on le copie colle en fonction de son nom, par classe, on peut avoir qu'un seul nom identique de model de planning à la fois.
Cela créer plein de planning instance qui ont tous un modèle est des dates.
Avant de créer un cours il faut créer un modèle de planning en lui donnant un nom, puis on créer tous nos cours, on copie colles le modèle de planning partout ou l'on souhaite et lorsqu'on clique sur validé, cela nous retourne une liste complète des erreurs en fonction de l'école (exemple : salle de classe déjà utilisé pour cette date et cette horaire, le professeur à déjà un cours pour cette date et cette horaire, la classe ont déjà un cours pour cette date et cette tanche horaire, etc.).
S'il n'y a pas d'erreur, alors cela créer tous les plannings instance et le planning est validé pour la classe (car les planning se font par classe, non par salle de classe ni par professeur, bien qu'il ont eu aussi automatiquement à la suite de ça leur propre planning).

Gestion des temps limités en inactif pour les sessions utilisateur :
Définit la durée de vie maximale d'une session utilisateur à 10 minutes sans activité (600 secondes) :
SESSION_COOKIE_AGE = 600

Prolonge la session à chaque requête de l'utilisateur, ce qui gère la déconnexion après inactivité:
SESSION_SAVE_EVERY_REQUEST = True

Gestion des envoie d'email (gmail) avec les mots de passe dans le fichier .env à la racine du projet : 
EMAIL_HOST_USER="votre_email@gmail.com"
EMAIL_HOST_PASSWORD="votre_mot_de_passe_d_application"
Django utilise par défaut les variables du fichier settings