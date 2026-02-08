const RECOMMENDABLE_STATUSES = new Set(['listed', 'invited', 'confirmed', 'declined']);

const normalizeCode = (rawCode) => String(rawCode || '').trim();

const normalizeStatus = (rawStatus) => {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'confirmed' || s.includes('参加確定') || s.includes('申し込む')) return 'confirmed';
  if (s === 'declined' || s.includes('辞退') || s.includes('申し込まない')) return 'declined';
  if (s === 'invited' || s.includes('招待中')) return 'invited';
  if (s === 'listed' || s.includes('未送付') || s.includes('リスト')) return 'listed';
  return s;
};

const toTimeValue = (rawDate) => {
  if (!rawDate) return 0;
  if (typeof rawDate === 'number' && Number.isFinite(rawDate)) {
    return rawDate > 100000000000 ? rawDate : rawDate * 1000;
  }
  const date = new Date(rawDate);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const vote = (mapObj, key) => {
  if (!key) return;
  mapObj.set(key, (mapObj.get(key) || 0) + 1);
};

const pickMostVoted = (mapObj, fallback = '') => {
  let selected = fallback;
  let maxCount = -1;
  mapObj.forEach((count, value) => {
    if (count > maxCount || (count === maxCount && String(value).length > String(selected).length)) {
      selected = value;
      maxCount = count;
    }
  });
  return selected;
};

const monthDiff = (fromMs, toMs) => {
  if (!fromMs || !toMs || toMs < fromMs) return 999;
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24 * 30));
};

const buildReason = ({
  confirmedCount,
  participationRate,
  declineRate,
  responseRate,
  invitedCount,
  monthsFromLastConfirmed,
  isFixed,
  score
}) => {
  if (invitedCount === 0 && isFixed) return '固定リスト企業で未招待のため、優先的に打診する価値があります';
  if (invitedCount === 0) return '未招待企業のため、新規開拓枠として優先度が高い候補です';

  if (declineRate >= 99.9 && confirmedCount > 0) {
    return `辞退率100％ですが、過去に${confirmedCount}回の参加実績があり、条件調整で来る可能性はあります`;
  }
  if (declineRate >= 99.9) {
    return '辞退率100％ですが、時期・提案内容・担当者アプローチを見直すと来る可能性はあります';
  }

  if (confirmedCount >= 5 && participationRate >= 75) {
    return `参加実績${confirmedCount}回・参加率${participationRate.toFixed(1)}%で、最優先で声かけすべき企業です`;
  }
  if (confirmedCount >= 3 && monthsFromLastConfirmed <= 12) {
    return '直近1年以内に参加実績が複数あり、今回も参加が見込める有力候補です';
  }
  if (participationRate >= 70 && responseRate >= 80) {
    return `参加率${participationRate.toFixed(1)}%・回答率${responseRate.toFixed(1)}%で、反応品質が高い企業です`;
  }
  if (confirmedCount >= 1 && declineRate <= 20) {
    return `過去参加実績があり、辞退率${declineRate.toFixed(1)}%と低いため参加可能性が高いです`;
  }
  if (responseRate >= 85 && invitedCount >= 3) {
    return '招待に対する回答が速く、交渉余地を作りやすい企業です';
  }
  if (declineRate >= 60 && confirmedCount >= 1) {
    return '辞退率は高めですが参加実績もあるため、出展条件の再設計で改善余地があります';
  }
  if (monthsFromLastConfirmed <= 18 && confirmedCount >= 1) {
    return '比較的最近の参加実績があるため、再招待の優先候補です';
  }
  if (isFixed && score >= 40) {
    return '固定リスト企業で、関係維持の観点から定期的な招待対象に適しています';
  }

  return `参加実績・辞退率・回答率の総合評価で招待候補です（AIスコア: ${score.toFixed(1)}）`;
};

export function buildAiInviteRecommendations({
  masterMakers,
  currentMakers,
  allExhibitions,
  currentExhibitionId,
  limit = 30
}) {
  const now = Date.now();
  const mastersByCode = new globalThis.Map();
  (masterMakers || []).forEach((maker) => {
    const code = normalizeCode(maker?.code);
    if (!code || mastersByCode.has(code)) return;
    mastersByCode.set(code, maker);
  });

  const currentCodes = new Set((currentMakers || []).map((maker) => normalizeCode(maker?.code)).filter(Boolean));
  const statsByCode = new globalThis.Map();

  (allExhibitions || []).forEach((ex) => {
    if (!ex || ex.id === currentExhibitionId) return;

    const exDate = toTimeValue(ex.dates?.[0]) || toTimeValue(ex.createdAt) || 0;
    const perExByCode = new globalThis.Map();

    (ex.makers || []).forEach((maker) => {
      const code = normalizeCode(maker?.code || maker?.supplierCode || maker?.response?.supplierCode);
      if (!code) return;

      const status = normalizeStatus(maker?.status);
      if (!RECOMMENDABLE_STATUSES.has(status)) return;

      if (!perExByCode.has(code)) {
        perExByCode.set(code, {
          statuses: new Set(),
          companyNameVotes: new globalThis.Map(),
          categoryVotes: new globalThis.Map()
        });
      }

      const perEx = perExByCode.get(code);
      perEx.statuses.add(status);
      vote(perEx.companyNameVotes, maker?.companyName || maker?.name || maker?.response?.companyName);
      vote(perEx.categoryVotes, maker?.category || maker?.response?.category);
    });

    perExByCode.forEach((perEx, code) => {
      if (!statsByCode.has(code)) {
        statsByCode.set(code, {
          invitedCount: 0,
          confirmedCount: 0,
          declinedCount: 0,
          companyNameVotes: new globalThis.Map(),
          categoryVotes: new globalThis.Map(),
          lastSeenAt: 0,
          lastConfirmedAt: 0
        });
      }

      const stats = statsByCode.get(code);
      stats.invitedCount += 1;
      if (perEx.statuses.has('confirmed')) stats.confirmedCount += 1;
      if (perEx.statuses.has('declined')) stats.declinedCount += 1;
      if (exDate > 0 && exDate > stats.lastSeenAt) stats.lastSeenAt = exDate;
      if (exDate > 0 && perEx.statuses.has('confirmed') && exDate > stats.lastConfirmedAt) stats.lastConfirmedAt = exDate;
      perEx.companyNameVotes.forEach((count, name) => stats.companyNameVotes.set(name, (stats.companyNameVotes.get(name) || 0) + count));
      perEx.categoryVotes.forEach((count, category) => stats.categoryVotes.set(category, (stats.categoryVotes.get(category) || 0) + count));
    });
  });

  const recommendations = [];

  mastersByCode.forEach((master, code) => {
    if (currentCodes.has(code)) return;

    const stats = statsByCode.get(code) || {
      invitedCount: 0,
      confirmedCount: 0,
      declinedCount: 0,
      companyNameVotes: new globalThis.Map(),
      categoryVotes: new globalThis.Map(),
      lastSeenAt: 0,
      lastConfirmedAt: 0
    };

    const respondedCount = stats.confirmedCount + stats.declinedCount;
    const responseRate = stats.invitedCount > 0 ? (respondedCount / stats.invitedCount) * 100 : 0;
    const participationRate = respondedCount > 0
      ? (stats.confirmedCount / respondedCount) * 100
      : (stats.invitedCount > 0 ? (stats.confirmedCount / stats.invitedCount) * 100 : 0);
    const declineRate = respondedCount > 0 ? (stats.declinedCount / respondedCount) * 100 : 0;
    const monthsFromLastConfirmed = monthDiff(stats.lastConfirmedAt, now);

    let recencyBoost = 0;
    if (stats.lastConfirmedAt > 0) {
      if (monthsFromLastConfirmed <= 6) recencyBoost = 14;
      else if (monthsFromLastConfirmed <= 12) recencyBoost = 10;
      else if (monthsFromLastConfirmed <= 24) recencyBoost = 6;
      else recencyBoost = 3;
    } else if (stats.confirmedCount > 0) {
      recencyBoost = 2;
    }

    const fixedBoost = master?.isFixed ? 6 : 0;
    const newCompanyBoost = stats.invitedCount === 0 ? 8 : 0;
    const scoreRaw =
      (stats.confirmedCount * 8) +
      (participationRate * 0.28) +
      (responseRate * 0.15) +
      recencyBoost +
      fixedBoost +
      newCompanyBoost -
      (declineRate * 0.2) -
      (stats.declinedCount * 2.5);

    const score = Number(Math.max(0, Math.min(100, scoreRaw)).toFixed(1));
    const companyName = master?.name || pickMostVoted(stats.companyNameVotes, `企業コード:${code}`);
    const category = master?.category || pickMostVoted(stats.categoryVotes, 'その他');

    recommendations.push({
      code,
      companyName,
      category,
      score,
      invitedCount: stats.invitedCount,
      confirmedCount: stats.confirmedCount,
      declinedCount: stats.declinedCount,
      responseRate: Number(responseRate.toFixed(1)),
      participationRate: Number(participationRate.toFixed(1)),
      declineRate: Number(declineRate.toFixed(1)),
      reason: buildReason({
        confirmedCount: stats.confirmedCount,
        participationRate,
        declineRate,
        responseRate,
        invitedCount: stats.invitedCount,
        monthsFromLastConfirmed,
        isFixed: !!master?.isFixed,
        score
      })
    });
  });

  return recommendations
    .sort((a, b) =>
      b.score - a.score
      || b.confirmedCount - a.confirmedCount
      || a.declineRate - b.declineRate
      || b.responseRate - a.responseRate
      || a.code.localeCompare(b.code, 'ja')
    )
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
