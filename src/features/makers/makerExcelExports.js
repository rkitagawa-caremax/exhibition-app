import { saveAs } from 'file-saver';

const getMakerField = (maker, key) => {
  if (!maker) return '';
  if (maker.response && maker.response[key] !== undefined && maker.response[key] !== '') return maker.response[key];
  if (maker[key] !== undefined && maker[key] !== '') return maker[key];
  return '';
};

const getMakerStatusLabel = (status) => {
  if (status === 'confirmed') return '参加確定';
  if (status === 'declined') return '辞退';
  if (status === 'invited') return '招待中';
  return 'リスト';
};

export const exportConfirmedMakersExcel = async ({ makers }) => {
  const confirmed = (makers || []).filter((maker) => maker.status === 'confirmed');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('ConfirmedMakers');
  worksheet.addRow(['会社名', '担当者名', '電話番号', '搬入日', 'コマ数', '人数', '特記事項']);

  confirmed.forEach((maker) => {
    worksheet.addRow([
      maker.companyName,
      getMakerField(maker, 'repName'),
      getMakerField(maker, 'phone'),
      getMakerField(maker, 'moveInDate'),
      getMakerField(maker, 'boothCount'),
      getMakerField(maker, 'attendees'),
      getMakerField(maker, 'note')
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'confirmed_makers.xlsx');
};

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

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('InvitedMakers');
  worksheet.addRow(['仕入先コード', '企業名', 'ポータルサイトURL', 'ステータス']);

  allInvited.forEach((maker) => {
    const portalUrl = `${origin}/?mode=maker&id=${exhibitionId}&code=${maker.code}`;
    worksheet.addRow([
      maker.code || '',
      maker.companyName || '',
      portalUrl,
      getMakerStatusLabel(maker.status)
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `invited_makers_${exhibitionTitle}.xlsx`);
  return { exported: true, count: allInvited.length };
};
