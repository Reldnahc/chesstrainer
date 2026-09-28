import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountGate from "./AccountGate";
import { CoachProvider } from "./coach/CoachProvider";
import { MotionProvider } from "./MotionProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountGate>
      <MotionProvider>
        <CoachProvider>
          <App />
        </CoachProvider>
      </MotionProvider>
    </AccountGate>
  </React.StrictMode>,
);
