import React, { useState } from 'react';
import { Button, Box, Typography, Card, CardContent, Divider } from '@mui/material';
import SignatureModal from '../SignatureModal';
import { OfflineSignatureModal } from '../OfflineSignatureModal';

// Sample invoice data with cart information
const sampleInvoice = {
  id: 'invoice_123',
  clientId: 'client_456',
  clientName: 'ACME Medical Center',
  invoiceNumber: 'INV-2024-001',
  total: 1250.75,
  carts: [
    {
      id: 'cart_1',
      name: 'Scrub Cart A',
      items: [
        { productId: 'prod_1', productName: 'Scrub Tops - Medium', quantity: 15, price: 25.00 },
        { productId: 'prod_2', productName: 'Scrub Pants - Medium', quantity: 15, price: 22.00 },
        { productId: 'prod_3', productName: 'Lab Coats - Large', quantity: 5, price: 45.00 }
      ]
    },
    {
      id: 'cart_2', 
      name: 'Linens Cart B',
      items: [
        { productId: 'prod_4', productName: 'Bed Sheets - Queen', quantity: 25, price: 18.00 },
        { productId: 'prod_5', productName: 'Pillow Cases', quantity: 30, price: 8.00 },
        { productId: 'prod_6', productName: 'Towels - Bath', quantity: 20, price: 12.00 }
      ]
    },
    {
      id: 'cart_3',
      name: 'Specialty Cart C', 
      items: [
        { productId: 'prod_7', productName: 'Surgical Gowns', quantity: 10, price: 35.00 },
        { productId: 'prod_8', productName: 'Sterile Drapes', quantity: 8, price: 28.00 }
      ]
    }
  ]
};

export const SignatureModalExample: React.FC = () => {
  const [showOriginalModal, setShowOriginalModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const handleSignatureSaved = () => {
    console.log('Signature saved successfully!');
  };

  const handleOfflineSignatureCapture = (signatureId: string) => {
    console.log('Offline signature captured:', signatureId);
  };

  // Calculate totals for display
  const totalCarts = sampleInvoice.carts.length;
  const totalItems = sampleInvoice.carts.reduce((sum, cart) => sum + cart.items.length, 0);
  const totalQuantity = sampleInvoice.carts.reduce((sum, cart) => 
    sum + cart.items.reduce((cartSum, item) => cartSum + item.quantity, 0), 0
  );

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3, textAlign: 'center', fontWeight: 700 }}>
        📝 Signature Modal with Cart Information
      </Typography>

      {/* Sample Invoice Preview */}
      <Card sx={{ mb: 3, border: '2px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#D72328', fontWeight: 700 }}>
            Sample Delivery Invoice
          </Typography>
          
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Client:</strong> {sampleInvoice.clientName}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Invoice:</strong> {sampleInvoice.invoiceNumber}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            <strong>Total Value:</strong> ${sampleInvoice.total.toFixed(2)}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Quick Stats */}
          <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                {totalCarts}
              </Typography>
              <Typography variant="caption">Carts</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                {totalItems}
              </Typography>
              <Typography variant="caption">Item Types</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                {totalQuantity}
              </Typography>
              <Typography variant="caption">Total Pieces</Typography>
            </Box>
          </Box>

          {/* Cart Breakdown */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Cart Details:
          </Typography>
          {sampleInvoice.carts.map((cart, index) => (
            <Typography key={cart.id} variant="body2" sx={{ mb: 0.5, pl: 2 }}>
              • <strong>{cart.name}:</strong> {cart.items.length} item types, {' '}
              {cart.items.reduce((sum, item) => sum + item.quantity, 0)} total pieces
            </Typography>
          ))}
        </CardContent>
      </Card>

      {/* Demo Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => setShowOriginalModal(true)}
          sx={{ 
            minWidth: 200,
            backgroundColor: '#D72328',
            '&:hover': { backgroundColor: '#b91c24' }
          }}
        >
          🖋️ Original Signature Modal
        </Button>
        
        <Button
          variant="contained"
          size="large"
          onClick={() => setShowOfflineModal(true)}
          sx={{ 
            minWidth: 200,
            backgroundColor: '#2e7d32',
            '&:hover': { backgroundColor: '#1b5e20' }
          }}
        >
          📱 Offline Signature Modal
        </Button>
      </Box>

      <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          <strong>New Feature:</strong> Both signature modals now display the quantity of carts and items being delivered,
          providing clear confirmation of what the client is receiving before signing.
        </Typography>
      </Box>

      {/* Signature Modals */}
      <SignatureModal
        show={showOriginalModal}
        onClose={() => setShowOriginalModal(false)}
        invoiceId={sampleInvoice.id}
        invoiceNumber={sampleInvoice.invoiceNumber}
        clientName={sampleInvoice.clientName}
        clientId={sampleInvoice.clientId}
        invoice={sampleInvoice as any}
        onSignatureSaved={handleSignatureSaved}
      />

      <OfflineSignatureModal
        open={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        invoice={sampleInvoice}
        onSignatureCapture={handleOfflineSignatureCapture}
      />
    </Box>
  );
}; 