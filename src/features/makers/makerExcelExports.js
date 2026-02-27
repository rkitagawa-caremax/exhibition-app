import { saveAs } from 'file-saver';

const SECTION_KEYS = ['section1', 'section2', 'section3'];

const STATUS_LABELS = {
  confirmed: '参加確定',
  declined: '辞退',
  invited: '招待中',
  listed: '未送付',
  pending: '未回答'
};

const INTERNAL_MAKER_KEYS = new Set([
  'id',
  'status',
  'invitationSentAt',
  'respondedAt',
  'confirmedAt',
  'applicationDate',
  'source',
  'isFixed',
  'aiRecommendation',
  'response',
  'formData',
  'noteUpdatedAt',
  'noteUpdatedBy'
]);

const FIELD_LABELS = {
  companyName: '会社名',
  companyNameKana: '会社名(フリガナ)',
  repName: '担当者名',
  phone: '電話番号',
  email: 'メールアドレス',
  status: '出展可否',
  moveInDate: '搬入日時',
  boothCount: '希望コマ数',
  staffCount: '参加人数',
  lunchCount: '昼食数',
  itemsDesk: '長机',
  itemsChair: '椅子',
  itemsPower: '電源',
  powerDetail: '電源詳細',
  transport: '搬出方法',
  packages: '出荷個口数',
  payment: '支払方法',
  billIssue: '請求書発行',
  products: '展示予定品',
  note: '特記事項',
  declineReason: '不参加理由',
  category: 'カテゴリ',
  supplierCode: '仕入先コード'
};

const CANONICAL_FIELD_ALIASES = {
  companyNameKana: ['kana'],
  staffCount: ['attendees'],
  itemsDesk: ['desk'],
  itemsChair: ['chair'],
  itemsPower: ['power'],
  powerDetail: ['powerDetails', 'powerVol'],
  transport: ['shipping'],
  packages: ['packageCount', 'shippingCount'],
  payment: ['paymentMethod'],
  billIssue: ['invoice'],
  products: ['exhibitItems'],
  supplierCode: ['code']
};

const aliasToCanonical = Object.entries(CANONICAL_FIELD_ALIASES).reduce((acc, [canonical, aliases]) => {
  aliases.forEach((alias) => {
    acc[alias] = canonical;
  });
  return acc;
}, {});

const normalizeFieldKey = (key) => {
  if (!key) return '';
  return aliasToCanonical[key] || key;
};

const isBlank = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every((v) => isBlank(v));
  return false;
};

const sanitizeText = (text) => {
  const normalized = String(text ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n');

  // Avoid accidental formula evaluation in Excel.
  if (/^[=+\-@]/.test(normalized)) {
    return `'${normalized}`;
  }
  return normalized;
};

const toCellText = (value) => {
  if (isBlank(value)) return '';
  if (Array.isArray(value)) {
    const list = value
      .map((v) => toCellText(v))
      .filter((v) => v !== '');
    return sanitizeText(list.join(', '));
  }
  if (typeof value === 'object') {
    try {
      return sanitizeText(JSON.stringify(value));
    } catch {
      return sanitizeText(String(value));
    }
  }
  return sanitizeText(String(value));
};

const formatAnswerTimestamp = (maker) => {
  const raw = maker?.respondedAt ?? maker?.applicationDate ?? maker?.confirmedAt ?? '';
  if (isBlank(raw)) return '';
  const date = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  if (!Number.isNaN(date.getTime())) return date.toLocaleString('ja-JP');
  return toCellText(raw);
};

const getNormalizedSources = (maker) => {
  const response = maker?.response && typeof maker.response === 'object' ? maker.response : {};
  const legacyFormData = maker?.formData && typeof maker.formData === 'object' ? maker.formData : {};
  return { response, legacyFormData };
};

const getAnswerValue = (maker, fieldKey) => {
  const canonicalKey = normalizeFieldKey(fieldKey);
  const { response, legacyFormData } = getNormalizedSources(maker);
  const aliasKeys = CANONICAL_FIELD_ALIASES[canonicalKey] || [];

  const readFrom = (source) => {
    if (!source || typeof source !== 'object') return '';
    if (!isBlank(source[canonicalKey])) return source[canonicalKey];
    for (const aliasKey of aliasKeys) {
      if (!isBlank(source[aliasKey])) return source[aliasKey];
    }
    return '';
  };

  return readFrom(response) || readFrom(legacyFormData) || readFrom(maker);
};

const toHalfWidthDigits = (value) => String(value ?? '').replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));

const parsePositiveInteger = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.floor(value) : fallback;
  }
  const normalized = toHalfWidthDigits(value);
  const match = normalized.match(/\d+/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const isConfirmedStatus = (rawStatus) => {
  const status = String(rawStatus || '').trim().toLowerCase();
  return status === 'confirmed' || status.includes('参加確定');
};

const collectQuestionDefinitions = (formConfig) => {
  const seen = new Set();
  const definitions = [];

  SECTION_KEYS.forEach((sectionKey) => {
    const items = formConfig?.[sectionKey]?.items;
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      if (!item || typeof item.id !== 'string') return;
      const key = normalizeFieldKey(item.id);
      if (!key || seen.has(key)) return;
      seen.add(key);
      definitions.push({
        key,
        label: item.label || FIELD_LABELS[key] || key
      });
    });
  });

  return definitions;
};

const shouldUseRootAsAnswerKey = (rawKey, rawValue) => {
  if (!rawKey) return false;
  if (INTERNAL_MAKER_KEYS.has(rawKey)) return false;
  if (rawKey.startsWith('custom_') || rawKey.startsWith('custom-')) return true;
  if (FIELD_LABELS[rawKey]) return true;
  if (aliasToCanonical[rawKey]) return true;
  if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return /^custom[_-]/.test(rawKey);
  }
  if (Array.isArray(rawValue)) return /^custom[_-]/.test(rawKey);
  return false;
};

const collectObservedQuestionKeys = (makers = []) => {
  const seen = new Set();
  const ordered = [];
  const pushKey = (rawKey) => {
    const normalized = normalizeFieldKey(rawKey);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  makers.forEach((maker) => {
    const { response, legacyFormData } = getNormalizedSources(maker);
    Object.keys(response).forEach(pushKey);
    Object.keys(legacyFormData).forEach(pushKey);

    Object.entries(maker || {}).forEach(([rawKey, rawValue]) => {
      if (!shouldUseRootAsAnswerKey(rawKey, rawValue)) return;
      pushKey(rawKey);
    });
  });

  return ordered;
};

const buildQuestionColumns = (makers, formConfig) => {
  const definitions = collectQuestionDefinitions(formConfig);
  const labelMap = new Map();
  const orderedKeys = [];
  const seen = new Set();

  const addKey = (key, label) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    orderedKeys.push(key);
    labelMap.set(key, label || FIELD_LABELS[key] || key);
  };

  definitions.forEach((def) => addKey(def.key, def.label));
  collectObservedQuestionKeys(makers).forEach((key) => addKey(key, FIELD_LABELS[key] || key));

  if (orderedKeys.length === 0) {
    // Last-resort fallback for very old data.
    Object.keys(FIELD_LABELS).forEach((key) => addKey(key, FIELD_LABELS[key]));
  }

  return orderedKeys.map((key) => ({ key, label: labelMap.get(key) || key }));
};

const createWorkbook = async () => {
  const ExcelJSImport = await import('exceljs');
  return new (ExcelJSImport.default || ExcelJSImport).Workbook();
};

const buildMakerPortalUrl = ({ origin, exhibitionId, makerCode }) => {
  if (!origin || !exhibitionId || !makerCode) return '';
  return `${origin}/?mode=maker&id=${exhibitionId}&code=${makerCode}`;
};

export const exportConfirmedMakersExcel = async ({ makers, formConfig, exhibitionId, origin }) => {
  const confirmed = (makers || []).filter((maker) => maker.status === 'confirmed');
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('ConfirmedMakers');

  const fixedQuestionKeys = new Set(['supplierCode', 'companyName', 'status']);
  const fixedColumns = [
    { key: '__code', label: '企業コード' },
    { key: '__company', label: '企業名(リスト)' },
    { key: '__portalUrl', label: 'メーカーポータルURL' },
    { key: '__status', label: '状態' },
    { key: '__answeredAt', label: '回答日時' }
  ];
  const questionColumns = buildQuestionColumns(confirmed, formConfig).filter(
    (column) => !fixedQuestionKeys.has(column.key)
  );
  const allColumns = [...fixedColumns, ...questionColumns];

  worksheet.addRow(allColumns.map((col) => col.label));

  confirmed.forEach((maker) => {
    const makerCode = maker?.code || getAnswerValue(maker, 'supplierCode');
    const portalUrl = buildMakerPortalUrl({
      origin,
      exhibitionId,
      makerCode
    });
    const row = [
      toCellText(makerCode),
      toCellText(maker?.companyName || getAnswerValue(maker, 'companyName')),
      toCellText(portalUrl),
      toCellText(STATUS_LABELS[maker?.status] || maker?.status || ''),
      toCellText(formatAnswerTimestamp(maker))
    ];

    questionColumns.forEach((col) => {
      row.push(toCellText(getAnswerValue(maker, col.key)));
    });

    worksheet.addRow(row);
  });

  worksheet.autoFilter = {
    from: 'A1',
    to: worksheet.getCell(1, Math.max(1, allColumns.length)).address
  };

  worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: fixedColumns.length }];

  worksheet.columns.forEach((column, index) => {
    const key = allColumns[index]?.key;
    if (key === '__portalUrl') {
      column.width = 48;
      return;
    }
    column.width = index < fixedColumns.length ? 20 : 24;
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      if (rowNumber > 1) {
        cell.numFmt = '@';
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'confirmed_makers.xlsx'
  );
};

const getMakerStatusLabel = (status) => STATUS_LABELS[status] || '未送付';

const sanitizeFileName = (text) => String(text || 'untitled').replace(/[\\/:*?"<>|]/g, '_');

export const exportInvitedMakersExcel = async ({
  makers,
  exhibitionId,
  exhibitionTitle,
  origin
}) => {
  const allInvited = (makers || []).filter((maker) => ['listed', 'invited', 'confirmed', 'declined'].includes(maker.status));
  if (allInvited.length === 0) {
    return { exported: false, count: 0 };
  }

  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('InvitedMakers');
  worksheet.addRow(['仕入先コード', '会社名', 'メーカーポータルURL', '状態']);

  allInvited.forEach((maker) => {
    const portalUrl = buildMakerPortalUrl({
      origin,
      exhibitionId,
      makerCode: maker?.code
    });
    worksheet.addRow([
      toCellText(maker.code || ''),
      toCellText(maker.companyName || ''),
      toCellText(portalUrl),
      toCellText(getMakerStatusLabel(maker.status))
    ]);
  });

  worksheet.columns = [
    { width: 18 },
    { width: 36 },
    { width: 48 },
    { width: 14 }
  ];
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `invited_makers_${sanitizeFileName(exhibitionTitle)}.xlsx`
  );
  return { exported: true, count: allInvited.length };
};

export const exportConfirmedMakersAccountingExcel = async ({ makers, formConfig, exhibitionTitle }) => {
  const confirmed = (makers || []).filter((maker) => isConfirmedStatus(maker?.status));
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('Accounting');

  const feePerBoothRaw = Number(formConfig?.settings?.feePerBooth);
  const feePerBooth = Number.isFinite(feePerBoothRaw) && feePerBoothRaw > 0 ? feePerBoothRaw : 30000;

  worksheet.addRow([
    '仕入先コード',
    '企業名',
    'コマ数',
    '請求費用',
    '出展費用支払方法'
  ]);

  confirmed.forEach((maker) => {
    const supplierCode = toCellText(maker?.code || getAnswerValue(maker, 'supplierCode'));
    const companyName = toCellText(maker?.companyName || getAnswerValue(maker, 'companyName'));
    const boothCount = parsePositiveInteger(getAnswerValue(maker, 'boothCount'), 0);
    const invoiceAmount = boothCount * feePerBooth;
    const paymentMethod = toCellText(getAnswerValue(maker, 'payment'));

    worksheet.addRow([supplierCode, companyName, boothCount, invoiceAmount, paymentMethod]);
  });

  worksheet.columns = [
    { width: 18 },
    { width: 34 },
    { width: 12 },
    { width: 16 },
    { width: 24 }
  ];

  worksheet.autoFilter = { from: 'A1', to: 'E1' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', wrapText: colNumber === 2 || colNumber === 5 };
      if (rowNumber > 1 && (colNumber === 3 || colNumber === 4)) cell.numFmt = '#,##0';
      if (rowNumber > 1 && (colNumber === 1 || colNumber === 2 || colNumber === 5)) cell.numFmt = '@';
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeTitle = sanitizeFileName(exhibitionTitle || 'exhibition');
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `confirmed_makers_accounting_${safeTitle}.xlsx`
  );
};
