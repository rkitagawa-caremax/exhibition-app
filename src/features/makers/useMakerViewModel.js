import { useMemo } from 'react';
import {
  buildConfirmedAggregates,
  buildMakerStats,
  filterMakersByTab
} from './makerViewModel';

export function useMakerViewModel({
  makers,
  searchTerm,
  activeTab,
  confirmedFilter
}) {
  const filteredMakers = useMemo(() => {
    return filterMakersByTab({
      makers,
      searchTerm,
      activeTab,
      confirmedFilter
    });
  }, [makers, searchTerm, activeTab, confirmedFilter]);

  const stats = useMemo(() => buildMakerStats(makers), [makers]);
  const aggregates = useMemo(() => buildConfirmedAggregates(makers), [makers]);

  return { filteredMakers, stats, aggregates };
}
