import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import "./index.css";

import App from "./App.jsx";

import Success from "./Success.jsx";

import Failed from "./Failed.jsx";

createRoot(
  document.getElementById("root")
).render(

  <StrictMode>

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<App />}
        />

        <Route
          path="/success"
          element={<Success />}
        />

        <Route
          path="/failed"
          element={<Failed />}
        />

      </Routes>

    </BrowserRouter>

  </StrictMode>
);