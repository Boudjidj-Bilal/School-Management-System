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

