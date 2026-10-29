# Smart Campus Complaint Management System

Students report campus problems (classrooms, Wi-Fi, facilities...) and track their resolution. Admins review complaints and update their status.

**Stack:** HTML, CSS, JavaScript (frontend) · Java 17 + Spring Boot 3 (backend) · JPA + MySQL (H2 is used by default for development) · JWT authentication

## Spring Boot backend

The migrated REST service is in `backend/` and is independent of the legacy Node.js files. Its package layout is:

```
backend/
├── pom.xml
├── src/main/resources/application.properties
└── src/main/java/com/campus/complaints/
    ├── CampusComplaintsApplication.java
    ├── config/                 # static upload resources and API errors
    ├── controller/             # auth, complaints, admin, notifications
    ├── model/                  # User, Complaint, Notification and enums
    ├── repository/             # Spring Data JPA repositories
    ├── security/               # stateless JWT filter and Spring Security
    └── service/                # complaint and NIO file storage services
```

Run it from `backend/` with Java 17 and Maven:

```powershell
mvn spring-boot:run
```

It listens on `http://localhost:8080`. H2 file storage is the default development database. For MySQL, set `DATABASE_URL` to a JDBC URL, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `DATABASE_DRIVER=com.mysql.cj.jdbc.Driver`. Set `JWT_SECRET` to a random value of at least 32 characters and `ADMIN_PASSCODE` before deployment. Uploaded JPEG/PNG evidence is stored in `uploads/` and served at `/uploads/<filename>`.

The Spring service preserves the frontend API routes, including `/api/auth`, `/api/complaints`, `/api/admin/complaints/{id}/status`, and `/api/notifications`. Complaint uploads accept both the current frontend field `evidence` and the specified `file` field.

## Features

- Role-aware Student and Admin sign up / login
- Submit complaints with category, location, priority and description
- Choose a frequent college issue from the complaint title dropdown
- Students see status, admin remarks and a full status timeline (complaint history dashboard)
- Admin dashboard: counts by status, search + filter by status/category, update status with remarks
- Every status change is stored in the complaint's history
- Admin assignment by department and staff member
- Admin-only internal complaint notes
- Timestamped status audit history with the updating user's identity
- JPEG/PNG photo evidence uploads up to 5MB, stored locally in `backend/uploads`
- In-app status notifications with unread tracking

## Folder structure

```
smart-campus-complaints/
├── README.md
├── backend/
│   ├── server.js             # Express app entry point
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example          # copy to backend/.env
│   ├── .gitignore
│   ├── config/db.js          # MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   └── Complaint.js
│   ├── middleware/auth.js    # JWT + role checks
│   ├── routes/
│   │   ├── auth.js           # register, login, me
│   │   └── complaints.js     # complaint CRUD, stats, status update
│   └── scripts/seedAdmin.js  # creates the admin account
└── frontend/
    └── public/               # static frontend served by Express
        ├── index.html        # login / sign up
        ├── student.html      # student dashboard
        ├── admin.html        # admin dashboard
        ├── css/style.css
        └── js/ (api.js, login.js, student.js, admin.js)
```

## Run in VS Code

1. Install **Node.js (18+)** and **MongoDB Community** (or use a free MongoDB Atlas cluster).
2. Extract the zip and open the folder in VS Code (`File > Open Folder`).
3. Open the terminal (`Ctrl + ~`) in the `backend/` directory and run:
   ```bash
   npm install
   cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
   npm run seed:admin          # creates the admin user
   npm run dev                 # or: npm start
   ```
4. Open http://localhost:5000

### Move an existing checkout

If you are applying this layout manually, run these commands from the project root.

**Bash:**

```bash
mkdir -p backend frontend
mv config middleware models routes scripts server.js .env .env.example package.json package-lock.json backend/
mv public frontend/public
```

**PowerShell:**

```powershell
New-Item -ItemType Directory -Force backend, frontend
Move-Item config, middleware, models, routes, scripts, server.js, .env, .env.example, package.json, package-lock.json backend
Move-Item public frontend/public
```

Then run `npm install` from `backend/` and copy `backend/.env.example` to `backend/.env`.

> If using MongoDB Atlas, put your connection string in `MONGO_URI` inside `.env`.
> Change `JWT_SECRET` in `.env` to a long random string.

### Default admin login (from `.env`)

- Email: `admin@campus.edu`
- Password: `Admin@123`

Students create their own accounts from the **Student Sign Up** tab.

## API overview

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/register` | public | Student signup; admins are created with the seed script |
| POST | `/api/auth/login` | public | Login with role and identifier (student ID/email for students) |
| GET | `/api/auth/me` | logged in | Current user |
| GET | `/api/complaints/meta` | logged in | Categories & statuses |
| POST | `/api/complaints` | student | Submit complaint |
| GET | `/api/complaints/mine` | student | Own complaints + stats |
| GET | `/api/complaints` | admin | All complaints (`?status=&category=&q=`) |
| GET | `/api/complaints/stats` | admin | Dashboard counts |
| GET | `/api/complaints/:id` | owner/admin | Single complaint |
| PATCH | `/api/complaints/:id/status` | admin | Update status + remarks |
| PATCH | `/api/complaints/:id/assignment` | admin | Assign department and staff member |
| POST | `/api/complaints/:id/notes` | admin | Add an internal note |
| GET | `/api/auth/staff` | admin | List assignable staff |
| POST | `/api/auth/staff` | admin | Create a staff account |
| GET | `/api/notifications` | logged in | Get notifications and unread count |
| PATCH | `/api/notifications/:id/read` | logged in | Mark one notification as read |
| PATCH | `/api/notifications/read-all` | logged in | Mark all notifications as read |

### Roles and privacy

- `student` users can create complaints and see their own status history.
- Only `admin` users can access the admin dashboard and manage complaints.
- Only `admin` users can create staff accounts.
- Internal notes are returned only by admin complaint endpoints and are never exposed to students.
- Each status history entry records the status, timestamp, remarks, and the user who made the change.
- Complaint uploads are available through `/uploads/<filename>` and are restricted to JPEG/PNG files no larger than 5MB.
- The notification bell polls for new in-app status updates every 30 seconds.
- Login supports Student and Admin role selection, session-only or remembered authentication, and dashboard-specific redirects.
- The sign-up form changes with the selected role: students provide a student ID and department, while admins provide an invite/security token.
- Switching roles clears all form values and validation feedback; switching between sign-in and sign-up preserves the selected role.
- Dashboard logout opens a confirmation modal before clearing both local and session authentication state.
- Public Admin signup requires the private `ADMIN_SIGNUP_CODE` configured in `backend/.env`; student signup does not require it.
- Student complaint history supports search, status, priority, and category filters and displays exact complaint timestamps.
- Students can check for open complaints at the same location and upvote an existing complaint.
- Duplicate open complaints with the same issue, location and priority are rejected.
- Admins can export monthly complaint metrics as CSV or PDF from the dashboard.
