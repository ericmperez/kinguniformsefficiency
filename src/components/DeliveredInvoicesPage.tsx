import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, Client } from '../types';
import { getInvoices, getClients, logActivity } from '../services/firebaseService';
import { sendInvoiceEmail, generateInvoicePDF } from '../services/emailService';
import InvoiceDetailsPopup from './InvoiceDetailsPopup';

interface DeliveredInvoicesPageProps {}

const DeliveredInvoicesPage: React.FC<DeliveredInvoicesPageProps> = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  
  // Filter states
  const [clientFilter, setClientFilter] = useState<string>('');
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Selection states for bulk operations
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Email operations
  const [emailingInvoices, setEmailingInvoices] = useState<Set<string>>(new Set());
  const [downloadingPDFs, setDownloadingPDFs] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allInvoices, allClients] = await Promise.all([
        getInvoices(),
        getClients()
      ]);
      
      // Filter to only delivered/signed invoices (status === "done")
      const deliveredInvoices = allInvoices.filter(inv => inv.status === 'done');
      
      setInvoices(deliveredInvoices);
      setClients(allClients);
      
      // Set default date range to last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      setEndDate(today.toISOString().slice(0, 10));
      setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));
      
    } catch (error) {
      console.error('Error loading delivered invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered invoices based on all criteria
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Client filter
      if (clientFilter && invoice.clientId !== clientFilter) return false;
      
      // Email status filter
      if (emailStatusFilter !== 'all') {
        const emailStatus = invoice.emailStatus;
        switch (emailStatusFilter) {
          case 'sent':
            if (!emailStatus?.manualEmailSent && !emailStatus?.approvalEmailSent && !emailStatus?.shippingEmailSent) return false;
            break;
          case 'not_sent':
            if (emailStatus?.manualEmailSent || emailStatus?.approvalEmailSent || emailStatus?.shippingEmailSent) return false;
            break;
          case 'failed':
            if (!emailStatus?.lastEmailError) return false;
            break;
        }
      }
      
      // Date range filter
      if (startDate && invoice.date) {
        const invoiceDate = new Date(invoice.date);
        const start = new Date(startDate);
        if (invoiceDate < start) return false;
      }
      
      if (endDate && invoice.date) {
        const invoiceDate = new Date(invoice.date);
        const end = new Date(endDate + 'T23:59:59');
        if (invoiceDate > end) return false;
      }
      
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesInvoiceNumber = (invoice.invoiceNumber || '').toString().toLowerCase().includes(searchLower);
        const matchesClientName = (invoice.clientName || '').toLowerCase().includes(searchLower);
        const matchesInvoiceName = (invoice.name || '').toLowerCase().includes(searchLower);
        
        if (!matchesInvoiceNumber && !matchesClientName && !matchesInvoiceName) return false;
      }
      
      return true;
    });
  }, [invoices, clientFilter, emailStatusFilter, startDate, endDate, searchTerm]);

  // Handle individual email resend
  const handleResendEmail = async (invoice: Invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    
    if (!client?.email) {
      alert('Client email not configured');
      return;
    }
    
    if (!client.printConfig?.emailSettings?.enabled) {
      alert('Email settings not enabled for this client');
      return;
    }
    
    setEmailingInvoices(prev => new Set(prev).add(invoice.id));
    
    try {
      // Generate PDF
      let pdfContent: string | undefined;
      try {
        pdfContent = await generateInvoicePDF(
          client,
          invoice,
          client.printConfig.invoicePrintSettings,
          undefined // No driver name available in this context
        );
      } catch (error) {
        console.error('Failed to generate PDF:', error);
      }
      
      // Send email
      const success = await sendInvoiceEmail(
        client,
        invoice,
        client.printConfig.emailSettings,
        pdfContent
      );
      
      if (success) {
        // Update email status (in a real app, you'd call onUpdateInvoice)
        alert(`✅ Email sent successfully to ${client.email}`);
        // Refresh data to show updated email status
        await loadData();
      } else {
        alert('❌ Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Email send error:', error);
      alert('❌ Error sending email. Please check configuration.');
    } finally {
      setEmailingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(invoice.id);
        return newSet;
      });
    }
  };

  // Handle bulk email resend
  const handleBulkEmailResend = async () => {
    if (selectedInvoices.length === 0) {
      alert('Please select invoices to email');
      return;
    }
    
    const invoicesToEmail = filteredInvoices.filter(inv => selectedInvoices.includes(inv.id));
    let successCount = 0;
    let failCount = 0;
    
    for (const invoice of invoicesToEmail) {
      const client = clients.find(c => c.id === invoice.clientId);
      
      if (!client?.email || !client.printConfig?.emailSettings?.enabled) {
        failCount++;
        continue;
      }
      
      setEmailingInvoices(prev => new Set(prev).add(invoice.id));
      
      try {
        let pdfContent: string | undefined;
        try {
          pdfContent = await generateInvoicePDF(
            client,
            invoice,
            client.printConfig.invoicePrintSettings,
            undefined // No driver name available in this context
          );
        } catch (error) {
          console.error('PDF generation failed:', error);
        }
        
        const success = await sendInvoiceEmail(
          client,
          invoice,
          client.printConfig.emailSettings,
          pdfContent
        );
        
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      } finally {
        setEmailingInvoices(prev => {
          const newSet = new Set(prev);
          newSet.delete(invoice.id);
          return newSet;
        });
      }
    }
    
    alert(`Bulk email completed!\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`);
    setSelectedInvoices([]);
    setSelectAll(false);
    await loadData();
  };

  // Handle bulk PDF download
  const handleBulkPDFDownload = async () => {
    if (selectedInvoices.length === 0) {
      alert('Please select invoices to download');
      return;
    }
    
    setDownloadingPDFs(true);
    
    try {
      const invoicesToDownload = filteredInvoices.filter(inv => selectedInvoices.includes(inv.id));
      
      for (const invoice of invoicesToDownload) {
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;
        
        try {
          const pdfContent = await generateInvoicePDF(
            client,
            invoice,
            client.printConfig?.invoicePrintSettings,
            undefined // No driver name available in this context
          );
          
          if (pdfContent) {
            // Convert base64 to blob
            const base64Data = pdfContent.split(',')[1] || pdfContent;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${invoice.invoiceNumber || invoice.id}-${client.name}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to download PDF for invoice ${invoice.id}:`, error);
        }
      }
      
      alert(`Downloaded ${invoicesToDownload.length} PDFs`);
    } catch (error) {
      console.error('Bulk PDF download error:', error);
      alert('Error downloading PDFs');
    } finally {
      setDownloadingPDFs(false);
      setSelectedInvoices([]);
      setSelectAll(false);
    }
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
    setSelectAll(!selectAll);
  };

  // Get email status display
  const getEmailStatusDisplay = (invoice: Invoice) => {
    const emailStatus = invoice.emailStatus;
    
    if (emailStatus?.lastEmailError) {
      return {
        status: 'error',
        text: 'Failed',
        className: 'badge bg-danger',
        title: emailStatus.lastEmailError
      };
    }
    
    if (emailStatus?.shippingEmailSent) {
      return {
        status: 'sent',
        text: 'Shipping Email',
        className: 'badge bg-success',
        title: `Sent: ${new Date(emailStatus.shippingEmailSentAt || '').toLocaleString()}`
      };
    }
    
    if (emailStatus?.manualEmailSent) {
      return {
        status: 'sent',
        text: 'Manual Email',
        className: 'badge bg-info',
        title: `Sent: ${new Date(emailStatus.manualEmailSentAt || '').toLocaleString()}`
      };
    }
    
    if (emailStatus?.approvalEmailSent) {
      return {
        status: 'sent',
        text: 'Approval Email',
        className: 'badge bg-primary',
        title: `Sent: ${new Date(emailStatus.approvalEmailSentAt || '').toLocaleString()}`
      };
    }
    
    return {
      status: 'not_sent',
      text: 'Not Sent',
      className: 'badge bg-secondary',
      title: 'No emails have been sent'
    };
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading delivered invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <i className="bi bi-check-circle-fill text-success me-2"></i>
          Delivered Invoices
        </h2>
        <button 
          className="btn btn-outline-primary"
          onClick={loadData}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Refresh
        </button>
      </div>

      {/* Filters Section */}
      <div className="card mb-4">
        <div className="card-body">
          <h6 className="card-title">Filters & Search</h6>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Client</label>
              <select 
                className="form-select"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">All Clients</option>
                {clients
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))
                }
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Email Status</label>
              <select 
                className="form-select"
                value={emailStatusFilter}
                onChange={(e) => setEmailStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="sent">Email Sent</option>
                <option value="not_sent">Email Not Sent</option>
                <option value="failed">Email Failed</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Start Date</label>
              <input 
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">End Date</label>
              <input 
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Search</label>
              <input 
                type="text"
                className="form-control"
                placeholder="Invoice #, Client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedInvoices.length > 0 && (
        <div className="alert alert-info d-flex justify-content-between align-items-center mb-4">
          <span>
            <i className="bi bi-check-square me-2"></i>
            {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? 's' : ''} selected
          </span>
          <div>
            <button 
              className="btn btn-outline-secondary btn-sm me-2"
              onClick={() => {
                setSelectedInvoices([]);
                setSelectAll(false);
              }}
            >
              Clear Selection
            </button>
            <button 
              className="btn btn-success btn-sm me-2"
              onClick={handleBulkEmailResend}
              disabled={emailingInvoices.size > 0}
            >
              <i className="bi bi-envelope me-1"></i>
              Resend Emails ({selectedInvoices.length})
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleBulkPDFDownload}
              disabled={downloadingPDFs}
            >
              {downloadingPDFs ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Downloading...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-1"></i>
                  Download PDFs ({selectedInvoices.length})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h5 className="card-title text-primary">{filteredInvoices.length}</h5>
              <small className="text-muted">Total Delivered</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h5 className="card-title text-success">
                {filteredInvoices.filter(inv => {
                  const status = inv.emailStatus;
                  return status?.manualEmailSent || status?.approvalEmailSent || status?.shippingEmailSent;
                }).length}
              </h5>
              <small className="text-muted">Emails Sent</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h5 className="card-title text-warning">
                {filteredInvoices.filter(inv => !inv.emailStatus || 
                  (!inv.emailStatus.manualEmailSent && !inv.emailStatus.approvalEmailSent && !inv.emailStatus.shippingEmailSent)
                ).length}
              </h5>
              <small className="text-muted">No Email Sent</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h5 className="card-title text-danger">
                {filteredInvoices.filter(inv => inv.emailStatus?.lastEmailError).length}
              </h5>
              <small className="text-muted">Email Errors</small>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>
                    <input 
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="form-check-input"
                    />
                  </th>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Delivery Date</th>
                  <th>Signature</th>
                  <th>Email Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      <i className="bi bi-inbox display-4 d-block mb-2"></i>
                      No delivered invoices found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(invoice => {
                    const client = clients.find(c => c.id === invoice.clientId);
                    const emailDisplay = getEmailStatusDisplay(invoice);
                    const isEmailEnabled = client?.email && client?.printConfig?.emailSettings?.enabled;
                    const isEmailing = emailingInvoices.has(invoice.id);
                    
                    return (
                      <tr key={invoice.id}>
                        <td>
                          <input 
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvoices(prev => [...prev, invoice.id]);
                              } else {
                                setSelectedInvoices(prev => prev.filter(id => id !== invoice.id));
                                setSelectAll(false);
                              }
                            }}
                            className="form-check-input"
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={() => setSelectedInvoiceId(invoice.id)}
                          >
                            #{invoice.invoiceNumber || invoice.id}
                          </button>
                        </td>
                        <td>{client?.name || invoice.clientName}</td>
                        <td>
                          {invoice.deliveryDate 
                            ? new Date(invoice.deliveryDate).toLocaleDateString()
                            : invoice.date 
                            ? new Date(invoice.date).toLocaleDateString()
                            : '-'
                          }
                        </td>
                        <td>
                          {invoice.signature ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              Signed
                            </span>
                          ) : (
                            <span className="badge bg-warning">
                              <i className="bi bi-clock me-1"></i>
                              Pending
                            </span>
                          )}
                        </td>
                        <td>
                          <span 
                            className={emailDisplay.className}
                            title={emailDisplay.title}
                          >
                            {emailDisplay.text}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => setSelectedInvoiceId(invoice.id)}
                              title="View Details"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            {isEmailEnabled && (
                              <button
                                className="btn btn-outline-success btn-sm"
                                onClick={() => handleResendEmail(invoice)}
                                disabled={isEmailing}
                                title={`Resend email to ${client?.email}`}
                              >
                                {isEmailing ? (
                                  <span className="spinner-border spinner-border-sm"></span>
                                ) : (
                                  <i className="bi bi-envelope"></i>
                                )}
                              </button>
                            )}
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={async () => {
                                if (!client) return;
                                
                                try {
                                  const pdfContent = await generateInvoicePDF(
                                    client,
                                    invoice,
                                    client.printConfig?.invoicePrintSettings,
                                    undefined // No driver name available in this context
                                  );
                                  
                                  if (pdfContent) {
                                    // Convert base64 to blob for download
                                    const base64Data = pdfContent.split(',')[1] || pdfContent;
                                    try {
                                      // Convert base64 string to binary
                                      const binaryString = atob(base64Data);
                                      const bytes = new Uint8Array(binaryString.length);
                                      for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                      }
                                      
                                      const blob = new Blob([bytes], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `Invoice-${invoice.invoiceNumber || invoice.id}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      URL.revokeObjectURL(url);
                                    } catch (blobError) {
                                      console.error('Error creating PDF blob:', blobError);
                                      alert('Failed to create PDF file');
                                    }
                                  } else {
                                    alert('Failed to generate PDF');
                                  }
                                } catch (error) {
                                  console.error('PDF download error:', error);
                                  alert('Error downloading PDF');
                                }
                              }}
                              title="Download PDF"
                            >
                              <i className="bi bi-download"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailsPopup
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};

export default DeliveredInvoicesPage;
