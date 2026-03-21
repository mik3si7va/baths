import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, CompactLayout } from './layouts';
import { Home, Calendar, Login, CriarSala } from './pages';
import ServicosPage from './pages/servicos/servicos';
import CriarServicoPage from './pages/servicos/criarServico';
import App from './App';

const PrivateRoute = ({ element }) => {
    const user = localStorage.getItem('usernameB&T');
    return user ? element : <Navigate to="/login" replace />;
};

const PublicLoginRoute = () => {
    const user = localStorage.getItem('usernameB&T');
    return user ? <Navigate to="/home" replace /> : <Login />;
};

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route
                    path="/home"
                    element={
                        <PrivateRoute
                            element={
                                <MainLayout>
                                    <Home />
                                </MainLayout>
                            }
                        />
                    }
                />
                <Route
                    path="/calendar"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout>
                                    <Calendar />
                                </CompactLayout>
                            }
                        />
                    }
                />
                <Route
                    path="/salas/nova"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout>
                                    <CriarSala />
                                </CompactLayout>
                            }
                        />
                    }
                />
                <Route
                    path="/servicos"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout>
                                    <ServicosPage />
                                </CompactLayout>
                            }
                        />
                    }
                />
                <Route
                    path="/servicos/novo"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout>
                                    <CriarServicoPage />
                                </CompactLayout>
                            }
                        />
                    }
                />
                <Route
                    path="/funcionarios"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout>
                                    <Users />
                                </CompactLayout>
                            }
                        />
                    }
                />
                <Route path="/login" element={<PublicLoginRoute />} />
            </Routes>
        </BrowserRouter>
    );
}