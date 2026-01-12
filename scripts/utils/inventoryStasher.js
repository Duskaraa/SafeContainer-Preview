/**
 * Inventory Stasher (minimal state layer)
 *
 * This module only tracks whether a player's inventory has been "stashed".
 * Hotbar changes are only allowed when stash state is true.
 *
 * Implementation: uses player tags (no dynamic property registration needed).
 */

import { system } from "@minecraft/server";

const STASH_TAG_TRUE = "stash";

/**
 * @param {import('@minecraft/server').Player} player
 * @returns {boolean} true when stash state is enabled
 */
export function isStashActive(player) {
  try {
    return !!player?.hasTag?.(STASH_TAG_TRUE);
  } catch {
    return false;
  }
}

/**
 * Returns whether the stash state key exists at all.
 * With a tag-backed implementation, "exists" == player has the tag.
 *
 * @param {import('@minecraft/server').Player} player
 * @returns {boolean}
 */
export function hasStashState(player) {
  return isStashActive(player);
}

/**
 * @param {import('@minecraft/server').Player} player
 * @param {boolean} active
 */
export function setStashActive(player, active) {
  // Try immediately (helps when other logic reads the state right after).
  try {
    if (active) player?.addTag?.(STASH_TAG_TRUE);
    else player?.removeTag?.(STASH_TAG_TRUE);
    return;
  } catch {}

  // Fallback: next tick (safer in some before-events).
  system.run(() => {
    try {
      if (!player?.addTag || !player?.removeTag) return;
      if (active) player.addTag(STASH_TAG_TRUE);
      else player.removeTag(STASH_TAG_TRUE);
    } catch {}
  });
}

export const _internal = {
  STASH_TAG_TRUE,
};
