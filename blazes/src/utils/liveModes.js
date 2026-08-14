import { Vault, Waves, Zap, Sun } from 'lucide-react';

/**
 * The four endless live modes. Kept out of the component file so fast refresh
 * keeps working — a module that exports both components and constants loses it.
 */
export const LIVE_MODE_META = {
  vault: {
    name: 'The Vault',
    icon: Vault,
    accent: '#f59e0b',
    blurb: 'A shared pot fills every second. Answer correctly to crack it — your streak sets your share.',
  },
  undertow: {
    name: 'Undertow',
    icon: Waves,
    accent: '#0891b2',
    blurb: 'One current flows to whoever is fastest. Ride it and your points multiply; fight it and they shrink.',
  },
  fracture: {
    name: 'Fracture',
    icon: Zap,
    accent: '#7c3aed',
    blurb: 'Everyone\'s mistakes crack one shared pane. Cracks near you dim your scoring until you repair them.',
  },
  eclipse: {
    name: 'Eclipse',
    icon: Sun,
    accent: '#ea580c',
    blurb: 'Your glow lights territory, and it fades constantly. Ground is held only by answering.',
  },
};

export const LIVE_MODE_IDS = Object.keys(LIVE_MODE_META);
