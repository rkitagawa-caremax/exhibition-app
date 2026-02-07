const getMakerField = (maker, key) => {
  if (!maker) return null;
  if (maker.response && maker.response[key] !== undefined && maker.response[key] !== '') return maker.response[key];
  if (maker[key] !== undefined && maker[key] !== '') return maker[key];
  return null;
};

const isPowerRequested = (maker) => {
  const powerVal = getMakerField(maker, 'power') || getMakerField(maker, 'itemsPower');
  const rawRes = maker?.response || {};
  return (powerVal && (parseInt(powerVal, 10) > 0 || powerVal === '必要'))
    || JSON.stringify(rawRes).includes('電源利用：あり')
    || JSON.stringify(maker).includes('電源利用：あり');
};

const isLunchRequested = (maker) => {
  const lunch1 = getMakerField(maker, 'lunch');
  const lunch2 = getMakerField(maker, 'lunchCount');
  const rawRes = maker?.response || {};
  return (parseInt(lunch1 || 0, 10) > 0)
    || (parseInt(lunch2 || 0, 10) > 0)
    || JSON.stringify(rawRes).includes('弁当')
    || JSON.stringify(maker).includes('弁当');
};

export const filterMakersByTab = ({
  makers,
  searchTerm,
  activeTab,
  confirmedFilter
}) => {
  return (makers || []).filter((maker) => {
    const matchesSearch = (maker.companyName?.includes(searchTerm) || maker.code?.includes(searchTerm));
    if (!matchesSearch) return false;

    if (activeTab === 'invited') {
      return maker.status === 'listed'
        || maker.status === 'invited'
        || maker.status === 'confirmed'
        || maker.status === 'declined';
    }

    if (activeTab === 'confirmed') {
      if (maker.status !== 'confirmed') return false;
      if (confirmedFilter === 'power') return isPowerRequested(maker);
      if (confirmedFilter === 'lunch') return isLunchRequested(maker);
      return true;
    }

    if (activeTab === 'declined') return maker.status === 'declined';
    if (activeTab === 'unanswered') return maker.status === 'invited' && !maker.respondedAt;
    return false;
  });
};

export const buildMakerStats = (makers) => {
  const list = makers || [];
  return {
    total: list.length,
    invited: list.length,
    confirmed: list.filter((maker) => maker.status === 'confirmed').length,
    declined: list.filter((maker) => maker.status === 'declined').length,
    unanswered: list.filter((maker) => maker.status === 'invited' && !maker.respondedAt).length
  };
};

export const buildConfirmedAggregates = (makers) => {
  const confirmed = (makers || []).filter((maker) => maker.status === 'confirmed');
  let totalBooths = 0;
  let totalPeople = 0;
  let totalLunch = 0;
  let totalDesks = 0;
  let totalChairs = 0;
  let totalPower = 0;

  confirmed.forEach((maker) => {
    const boothVal = getMakerField(maker, 'boothCount');
    if (boothVal) {
      const match = String(boothVal).match(/(\d+)/);
      if (match) totalBooths += parseInt(match[1], 10);
    }

    const attendees = getMakerField(maker, 'attendees') || getMakerField(maker, 'staffCount');
    if (attendees) totalPeople += parseInt(attendees, 10) || 0;

    const lunch1 = getMakerField(maker, 'lunch');
    const lunch2 = getMakerField(maker, 'lunchCount');
    if (lunch1) totalLunch += parseInt(lunch1, 10) || 0;
    else if (lunch2) totalLunch += parseInt(lunch2, 10) || 0;

    const desk = getMakerField(maker, 'desk') || getMakerField(maker, 'itemsDesk');
    if (desk) totalDesks += parseInt(desk, 10) || 0;
    const chair = getMakerField(maker, 'chair') || getMakerField(maker, 'itemsChair');
    if (chair) totalChairs += parseInt(chair, 10) || 0;

    if (isPowerRequested(maker)) totalPower += 1;
  });

  return { totalBooths, totalPeople, totalLunch, totalDesks, totalChairs, totalPower };
};
