# Rihan-Collection

Rihan-Collection is an e-commerce and delivery platform for women's products.

## Stack

- Frontend: React, TailwindCSS
- Backend: Node.js, Express.js
- Database: MariaDB (Sequelize ORM)
- Auth: JWT (role-based)
- Media: Cloudinary

## Core Features

- User registration/login
- Product management
- Order lifecycle: `pending -> paid -> out_for_delivery -> delivered/cancelled/refunded`
- Rider assignment and timeout re-assignment job
- Admin dashboard metrics

## Project Structure

- `client/` - frontend app
- `server/` - backend API

## Backend Setup (MariaDB)

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment

Copy `server/.env.example` to `server/.env`, then update values:

```env
NODE_ENV=development
PORT=5001
JWT_SECRET=replace_with_a_long_random_secret_min_32_chars

DATABASE_URL=mariadb://root:your_mysql_password@127.0.0.1:3306/rihancollection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=rihancollection
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_SYNC=true
DB_SYNC_ALTER=true

CLOUDINARY_NAME=replace_with_cloudinary_cloud_name
CLOUDINARY_API_KEY=replace_with_cloudinary_api_key
CLOUDINARY_API_SECRET=replace_with_cloudinary_api_secret
APP_NAME=RihanCollection
MAIL_FROM=RihanCollection <no-reply@example.com>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173
```

### 3. Prepare database

i already created:

- `users`
- `products`
- `orders`
- `order_items`

The app also runs `sequelize.sync({ alter: true })`, so missing columns/tables used by the current backend will be added automatically.
For production, prefer `DB_SYNC_ALTER=false` unless you intentionally want schema auto-alter enabled.

### 4. Start backend

```bash
cd server
npm start
```

Backend default URL: `http://localhost:5001`

### 5. Bootstrap local test accounts

```bash
cd server
npm run create-admin
npm run create-rider
npm run create-test-order
```

Default local credentials:

- Admin: `admin@ramla.com` / `Jay442tx`
- Rider: `rider@ramla.com` / `Jay442tx`
- Test customer: `customer@ramla.com` / `Jay442tx`

## Frontend Setup

Copy `client/.env.example` to `client/.env`, then start the app:

```bash
cd client
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Main API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/products`
- `POST /api/orders`
- `PUT /api/orders/:id/pay`
- `PUT /api/orders/:id/status` (admin)
- `GET /api/rider/orders`
- `PUT /api/rider/orders/:id/accept`
- `PUT /api/rider/orders/:id/reject`
- `PUT /api/rider/orders/:id/delivered`
- `GET /api/admin/dashboard`

## Deploy (Render - Backend)

Set:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Required env vars on Render:

- `NODE_ENV=production`
- `JWT_SECRET=...`
- `CLIENT_URL=https://your-frontend-domain`
- `DATABASE_URL=mariadb://USER:PASSWORD@HOST:3306/DBNAME`
- `CLOUDINARY_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `MAIL_FROM=...`
- `SMTP_HOST=...`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=...`
- `SMTP_PASS=...`

## Notes by JAYFOUR

- Do not commit real secrets in `.env`.
- Keep `server/.env` ignored in git.
- Local uploads are stored in `server/uploads/` when Cloudinary is not configured.
- Forgot-password emails use SMTP in production; without SMTP the reset link is only exposed in local development.
