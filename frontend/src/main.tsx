import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountGate from "./AccountGate";
import { CoachProvider } from "./coach/CoachProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountGate>
      <CoachProvider>
        <App />
      </CoachProvider>
    </AccountGate>
  </React.StrictMode>,
);
