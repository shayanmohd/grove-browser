import React from "react";
import ReactDOM from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
// Base styles load before App so each component's own CSS wins ties.
import "./styles.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ size: 20, weight: "regular" }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>,
);
