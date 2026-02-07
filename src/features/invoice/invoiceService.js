import { downloadInvoicePdfFromWorksheetCanvas } from '../../invoicePdfRenderer';
import {
  formatDateCompact,
  formatJapaneseDate,
  formatJapaneseMonthEnd,
  getFirstEventDate,
  getMakerValue,
  getMonthEndByOffset,
  resolveInvoiceSheetName,
  sanitizeFileName
} from './invoiceHelpers';

export const downloadInvoicePdfFromWorksheet = async (workbook, worksheet, fileName) => {
  return downloadInvoicePdfFromWorksheetCanvas(workbook, worksheet, fileName);
};

export const loadInvoiceTemplateBuffer = async (invoiceTemplateBufferRef) => {
  if (invoiceTemplateBufferRef?.current) return invoiceTemplateBufferRef.current.slice(0);
  const templateFileName = '請求書例.xlsx';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const templateUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${encodeURIComponent(templateFileName)}`;
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error(`テンプレート読込失敗 (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  if (invoiceTemplateBufferRef) invoiceTemplateBufferRef.current = arrayBuffer;
  return arrayBuffer.slice(0);
};

export const buildInvoicePayloadForMaker = async ({
  maker,
  exhibition,
  formConfig,
  extractNum,
  invoiceTemplateBufferRef
}) => {
  if (!maker || maker.status !== 'confirmed') {
    throw new Error('参加確定の企業のみ請求書を出力できます。');
  }

  const eventDate = getFirstEventDate(exhibition?.dates);
  if (!eventDate) {
    throw new Error('展示会の開催日が未設定のため、請求書を作成できません。');
  }

  const companyName = getMakerValue(maker, 'companyName') || maker.companyName || '企業名未設定';
  const boothCountRaw = getMakerValue(maker, 'boothCount') || maker.boothCount || 0;
  const boothCount = extractNum(boothCountRaw);
  if (boothCount <= 0) {
    throw new Error(`希望コマ数が取得できないため、請求書を作成できません。\n企業: ${companyName}`);
  }

  const paymentMethod = getMakerValue(maker, 'payment') || getMakerValue(maker, 'paymentMethod') || '振り込み';
  const sheetName = resolveInvoiceSheetName(paymentMethod);
  const feePerBooth = Number(formConfig?.settings?.feePerBooth || 30000);
  const totalAmountTaxIncluded = Math.round(boothCount * feePerBooth);
  const unitPriceWithoutTax = Math.round(feePerBooth / 1.1);
  const amountWithoutTax = unitPriceWithoutTax * boothCount;
  const taxAmount = Math.max(0, totalAmountTaxIncluded - amountWithoutTax);
  const dueDate = getMonthEndByOffset(eventDate, 1);

  const templateBuffer = await loadInvoiceTemplateBuffer(invoiceTemplateBufferRef);
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const invoiceSheet = workbook.getWorksheet(sheetName);
  if (!invoiceSheet) throw new Error(`テンプレートに「${sheetName}」シートが見つかりません`);

  invoiceSheet.getCell('AG1').value = formatJapaneseDate(new Date());
  invoiceSheet.getCell('B4').value = companyName;
  invoiceSheet.getCell('G13').value = formatJapaneseMonthEnd(dueDate);
  invoiceSheet.getCell('M17').value = `\\${totalAmountTaxIncluded.toLocaleString('ja-JP')}（税込）`;
  invoiceSheet.getCell('D19').value = `${exhibition?.title || '展示会'}　出展料\n（${formatJapaneseDate(eventDate)}）`;
  invoiceSheet.getCell('V19').value = boothCount;
  invoiceSheet.getCell('Y19').value = `\\${unitPriceWithoutTax}`;
  invoiceSheet.getCell('AF19').value = `\\${amountWithoutTax}`;
  invoiceSheet.getCell('AF23').value = null;
  invoiceSheet.getCell('AF24').value = `\\${taxAmount}`;
  if (sheetName === '相殺' && dueDate) {
    const dueMonth = dueDate.getMonth() + 1;
    invoiceSheet.getCell('D25').value = `　※${dueMonth}月分の仕入より相殺させていただきます。`;
    invoiceSheet.getCell('D26').value = null;
    invoiceSheet.getCell('D27').value = null;
    invoiceSheet.getCell('D28').value = null;
  }

  const supplierCode = getMakerValue(maker, 'supplierCode') || maker.code || 'コード未設定';
  const fileName = `【請求書】${sanitizeFileName(supplierCode, 'コード')}＿${sanitizeFileName(companyName, '企業')}_${sanitizeFileName(exhibition?.title || '展示会', '展示会')}_${formatDateCompact(new Date())}.pdf`;
  return { workbook, invoiceSheet, fileName, companyName };
};
