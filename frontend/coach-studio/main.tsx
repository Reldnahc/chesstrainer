import React from "react";
import ReactDOM from "react-dom/client";
import CoachStudio from "../src/coach/studio/CoachStudio";
import "../src/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="workspace-page">
      <CoachStudio />
    </main>
  </React.StrictMode>,
);
