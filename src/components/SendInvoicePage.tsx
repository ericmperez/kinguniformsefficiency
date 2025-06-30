import React, { useEffect, useState } from "react";
import { getClients, getInvoices, logActivity } from "../services/firebaseService";
import { Client, Invoice } from "../types";
import html2pdf from "html2pdf.js";

const SendInvoicePage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [emailTo, setEmailTo] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      getInvoices().then(all => {
        setInvoices(all.filter(inv => inv.clientId === selectedClientId && inv.status === "done"));
      });
      const client = clients.find(c => c.id === selectedClientId);
      setEmailTo(client?.email || "");
    } else {
      setInvoices([]);
      setEmailTo("");
    }
    setSelectedInvoices([]);
  }, [selectedClientId, clients]);

  const handleInvoiceCheck = (id: string) => {
    setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  async function sendCustomInvoice() {
    setStatus("");
    if (!emailTo || !subject || !message || selectedInvoices.length === 0) {
      setStatus("Please fill all fields and select at least one invoice.");
      return;
    }
    // Generate PDF from selected invoices
    const pdfContent = document.getElementById("pdf-preview");
    if (!pdfContent) {
      setStatus("PDF preview not found.");
      return;
    }
    try {
      const pdfBlob = await html2pdf().from(pdfContent).outputPdf("blob");
      const pdfBase64 = await blobToBase64(pdfBlob);
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject,
          text: message,
          pdfBase64: pdfBase64.split(",")[1],
        }),
      });
      if (res.ok) {
        setStatus("Email sent successfully.");
        await logActivity({
          type: "Invoice",
          message: `Custom invoice email sent to ${emailTo} (subject: '${subject}')`,
        });
      } else {
        setStatus("Failed to send email.");
      }
    } catch (err) {
      setStatus("Error generating or sending PDF.");
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return (
    <div className="container py-4">
      <h2>Send Custom Invoice Email</h2>
      <div className="mb-3" style={{ maxWidth: 350 }}>
        <label className="form-label">Select Client</label>
        <select className="form-select" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
          <option value="">-- Select Client --</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>
      {selectedClientId && (
        <>
          <div className="mb-3" style={{ maxWidth: 350 }}>
            <label className="form-label">Recipient Email</label>
            <input type="email" className="form-control" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
          </div>
          <div className="mb-3" style={{ maxWidth: 500 }}>
            <label className="form-label">Email Subject</label>
            <input type="text" className="form-control" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="mb-3" style={{ maxWidth: 500 }}>
            <label className="form-label">Email Message</label>
            <textarea className="form-control" rows={3} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">Select Invoices to Include in PDF</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
              {invoices.length === 0 && <div className="text-muted">No invoices found for this client.</div>}
              {invoices.map(inv => (
                <div key={inv.id} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={inv.id}
                    checked={selectedInvoices.includes(inv.id)}
                    onChange={() => handleInvoiceCheck(inv.id)}
                  />
                  <label className="form-check-label" htmlFor={inv.id}>
                    #{inv.invoiceNumber || inv.id} - {inv.date ? new Date(inv.date).toLocaleDateString() : '-'}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">PDF Preview</label>
            <div id="pdf-preview" style={{ background: '#fff', border: '1px solid #ccc', padding: 16, minHeight: 100 }}>
              <h3 style={{ color: '#0E62A0' }}>{subject || 'Invoice(s)'}</h3>
              <div style={{ marginBottom: 12 }}>{message}</div>
              {invoices.filter(inv => selectedInvoices.includes(inv.id)).map(inv => (
                <div key={inv.id} style={{ borderBottom: '1px solid #eee', marginBottom: 8, paddingBottom: 8 }}>
                  <div><b>Invoice #:</b> {inv.invoiceNumber || inv.id}</div>
                  <div><b>Date:</b> {inv.date ? new Date(inv.date).toLocaleDateString() : '-'}</div>
                  <div><b>Truck #:</b> {inv.truckNumber || '-'}</div>
                  <div><b>Verifier:</b> {inv.verifiedBy || '-'}</div>
                  {/* Add more invoice details as needed */}
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={sendCustomInvoice}>Send Email with PDF</button>
          {status && <div className="mt-2" style={{ color: status.includes('success') ? 'green' : 'red' }}>{status}</div>}
        </>
      )}
    </div>
  );
};

export default SendInvoicePage;
