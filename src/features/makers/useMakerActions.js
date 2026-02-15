import { useCallback } from 'react';

export function useMakerActions({
  makers,
  setMakers,
  formConfig,
  selectedMakerIds,
  setSelectedMakerIds
}) {
  const handleSendInvitations = useCallback(async () => {
    const targets = makers.filter((maker) => (maker.status === 'listed' || maker.status === 'invited') && !maker.invitationSentAt);
    if (targets.length === 0) {
      alert('送付対象の企業がありません');
      return;
    }
    if (!window.confirm(`${targets.length}件の企業に招待状を一斉送付しますか？`)) return;

    const settings = formConfig?.settings || {};
    const missingSettings = [];
    if (!settings.venuePhone) missingSettings.push('会場電話番号');
    if (!settings.moveInInfo) missingSettings.push('搬入案内');
    if (!settings.feePerBooth) missingSettings.push('出展費用');
    if (!settings.deadline) missingSettings.push('回答期限');

    if (missingSettings.length > 0) {
      alert(`【送信できません】\n招待を送る前に「フォーム編集」＞「基本設定」から以下の項目を設定してください。\n\n未設定: ${missingSettings.join(', ')}`);
      return;
    }

    const updatedMakers = makers.map((maker) => {
      if ((maker.status === 'listed' || maker.status === 'invited') && !maker.invitationSentAt) {
        return { ...maker, status: 'invited', invitationSentAt: Date.now() };
      }
      return maker;
    });
    setMakers(updatedMakers);
    alert('招待状を送付しました');
  }, [formConfig, makers, setMakers]);

  const handleCloseReception = useCallback(async () => {
    const targets = makers.filter((maker) => maker.status === 'listed' || maker.status === 'invited');
    if (targets.length === 0) return;
    if (!window.confirm(`現在「招待中（未回答）」の${targets.length}件を「辞退（締切）」に変更しますか？\n※参加確定の企業は変更されません。`)) return;

    const closedAt = Date.now();
    const updatedMakers = makers.map((maker) => {
      if (maker.status === 'listed' || maker.status === 'invited') {
        return {
          ...maker,
          status: 'declined',
          autoDeclinedByReceptionClose: true,
          autoDeclinedAt: closedAt,
          autoDeclineReason: 'reception_closed',
          note: (maker.note || '') + '\n[システム] 受付締切により自動辞退'
        };
      }
      return maker;
    });
    setMakers(updatedMakers);
    alert('受付を締め切りました');
  }, [makers, setMakers]);

  const handleDeleteInvitation = useCallback((maker) => {
    if (!window.confirm(`「${maker.companyName}」をリストから削除しますか？`)) return;
    if (!window.confirm('【警告】\n削除すると参加確定・招待中・辞退済みに関わらず、企業ポータルからこの展示会の情報は完全に削除されます。\n\n本当に削除してよろしいですか？')) return;

    const updatedMakers = makers.filter((item) => item.id !== maker.id);
    setMakers(updatedMakers);
  }, [makers, setMakers]);

  const handleBulkDelete = useCallback(() => {
    if (selectedMakerIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedMakerIds.size} 件の企業を削除しますか？`)) return;
    if (!window.confirm('【警告】\n削除するとこれらのデータは完全に失われます。\n本当によろしいですか？')) return;

    const updatedMakers = makers.filter((maker) => !selectedMakerIds.has(maker.id));
    setMakers(updatedMakers);
    setSelectedMakerIds(new Set());
    alert('削除しました');
  }, [makers, selectedMakerIds, setMakers, setSelectedMakerIds]);

  const handleNormalizeMakers = useCallback(() => {
    const groups = {};
    makers.forEach((maker) => {
      if (!maker.code) return;
      if (!groups[maker.code]) groups[maker.code] = [];
      groups[maker.code].push(maker);
    });

    const toRemoveIds = new Set();
    let fixedCount = 0;

    const STATUS_PRIORITY = {
      confirmed: 4,
      declined: 3,
      invited: 2,
      listed: 1
    };

    Object.entries(groups).forEach(([, groupMakers]) => {
      if (groupMakers.length < 2) return;

      groupMakers.sort((a, b) => {
        const scoreA = STATUS_PRIORITY[a.status] || 0;
        const scoreB = STATUS_PRIORITY[b.status] || 0;

        if (scoreA === scoreB) {
          const hasResA = a.response && Object.keys(a.response).length > 0 ? 1 : 0;
          const hasResB = b.response && Object.keys(b.response).length > 0 ? 1 : 0;
          return hasResB - hasResA;
        }
        return scoreB - scoreA;
      });

      for (let i = 1; i < groupMakers.length; i += 1) {
        toRemoveIds.add(groupMakers[i].id);
      }
      fixedCount += 1;
    });

    if (toRemoveIds.size === 0) {
      alert('重複データは見つかりませんでした。');
      return;
    }

    if (!window.confirm(`重複する仕入先コードを持つデータが ${fixedCount} グループ見つかりました。\n合計 ${toRemoveIds.size} 件の不要な重複データを削除し、最もステータスの高い（または情報の多い）データを残します。\n\n「参加確定」＞「辞退」＞「招待中」の優先順位で残します。\n実行してもよろしいですか？`)) return;

    const updatedMakers = makers.filter((maker) => !toRemoveIds.has(maker.id));
    setMakers(updatedMakers);
    alert(`${toRemoveIds.size} 件の重複データを削除し、整理しました。`);
  }, [makers, setMakers]);

  return {
    handleSendInvitations,
    handleCloseReception,
    handleDeleteInvitation,
    handleBulkDelete,
    handleNormalizeMakers
  };
}
