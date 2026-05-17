import { useState, useEffect, useCallback } from 'react';
import { fetchAvailableDays, fetchLakeScoresForDay } from '../lib/supabase';
import type { LakeScore } from '../types/lake';
import { getLocalDateKey } from '../lib/date';

const REFRESH_INTERVAL = 60_000;

export function useLakes() {
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [lakes, setLakes] = useState<LakeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Step 1: load available days once on mount
  useEffect(() => {
    fetchAvailableDays().then((days) => {
      setAvailableDays(days);
      // Default to today if present, otherwise first available day
      const today = getLocalDateKey();
      const defaultDay = days.includes(today) ? today : (days[0] ?? today);
      setSelectedDay(defaultDay);
    }).catch(() => {
      const today = getLocalDateKey();
      setAvailableDays([today]);
      setSelectedDay(today);
    });
  }, []);

  // Step 2: load scores whenever selectedDay changes
  const loadScores = useCallback(async (day: string, silent = false) => {
    if (!day) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await fetchLakeScoresForDay(day);
      setLakes(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError('Could not load lake data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDay) return;
    loadScores(selectedDay);
  }, [selectedDay, loadScores]);

  // Auto-refresh only when viewing today
  useEffect(() => {
    const today = getLocalDateKey();
    if (selectedDay !== today) return;
    const interval = setInterval(() => loadScores(today, true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedDay, loadScores]);

  return {
    lakes,
    loading,
    error,
    lastUpdated,
    refreshing,
    availableDays,
    selectedDay,
    setSelectedDay,
    refresh: () => loadScores(selectedDay, true),
  };
}
