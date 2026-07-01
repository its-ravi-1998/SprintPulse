# SprintPulse - Sprint & Task Management

## Project Overview
SprintPulse is a Django REST Framework backend for managing sprints and tasks. It provides CRUD APIs for Sprint and Task management.

## Tech Stack
- Python
- Django
- Django REST Framework
- SQLite

## Sprint APIs
- GET /sprints/
- POST /sprints/
- PUT /sprints/update/<id>/
- DELETE /sprints/delete/<id>/

## Task APIs
- GET /tasks/
- POST /tasks/
- PUT /tasks/update/<id>/
- DELETE /tasks/delete/<id>/

## Run Project

bash
python manage.py migrate
python manage.py runserver
