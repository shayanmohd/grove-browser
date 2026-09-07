import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import { IconContext } from "@phosphor-icons/react";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ size: 20, weight: "regular" }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>,
);
