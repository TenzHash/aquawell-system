import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </React.StrictMode>,
  );
} else {
  console.error(
    "Failed to find the root element to mount the React application.",
  );
}

// Register the installable PWA shell. Location sharing still requires the rider app
// to remain active in the foreground; browsers do not expose GPS to service workers.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) =>
      console.warn("AquaWell offline shell could not be registered:", error),
    );
  });
}
