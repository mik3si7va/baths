import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Users from './pages/admin/users/users';
import Admin from './pages/admin/admin';
import Home from './pages/home/home';
import LoginPage from './pages/login/login';
import App from './App';
import CalendarView from './pages/calendar/calendar';

const PrivateRoute = ({ element }) => {
    const user = localStorage.getItem('usernameB&T');
    return user ? element : <Navigate to="/login" replace />;
};

const PublicLoginRoute = () => {
    const user = localStorage.getItem('usernameB&T');
    return user ? <Navigate to="/home" replace /> : <LoginPage />;
};

const AdminRoute = ({ element }) => {
    const user = localStorage.getItem('usernameB&T');
    return user === 'admin' ? element : <Navigate to="/login" replace />;
};

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/home" element={<PrivateRoute element={<Home />} />} />
                <Route path="/calendar" element={<PrivateRoute element={<CalendarView />} />} />
                <Route path="/admin" element={<AdminRoute element={<Admin />} />} />
                <Route path="/admin/users" element={<AdminRoute element={<Users />} />} />
                <Route path="/login" element={<PublicLoginRoute />} />
            </Routes>
        </BrowserRouter>
    );
}
