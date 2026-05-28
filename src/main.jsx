import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function detectPage() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = new URLSearchParams(window.location.search).get("page");

  if (pathname === "/admin" || page === "admin") {
    return "admin";
  }

  if (pathname === "/about" || pathname === "/documents" || page === "about" || page === "documents") {
    return "about";
  }

  return "home";
}

const rootNode = document.getElementById("root");
if (!rootNode) {
  throw new Error("Root node #root not found");
}

const root = createRoot(rootNode);
const pageType = detectPage();

async function mountPage() {
  if (pageType === "admin") {
    const { default: AdminApp } = await import("./AdminApp.jsx");
    root.render(<AdminApp />);
    return;
  }

  if (pageType === "about") {
    const { default: AboutApp } = await import("./AboutApp.jsx");
    root.render(<AboutApp />);
    return;
  }

  const { default: HomeApp } = await import("./HomeApp.jsx");
  root.render(<HomeApp />);
}

mountPage().catch(() => {
  root.render(
    <main style={{ padding: "24px", fontFamily: "Manrope, sans-serif" }}>
      <h1>Ошибка запуска</h1>
      <p>Не удалось загрузить страницу. Обновите вкладку.</p>
    </main>
  );
});
