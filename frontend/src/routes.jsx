import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout, CompactLayout } from "./layouts";
import ServicosPage from "./pages/servicos/servicos";
import Clientes from "./pages/clientes/clientes";
import {
  Home,
  Calendar,
  Login,
  RecuperarPassword,
  DefinirPassword,
  Salas,
  SalaDetalhes,
  Funcionarios,
  FuncionarioDetalhes,
  Contas,
  Perfil,
  Pesquisa,
  AgendamentoNovo,
  AgendamentoEditar,
  Faturas,
  FaturaDetalhe,
} from "./pages";
import App from "./App";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("btUser") || "null");
  } catch (_error) {
    return null;
  }
}

const PrivateRoute = ({ element }) => {
  const user = localStorage.getItem("btUser") || localStorage.getItem("usernameB&T");
  return user ? element : <Navigate to="/login" replace />;
};

const AdminRoute = ({ element }) => {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.tipoConta === "ADMIN" ? element : <Navigate to="/home" replace />;
};

const PublicLoginRoute = () => {
  const user = localStorage.getItem("btUser") || localStorage.getItem("usernameB&T");
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
          path="/clientes"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <Clientes />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/pesquisa"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <Pesquisa />
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
                <CompactLayout showBack>
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
          path="/agendamentos/novo"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <AgendamentoNovo />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/agendamentos/:agendamentoId/reagendar"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <AgendamentoEditar />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/faturas"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <Faturas />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/faturas/:faturaId"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <FaturaDetalhe />
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
                  <Funcionarios />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/funcionarios/:id/:nome"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <FuncionarioDetalhes />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/contas"
          element={
            <AdminRoute
              element={
                <CompactLayout>
                  <Contas />
                </CompactLayout>
              }
            />
          }
        />
        <Route
          path="/perfil"
          element={
            <PrivateRoute
              element={
                <CompactLayout showBack>
                  <Perfil />
                </CompactLayout>
              }
            />
          }
        />
        <Route path="/login" element={<PublicLoginRoute />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/definir-password" element={<DefinirPassword />} />
      </Routes>
    </BrowserRouter>
  );
}
