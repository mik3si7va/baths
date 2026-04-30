import { Navigate, Route, Routes } from "react-router-dom";
import PrivateRoute from "./auth/PrivateRoute";
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";

export default function AppRoutes() {
  return (
    <Routes>
      
      // rotas públicas aqui!!
      
      <Route path="/login" element={<Login />} />
      
      // rotas privadas!!

      <Route element={<PrivateRoute />}>
        // rotas que precisam de autenticação
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
