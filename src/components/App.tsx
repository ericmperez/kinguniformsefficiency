import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import ActiveInvoices from "./ActiveInvoices";
import Supervisor from "./Supervisor";
import "./App.css";

function App() {
  return (
    <Router>
      <div
        className="app-root d-flex flex-column align-items-center"
        style={{ minHeight: "100vh", width: "100vw", background: "#f8f9fa" }}
      >
        {/* Navigation Bar */}
        <nav
          className="navbar navbar-expand-lg navbar-light bg-light w-100"
          style={{ maxWidth: 1200, margin: "0 auto" }}
        >
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {/* ...existing nav links... */}
            <li className="nav-item">
              <Link className="nav-link d-flex align-items-center" to="/supervisor">
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#fff', border: '2px solid #D72328', borderRadius: '50%', marginRight: 6 }}>
                  {/* Inline SVG for person icon */}
                  <svg xmlns
                  alt="Supervisor"
                  style={{
                    width: 22,
                    height: 22,
                    marginRight: 6,
                  }}
                />
                <span className="d-none d-lg-inline">Supervisor</span>
              </Link>
            </li>
          </ul>
        </nav>
        {/* Main Content */}
        <main
          className="flex-grow-1 w-100 d-flex flex-column align-items-center justify-content-center"
          style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}
        >
          <Routes>
            {/* ...existing routes... */}
            <Route path="/supervisor" element={<Supervisor />} />
            {/* Example: <Route path="/active-invoices" element={<ActiveInvoices />} /> */}
          </Routes>
        </main>
        {/* Footer */}
        <footer
          className="bg-light text-center text-lg-start"
          style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}
        >
          {/* ...existing footer code... */}
        </footer>
      </div>
    </Router>
  );
}

export default App;
