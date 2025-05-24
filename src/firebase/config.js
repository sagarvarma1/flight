import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4sAcQci-y5VZ-WN4dR5DRoxQDpRB6liA",
  authDomain: "fir-3bda4.firebaseapp.com",
  projectId: "fir-3bda4",
  storageBucket: "fir-3bda4.firebasestorage.app",
  messagingSenderId: "735043718227",
  appId: "1:735043718227:web:eb7fe041640dc2b809caa6",
  measurementId: "G-4HF3D273LS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app; 