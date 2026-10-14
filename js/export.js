/* Export a list of references to Excel (.xlsx) or to a printable page (Print / Save as PDF).
   No library: the .xlsx is a small Office Open XML package written into an uncompressed ZIP. */
(function () {
  const enc = new TextEncoder();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  /* ---------- ZIP (store) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const parts = [], central = []; let offset = 0;
    files.forEach(({ name, data }) => {
      const nameB = enc.encode(name), dataB = typeof data === 'string' ? enc.encode(data) : data, crc = crc32(dataB);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, dataB.length, true); h.setUint32(22, dataB.length, true); h.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(h.buffer), nameB, dataB);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, dataB.length, true); c.setUint32(24, dataB.length, true); c.setUint16(28, nameB.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nameB);
      offset += 30 + nameB.length + dataB.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- XLSX ---------- */
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function xlsx(sheetName, headers, rows, title) {
    const all = [];
    if (title) all.push({ cells: [title], style: 2 }, { cells: [] });
    all.push({ cells: headers, style: 1 });
    rows.forEach(r => all.push({ cells: r }));
    const widths = headers.map((h, i) => Math.min(70, Math.max(String(h).length, ...rows.map(r => String(r[i] == null ? '' : r[i]).length)) + 2));
    const sheetRows = all.map((row, ri) => `<row r="${ri + 1}">` + row.cells.map((v, ci) => {
      const ref = col(ci) + (ri + 1), s = row.style ? ` s="${row.style}"` : '';
      return typeof v === 'number' ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    const headerRow = title ? 3 : 1;
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A${headerRow}:${col(headers.length - 1)}${headerRow + rows.length}"/></worksheet>`;
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E2A47"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const safeName = esc(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeName}'!$A$${headerRow}:$${col(headers.length - 1)}$${headerRow + rows.length}</definedName></definedNames></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/worksheets/sheet1.xml', data: sheet },
      { name: 'xl/styles.xml', data: styles }
    ]);
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- Printable page (Print / Save as PDF) ---------- */
  function printable(title, subtitle, headers, rows, root) {
    const FR = window.LR_LANG === 'fr', T = (en, fr) => (FR ? fr : en);
    const w = window.open('', '_blank');
    if (!w) { alert(T('Please allow pop-ups for this site to print the list.', 'Autorisez les fenêtres pop-up pour ce site afin d’imprimer la liste.')); return; }
    const today = new Date().toLocaleDateString(FR ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    w.document.write(`<!doctype html><html lang="${FR ? 'fr' : 'en'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4; margin: 12mm 12mm 14mm; }
      body { font: 10pt/1.4 Arial, Helvetica, sans-serif; color: #0A1929; margin: 0; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0E2A47; padding-bottom: 8px; margin-bottom: 12px; }
      header img { height: 30px; } header p { margin: 0; font-size: 8.5pt; color: #5A6B7D; text-align: right; }
      h1 { font-size: 15pt; margin: 0 0 2px; } .sub { color: #5A6B7D; margin: 0 0 10px; font-size: 9pt; }
      table { width: 100%; border-collapse: collapse; } th { background: #0E2A47; color: #fff; text-align: left; font-size: 8.5pt; padding: 5px 6px; }
      td { border-bottom: 1px solid #E3E8EE; padding: 4px 6px; font-size: 8.5pt; vertical-align: top; } tr:nth-child(even) td { background: #F5F7FA; }
      td.code { font-family: 'Courier New', monospace; font-weight: bold; white-space: nowrap; } td.num { text-align: right; white-space: nowrap; }
      thead { display: table-header-group; } tr { break-inside: avoid; }
      footer { margin-top: 12px; font-size: 8pt; color: #5A6B7D; }
    </style></head><body>
      <header><img src="${root}assets/img/logo/logo.png" alt="Le Raccordement"><p>Le Raccordement · Zone Industrielle de Doukhane, El Hencha, 3043 Sfax, ${T('Tunisia', 'Tunisie')}<br>commande@leraccordement.com · leraccordement.com · ${esc(today)}</p></header>
      <h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>
      <table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r => `<tr>${r.map((v, i) => `<td class="${i === 0 ? 'code' : typeof v === 'number' ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
      <footer>${T('Prices on request.', 'Prix sur demande.')}</footer>
    </body></html>`);
    w.document.close();
    // Print from this page: the new window runs no script of its own (Content-Security-Policy)
    const go = () => { try { w.focus(); w.print(); } catch (e) { /* window closed */ } };
    if (w.document.readyState === 'complete') setTimeout(go, 300); else w.addEventListener('load', () => setTimeout(go, 300));
  }

  const ROOT = new URL('..', (document.currentScript && document.currentScript.src) || window.location.href).href;
  window.LR_EXPORT = {
    excel(filename, sheetName, headers, rows, title) { download(xlsx(sheetName, headers, rows, title), filename); },
    print(title, subtitle, headers, rows) { printable(title, subtitle, headers, rows, ROOT); },
    _xlsx: xlsx
  };
})();
