const ANALYSIS_STATUSES = new Set(['invited', 'confirmed', 'declined']);

const normalizeVisitorStatus = (rawStatus) => String(rawStatus || '').trim().toLowerCase();

const isCheckedInVisitor = (visitor) => {
  if (!visitor) return false;
  const status = normalizeVisitorStatus(visitor.status);
  return visitor.checkedIn === true
    || status === 'checked-in'
    || status === 'checkedin'
    || status === 'arrived';
};

const toTimestamp = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 100000000000 ? raw : raw * 1000;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n)) return n > 100000000000 ? n : n * 1000;
    }
    const parsed = new Date(trimmed).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof raw?.toDate === 'function') {
    const date = raw.toDate();
    const ts = date?.getTime?.();
    return Number.isFinite(ts) ? ts : null;
  }

  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    const ms = (raw.seconds * 1000) + Math.floor((raw.nanoseconds || 0) / 1000000);
    return Number.isFinite(ms) ? ms : null;
  }

  return null;
};

const getVisitorCheckinTimestamp = (visitor) => {
  const candidates = [
    visitor?.checkedInAt,
    visitor?.checkInAt,
    visitor?.arrivedAt
  ];
  for (const candidate of candidates) {
    const ts = toTimestamp(candidate);
    if (ts !== null) return ts;
  }
  return null;
};

const normalizeCompanyName = (name) => String(name || '')
  .replace(/[ \t\r\n\u3000]/g, '')
  .trim()
  .toLowerCase();

const getMakerField = (maker, key) => {
  if (!maker) return '';
  if (maker[key] !== undefined && maker[key] !== null && maker[key] !== '') return String(maker[key]).trim();
  if (maker.response?.[key] !== undefined && maker.response?.[key] !== null && maker.response?.[key] !== '') return String(maker.response[key]).trim();
  if (maker.formData?.[key] !== undefined && maker.formData?.[key] !== null && maker.formData?.[key] !== '') return String(maker.formData[key]).trim();
  return '';
};

const getMakerCode = (maker) => {
  return getMakerField(maker, 'supplierCode')
    || getMakerField(maker, 'code')
    || '';
};

const getMakerDisplayName = (maker) => {
  return getMakerField(maker, 'companyName')
    || getMakerField(maker, 'name')
    || (getMakerCode(maker) ? `コード:${getMakerCode(maker)}` : '企業名不明');
};

const getMakerCompanyKey = (maker) => {
  const code = getMakerCode(maker);
  if (code) return `code:${code}`;
  const normalizedName = normalizeCompanyName(getMakerDisplayName(maker));
  if (normalizedName) return `name:${normalizedName}`;
  return null;
};

const parseBoothCount = (value, fallback = 1) => {
  const m = String(value ?? '').match(/\d+/);
  if (!m) return fallback;
  const parsed = Number(m[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildExhibitionSortTime = (ex, fallbackOrder) => {
  const dateStr = ex?.dates?.[0];
  const parsed = dateStr ? new Date(dateStr).getTime() : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return fallbackOrder;
};

export const normalizeMakerStatusForAnalysis = (rawStatus) => {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'confirmed' || s.includes('参加確定') || s.includes('申し込む')) return 'confirmed';
  if (s === 'declined' || s.includes('辞退') || s.includes('申し込まない')) return 'declined';
  if (s === 'invited' || s.includes('招待中')) return 'invited';
  if (s === 'listed' || s.includes('未送付') || s.includes('リスト')) return 'listed';
  return s;
};

export const buildYearlyStats = (exhibitions) => {
  const yearlyData = {};

  (exhibitions || []).forEach((ex) => {
    const dateStr = ex.dates?.[0];
    if (!dateStr) return;

    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const year = month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
    const fiscalYear = `${year}年度`;

    if (!yearlyData[fiscalYear]) {
      yearlyData[fiscalYear] = { income: 0, expense: 0, exhibitions: 0, visitors: 0 };
    }

    const makers = ex.makers || [];
    const confirmedMakers = makers.filter((m) => m.status === 'confirmed');
    const feePerBooth = ex.formConfig?.settings?.feePerBooth || 30000;
    const boothIncome = confirmedMakers.reduce((sum, m) => {
      const boothCount = parseInt(String(m.boothCount || '1').match(/\d+/)?.[0] || '1', 10);
      return sum + (boothCount * feePerBooth);
    }, 0);
    const otherIncomes = (ex.otherBudgets || []).filter((b) => b.type === 'income').reduce((s, i) => s + (i.amount || 0), 0);

    const venueCost = ex.venueDetails?.cost || 0;
    const equipmentTotal = (ex.venueDetails?.equipment || []).reduce((sum, item) => sum + (item.count * item.price), 0);
    const lectureFees = (ex.lectures || []).reduce((sum, l) => sum + Number(l.speakerFee || 0) + Number(l.transportFee || 0), 0);
    const otherExpenses = (ex.otherBudgets || []).filter((b) => b.type === 'expense').reduce((s, i) => s + (i.amount || 0), 0);

    yearlyData[fiscalYear].income += boothIncome + otherIncomes;
    yearlyData[fiscalYear].expense += venueCost + equipmentTotal + lectureFees + otherExpenses;
    yearlyData[fiscalYear].exhibitions += 1;
    yearlyData[fiscalYear].visitors += (ex.visitors || []).length;
  });

  return Object.entries(yearlyData).map(([year, data]) => ({
    year,
    ...data,
    profit: data.income - data.expense
  })).sort((a, b) => b.year.localeCompare(a.year));
};

export const buildVisitorForecast = (exhibitions) => {
  const rows = (exhibitions || []).map((ex, idx) => {
    const visitors = ex.visitors || [];
    const checkedIn = visitors.filter((v) => isCheckedInVisitor(v)).length;
    return {
      id: ex.id || `ex-${idx}`,
      title: ex.title || `展示会${idx + 1}`,
      visitors: visitors.length,
      checkedIn,
      sortTime: buildExhibitionSortTime(ex, idx)
    };
  }).sort((a, b) => a.sortTime - b.sortTime);

  if (rows.length === 0) {
    return {
      dataPoints: 0,
      latestVisitors: 0,
      averageVisitors: 0,
      trendPerExhibition: 0,
      predictedVisitors: 0,
      predictedCheckedIn: 0,
      predictedMin: 0,
      predictedMax: 0,
      avgCheckinRate: 0
    };
  }

  const visitorCounts = rows.map((row) => row.visitors);
  const recent = visitorCounts.slice(-6);
  const weightTotal = recent.reduce((sum, _v, idx) => sum + (idx + 1), 0) || 1;
  const weightedAverage = recent.reduce((sum, value, idx) => sum + (value * (idx + 1)), 0) / weightTotal;

  const trendPerExhibition = rows.length >= 2
    ? (visitorCounts[visitorCounts.length - 1] - visitorCounts[0]) / (rows.length - 1)
    : 0;

  const blendedPrediction = weightedAverage + (trendPerExhibition * 0.7);
  const predictedVisitors = Math.max(0, Math.round(blendedPrediction));

  const averageVisitors = visitorCounts.reduce((sum, value) => sum + value, 0) / visitorCounts.length;
  const variance = visitorCounts.reduce((sum, value) => sum + ((value - averageVisitors) ** 2), 0) / visitorCounts.length;
  const stddev = Math.sqrt(variance);
  const rangeMargin = Math.max(10, Math.round(stddev * 0.8));

  const totalVisitors = rows.reduce((sum, row) => sum + row.visitors, 0);
  const totalCheckedIn = rows.reduce((sum, row) => sum + row.checkedIn, 0);
  const avgCheckinRate = totalVisitors > 0 ? (totalCheckedIn / totalVisitors) : 0;
  const predictedCheckedIn = Math.round(predictedVisitors * avgCheckinRate);

  return {
    dataPoints: rows.length,
    latestVisitors: rows[rows.length - 1]?.visitors || 0,
    averageVisitors: Math.round(averageVisitors),
    trendPerExhibition: Number(trendPerExhibition.toFixed(1)),
    predictedVisitors,
    predictedCheckedIn,
    predictedMin: Math.max(0, predictedVisitors - rangeMargin),
    predictedMax: predictedVisitors + rangeMargin,
    avgCheckinRate: Number((avgCheckinRate * 100).toFixed(1))
  };
};

export const buildRevenueSimulation = (exhibitions, additionalCompanies = 0) => {
  const safeAdditionalCompanies = Math.max(0, Math.floor(toFiniteNumber(additionalCompanies, 0)));

  const perEx = (exhibitions || []).map((ex, exIndex) => {
    const makers = ex.makers || [];
    const confirmedMakers = makers.filter((m) => normalizeMakerStatusForAnalysis(m?.status) === 'confirmed');
    const confirmedCount = confirmedMakers.length;
    const feePerBooth = toFiniteNumber(ex.formConfig?.settings?.feePerBooth, 30000);

    const totalBooths = confirmedMakers.reduce((sum, maker) => {
      const boothCountRaw = getMakerField(maker, 'boothCount') || maker.boothCount || 1;
      return sum + parseBoothCount(boothCountRaw, 1);
    }, 0);
    const boothIncome = totalBooths * feePerBooth;
    const otherIncomes = (ex.otherBudgets || [])
      .filter((b) => b.type === 'income')
      .reduce((sum, b) => sum + toFiniteNumber(b.amount, 0), 0);
    const venueCost = toFiniteNumber(ex.venueDetails?.cost, 0);
    const equipmentTotal = (ex.venueDetails?.equipment || [])
      .reduce((sum, item) => sum + (toFiniteNumber(item.count, 0) * toFiniteNumber(item.price, 0)), 0);
    const lectureFees = (ex.lectures || [])
      .reduce((sum, lecture) => sum + toFiniteNumber(lecture.speakerFee ?? lecture.fee, 0) + toFiniteNumber(lecture.transportFee, 0), 0);
    const otherExpenses = (ex.otherBudgets || [])
      .filter((b) => b.type === 'expense')
      .reduce((sum, b) => sum + toFiniteNumber(b.amount, 0), 0);

    const income = boothIncome + otherIncomes;
    const expense = venueCost + equipmentTotal + lectureFees + otherExpenses;
    const variableExpense = equipmentTotal + otherExpenses;

    return {
      id: ex.id || `ex-${exIndex}`,
      confirmedCount,
      totalBooths,
      feePerBooth,
      boothIncome,
      income,
      expense,
      profit: income - expense,
      variableExpense
    };
  });

  const baseCount = perEx.length || 1;
  const totalConfirmed = perEx.reduce((sum, row) => sum + row.confirmedCount, 0);
  const totalBooths = perEx.reduce((sum, row) => sum + row.totalBooths, 0);
  const totalBoothIncome = perEx.reduce((sum, row) => sum + row.boothIncome, 0);
  const totalVariableExpense = perEx.reduce((sum, row) => sum + row.variableExpense, 0);
  const totalIncome = perEx.reduce((sum, row) => sum + row.income, 0);
  const totalExpense = perEx.reduce((sum, row) => sum + row.expense, 0);
  const totalProfit = perEx.reduce((sum, row) => sum + row.profit, 0);

  const avgIncome = Math.round(totalIncome / baseCount);
  const avgExpense = Math.round(totalExpense / baseCount);
  const avgProfit = Math.round(totalProfit / baseCount);
  const avgRevenuePerCompany = totalConfirmed > 0
    ? (totalBoothIncome / totalConfirmed)
    : 30000;
  const avgVariableExpensePerCompany = totalConfirmed > 0
    ? (totalVariableExpense / totalConfirmed)
    : 0;
  const avgBoothsPerCompany = totalConfirmed > 0
    ? (totalBooths / totalConfirmed)
    : 1;
  const avgFeePerBooth = totalBooths > 0
    ? (totalBoothIncome / totalBooths)
    : 30000;

  const additionalIncome = Math.round(safeAdditionalCompanies * avgRevenuePerCompany);
  const additionalExpense = Math.round(safeAdditionalCompanies * avgVariableExpensePerCompany);
  const projectedIncome = avgIncome + additionalIncome;
  const projectedExpense = avgExpense + additionalExpense;
  const projectedProfit = projectedIncome - projectedExpense;
  const profitDelta = projectedProfit - avgProfit;
  const additionalBooths = Number((safeAdditionalCompanies * avgBoothsPerCompany).toFixed(1));
  const roi = additionalExpense > 0
    ? Number((((additionalIncome - additionalExpense) / additionalExpense) * 100).toFixed(1))
    : null;

  return {
    dataPoints: perEx.length,
    scenario: {
      additionalCompanies: safeAdditionalCompanies,
      additionalBooths
    },
    baseline: {
      avgIncome,
      avgExpense,
      avgProfit,
      avgRevenuePerCompany: Math.round(avgRevenuePerCompany),
      avgVariableExpensePerCompany: Math.round(avgVariableExpensePerCompany),
      avgBoothsPerCompany: Number(avgBoothsPerCompany.toFixed(2)),
      avgFeePerBooth: Math.round(avgFeePerBooth)
    },
    projected: {
      additionalIncome,
      additionalExpense,
      projectedIncome,
      projectedExpense,
      projectedProfit,
      profitDelta,
      roi
    }
  };
};

export const buildTotalVisitors = (exhibitions) => {
  return (exhibitions || []).reduce((sum, ex) => sum + (ex.visitors || []).length, 0);
};

export const buildCheckedInVisitors = (exhibitions) => {
  return (exhibitions || []).reduce((sum, ex) => {
    const visitors = ex.visitors || [];
    return sum + visitors.filter((v) => isCheckedInVisitor(v)).length;
  }, 0);
};

export const buildVisitorAttributes = (exhibitions) => {
  const attributes = {};
  (exhibitions || []).forEach((ex) => {
    (ex.visitors || []).forEach((v) => {
      const category = v.receptionType || v.category || v.type || '未分類';
      attributes[category] = (attributes[category] || 0) + 1;
    });
  });
  return Object.entries(attributes).map(([name, value]) => ({ name, value }));
};

export const buildVisitorCheckinHeatmap = (exhibitions) => {
  const HOUR_SLOTS = 24;
  const hourLabels = Array.from({ length: HOUR_SLOTS }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
  const totalByHour = Array(HOUR_SLOTS).fill(0);

  const rows = (exhibitions || []).map((ex, exIndex) => {
    const slots = Array(HOUR_SLOTS).fill(0);
    let trackedCheckins = 0;
    let unknownCheckinTime = 0;

    (ex.visitors || []).forEach((visitor) => {
      if (!isCheckedInVisitor(visitor)) return;

      const ts = getVisitorCheckinTimestamp(visitor);
      if (ts === null) {
        unknownCheckinTime += 1;
        return;
      }

      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) {
        unknownCheckinTime += 1;
        return;
      }

      const hour = date.getHours();
      if (!Number.isInteger(hour) || hour < 0 || hour >= HOUR_SLOTS) {
        unknownCheckinTime += 1;
        return;
      }

      slots[hour] += 1;
      totalByHour[hour] += 1;
      trackedCheckins += 1;
    });

    const peakHourIndex = slots.reduce((bestIndex, count, idx) => {
      if (count > slots[bestIndex]) return idx;
      return bestIndex;
    }, 0);

    const rawDate = ex.dates?.[0] || '';
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const sortTime = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : -Infinity;

    return {
      id: ex.id || `ex-${exIndex}`,
      title: ex.title || `展示会${exIndex + 1}`,
      dateLabel: rawDate || '日付未設定',
      sortTime,
      slots,
      trackedCheckins,
      unknownCheckinTime,
      totalCheckins: trackedCheckins + unknownCheckinTime,
      peakHourLabel: slots[peakHourIndex] > 0 ? hourLabels[peakHourIndex] : '-',
      peakHourCount: slots[peakHourIndex] || 0
    };
  }).sort((a, b) => b.sortTime - a.sortTime);

  const maxCount = Math.max(0, ...totalByHour, ...rows.flatMap((row) => row.slots));
  const totalPeakHourIndex = totalByHour.reduce((bestIndex, count, idx) => {
    if (count > totalByHour[bestIndex]) return idx;
    return bestIndex;
  }, 0);

  const trackedCheckinsTotal = rows.reduce((sum, row) => sum + row.trackedCheckins, 0);
  const unknownCheckinsTotal = rows.reduce((sum, row) => sum + row.unknownCheckinTime, 0);

  return {
    hourLabels,
    rows,
    maxCount,
    totalsByHour: totalByHour.map((count, idx) => ({ hour: hourLabels[idx], count })),
    trackedCheckinsTotal,
    unknownCheckinsTotal,
    totalPeakHourLabel: totalByHour[totalPeakHourIndex] > 0 ? hourLabels[totalPeakHourIndex] : '-',
    totalPeakHourCount: totalByHour[totalPeakHourIndex] || 0
  };
};

export const buildCompanyPerformanceStats = (exhibitions) => {
  const statsByCompany = new globalThis.Map();
  const pickMostVoted = (votes) => {
    let picked = '';
    let max = -1;
    votes.forEach((count, value) => {
      if (count > max || (count === max && String(value).length > String(picked).length)) {
        picked = value;
        max = count;
      }
    });
    return picked;
  };

  (exhibitions || []).forEach((ex, exIndex) => {
    const exhibitionKey = ex.id || `${ex.title || '展示会'}__${ex.dates?.[0] || ''}__${exIndex}`;
    const perExCompany = new globalThis.Map();

    (ex.makers || []).forEach((maker) => {
      const status = normalizeMakerStatusForAnalysis(maker?.status);
      if (!ANALYSIS_STATUSES.has(status)) return;

      const companyKey = getMakerCompanyKey(maker);
      if (!companyKey) return;

      if (!perExCompany.has(companyKey)) {
        perExCompany.set(companyKey, { statuses: new Set(), nameVotes: new globalThis.Map(), codeVotes: new globalThis.Map() });
      }
      const perEx = perExCompany.get(companyKey);
      perEx.statuses.add(status);

      const name = getMakerDisplayName(maker);
      if (name) perEx.nameVotes.set(name, (perEx.nameVotes.get(name) || 0) + 1);

      const code = getMakerCode(maker);
      if (code) perEx.codeVotes.set(code, (perEx.codeVotes.get(code) || 0) + 1);
    });

    perExCompany.forEach((perEx, companyKey) => {
      if (!statsByCompany.has(companyKey)) {
        statsByCompany.set(companyKey, {
          key: companyKey,
          name: '企業名不明',
          code: '',
          invitedExhibitions: new Set(),
          confirmedExhibitions: new Set(),
          declinedExhibitions: new Set()
        });
      }
      const company = statsByCompany.get(companyKey);
      const votedName = pickMostVoted(perEx.nameVotes);
      const votedCode = pickMostVoted(perEx.codeVotes);
      if (votedName && (company.name === '企業名不明' || votedName.length > company.name.length)) company.name = votedName;
      if (votedCode && !company.code) company.code = votedCode;

      company.invitedExhibitions.add(exhibitionKey);
      if (perEx.statuses.has('confirmed')) company.confirmedExhibitions.add(exhibitionKey);
      if (perEx.statuses.has('declined')) company.declinedExhibitions.add(exhibitionKey);
    });
  });

  return Array.from(statsByCompany.values()).map((company) => {
    const invited = company.invitedExhibitions.size;
    const confirmed = company.confirmedExhibitions.size;
    const declined = company.declinedExhibitions.size;
    const declineRate = invited > 0 ? Number(((declined / invited) * 100).toFixed(1)) : 0;
    const participationRate = invited > 0 ? Number(((confirmed / invited) * 100).toFixed(1)) : 0;
    return {
      key: company.key,
      name: company.name,
      code: company.code,
      invited,
      confirmed,
      declined,
      declineRate,
      participationRate
    };
  });
};

export const buildCompanyRanking = (companyPerformanceStats) => {
  return [...(companyPerformanceStats || [])]
    .sort((a, b) => b.confirmed - a.confirmed || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 30)
    .map((company) => ({
      name: company.name,
      code: company.code,
      count: company.confirmed,
      invited: company.invited,
      declined: company.declined
    }));
};

export const buildDeclineRanking = (companyPerformanceStats) => {
  return [...(companyPerformanceStats || [])]
    .filter((company) => company.invited >= 3)
    .sort((a, b) => b.declineRate - a.declineRate || b.declined - a.declined || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 30)
    .map((company) => ({
      name: company.name,
      code: company.code,
      invited: company.invited,
      declined: company.declined,
      rate: company.declineRate.toFixed(1)
    }));
};

export const buildOverallExhibitionStats = (exhibitions) => {
  const toInt = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const parseCount = (value, fallback = 0) => {
    const m = String(value ?? '').match(/\d+/);
    return m ? Number(m[0]) : fallback;
  };
  const now = new Date();

  const perExhibition = (exhibitions || []).map((ex, exIndex) => {
    const makers = ex.makers || [];
    const visitors = ex.visitors || [];
    const tasks = ex.tasks || [];
    const scheduleDayBefore = ex.schedule?.dayBefore || [];
    const scheduleEventDay = ex.schedule?.eventDay || [];
    const lectures = ex.lectures || [];
    const scanLogs = ex.scanLogs || [];
    const hotels = ex.hotelReservations || ex.hotels || [];
    const staffCount = String(ex.staff || '').split(',').map((s) => s.trim()).filter(Boolean).length;

    const statusCounts = { listed: 0, invited: 0, confirmed: 0, declined: 0 };
    makers.forEach((maker) => {
      const normalized = normalizeMakerStatusForAnalysis(maker?.status);
      if (statusCounts[normalized] !== undefined) statusCounts[normalized] += 1;
    });

    const actionableInvites = statusCounts.invited + statusCounts.confirmed + statusCounts.declined;
    const answered = statusCounts.confirmed + statusCounts.declined;
    const responseRate = actionableInvites > 0 ? (answered / actionableInvites) * 100 : 0;
    const confirmRate = actionableInvites > 0 ? (statusCounts.confirmed / actionableInvites) * 100 : 0;
    const declineRate = actionableInvites > 0 ? (statusCounts.declined / actionableInvites) * 100 : 0;

    const checkedIn = visitors.filter((v) => isCheckedInVisitor(v)).length;
    const visitorTarget = toInt(ex.targetVisitors, 0);
    const makerTarget = toInt(ex.targetMakers, 0);
    const profitTarget = toInt(ex.targetProfit, 0);

    const taskDone = tasks.filter((t) => t.status === 'done').length;
    const taskRate = tasks.length > 0 ? (taskDone / tasks.length) * 100 : 0;
    const scheduleCount = scheduleDayBefore.length + scheduleEventDay.length;

    const feePerBooth = toInt(ex.formConfig?.settings?.feePerBooth, 30000);
    const boothIncome = makers
      .filter((m) => normalizeMakerStatusForAnalysis(m?.status) === 'confirmed')
      .reduce((sum, maker) => {
        const boothCountRaw = getMakerField(maker, 'boothCount') || maker.boothCount || 0;
        return sum + (parseCount(boothCountRaw, 0) * feePerBooth);
      }, 0);
    const otherIncomes = (ex.otherBudgets || []).filter((b) => b.type === 'income').reduce((sum, b) => sum + toInt(b.amount, 0), 0);
    const venueCost = toInt(ex.venueDetails?.cost, 0);
    const equipmentTotal = (ex.venueDetails?.equipment || []).reduce((sum, item) => sum + (toInt(item.count, 0) * toInt(item.price, 0)), 0);
    const lectureFees = lectures.reduce((sum, l) => sum + toInt(l.speakerFee ?? l.fee, 0) + toInt(l.transportFee, 0), 0);
    const otherExpenses = (ex.otherBudgets || []).filter((b) => b.type === 'expense').reduce((sum, b) => sum + toInt(b.amount, 0), 0);
    const income = boothIncome + otherIncomes;
    const expense = venueCost + equipmentTotal + lectureFees + otherExpenses;
    const profit = income - expense;

    const hasLayout = !!(ex.materials?.venue || ex.documents?.layoutPdf?.url || ex.documents?.layoutPdf?.data);
    const hasFlyer = !!(ex.materials?.flyer || ex.documents?.flyerPdf?.url || ex.documents?.flyerPdf?.data);
    const hasOtherMaterial = !!ex.materials?.other;
    const docScore = (hasLayout ? 1 : 0) + (hasFlyer ? 1 : 0) + (hasOtherMaterial ? 1 : 0);

    const deadlineRaw = ex.formConfig?.settings?.deadline || ex.formConfig?.deadline || null;
    const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
    const hasPastDeadlinePending = !!(deadline && !Number.isNaN(deadline.getTime()) && deadline < now && statusCounts.invited > 0);

    const exName = ex.title || `展示会#${exIndex + 1}`;
    return {
      id: ex.id || `ex-${exIndex}`,
      name: exName,
      date: ex.dates?.[0] || '',
      visitors: visitors.length,
      checkedIn,
      visitorTarget,
      confirmedMakers: statusCounts.confirmed,
      makerTarget,
      listedMakers: statusCounts.listed,
      invitedMakers: statusCounts.invited,
      declinedMakers: statusCounts.declined,
      actionableInvites,
      responseRate,
      confirmRate,
      declineRate,
      taskCount: tasks.length,
      taskDone,
      taskRate,
      scheduleCount,
      lecturesCount: lectures.length,
      scanCount: scanLogs.length,
      hotelsCount: hotels.length,
      staffCount,
      docScore,
      hasLayout,
      hasFlyer,
      hasOtherMaterial,
      hasPastDeadlinePending,
      income,
      expense,
      profit,
      profitTarget
    };
  });

  const totals = perExhibition.reduce((acc, ex) => {
    acc.visitors += ex.visitors;
    acc.checkedIn += ex.checkedIn;
    acc.confirmedMakers += ex.confirmedMakers;
    acc.listedMakers += ex.listedMakers;
    acc.invitedMakers += ex.invitedMakers;
    acc.declinedMakers += ex.declinedMakers;
    acc.actionableInvites += ex.actionableInvites;
    acc.tasks += ex.taskCount;
    acc.tasksDone += ex.taskDone;
    acc.scheduleItems += ex.scheduleCount;
    acc.scanLogs += ex.scanCount;
    acc.lectures += ex.lecturesCount;
    acc.staff += ex.staffCount;
    acc.hotels += ex.hotelsCount;
    acc.docsScore += ex.docScore;
    acc.docsComplete += ex.docScore >= 2 ? 1 : 0;
    acc.pendingAfterDeadline += ex.hasPastDeadlinePending ? 1 : 0;
    acc.income += ex.income;
    acc.expense += ex.expense;
    acc.profit += ex.profit;
    if (ex.visitorTarget > 0) {
      acc.targetVisitorsSet += 1;
      if (ex.checkedIn >= ex.visitorTarget) acc.targetVisitorsAchieved += 1;
    }
    if (ex.makerTarget > 0) {
      acc.targetMakersSet += 1;
      if (ex.confirmedMakers >= ex.makerTarget) acc.targetMakersAchieved += 1;
    }
    if (ex.profitTarget > 0) {
      acc.targetProfitSet += 1;
      if (ex.profit >= ex.profitTarget) acc.targetProfitAchieved += 1;
    }
    return acc;
  }, {
    visitors: 0,
    checkedIn: 0,
    confirmedMakers: 0,
    listedMakers: 0,
    invitedMakers: 0,
    declinedMakers: 0,
    actionableInvites: 0,
    tasks: 0,
    tasksDone: 0,
    scheduleItems: 0,
    scanLogs: 0,
    lectures: 0,
    staff: 0,
    hotels: 0,
    docsScore: 0,
    docsComplete: 0,
    pendingAfterDeadline: 0,
    income: 0,
    expense: 0,
    profit: 0,
    targetVisitorsSet: 0,
    targetVisitorsAchieved: 0,
    targetMakersSet: 0,
    targetMakersAchieved: 0,
    targetProfitSet: 0,
    targetProfitAchieved: 0
  });

  const rates = {
    checkinRate: totals.visitors > 0 ? (totals.checkedIn / totals.visitors) * 100 : 0,
    responseRate: totals.actionableInvites > 0 ? ((totals.confirmedMakers + totals.declinedMakers) / totals.actionableInvites) * 100 : 0,
    declineRate: totals.actionableInvites > 0 ? (totals.declinedMakers / totals.actionableInvites) * 100 : 0,
    confirmRate: totals.actionableInvites > 0 ? (totals.confirmedMakers / totals.actionableInvites) * 100 : 0,
    taskDoneRate: totals.tasks > 0 ? (totals.tasksDone / totals.tasks) * 100 : 0,
    docsCompleteRate: (exhibitions || []).length > 0 ? (totals.docsComplete / (exhibitions || []).length) * 100 : 0
  };

  return { perExhibition, totals, rates };
};

export const buildAiIntegratedReport = ({ overallExhibitionStats, exhibitionsCount, generatedAt }) => {
  const { perExhibition, totals, rates } = overallExhibitionStats;
  const topProfit = [...perExhibition].sort((a, b) => b.profit - a.profit).slice(0, 3);
  const weakResponse = [...perExhibition]
    .filter((ex) => ex.actionableInvites >= 3)
    .sort((a, b) => a.responseRate - b.responseRate)
    .slice(0, 3);

  const executiveSummary = [
    `全${exhibitionsCount}展示会の統合分析。来場登録${totals.visitors}名、来場済み${totals.checkedIn}名（来場率${rates.checkinRate.toFixed(1)}%）。`,
    `招待母数${totals.actionableInvites}件に対して、参加確定率${rates.confirmRate.toFixed(1)}%、辞退率${rates.declineRate.toFixed(1)}%、回答率${rates.responseRate.toFixed(1)}%。`,
    `全体収支は 収入¥${totals.income.toLocaleString()} / 支出¥${totals.expense.toLocaleString()} / 収支¥${totals.profit.toLocaleString()}。`,
    `主要資料（レイアウト・チラシ）が揃う展示会比率は${rates.docsCompleteRate.toFixed(1)}%（${totals.docsComplete}/${exhibitionsCount || 0}件）。`,
    `タスク完了率は${rates.taskDoneRate.toFixed(1)}%（${totals.tasksDone}/${totals.tasks}件）、期限超過未回答の展示会は${totals.pendingAfterDeadline}件。`
  ];

  const risks = [];
  if (totals.pendingAfterDeadline > 0) {
    risks.push({ score: 95, title: '回答期限超過の未回答企業が残存', detail: `${totals.pendingAfterDeadline}展示会で、期限経過後も「招待中」が残っています。` });
  }
  if (rates.responseRate < 60 && totals.actionableInvites >= 10) {
    risks.push({ score: 88, title: '招待回答率が低い', detail: `回答率が${rates.responseRate.toFixed(1)}%です。回答導線とリマインド間隔の再設計が必要です。` });
  }
  if (rates.declineRate >= 35 && totals.actionableInvites >= 10) {
    risks.push({ score: 82, title: '辞退率が高い', detail: `辞退率が${rates.declineRate.toFixed(1)}%です。対象選定基準の見直し余地があります。` });
  }
  if (rates.docsCompleteRate < 65 && exhibitionsCount > 0) {
    risks.push({ score: 74, title: '資料整備のばらつき', detail: `資料整備率が${rates.docsCompleteRate.toFixed(1)}%で、展示会ごとの品質差があります。` });
  }
  if (rates.taskDoneRate < 70 && totals.tasks >= 20) {
    risks.push({ score: 70, title: 'タスク完了率が低い', detail: `全体タスク完了率が${rates.taskDoneRate.toFixed(1)}%です。進行管理の強化が必要です。` });
  }
  risks.sort((a, b) => b.score - a.score);

  const opportunities = [];
  if (topProfit.length > 0) {
    const lead = topProfit[0];
    opportunities.push(`最も収支が良い展示会は「${lead.name}」（¥${lead.profit.toLocaleString()}）。同条件（会場/対象企業/出展費）を横展開する価値があります。`);
  }
  if (weakResponse.length > 0) {
    opportunities.push(`回答率が低い展示会（例: ${weakResponse.map((x) => x.name).join(' / ')}）は、回答期限前の個別連絡で改善余地があります。`);
  }
  if (totals.targetVisitorsSet > 0) {
    opportunities.push(`来場目標達成は ${totals.targetVisitorsAchieved}/${totals.targetVisitorsSet} 件。未達展示会の集客施策をテンプレ化できます。`);
  }
  if (totals.scanLogs > 0 && totals.confirmedMakers > 0) {
    opportunities.push(`スキャンログ${totals.scanLogs}件が蓄積。企業別の商談量と次回出展率を紐づけると、招待精度が上がります。`);
  }

  const actions = [];
  if (totals.pendingAfterDeadline > 0) actions.push('締切当日夜に自動で「招待中」を一括クローズし、辞退確定へ遷移する運用を固定化する。');
  if (rates.responseRate < 60) actions.push('回答期限7日前/3日前/前日の3段階リマインドを標準化し、未回答企業へ担当者電話を連携する。');
  if (rates.declineRate >= 35) actions.push('辞退率上位企業は次回招待前に参加条件確認を実施し、対象企業リストを優先度別に再編する。');
  if (rates.docsCompleteRate < 65) actions.push('資料（レイアウト・チラシ）公開チェックリストを追加し、公開漏れをゼロ化する。');
  if (rates.taskDoneRate < 70) actions.push('進行タスクを週次で強制棚卸しし、担当未設定・期限未設定タスクを禁止する。');
  if (actions.length === 0) actions.push('主要KPIは安定。高収支展示会の再現性を高める標準運用書を作成してください。');

  return {
    generatedAt,
    executiveSummary,
    risks: risks.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    actions: actions.slice(0, 7),
    kpi: {
      responseRate: rates.responseRate.toFixed(1),
      declineRate: rates.declineRate.toFixed(1),
      confirmRate: rates.confirmRate.toFixed(1),
      taskDoneRate: rates.taskDoneRate.toFixed(1),
      docsCompleteRate: rates.docsCompleteRate.toFixed(1)
    }
  };
};

export const buildMakerStrategyReport = ({ companyPerformanceStats, generatedAt }) => {
  const companies = [...(companyPerformanceStats || [])].filter((company) => company.invited > 0);
  const totals = companies.reduce((acc, company) => {
    acc.invited += company.invited;
    acc.confirmed += company.confirmed;
    acc.declined += company.declined;
    return acc;
  }, { invited: 0, confirmed: 0, declined: 0 });

  const participationRate = totals.invited > 0 ? Number(((totals.confirmed / totals.invited) * 100).toFixed(1)) : 0;
  const declineRate = totals.invited > 0 ? Number(((totals.declined / totals.invited) * 100).toFixed(1)) : 0;

  const strategyLabel = (company) => {
    if (company.invited >= 3 && company.declineRate >= 50) return '要因ヒアリング後に再招待';
    if (company.confirmed >= 3 && company.participationRate >= 70) return '先行招待＋ブース拡張提案';
    if (company.confirmed === 0 && company.invited >= 3) return '招待優先度を下げて保留';
    if (company.participationRate >= 50) return '通常招待＋追加提案';
    return '個別フォローで参加可否確認';
  };

  const topParticipants = [...companies]
    .sort((a, b) => b.confirmed - a.confirmed || b.participationRate - a.participationRate || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 30)
    .map((company) => ({
      ...company,
      strategy: strategyLabel(company)
    }));

  const highDecliners = [...companies]
    .filter((company) => company.invited >= 2)
    .sort((a, b) => b.declineRate - a.declineRate || b.declined - a.declined || b.invited - a.invited || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 30)
    .map((company) => ({
      ...company,
      strategy: strategyLabel(company)
    }));

  const segmentCounts = companies.reduce((acc, company) => {
    if (company.invited >= 3 && company.declineRate >= 50) acc.caution += 1;
    else if (company.confirmed >= 3 && company.participationRate >= 70 && company.declineRate <= 20) acc.core += 1;
    else if (company.confirmed > 0) acc.growth += 1;
    else acc.dormant += 1;
    return acc;
  }, { core: 0, growth: 0, caution: 0, dormant: 0 });

  const coreFocus = topParticipants
    .filter((company) => company.confirmed >= 3 && company.participationRate >= 70 && company.declineRate <= 25)
    .slice(0, 5);
  const cautionFocus = highDecliners
    .filter((company) => company.invited >= 3 && company.declined >= 2)
    .slice(0, 5);
  const dormantFocus = [...companies]
    .filter((company) => company.invited >= 3 && company.confirmed === 0)
    .sort((a, b) => b.invited - a.invited || b.declined - a.declined || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 5);

  const executiveSummary = [
    `対象${companies.length}社の招待実績を分析。招待${totals.invited}回、出展${totals.confirmed}回、辞退${totals.declined}回。`,
    `全社平均の出展率は${participationRate.toFixed(1)}%、辞退率は${declineRate.toFixed(1)}%。`,
    `重点育成${segmentCounts.core}社 / 成長余地${segmentCounts.growth}社 / 辞退高リスク${segmentCounts.caution}社 / 休眠${segmentCounts.dormant}社。`
  ];

  const policyRecommendations = [];
  if (coreFocus.length > 0) {
    policyRecommendations.push(`重点育成候補（${coreFocus.map((x) => x.name).join(' / ')}）には先行招待とブース拡張提案を実施する。`);
  }
  if (cautionFocus.length > 0) {
    policyRecommendations.push(`辞退高リスク（${cautionFocus.map((x) => x.name).join(' / ')}）は、次回招待前に不参加要因ヒアリングを必須化する。`);
  }
  if (dormantFocus.length > 0) {
    policyRecommendations.push(`連続未出展（${dormantFocus.map((x) => x.name).join(' / ')}）は、招待頻度と優先度を見直して母集団を再編する。`);
  }
  if (policyRecommendations.length === 0) {
    policyRecommendations.push('現状は分布が安定。出展率上位企業の成功要因をテンプレート化して横展開する。');
  }

  const nextActions = [];
  if (segmentCounts.caution > 0) nextActions.push('辞退率50%以上かつ招待3回以上の企業を次回招待前にレビューし、個別連絡で条件調整する。');
  if (segmentCounts.core > 0) nextActions.push('出展上位企業に対して、次回展示会の先行案内と追加コマ提案を標準運用に組み込む。');
  if (segmentCounts.dormant > 0) nextActions.push('3回以上招待で未出展の企業は、優先度を下げた再分類リストへ移して招待効率を改善する。');
  if (nextActions.length === 0) nextActions.push('主要企業群は健全。現行の招待運用を維持しつつ、来場成果データと連携した精度改善を進める。');

  return {
    generatedAt,
    totals: {
      companies: companies.length,
      invited: totals.invited,
      confirmed: totals.confirmed,
      declined: totals.declined
    },
    kpi: {
      participationRate,
      declineRate
    },
    segmentCounts,
    executiveSummary,
    policyRecommendations: policyRecommendations.slice(0, 5),
    nextActions: nextActions.slice(0, 5),
    topParticipants,
    highDecliners
  };
};

export const formatReportTimestamp = (ts) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};
