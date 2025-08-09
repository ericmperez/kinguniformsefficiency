import React from "react";
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfPreviewProps {
  pdfData: Uint8Array | null;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ pdfData }) => {
  if (!pdfData) {
    return <div className="border rounded p-3 bg-light text-center">No PDF preview available.</div>;
  }
  // Convert Uint8Array to Blob URL
  const blob = new Blob([pdfData], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  return (
    <div style={{ height: 500 }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={url} />
      </Worker>
    </div>
  );
};

export default PdfPreview;
