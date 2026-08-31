/**
 * How many players each mode needs to work, and how many it can carry.
 *
 * These are enforced in two places on purpose: the lobby disables Start and says
 * why, and PUT /api/games/:gameCode/start rejects the same cases. The client
 * check is for the teacher; the server check is what actually holds, since the
 * lobby is not the only thing that can call start.
 *
 * The counts include the host when the host is playing.
 */
export const MODE_PLAYER_LIMITS = {
  classic_timed:     { min: 1, max: 30 },
  // Stealing needs someone to steal from.
  jackpot:           { min: 2, max: 50 },
};

export const DEFAULT_PLAYER_LIMITS = { min: 1, max: 50 };

export function playerLimitsFor(mode) {
  return MODE_PLAYER_LIMITS[mode] || DEFAULT_PLAYER_LIMITS;
}

/** Returns null when the count is fine, or a message explaining what's wrong. */
export function playerCountProblem(mode, count) {
  const { min, max } = playerLimitsFor(mode);
  if (count < min) {
    const need = min - count;
    return `Needs at least ${min} players to start. Waiting for ${need} more.`;
  }
  if (count > max) {
    return `This mode supports up to ${max} players. ${count} have joined.`;
  }
  return null;
}
