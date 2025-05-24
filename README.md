# Yeager Companion App

A React-based ATC (Air Traffic Control) Companion application with Firebase authentication.

## Features Implemented (Step 1)

✅ **Authentication System**
- Firebase Authentication integration
- User registration and login
- Protected routes
- Authentication state management with React Context
- Clean, modern UI with custom CSS styling

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- A Firebase project (for authentication)

### Installation

1. **Clone and Install Dependencies**
   ```bash
   cd yeager
   npm install
   ```

2. **Configure Firebase**
   - Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Enable Authentication with Email/Password provider
   - Copy your Firebase configuration
   - Update `src/firebase/config.js` with your Firebase credentials:

   ```javascript
   const firebaseConfig = {
     apiKey: "your-actual-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-actual-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-actual-sender-id",
     appId: "your-actual-app-id"
   };
   ```

3. **Run the Application**
   ```bash
   npm start
   ```

   The app will open at [http://localhost:3000](http://localhost:3000)

## Application Structure

```
src/
├── components/
│   └── ProtectedRoute.js     # Route protection component
├── contexts/
│   └── AuthContext.js        # Authentication context and provider
├── firebase/
│   └── config.js            # Firebase initialization
├── pages/
│   ├── Login.js             # Login page
│   ├── Signup.js            # Registration page
│   └── Dashboard.js         # Main dashboard (placeholder)
├── App.js                   # Main app with routing
└── index.css                # Global styles
```

## Authentication Flow

1. **Unauthenticated users** are redirected to `/login`
2. **New users** can register via `/signup`
3. **Authenticated users** access the main dashboard at `/dashboard`
4. **Route protection** ensures only authenticated users access protected routes

## Next Steps

The following features will be implemented in subsequent steps:
- Application state management with Zustand
- Transcript feed simulation
- Message parsing system
- Conflict detection logic
- Aircraft map with Leaflet
- Real-time data integration

## Technologies Used

- **React** - Frontend framework
- **React Router** - Routing and navigation
- **Firebase Authentication** - User authentication
- **CSS3** - Custom styling (no external CSS frameworks)

## Development Notes

- The app uses Firebase Authentication for user management
- Custom CSS provides a clean, modern interface
- React Context manages authentication state
- Protected routes ensure security
- Responsive design works on desktop and mobile devices
