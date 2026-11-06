/* fara Trezor – definicija PDF dokumenta (koristi pdfmake) */
(function (root) {
  const fmt = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}.`; };
  const SECRET = ['pass', 'num', 'cvv', 'pin', 'a1', 'a2', 'codes'];
  const clean = s => String(s ?? '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F]/gu, '');
  const flat = { hLineWidth: () => 0, vLineWidth: () => 0 };

  function build(entries, TYPES, COL, meta = {}) {
    const groups = Object.keys(TYPES).map(k => ({ k, list: entries.filter(e => e.type === k).sort((a, b) => a.title.localeCompare(b.title, 'bs')) })).filter(g => g.list.length);
    const box = (stack, fill, extra = {}) => ({ table: { widths: ['*'], body: [[{ stack }]] }, layout: { ...flat, fillColor: () => fill, paddingLeft: () => 26, paddingRight: () => 26, paddingTop: () => 22, paddingBottom: () => 22, ...extra } });

    const stats = [['Unosa', String(entries.length)], ['Kategorija', String(groups.length)]];
    if (meta.score != null) stats.push(['Zdravlje šifri', meta.score + '%']);

    const content = [
      box([{ text: [{ text: 'fara ', bold: false, color: '#9fe3d0' }, { text: 'Trezor', bold: true, color: '#4fd1b0' }], fontSize: 32 }, { text: 'Izvod trezora', fontSize: 16, color: '#ffffff', margin: [0, 2, 0, 10] },
        { text: `Izvezeno ${fmt(Date.now())}`, fontSize: 10, color: '#9fb8b5' }], '#0f2a2a'),
      { margin: [0, 14, 0, 14], table: { widths: ['*'], body: [[{ text: 'Pažnja: ovaj dokument sadrži šifre u čitljivom obliku. Čuvaj ga na sigurnom mjestu, ne šalji ga nikome i obriši kada ti više ne treba.', color: '#8a2a22', bold: true, fontSize: 9.5 }]] },
        layout: { hLineWidth: () => 0, vLineWidth: i => i === 0 ? 3 : 0, vLineColor: () => '#d9534f', fillColor: () => '#fdecea', paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 9, paddingBottom: () => 9 } },
      { columns: stats.map(([l, v]) => ({ table: { widths: ['*'], body: [[{ stack: [{ text: v, fontSize: 24, bold: true, color: '#0f6b57' }, { text: l, fontSize: 9, color: '#6b7785' }] }]] },
        layout: { ...flat, fillColor: () => '#eef6f4', paddingLeft: () => 14, paddingTop: () => 12, paddingBottom: () => 12 } })), columnGap: 10, margin: [0, 0, 0, 22] },
      { text: 'Sadržaj', fontSize: 15, bold: true, margin: [0, 0, 0, 8] },
      { table: { widths: [14, '*', 'auto'], body: groups.map(g => [
          { canvas: [{ type: 'rect', x: 0, y: 2, w: 9, h: 9, r: 2, color: COL[g.k] || '#4fd1b0' }] },
          { text: TYPES[g.k].p, fontSize: 11 }, { text: String(g.list.length), alignment: 'right', bold: true, fontSize: 11 }]) },
        layout: { hLineWidth: (i, n) => i === 0 || i === n.table.body.length ? 0 : 0.5, vLineWidth: () => 0, hLineColor: () => '#dde5ea', paddingTop: () => 7, paddingBottom: () => 7 } }
    ];

    groups.forEach(g => {
      const c = COL[g.k] || '#4fd1b0';
      content.push({ text: `${TYPES[g.k].p}  (${g.list.length})`, fontSize: 19, bold: true, color: c, pageBreak: 'before', margin: [0, 0, 0, 4] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: c }], margin: [0, 0, 0, 12] });
      g.list.forEach(e => {
        const rows = [];
        TYPES[g.k].fields.forEach(([k, l]) => { const v = e.f[k]; if (v) rows.push([{ text: l, color: '#6b7785', fontSize: 9 }, SECRET.includes(k) ? { text: clean(v), bold: true, color: '#0f6b57' } : { text: clean(v) }]); });
        if (e.h && e.h.length) rows.push([{ text: 'Prethodne šifre', color: '#6b7785', fontSize: 9 }, { text: e.h.map(h => `${h.p}   (do ${fmt(h.d)})`).join('\n'), color: '#7a6a53' }]);
        if (e.att && e.att.length) rows.push([{ text: 'Prilozi', color: '#6b7785', fontSize: 9 }, { text: `${e.att.length} slika (nisu uključene u PDF)`, italics: true, color: '#8a9bad' }]);
        rows.push([{ text: 'Zadnja izmjena', color: '#6b7785', fontSize: 9 }, { text: e.updated ? fmt(e.updated) : '–', color: '#8a9bad' }]);
        content.push({ unbreakable: true, margin: [0, 0, 0, 12],
          table: { widths: [105, '*'], body: [[{ text: clean(e.title) + (e.pin ? '  ★' : ''), colSpan: 2, bold: true, fontSize: 12.5, fillColor: '#f1f5f8' }, {}], ...rows] },
          layout: { hLineWidth: () => 0.5, vLineWidth: i => i === 0 ? 3 : 0, hLineColor: () => '#dde5ea', vLineColor: () => c, paddingLeft: () => 11, paddingRight: () => 11, paddingTop: () => 5, paddingBottom: () => 5 } });
      });
    });

    return {
      pageSize: 'A4', pageMargins: [40, 56, 40, 52], info: { title: 'fara Trezor – izvod trezora', author: 'fara Trezor' },
      defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#1f2d3d', lineHeight: 1.15 },
      header: page => page === 1 ? null : { text: 'fara Trezor · izvod trezora', margin: [40, 26, 40, 0], fontSize: 8, color: '#8a9bad' },
      footer: (page, pages) => ({ columns: [{ text: 'Povjerljivo – čuvaj na sigurnom mjestu', fontSize: 8, color: '#8a9bad' }, { text: `Stranica ${page} / ${pages}`, alignment: 'right', fontSize: 8, color: '#8a9bad' }], margin: [40, 18, 40, 0] }),
      content
    };
  }
  root.SefPdf = { build };
})(typeof window !== 'undefined' ? window : globalThis);
