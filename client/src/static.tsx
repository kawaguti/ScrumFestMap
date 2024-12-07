import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StaticHomePage from "./pages/static/StaticHomePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StaticHomePage />
  </StrictMode>,
);
