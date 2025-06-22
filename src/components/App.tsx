import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import ActiveInvoices from "./ActiveInvoices";
import "./App.css";

function App() {
  return (
    <div
      className="app-root d-flex flex-column align-items-center"
      style={{ minHeight: "100vh", width: "100vw", background: "#f8f9fa" }}
    >
      {/* Navigation Bar */}
      <nav
        className="navbar navbar-expand-lg navbar-light bg-light w-100"
        style={{ maxWidth: 1200, margin: "0 auto" }}
      >
        {/* ...existing code... */}
      </nav>
      {/* Main Content */}
      <main
        className="flex-grow-1 w-100 d-flex flex-column align-items-center justify-content-center"
        style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}
      >
        {/* Remove broken <Route path="/active-invoices" ... /> and keep conditional rendering here */}
        {/* ...existing conditional rendering for pages/components... */}
      </main>
      {/* Footer */}
      <footer
        className="bg-light text-center text-lg-start"
        style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}
      >
        {/* ...existing footer code... */}
      </footer>
    </div>
  );
}

export default App;
