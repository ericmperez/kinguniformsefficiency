import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import ActiveInvoices from "./ActiveInvoices";
import Supervisor from "./Supervisor";
import SendInvoicePage from "./SendInvoicePage";
import "./App.css";
import { Client, Invoice, Product, Cart } from "../types";

function App() {
  // Dummy data for clients and invoices (fully typed)
  const clients: Client[] = [
    {
      id: "1",
      name: "Client A",
      selectedProducts: [],
      image: null,
      imageUrl: undefined,
      isRented: false,
      washingType: "Tunnel",
      segregation: false,
    },
    {
      id: "2",
      name: "Client B",
      selectedProducts: [],
      image: null,
      imageUrl: undefined,
      isRented: false,
      washingType: "Conventional",
      segregation: false,
    },
  ];

  const invoices: Invoice[] = [
    {
      id: "inv1",
      clientId: "1",
      clientName: "Client A",
      date: new Date().toISOString(),
      products: [],
      total: 100,
      carts: [],
      status: "Tunnel",
      invoiceNumber: 1,
      locked: false,
      verified: false,
      verifiedBy: undefined,
      verifiedAt: undefined,
      verifiedProducts: undefined,
      lockedBy: undefined,
      lockedAt: undefined,
      note: undefined,
    },
    {
      id: "inv2",
      clientId: "2",
      clientName: "Client B",
      date: new Date().toISOString(),
      products: [],
      total: 200,
      carts: [],
      status: "Conventional",
      invoiceNumber: 2,
      locked: false,
      verified: false,
      verifiedBy: undefined,
      verifiedAt: undefined,
      verifiedProducts: undefined,
      lockedBy: undefined,
      lockedAt: undefined,
      note: undefined,
    },
  ];

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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D72328" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, marginRight: 0 }}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 8-4 8-4s8 0 8 4" />
                  </svg>
                </span>
                <span className="d-none d-lg-inline">Supervisor</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link d-flex align-items-center" to="/send-invoice">
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#fff', border: '2px solid #0ea5e9', borderRadius: '50%', marginRight: 6 }}>
                  <i className="bi bi-envelope-paper" style={{ fontSize: 18, color: '#0ea5e9' }}></i>
                </span>
                <span className="d-none d-lg-inline">Send Invoice</span>
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
            <Route path="/supervisor" element={<Supervisor clients={clients} invoices={invoices} />} />
            <Route path="/send-invoice" element={<SendInvoicePage />} />
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
