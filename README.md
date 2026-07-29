# SprintPulse - Engineering Sprint Analytics & Management

SprintPulse is a modern engineering sprint analytics and project management platform featuring data-driven velocity tracking, burndown metrics, bottleneck identification, Google SSID / SSO authentication, and PostgreSQL support.

---

## 🛠 Tech Stack

- **Backend**: Python 3, Django 6, Django REST Framework, SimpleJWT, `google-auth`
- **Frontend**: React 19, Vite, Recharts, Lucide Icons, Google Identity Services SDK
- **Database**: PostgreSQL (default with `dj-database-url`), SQLite fallback support

---

## 🔐 Google SSID / SSO Authentication

SprintPulse supports Google Single Sign-On (SSO / SSID):
- **Endpoint**: `POST /api/auth/google/`
- **Request Body**:
  ```json
  {
    "token": "<google_id_token>",
    "role": "member",
    "team_name": "Phoenix Team"
  }
  ```
- **Response**: Returns standard DRF SimpleJWT `access` & `refresh` tokens alongside the provisioned `user` profile.

---

## 🗄 PostgreSQL Setup & Migration

SprintPulse connects to PostgreSQL out-of-the-box using `DATABASE_URL` or standard PostgreSQL environment variables (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`).

### Data Migration Script (`migrate_to_postgres.py`)

1. **Export data from SQLite**:
   ```bash
   python3 migrate_to_postgres.py --dump
   ```

2. **Migrate schema & load data into PostgreSQL**:
   ```bash
   python3 migrate_to_postgres.py --load --db-url "postgres://username:password@localhost:5432/sprintpulse"
   ```

---

## 🚀 Running Locally

### 1. Environment Setup
Copy [.env.example](file:///Users/divyansh/Documents/Sprint%20Pulse/SprintPulse/.env.example) to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 2. Backend (Django REST Framework)
```bash
# Apply migrations
python3 manage.py migrate

# Run Django dev server
python3 manage.py runserver 8000
```

### 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the SprintPulse application interface and `http://127.0.0.1:8000/api/docs/` for Swagger API documentation.

