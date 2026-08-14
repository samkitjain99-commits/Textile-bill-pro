import "./storage-shim.js";
import React from "react";
import ReactDOM from "react-dom/client";
import TextileSales from "./TextileSales.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TextileSales />
  </React.StrictMode>
);
