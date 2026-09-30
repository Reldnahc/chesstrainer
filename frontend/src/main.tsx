import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountGate from "./AccountGate";
import { CoachProvider } from "./coach/CoachProvider";
import { MotionProvider } from "./MotionProvider";
import { AudioProvider } from "./audio/AudioProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountGate>
      <AudioProvider>
      <MotionProvider>
        <CoachProvider>
          <App />
        </CoachProvider>
      </MotionProvider>
      </AudioProvider>
    </AccountGate>
  </React.StrictMode>,
);
