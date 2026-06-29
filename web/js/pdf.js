// PDF export via jsPDF (loaded lazily from CDN). Each journal page is rendered
// (template + handwriting) to an image and placed on its own PDF page.
window.LJPDF = (function () {
  const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let loading;

  function ensureLib() {
    if (window.jspdf) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load PDF library'));
      document.head.appendChild(s);
    });
    return loading;
  }

  async function exportJournal(journal) {
    await ensureLib();
    const { jsPDF } = window.jspdf;
    const { W, H } = LJData.PAGE;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [W, H] });
    journal.pages.forEach((page, i) => {
      if (i > 0) pdf.addPage([W, H], 'portrait');
      const canvas = JournalCanvas.renderPageCanvas(page, journal, 2);
      const img = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(img, 'JPEG', 0, 0, W, H);
    });
    const name = (journal.title || 'Life Journal').replace(/[\\/:*?"<>|]/g, '-');
    pdf.save(name + '.pdf');
  }

  return { exportJournal };
})();
