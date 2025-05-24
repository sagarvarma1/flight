import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  
  // If user is not authenticated, redirect to login
  return user ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute; 