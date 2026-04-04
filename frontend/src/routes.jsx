import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, CompactLayout } from './layouts';
import { Home, Calendar, Login, CriarSala, Users} from './pages'
import ServicosPage from './pages/servicos/servicos';
import { Home, Calendar, Login, Salas, SalaDetalhes, Users } from './pages'
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
                    path="/calendar" 
                    element={
                        <PrivateRoute 
                            element={
                                <CompactLayout showBack>
                                    <Calendar />
                                </CompactLayout>
                            } 
                        />
                    } 
                />
                <Route 
                    path="/salas" 
                    element={
                        <PrivateRoute 
                            element={
                                <CompactLayout showBack>
                                    <Salas />
                                </CompactLayout>
                            } 
                        />
                    } 
                />
                <Route
                    path="/salas/:id/:nome"
                    element={
                        <PrivateRoute
                            element={
                                <CompactLayout showBack>
                                    <SalaDetalhes />
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
