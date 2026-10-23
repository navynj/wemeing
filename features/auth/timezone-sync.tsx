'use client';

import { useEffect } from 'react';

import { detectTimezone } from '@/lib/time';

import { updateMyTimezone } from './timezone';

/**
 * Travelling between Vancouver and Korea without signing in again (0013):
 * when the device's zone differs from my profile's, the profile follows, so
 * what I write next lands on the day I am living. Renders nothing.
 */
export function TimezoneSync({ profileZone }: { profileZone: string }) {
  useEffect(() => {
    const here = detectTimezone();
    if (here && here !== profileZone) void updateMyTimezone(here);
  }, [profileZone]);
  return null;
}
