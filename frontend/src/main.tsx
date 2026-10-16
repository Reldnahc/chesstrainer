import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountGate from "./AccountGate";
import { CoachProvider } from "./coach/CoachProvider";
import { MotionProvider } from "./MotionProvider";
import { AudioProvider } from "./audio/AudioProvider";
import { BannerProvider } from "./Banner";
import { installDisclosureMotion } from "./disclosureMotion";
import { installLoadHandoff } from "./loadHandoff";
import { startRouter } from "./navigation";
import "./styles.css";

startRouter();
installDisclosureMotion();
installLoadHandoff(document.getElementById("root")!);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountGate>
      <AudioProvider>
        <MotionProvider>
          <CoachProvider>
            <BannerProvider>
              <App />
            </BannerProvider>
          </CoachProvider>
        </MotionProvider>
      </AudioProvider>
    </AccountGate>
  </React.StrictMode>,
);
