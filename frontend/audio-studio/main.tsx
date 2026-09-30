import React from "react";
import ReactDOM from "react-dom/client";
import AudioStudio from "../src/audio/studio/AudioStudio";
import "../src/foundation.css";
import "../src/interface-motion.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AudioStudio /></React.StrictMode>,
);
