export const getGameModeName = (mode) => {
  const modeNames = {
    'classic_timed': 'Classic Timed',
    'regular': 'Regular',
    'survival': 'Survival',
    'elemental_clash': 'Elemental Clash',
    'elemental_wager': 'Elemental Wager',
    'inferno_tower': 'Inferno Tower'
  };
  return modeNames[mode] || (mode ? mode.charAt(0).toUpperCase() + mode.slice(1).replace(/_/g, ' ') : 'Unknown');
};
