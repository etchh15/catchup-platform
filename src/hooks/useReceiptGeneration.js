import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function useReceiptGeneration() {
  const generateAndDownloadPDF = useCallback(async (receiptElementId, agreementId) => {
    try {
      const element = document.getElementById(receiptElementId);
      if (!element) {
        throw new Error('Receipt element not found');
      }

      // Convert HTML to canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      // Get PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');

      while (heightLeft >= 0) {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position = heightLeft;
        if (heightLeft >= 0) {
          pdf.addPage();
        }
      }

      // Download PDF
      const filename = `catchup-agreement-${agreementId.substring(0, 8).toUpperCase()}.pdf`;
      pdf.save(filename);

      return filename;
    } catch (err) {
      console.error('Error generating PDF:', err);
      throw err;
    }
  }, []);

  return { generateAndDownloadPDF };
}
