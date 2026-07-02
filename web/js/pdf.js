// PDF export via jsPDF (loaded lazily — bundled copy first, CDN as backup).
// Each journal page is rendered (template + handwriting) to an image and
// placed on its own PDF page.
window.LJPDF = (function () {
  const SOURCES = [
    'vendor/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  ];
  let loading;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error('failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureLib() {
    if (window.jspdf) return Promise.resolve();
    if (loading) return loading;
    loading = loadScript(SOURCES[0])
      .catch(() => loadScript(SOURCES[1]))
      .catch(() => { loading = null; throw new Error('Could not load PDF library'); });
    return loading;
  }

  function loadImage(src, crossOrigin) {
    return new Promise((resolve) => {
      const im = new Image();
      if (crossOrigin) im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  // The month photo (user upload or themed default) for PDF export.
  async function loadMonthPhoto(journal, month) {
    const user = LJStore.getPhoto(journal.id, month);
    if (user) return await loadImage(user, false);            // dataURL — same origin
    let im = await loadImage(LJPlanner.defaultPhotoURL(month, 1200), true);
    if (!im) im = await loadImage(LJPlanner.fallbackPhotoURL(month, 1200), true);
    return im;                                                // null → template draws placeholder
  }

  async function exportJournal(journal) {
    await ensureLib();
    const { jsPDF } = window.jspdf;
    const { W, H } = LJData.PAGE;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [W, H] });
    for (let i = 0; i < journal.pages.length; i++) {
      const page = journal.pages[i];
      if (i > 0) pdf.addPage([W, H], 'portrait');
      let photo = null;
      if (page.template === 'planMonth') photo = await loadMonthPhoto(journal, page.month);
      const canvas = JournalCanvas.renderPageCanvas(page, journal, 2, photo);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
    }
    const name = (journal.title || 'Life Journal').replace(/[\\/:*?"<>|]/g, '-');
    pdf.save(name + '.pdf');
  }

  return { exportJournal };
})();
