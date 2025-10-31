# POS Food System

A full-stack Point of Sale (POS) system for food businesses built with React and Node.js.

## Features

- **Frontend**: React with TypeScript, Tailwind CSS, React Router
- **Backend**: Node.js with Express, TypeScript, Sequelize ORM
- **Database**: MySQL
- **Authentication**: JWT-based authentication
- **Pages**: Dashboard, Billing, Reports, Master Data Management

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MySQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd POS_Food
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Setup environment variables**
   ```bash
   # Copy the example environment file
   cd ../server
   cp env.example .env
   ```
   
   Edit the `.env` file with your database credentials:
   ```
   PORT=4000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=pos_food
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   JWT_EXPIRES_IN=1d
   CLIENT_ORIGIN=http://localhost:5173
   ```

4. **Setup MySQL Database**
   - Create a MySQL database named `pos_food`
   - Make sure MySQL is running on your system

### Running the Application

#### Option 1: Run Everything with One Command (Recommended)
```bash
cd server
npm run start:full
```

This command will:
- Build the client application
- Build the server application
- Start the server

#### Option 2: Manual Build and Start
```bash
# Build client
cd client
npm run build

# Build and start server
cd ../server
npm run build
npm start
```

#### Option 3: Development Mode
```bash
# Start server in development mode (with hot reload)
cd server
npm run dev
```

### Accessing the Application

Once the server is running, you can access:

- **Main Application**: http://localhost:4000
- **API Health Check**: http://localhost:4000/health
- **API Endpoints**: http://localhost:4000/api/*

## Project Structure

```
POS_Food/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── router/         # Routing configuration
│   │   └── api/            # API client
│   └── out/                # Built client files (served by server)
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── middleware/       # Custom middleware
│   │   └── config/          # Configuration files
│   └── dist/                # Compiled server files
└── README.md
```

## API Endpoints

- `GET /health` - Server health check
- `POST /api/auth/login` - User login
- `GET /api/dashboard/*` - Dashboard data
- `GET /api/billing/*` - Billing operations
- `GET /api/reports/*` - Reports data
- `GET /api/users/*` - User management
- `GET /api/transactions/*` - Transaction data

## Development

### Client Development
```bash
cd client
npm run dev
```

### Server Development
```bash
cd server
npm run dev
```

## Building for Production

```bash
# Build everything
cd server
npm run build:all

# Start production server
npm start
```

## Troubleshooting

### Database Connection Issues
- Ensure MySQL is running
- Check database credentials in `.env` file
- Verify database `pos_food` exists

### Port Already in Use
- Change the `PORT` in `.env` file
- Kill existing processes using the port

### Client Not Loading
- Ensure client build exists in `client/out/` directory
- Run `npm run build:all` to rebuild everything

## Notes

- The server serves both the API and the client application
- Client-side routing is handled by serving `index.html` for all non-API routes
- Database tables are automatically created/synced on server start
- JWT tokens are used for authentication
