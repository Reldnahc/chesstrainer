import React from "react";
import ReactDOM from "react-dom/client";
import CoachStudio from "../src/coach/studio/CoachStudio";
import "../src/coach-presentation.css";
import "../src/foundation.css";
import "../src/interface-motion.css";
import "./shell.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="studio-page">
      <CoachStudio />
    </main>
  </React.StrictMode>,
);
