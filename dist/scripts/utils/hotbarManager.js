import { ItemStack, system } from "@minecraft/server";
import config from "../config.js";
import { isStashActive } from "./inventoryStasher.js";

const HOTBAR_SIZE = 9;

// Tracks whether the hotbar was modified (1) or not (0)
const HOTBAR_STATE_TAG_1 = "scontainer:hotbar_state_1";
const HOTBAR_STATE_TAG_0 = "scontainer:hotbar_state_0";

let hotbarModeEnabled = config?.hotbarModeEnabled ?? true;

/**
 * Enable/disable hotbar mode globally (you said you'll use later).
 * @param {boolean} enabled
 */
export function setHotbarModeEnabled(enabled) {
  hotbarModeEnabled = !!enabled;
}

/** @returns {boolean} */
export function isHotbarModeEnabled() {
  return hotbarModeEnabled;
}

/**
 * @param {import('@minecraft/server').Player} player
 * @returns {0|1}
 */
export function getHotbarState(player) {
  try {
    if (player?.hasTag?.(HOTBAR_STATE_TAG_1)) return 1;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * @param {import('@minecraft/server').Player} player
 * @param {0|1} state
 */
export function setHotbarState(player, state) {
  system.run(() => {
    if (!player?.addTag || !player?.removeTag) return;
    // Normalize
    const normalized = state === 1 ? 1 : 0;

    // Keep tags mutually exclusive
    player.removeTag(HOTBAR_STATE_TAG_1);
    player.removeTag(HOTBAR_STATE_TAG_0);

    player.addTag(normalized === 1 ? HOTBAR_STATE_TAG_1 : HOTBAR_STATE_TAG_0);
  });
}

/**
 * Applies a hotbar preset by exact config key name.
 * - Requires stash state == true (inventoryStasher)
 * - Clears missing slots to air
 * - Sets hotbar state to 1 after successful apply
 *
 * Preset format supported (current config):
 *   hotbarPresets[presetKey] = { "namespace:item": slotIndex, ... }
 *
 * @param {import('@minecraft/server').Player} player
 * @param {string} presetKey e.g. "toolboxOpened"
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function applyHotbarPreset(player, presetKey) {
  if (!hotbarModeEnabled) return { ok: false, reason: "hotbar_mode_disabled" };
  if (!player) return { ok: false, reason: "no_player" };

  // This is the required gate: if stash isn't true, do not allow hotbar changes.
  // If stash is not found (tag missing), this also blocks changes.
  if (!isStashActive(player)) return { ok: false, reason: "stash_not_active" };

  if (typeof presetKey !== "string" || presetKey.length === 0) {
    return { ok: false, reason: "invalid_preset_key" };
  }

  const presets = config?.hotbarPresets;
  if (!presets || typeof presets !== "object") {
    return { ok: false, reason: "missing_hotbar_presets" };
  }

  // Key must match exactly as written in config (e.g. toolboxOpened)
  const preset = presets[presetKey];
  if (!preset || typeof preset !== "object") {
    return { ok: false, reason: "preset_not_found" };
  }

  const inventory = player.getComponent?.("minecraft:inventory");
  const container = inventory?.container;
  if (!container) return { ok: false, reason: "no_inventory_container" };

  /** @type {Array<string|undefined>} */
  const slotToItemId = new Array(HOTBAR_SIZE).fill(undefined);

  for (const [itemId, slot] of Object.entries(preset)) {
    const slotIndex = Number(slot);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= HOTBAR_SIZE) continue;
    if (typeof itemId !== "string" || itemId.length === 0) continue;
    slotToItemId[slotIndex] = itemId;
  }

  try {
    for (let slotIndex = 0; slotIndex < HOTBAR_SIZE; slotIndex++) {
      const itemId = slotToItemId[slotIndex];
      if (!itemId) {
        // "air" => empty slot
        container.setItem(slotIndex, undefined);
        continue;
      }

      const stack = new ItemStack(itemId, 1);
      container.setItem(slotIndex, stack);
    }

    setHotbarState(player, 1);
    return { ok: true };
  } catch (e) {
    try {
      console.error("applyHotbarPreset failed:", e);
    } catch {}
    return { ok: false, reason: "exception" };
  }
}

/**
 * Convenience helper to clear hotbar to air (0..8) and set state to 0.
 * This does not require stash (useful for admin cleanup or future features).
 *
 * @param {import('@minecraft/server').Player} player
 */
export function clearHotbar(player) {
  const inventory = player?.getComponent?.("minecraft:inventory");
  const container = inventory?.container;
  if (!container) return;

  for (let slotIndex = 0; slotIndex < HOTBAR_SIZE; slotIndex++) {
    container.setItem(slotIndex, undefined);
  }
  setHotbarState(player, 0);
}
