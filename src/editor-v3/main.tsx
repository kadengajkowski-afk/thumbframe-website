import "pixi.js/advanced-blend-modes";
import "@/styles/tokens.css";
import "@/styles/fonts.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { preloadBundledFonts } from "@/lib/fonts";

preloadBundledFonts();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
