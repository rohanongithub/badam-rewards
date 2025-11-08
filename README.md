# Badam Rewards Website

A simple website for tracking Badam rewards with user authentication.

## Features

- User sign up and sign in
- Badam counter with increment/decrement buttons
- PostgreSQL database for storing user credentials and Badam counts
- Plain JavaScript frontend (no frameworks)
- Node.js/Express backend

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb badam_rewards
```

Or using psql:

```sql
CREATE DATABASE badam_rewards;
```

### 3. Configure Database Connection

The application uses the following default database settings:
- Host: localhost
- Port: 5432
- Database: badam_rewards
- User: postgres
- Password: postgres

You can override these by setting environment variables:

```bash
export DB_USER=your_username
export DB_PASSWORD=your_password
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=badam_rewards
```

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 5. Access the Website

Open your browser and navigate to:
- `http://localhost:3000` - Sign in page
- `http://localhost:3000/main.html` - Main dashboard (requires authentication)

## Usage

1. **Sign Up**: Create a new account with a username and password
2. **Sign In**: Use your credentials to sign in
3. **Track Badam**: Use the + and - buttons to increment or decrement your Badam count
4. **Sign Out**: Click the sign out button to log out

## Project Structure

```
badam-rewards/
├── server.js          # Main server file with API endpoints
├── db.js              # Database connection and initialization
├── package.json       # Dependencies and scripts
├── public/            # Frontend files
│   ├── index.html     # Sign in/sign up page
│   ├── main.html      # Main dashboard page
│   ├── style.css      # Stylesheet
│   ├── app.js         # Sign in/sign up logic
│   └── main.js        # Dashboard logic
└── README.md          # This file
```

## API Endpoints

- `POST /api/signup` - Create a new user account
- `POST /api/signin` - Sign in with username and password
- `GET /api/user` - Get current user information
- `GET /api/badam` - Get current Badam count
- `POST /api/badam` - Update Badam count (action: 'increment' or 'decrement')
- `POST /api/signout` - Sign out

## Deployment to Render

### Step 1: Create a PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure your database:
   - **Name:** `badam-rewards-db`
   - **Database Name:** `badam_rewards`
   - **User:** `badam_user` (or leave default)
   - **Region:** Choose closest to you
   - **Plan:** Free (or paid if needed)
4. Click **"Create Database"**
5. Wait for the database to be created
6. Copy the **Internal Database URL** (you'll need this later)

### Step 2: Create a Web Service on Render

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub/GitLab repository (or use Render's manual deploy)
3. Configure the service:
   - **Name:** `badam-rewards`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or paid if needed)

### Step 3: Set Environment Variables

In your Web Service settings, go to **"Environment"** and add:

1. **DATABASE_URL** - Paste the Internal Database URL from Step 1
   - Format: `postgresql://user:password@host:port/database`
   - This is automatically provided if you link the database in render.yaml

2. **NODE_ENV** - Set to `production`

**Note:** If you use the `render.yaml` file, the DATABASE_URL will be automatically linked.

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Install dependencies
   - Start your server
   - Create database tables (on first run)

### Step 5: Verify Deployment

1. Once deployed, you'll get a URL like: `https://badam-rewards.onrender.com`
2. Visit the URL to test your application
3. The database tables will be created automatically on first request

### Environment Variables Reference

For **local development**, create a `.env` file (not committed to git):

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=badam_rewards
DB_PASSWORD=postgres
DB_PORT=5432
NODE_ENV=development
```

For **Render deployment**, you only need:
- `DATABASE_URL` (automatically provided when you link the database)
- `NODE_ENV=production`

### Database Connection Details

The application automatically handles:
- **Local:** Uses individual DB parameters (DB_USER, DB_HOST, etc.)
- **Render:** Uses DATABASE_URL connection string with SSL enabled

The database tables (`users` and `badam_counts`) are created automatically on first run.

## Notes

- Passwords are hashed using bcrypt
- Sessions are stored in memory (for production, consider using Redis or database sessions)
- The database tables are automatically created on first run
- Render free tier may spin down after inactivity (takes ~30 seconds to wake up)

