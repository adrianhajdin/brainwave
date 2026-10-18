import { useEffect, useState } from 'react';

import { useApp } from '../AppProvider';
import type { IconName } from './ui';

/** Resolve a stored cat photo path to a (signed, cached) URL. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const { backend } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path || !backend) {
      setUrl(null);
      return;
    }
    void backend.photoUrl(path).then((u) => active && setUrl(u)).catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [path, backend]);
  return url;
}

/** Badge on a cat's avatar: lost mode wins over low battery. */
export function catBadge(
  cat: { lostMode: boolean; lastBatteryPct: number | null },
  colors: { danger: string; accent: string },
): { icon: IconName; color: string } | null {
  if (cat.lostMode) return { icon: 'alert', color: colors.danger };
  if (cat.lastBatteryPct !== null && cat.lastBatteryPct > 0 && cat.lastBatteryPct < 20) {
    return { icon: 'battery-dead', color: colors.accent };
  }
  return null;
}
