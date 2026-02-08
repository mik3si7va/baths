import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/home/home';
import LoginPage from './pages/login/login';
import App from './App';

const PrivateRoute = ({ element }) => {
    const user = localStorage.getItem('usernameB&T');
    return user ? element : <Navigate to="/login" replace />;
};

const PublicLoginRoute = () => {
    const user = localStorage.getItem('usernameB&T');
    return user ? <Navigate to="/home" replace /> : <LoginPage />;
};

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/home" element={<PrivateRoute element={<Home />} />} />
                <Route path="/login" element={<PublicLoginRoute />} />
            </Routes>
        </BrowserRouter>
    );
}
