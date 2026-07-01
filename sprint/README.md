# SprintPulse AI - Sprint & Task Management

## Project Overview
This project is a Sprint & Task Management API built using Django REST Framework.

## Features
- Create Sprint
- View All Sprints
- Update Sprint
- Delete Sprint
- Create Task
- View All Tasks
- Update Task
- Delete Task

## Technologies Used
- Python
- Django
- Django REST Framework
- SQLite

## API Endpoints

### Sprint APIs
GET /sprints/
POST /sprints/
PUT /sprints/update/<id>/
DELETE /sprints/delete/<id>/

### Task APIs
GET /tasks/
POST /tasks/
PUT /tasks/update/<id>/
DELETE /tasks/delete/<id>/

## How to Run
1. Clone the repository
2. Install requirements
3. Run migrations
4. Start the server

bash
python manage.py runserver
