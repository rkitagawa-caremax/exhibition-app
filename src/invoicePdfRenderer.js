import jsPDF from 'jspdf';

const EMU_PER_PX = 9525;
const DEFAULT_FONT_STACK = "'Meiryo UI', 'Meiryo', sans-serif";

const colLettersToNumber = (letters) => {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = (num * 26) + (letters.charCodeAt(i) - 64);
  }
  return num;
};

const parseMergeRange = (range) => {
  const m = String(range || '').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  return {
    startCol: colLettersToNumber(m[1]),
    startRow: parseInt(m[2], 10),
    endCol: colLettersToNumber(m[3]),
    endRow: parseInt(m[4], 10)
  };
};

const excelColumnWidthToPx = (width) => {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return 0;
  if (w < 1) return Math.floor(w * 12 + 0.5);
  return Math.floor(((256 * w + Math.floor(128 / 7)) / 256) * 7);
};

const pointsToPx = (pt) => {
  const p = Number(pt);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return p * (96 / 72);
};

const parseWorkbookThemeColors = (workbook) => {
  const xml = workbook?._themes?.theme1;
  if (!xml || typeof xml !== 'string') return {};
  const getClr = (tag) => {
    const rgx = new RegExp(`<a:${tag}>[\\s\\S]*?(?:<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")`, 'i');
    const m = xml.match(rgx);
    return (m?.[1] || m?.[2] || '').toUpperCase();
  };
  return {
    0: getClr('lt1'),
    1: getClr('dk1'),
    2: getClr('lt2'),
    3: getClr('dk2'),
    4: getClr('accent1'),
    5: getClr('accent2'),
    6: getClr('accent3'),
    7: getClr('accent4'),
    8: getClr('accent5'),
    9: getClr('accent6'),
    10: getClr('hlink'),
    11: getClr('folHlink')
  };
};

const applyTintToHex = (hex, tint) => {
  if (!hex) return hex;
  if (tint === undefined || tint === null || Number.isNaN(Number(tint))) return hex;
  const t = Number(tint);
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (t < 0) {
    const f = 1 + t;
    return `${clamp(r * f).toString(16).padStart(2, '0')}${clamp(g * f).toString(16).padStart(2, '0')}${clamp(b * f).toString(16).padStart(2, '0')}`.toUpperCase();
  }
  return `${clamp(r + (255 - r) * t).toString(16).padStart(2, '0')}${clamp(g + (255 - g) * t).toString(16).padStart(2, '0')}${clamp(b + (255 - b) * t).toString(16).padStart(2, '0')}`.toUpperCase();
};

const colorToCss = (color, fallback = '#000000', themeColors = {}) => {
  if (!color) return fallback;
  if (color.argb) {
    const argb = String(color.argb);
    if (argb.length === 8) return `#${argb.slice(2)}`;
    if (argb.length === 6) return `#${argb}`;
  }
  if (color.indexed !== undefined) {
    const indexedMap = {
      9: '#FFFFFF',
      64: '#000000'
    };
    return indexedMap[color.indexed] || fallback;
  }
  if (color.theme !== undefined) {
    const themeHex = themeColors[color.theme];
    if (themeHex) return `#${applyTintToHex(themeHex, color.tint)}`;
  }
  return fallback;
};

const normalizeInvoiceCellText = (text) => {
  if (text === null || text === undefined) return '';
  const s = String(text);
  return s.replace(/^\\(?=\d)/, '\u00A5');
};

const getCellDisplayText = (cell) => {
  if (!cell) return '';
  if (cell.text !== undefined && cell.text !== null && cell.text !== '') return normalizeInvoiceCellText(cell.text);
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return normalizeInvoiceCellText(v.richText.map((t) => t.text).join(''));
    if (v.formula) return normalizeInvoiceCellText(v.result ?? '');
    if (v.text) return normalizeInvoiceCellText(v.text);
    return normalizeInvoiceCellText(JSON.stringify(v));
  }
  return normalizeInvoiceCellText(v);
};

const getCellRichRuns = (cell) => {
  const v = cell?.value;
  if (!v || typeof v !== 'object' || !Array.isArray(v.richText)) return null;
  return v.richText.map((run) => ({
    text: normalizeInvoiceCellText(run?.text ?? ''),
    font: run?.font || {}
  }));
};

const mediaToDataUrl = (media) => {
  if (!media || !media.buffer) return null;
  let bytes;
  if (media.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(media.buffer);
  } else if (ArrayBuffer.isView(media.buffer)) {
    bytes = new Uint8Array(media.buffer.buffer, media.buffer.byteOffset, media.buffer.byteLength);
  } else if (media.buffer?.data) {
    bytes = Uint8Array.from(media.buffer.data);
  } else {
    return null;
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const ext = String(media.extension || 'png').toLowerCase();
  return `data:image/${ext};base64,${btoa(binary)}`;
};

const loadImage = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('画像読込失敗'));
  image.src = dataUrl;
});

const borderStyleToWidth = (style) => {
  if (style === 'thick') return 2;
  if (style === 'medium') return 1.5;
  if (style === 'hair') return 0.5;
  return 1;
};

const borderStyleToDash = (style, width) => {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [width, width * 2];
  return [];
};

const setCanvasFont = (ctx, font, overridePtSize = null) => {
  const ptSize = overridePtSize ?? Number(font?.size || 10);
  const pxSize = Math.max(7, pointsToPx(ptSize));
  const weight = font?.bold ? 700 : 400;
  const italic = font?.italic ? 'italic ' : '';
  const family = font?.name ? `'${font.name}', ${DEFAULT_FONT_STACK}` : DEFAULT_FONT_STACK;
  ctx.font = `${italic}${weight} ${pxSize}px ${family}`;
  return pxSize;
};

const measureLine = (ctx, lineText, pxSize) => {
  const measured = ctx.measureText(lineText);
  const ascent = measured.actualBoundingBoxAscent || (pxSize * 0.82);
  const descent = measured.actualBoundingBoxDescent || (pxSize * 0.18);
  return {
    width: measured.width,
    ascent,
    descent,
    lineHeight: Math.max(pxSize * 1.15, ascent + descent)
  };
};

const wrapByWidth = (ctx, sourceText, maxWidth) => {
  if (!sourceText) return [''];
  if (!Number.isFinite(maxWidth) || maxWidth <= 1) return [sourceText];
  const result = [];
  sourceText.split('\n').forEach((line) => {
    if (ctx.measureText(line).width <= maxWidth) {
      result.push(line);
      return;
    }
    let part = '';
    [...line].forEach((ch) => {
      const next = part + ch;
      if (!part || ctx.measureText(next).width <= maxWidth) {
        part = next;
      } else {
        result.push(part);
        part = ch;
      }
    });
    if (part) result.push(part);
  });
  return result.length > 0 ? result : [''];
};

const drawBorderEdge = (ctx, side, style, color, width, x, y, w, h) => {
  const drawSingle = (x1, y1, x2, y2) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(borderStyleToDash(style, width));
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };
  if (side === 'top') {
    if (style === 'double') {
      drawSingle(x, y + 1, x + w, y + 1);
      drawSingle(x, y + 3, x + w, y + 3);
    } else {
      drawSingle(x, y + width / 2, x + w, y + width / 2);
    }
  }
  if (side === 'right') {
    if (style === 'double') {
      drawSingle(x + w - 1, y, x + w - 1, y + h);
      drawSingle(x + w - 3, y, x + w - 3, y + h);
    } else {
      drawSingle(x + w - width / 2, y, x + w - width / 2, y + h);
    }
  }
  if (side === 'bottom') {
    if (style === 'double') {
      drawSingle(x, y + h - 1, x + w, y + h - 1);
      drawSingle(x, y + h - 3, x + w, y + h - 3);
    } else {
      drawSingle(x, y + h - width / 2, x + w, y + h - width / 2);
    }
  }
  if (side === 'left') {
    if (style === 'double') {
      drawSingle(x + 1, y, x + 1, y + h);
      drawSingle(x + 3, y, x + 3, y + h);
    } else {
      drawSingle(x + width / 2, y, x + width / 2, y + h);
    }
  }
};

export async function downloadInvoicePdfFromWorksheetCanvas(workbook, worksheet, fileName = null) {
  const maxCol = Math.max(45, worksheet.columnCount || 45);
  const maxRow = Math.max(28, worksheet.rowCount || 28);
  const defaultColWidth = Number(worksheet.properties?.defaultColWidth || 8.43);
  const defaultRowHeight = Number(worksheet.properties?.defaultRowHeight || 13.5);
  const themeColors = parseWorkbookThemeColors(workbook);

  const colWidths = new Array(maxCol + 1).fill(excelColumnWidthToPx(defaultColWidth));
  const rowHeights = new Array(maxRow + 1).fill(pointsToPx(defaultRowHeight));
  for (let c = 1; c <= maxCol; c++) {
    const w = worksheet.getColumn(c)?.width;
    colWidths[c] = w ? excelColumnWidthToPx(w) : excelColumnWidthToPx(defaultColWidth);
  }
  for (let r = 1; r <= maxRow; r++) {
    const h = worksheet.getRow(r)?.height;
    rowHeights[r] = h ? pointsToPx(h) : pointsToPx(defaultRowHeight);
  }

  const colLeft = new Array(maxCol + 2).fill(0);
  const rowTop = new Array(maxRow + 2).fill(0);
  let totalWidth = 0;
  let totalHeight = 0;
  for (let c = 1; c <= maxCol; c++) {
    colLeft[c] = totalWidth;
    totalWidth += colWidths[c];
  }
  for (let r = 1; r <= maxRow; r++) {
    rowTop[r] = totalHeight;
    totalHeight += rowHeights[r];
  }

  const mergeTopLeft = new Map();
  const mergeCovered = new Set();
  (worksheet.model?.merges || []).forEach((m) => {
    const parsed = parseMergeRange(m);
    if (!parsed) return;
    mergeTopLeft.set(`${parsed.startRow}:${parsed.startCol}`, {
      rowSpan: parsed.endRow - parsed.startRow + 1,
      colSpan: parsed.endCol - parsed.startCol + 1
    });
    for (let rr = parsed.startRow; rr <= parsed.endRow; rr++) {
      for (let cc = parsed.startCol; cc <= parsed.endCol; cc++) {
        if (rr === parsed.startRow && cc === parsed.startCol) continue;
        mergeCovered.add(`${rr}:${cc}`);
      }
    }
  });

  const pickEdgeBorder = (cells, edgeName) => {
    for (const candidate of cells) {
      const b = candidate?.border?.[edgeName];
      if (b) return b;
    }
    return null;
  };

  const canvasScale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(totalWidth * canvasScale);
  canvas.height = Math.ceil(totalHeight * canvasScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas初期化に失敗しました。');
  ctx.scale(canvasScale, canvasScale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const key = `${r}:${c}`;
      if (mergeCovered.has(key)) continue;
      const cell = worksheet.getRow(r).getCell(c);
      const merge = mergeTopLeft.get(key);
      const rowSpan = merge?.rowSpan || 1;
      const colSpan = merge?.colSpan || 1;
      let w = 0;
      let h = 0;
      for (let i = 0; i < colSpan; i++) w += colWidths[c + i] || 0;
      for (let i = 0; i < rowSpan; i++) h += rowHeights[r + i] || 0;
      const x = colLeft[c] || 0;
      const y = rowTop[r] || 0;

      const border = (() => {
        if (rowSpan <= 1 && colSpan <= 1) return cell.border || {};
        const topCells = [];
        const bottomCells = [];
        const leftCells = [];
        const rightCells = [];
        for (let cc = c; cc < c + colSpan; cc++) {
          topCells.push(worksheet.getRow(r).getCell(cc));
          bottomCells.push(worksheet.getRow(r + rowSpan - 1).getCell(cc));
        }
        for (let rr = r; rr < r + rowSpan; rr++) {
          leftCells.push(worksheet.getRow(rr).getCell(c));
          rightCells.push(worksheet.getRow(rr).getCell(c + colSpan - 1));
        }
        return {
          top: pickEdgeBorder(topCells, 'top') || cell.border?.top,
          right: pickEdgeBorder(rightCells, 'right') || cell.border?.right,
          bottom: pickEdgeBorder(bottomCells, 'bottom') || cell.border?.bottom,
          left: pickEdgeBorder(leftCells, 'left') || cell.border?.left
        };
      })();

      const fill = cell.fill;
      const hasSolidFill = fill?.type === 'pattern' && fill?.pattern === 'solid' && !!fill?.fgColor;
      if (hasSolidFill) {
        ctx.fillStyle = colorToCss(fill.fgColor, '#ffffff', themeColors);
        ctx.fillRect(x, y, w, h);
      }
      ['top', 'right', 'bottom', 'left'].forEach((edgeName) => {
        const edge = border?.[edgeName];
        if (!edge) return;
        const style = edge.style || 'thin';
        const width = borderStyleToWidth(style);
        const color = colorToCss(edge.color, '#000000', themeColors);
        drawBorderEdge(ctx, edgeName, style, color, width, x, y, w, h);
      });

      const text = getCellDisplayText(cell);
      if (!text) continue;
      const align = cell.alignment || {};
      const hAlign = align.horizontal || 'left';
      const vAlign = align.vertical || ((border.top || border.bottom) ? 'middle' : 'top');
      const isVerticalText = align.textRotation === 'vertical' || align.textRotation === 255;
      const richRuns = getCellRichRuns(cell);

      let textW = w;
      const canOverflowHorizontally = rowSpan === 1
        && colSpan === 1
        && !align.wrapText
        && (hAlign === 'left' || !hAlign)
        && !border.right
        && !text.includes('\n');
      if (canOverflowHorizontally) {
        for (let cc = c + 1; cc <= maxCol; cc++) {
          const key2 = `${r}:${cc}`;
          if (mergeTopLeft.has(key2)) break;
          const nextText = getCellDisplayText(worksheet.getRow(r).getCell(cc));
          if (nextText) break;
          textW += colWidths[cc] || 0;
        }
      }

      const padLeft = hAlign === 'left' ? 2 : 1;
      const padRight = hAlign === 'right' ? 6 : ((hAlign === 'left' && r >= 25 && r <= 28 && colSpan >= 10) ? 10 : 2);
      const padTop = r === 2 ? 0 : 1;
      const padBottom = r === 2 ? 0 : 1;
      const textRect = {
        x: x + padLeft,
        y: y + padTop,
        w: Math.max(1, textW - padLeft - padRight),
        h: Math.max(1, h - padTop - padBottom)
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(textRect.x, textRect.y, textRect.w, textRect.h);
      ctx.clip();

      if (isVerticalText) {
        const basePx = setCanvasFont(ctx, cell.font || {});
        ctx.fillStyle = colorToCss(cell.font?.color, '#000000', themeColors);
        const chars = [...String(text).replace(/\n/g, '')];
        const vTextRect = {
          x: x + 0.5,
          y: y + 0.5,
          w: Math.max(1, w - 1),
          h: Math.max(1, h - 1)
        };
        if (chars.length > 0) {
          const charMetrics = chars.map((ch) => ({ ch, ...measureLine(ctx, ch, basePx) }));
          const lineHeight = charMetrics.reduce((mx, m) => Math.max(mx, m.lineHeight), basePx * 1.12);
          const maxAscent = charMetrics.reduce((mx, m) => Math.max(mx, m.ascent), basePx * 0.82);
          const blockHeight = lineHeight * charMetrics.length;
          let firstBaseline = vTextRect.y + maxAscent;
          if (vAlign === 'middle') firstBaseline = vTextRect.y + ((vTextRect.h - blockHeight) / 2) + maxAscent;
          if (vAlign === 'bottom') firstBaseline = vTextRect.y + vTextRect.h - blockHeight + maxAscent;
          charMetrics.forEach((m, i) => {
            const drawX = vTextRect.x + ((vTextRect.w - m.width) / 2);
            const drawY = firstBaseline + (i * lineHeight);
            ctx.fillText(m.ch, drawX, drawY);
          });
        }
        ctx.restore();
        continue;
      }

      if (richRuns && richRuns.length > 0) {
        const runMetrics = richRuns.map((run) => {
          const f = { ...(cell.font || {}), ...(run.font || {}) };
          const px = setCanvasFont(ctx, f);
          const m = measureLine(ctx, run.text, px);
          return { ...run, font: f, width: m.width, ascent: m.ascent, descent: m.descent };
        });
        const totalRunWidth = runMetrics.reduce((sum, run) => sum + run.width, 0);
        const maxAscent = runMetrics.reduce((mx, run) => Math.max(mx, run.ascent), 0);
        const maxDescent = runMetrics.reduce((mx, run) => Math.max(mx, run.descent), 0);
        const blockH = maxAscent + maxDescent;
        let drawX = textRect.x;
        if (hAlign === 'center') drawX = textRect.x + (textRect.w - totalRunWidth) / 2;
        if (hAlign === 'right') drawX = textRect.x + textRect.w - totalRunWidth;
        let baselineY = textRect.y + maxAscent;
        if (vAlign === 'middle') baselineY = textRect.y + ((textRect.h - blockH) / 2) + maxAscent;
        if (vAlign === 'bottom') baselineY = textRect.y + textRect.h - maxDescent;
        if (r === 1) baselineY += 0.9;
        if (r === 2) baselineY += 1.5;
        if (r === 4) baselineY -= 0.8;
        if (r === 12 || r === 13) baselineY += 0.6;
        runMetrics.forEach((run) => {
          setCanvasFont(ctx, run.font);
          ctx.fillStyle = colorToCss(run.font?.color || cell.font?.color, '#000000', themeColors);
          ctx.fillText(run.text, drawX, baselineY);
          drawX += run.width;
        });
        ctx.restore();
        continue;
      }

      const basePx = setCanvasFont(ctx, cell.font || {});
      ctx.fillStyle = colorToCss(cell.font?.color, '#000000', themeColors);
      const lines = align.wrapText ? wrapByWidth(ctx, text, textRect.w) : text.split('\n');
      const measuredLines = lines.map((line) => ({ line, ...measureLine(ctx, line, basePx) }));
      const lineHeight = measuredLines.reduce((mx, line) => Math.max(mx, line.lineHeight), basePx * 1.12);
      const maxAscent = measuredLines.reduce((mx, line) => Math.max(mx, line.ascent), basePx * 0.82);
      const blockHeight = lineHeight * measuredLines.length;
      let firstBaseline = textRect.y + maxAscent;
      if (vAlign === 'middle') firstBaseline = textRect.y + ((textRect.h - blockHeight) / 2) + maxAscent;
      if (vAlign === 'bottom') firstBaseline = textRect.y + textRect.h - blockHeight + maxAscent;
      if (r === 1) firstBaseline += 0.9;
      if (r === 2) firstBaseline += 1.5;
      if (r === 4) firstBaseline -= 0.8;
      if (r === 12 || r === 13) firstBaseline += 0.6;

      measuredLines.forEach((line, i) => {
        let drawX = textRect.x;
        if (hAlign === 'center') drawX = textRect.x + ((textRect.w - line.width) / 2);
        if (hAlign === 'right') drawX = textRect.x + textRect.w - line.width;
        const drawY = firstBaseline + (i * lineHeight);
        ctx.fillText(line.line, drawX, drawY);
      });
      ctx.restore();
    }
  }

  const imageJobs = [];
  let stampLeftPx = null;
  (worksheet.getImages ? worksheet.getImages() : []).forEach((img) => {
    const media = (workbook.media || []).find((m) => m.index === img.imageId) || workbook.media?.[img.imageId];
    const dataUrl = mediaToDataUrl(media);
    if (!dataUrl) return;
    const tl = img.range?.tl;
    const br = img.range?.br;
    const tlCol = typeof tl?.nativeCol === 'number' ? tl.nativeCol : Math.floor(tl?.col ?? 0);
    const tlRow = typeof tl?.nativeRow === 'number' ? tl.nativeRow : Math.floor(tl?.row ?? 0);
    const tlColOffPx = (typeof tl?.nativeColOff === 'number' ? tl.nativeColOff : (tl?.colOff || 0)) / EMU_PER_PX;
    const tlRowOffPx = (typeof tl?.nativeRowOff === 'number' ? tl.nativeRowOff : (tl?.rowOff || 0)) / EMU_PER_PX;
    let x = (colLeft[tlCol + 1] || 0) + tlColOffPx;
    let y = (rowTop[tlRow + 1] || 0) + tlRowOffPx;
    let w = 0;
    let h = 0;
    if (br) {
      const brCol = typeof br?.nativeCol === 'number' ? br.nativeCol : Math.floor(br?.col ?? 0);
      const brRow = typeof br?.nativeRow === 'number' ? br.nativeRow : Math.floor(br?.row ?? 0);
      const brColOffPx = (typeof br?.nativeColOff === 'number' ? br.nativeColOff : (br?.colOff || 0)) / EMU_PER_PX;
      const brRowOffPx = (typeof br?.nativeRowOff === 'number' ? br.nativeRowOff : (br?.rowOff || 0)) / EMU_PER_PX;
      const x2 = (colLeft[brCol + 1] || totalWidth) + brColOffPx;
      const y2 = (rowTop[brRow + 1] || totalHeight) + brRowOffPx;
      w = Math.max(1, x2 - x);
      h = Math.max(1, y2 - y);
    } else if (img.range?.ext) {
      w = Math.max(1, (img.range.ext.width || img.range.ext.cx || 0) / EMU_PER_PX);
      h = Math.max(1, (img.range.ext.height || img.range.ext.cy || 0) / EMU_PER_PX);
    }
    if (w <= 0 || h <= 0) {
      w = 120;
      h = 40;
    }
    if (w <= 130 && h <= 130 && y < (rowTop[Math.min(16, maxRow)] || totalHeight)) {
      stampLeftPx = stampLeftPx === null ? x : Math.min(stampLeftPx, x);
    }
    imageJobs.push({ dataUrl, x, y, w, h });
  });

  const officerCol = Math.min(28, maxCol);
  const officerRow = Math.min(9, maxRow);
  const officerEndCol = Math.min(40, maxCol + 1);
  const officerEndRow = Math.min(17, maxRow + 1);
  const officerLeft = (colLeft[officerCol] || 0) + 2;
  const officerTop = (rowTop[officerRow] || 0) + 2;
  const officerRight = colLeft[officerEndCol] || totalWidth;
  const officerBottom = rowTop[officerEndRow] || totalHeight;
  let officerWidth = Math.max(220, officerRight - officerLeft - 6);
  if (stampLeftPx !== null) officerWidth = Math.max(170, stampLeftPx - officerLeft - 10);
  const officerHeight = Math.max(64, officerBottom - officerTop - 4);
  const officerLines = [
    { text: '代表取締役社長　宮武　佳弘', pt: 10.8, bold: false },
    { text: '高知県高知市上町2-6-9', pt: 9.2, bold: false },
    { text: 'TEL088-831-6087/FAX088-831-6070', pt: 9.2, bold: false },
    { text: '登録番号：T4490001002141', pt: 9.2, bold: false }
  ];

  let officerScale = 1;
  for (let i = 0; i < 20; i++) {
    const tooWide = officerLines.some((line) => {
      setCanvasFont(ctx, { name: 'Meiryo UI', bold: line.bold, size: line.pt * officerScale });
      return ctx.measureText(line.text).width > officerWidth;
    });
    if (!tooWide) break;
    officerScale -= 0.03;
  }

  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.rect(officerLeft, officerTop, officerWidth, officerHeight);
  ctx.clip();
  let officerY = officerTop + 13;
  officerLines.forEach((line, index) => {
    setCanvasFont(ctx, { name: 'Meiryo UI', bold: line.bold, size: line.pt * officerScale });
    const px = Math.max(8, pointsToPx(line.pt * officerScale));
    ctx.fillText(line.text, officerLeft, officerY);
    officerY += index === 0 ? Math.max(15, px * 1.3) : Math.max(14, px * 1.28);
  });
  ctx.restore();

  for (const img of imageJobs) {
    try {
      const image = await loadImage(img.dataUrl);
      ctx.drawImage(image, img.x, img.y, img.w, img.h);
    } catch (_) {
      // ignore and continue output
    }
  }

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imageRatio = canvas.width / canvas.height;
  let drawW = pageW;
  let drawH = drawW / imageRatio;
  if (drawH > pageH) {
    drawH = pageH;
    drawW = drawH * imageRatio;
  }
  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;
  pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
  const pdfBlob = pdf.output('blob');
  if (fileName) pdf.save(fileName);
  return pdfBlob;
}
