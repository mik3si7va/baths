import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ClientLayout from "./layoutApp/clientLayout";
import { ClientHome, ClientLogin, ClientRegister } from "./pagesApp";
import { getClientSession } from "./clientActions/clientAuthActions";

function ClientPrivateRoute() {
  const client = getClientSession();
  return client ? <ClientLayout /> : <Navigate to="login" replace />;
}

function ClientPublicRoute({ element }) {
  const client = getClientSession();
  return client ? <Navigate to="home" replace /> : element;
}

export default function ClientApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route
        path="login"
        element={<ClientPublicRoute element={<ClientLogin />} />}
      />
      <Route
        path="registo"
        element={<ClientPublicRoute element={<ClientRegister />} />}
      />
      <Route element={<ClientPrivateRoute />}>
        <Route path="home" element={<ClientHome />} />
      </Route>
    </Routes>
  );
}
