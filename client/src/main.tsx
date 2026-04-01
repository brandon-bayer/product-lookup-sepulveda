import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// This setup prevents flickering on iOS for camera usage
document.addEventListener('touchstart', function() {}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
