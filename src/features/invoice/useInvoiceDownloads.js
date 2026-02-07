import { useCallback, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  formatDateCompact,
  getMakerValue,
  sanitizeFileName,
  withTimeout
} from './invoiceHelpers';
import {
  buildInvoicePayloadForMaker,
  downloadInvoicePdfFromWorksheet
} from './invoiceService';

export function useInvoiceDownloads({
  makers,
  exhibition,
  formConfig,
  extractNum
}) {
  const [isBulkInvoiceDownloading, setIsBulkInvoiceDownloading] = useState(false);
  const [bulkInvoiceProgress, setBulkInvoiceProgress] = useState({ done: 0, total: 0, phase: '' });
  const invoiceTemplateBufferRef = useRef(null);

  const buildPayload = useCallback((maker) => {
    return buildInvoicePayloadForMaker({
      maker,
      exhibition,
      formConfig,
      extractNum,
      invoiceTemplateBufferRef
    });
  }, [exhibition, formConfig, extractNum]);

  const handleDownloadInvoice = useCallback(async (maker) => {
    try {
      const { workbook, invoiceSheet, fileName } = await buildPayload(maker);
      await downloadInvoicePdfFromWorksheet(workbook, invoiceSheet, fileName);
    } catch (e) {
      console.error('請求書出力エラー:', e);
      alert(`請求書出力エラー: ${e.message}`);
    }
  }, [buildPayload]);

  const handleDownloadInvoicesBulk = useCallback(async () => {
    const confirmedMakers = makers.filter((m) => m.status === 'confirmed');
    if (confirmedMakers.length === 0) {
      alert('参加確定の企業がないため、請求書を一括出力できません。');
      return;
    }
    if (!window.confirm(`参加確定 ${confirmedMakers.length} 社の請求書をZIPで一括ダウンロードしますか？`)) return;

    setIsBulkInvoiceDownloading(true);
    setBulkInvoiceProgress({ done: 0, total: confirmedMakers.length, phase: '作成中' });
    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const zip = new JSZip();
      const failed = [];

      for (let idx = 0; idx < confirmedMakers.length; idx += 1) {
        const maker = confirmedMakers[idx];
        try {
          const { workbook, invoiceSheet, fileName } = await buildPayload(maker);
          const pdfBlob = await withTimeout(
            downloadInvoicePdfFromWorksheet(workbook, invoiceSheet, null),
            45000,
            'PDF生成がタイムアウトしました'
          );
          zip.file(fileName, pdfBlob);
        } catch (err) {
          const companyName = getMakerValue(maker, 'companyName') || maker.companyName || maker.code || '不明';
          failed.push(`${companyName}: ${err.message}`);
        }
        const done = idx + 1;
        setBulkInvoiceProgress({ done, total: confirmedMakers.length, phase: '作成中' });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const successCount = confirmedMakers.length - failed.length;
      if (successCount <= 0) {
        throw new Error('すべての企業で請求書作成に失敗しました。');
      }

      setBulkInvoiceProgress({ done: confirmedMakers.length, total: confirmedMakers.length, phase: 'ZIP作成中' });
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE'
      });
      const zipFileName = `【請求書一括】${sanitizeFileName(exhibition.title || '展示会', '展示会')}_${formatDateCompact(new Date())}.zip`;
      saveAs(zipBlob, zipFileName);

      if (failed.length > 0) {
        const preview = failed.slice(0, 5).join('\n');
        const omitted = failed.length > 5 ? `\n...他 ${failed.length - 5} 件` : '';
        alert(`請求書一括出力が完了しました。\n成功: ${successCount}件 / 失敗: ${failed.length}件\n\n${preview}${omitted}`);
      } else {
        alert(`請求書一括出力が完了しました。（${successCount}件）`);
      }
    } catch (e) {
      console.error('請求書一括出力エラー:', e);
      alert(`請求書一括出力エラー: ${e.message}`);
    } finally {
      setIsBulkInvoiceDownloading(false);
      setBulkInvoiceProgress({ done: 0, total: 0, phase: '' });
    }
  }, [buildPayload, exhibition.title, makers]);

  return {
    isBulkInvoiceDownloading,
    bulkInvoiceProgress,
    handleDownloadInvoice,
    handleDownloadInvoicesBulk
  };
}
