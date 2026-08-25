import { Vault, Waves, Zap, Sun } from 'lucide-react';

/**
 * The four live modes. Kept out of the component file so fast refresh
 * keeps working, a module that exports both components and constants loses it.
 */
export const LIVE_MODE_META = {
  vault: {
    name: 'The Vault',
    icon: Vault,
    accent: '#f59e0b',
    blurb: 'A shared pot grows every second. The next correct answer takes part of it, and your streak sets how much.',
  },
  undertow: {
    name: 'Undertow',
    icon: Waves,
    accent: '#0891b2',
    blurb: 'The current moves to whoever has answered fastest recently. Answering with it multiplies your points; answering against it reduces them.',
  },
  fracture: {
    name: 'Fracture',
    icon: Zap,
    accent: '#7c3aed',
    blurb: 'Every wrong answer adds a crack to one shared pane. Cracks near you reduce your scoring until correct answers remove them.',
  },
  eclipse: {
    name: 'Eclipse',
    icon: Sun,
    accent: '#ea580c',
    blurb: 'Your colour covers an area that shrinks over time. Correct answers make it larger.',
  },
};

export const LIVE_MODE_IDS = Object.keys(LIVE_MODE_META);
