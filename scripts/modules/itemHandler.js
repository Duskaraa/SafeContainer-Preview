import { BlockVolume, system, world } from "@minecraft/server";
import { applyHotbarPreset, clearHotbar, isHotbarModeEnabled, setHotbarModeEnabled } from "../utils/hotbarManager";
import EventBus from "../core/eventBus";
import { isStashActive, setStashActive } from "../utils/inventoryStasher";
import config from "../config";

EventBus.on("itemUse", (data) => {
  const player = data?.source;
  const itemTypeId = data?.itemStack?.typeId;
  if (!player || typeof itemTypeId !== "string") return;

  // Fast-path: ignore unrelated items.
  const isClosedToolbox = itemTypeId === config.toolboxTypeId;
  const isOpenToolbox = itemTypeId === config.toolboxOpenedTypeId;
  if (!isClosedToolbox && !isOpenToolbox) return;

  const stashActive = isStashActive(player);
  const hotbarModeEnabled = isHotbarModeEnabled();

  // Cancel the vanilla behavior for the toolbox items.
  data.cancel = true;

  if (isClosedToolbox) {
    // Open: only when currently closed.
    if (stashActive && hotbarModeEnabled) return;

    setStashActive(player, true);
    setHotbarModeEnabled(true);

    // Inventory edits are safer on next tick.
    system.run(() => {
      applyHotbarPreset(player, "toolboxOpened");
    });
    console.log("Toolbox opened for player:", player.name);
    return;
  }

  // Close: only when currently opened.
  if (!stashActive || !hotbarModeEnabled) return;

  setStashActive(player, false);
  setHotbarModeEnabled(false);
  system.run(() => {
    clearHotbar(player);
  });
  console.log("Toolbox closed for player:", player.name);
});

// Mapeo de prueba (vanilla) para no depender de resource packs.
// Solo usa concreto y lana de colores.
const letters = {
  a: "minecraft:white_concrete",
  b: "minecraft:orange_concrete",
  c: "minecraft:magenta_concrete",
  d: "minecraft:light_blue_concrete",
  e: "minecraft:yellow_concrete",
  f: "minecraft:lime_concrete",
  g: "minecraft:pink_concrete",
  h: "minecraft:gray_concrete",
  i: "minecraft:light_gray_concrete",
  j: "minecraft:cyan_concrete",
  k: "minecraft:purple_concrete",
  l: "minecraft:blue_concrete",
  m: "minecraft:brown_concrete",
  n: "minecraft:green_concrete",
  o: "minecraft:red_concrete",
  p: "minecraft:black_concrete",

  q: "minecraft:white_wool",
  r: "minecraft:orange_wool",
  s: "minecraft:magenta_wool",
  t: "minecraft:light_blue_wool",
  u: "minecraft:yellow_wool",
  v: "minecraft:lime_wool",
  w: "minecraft:pink_wool",
  x: "minecraft:gray_wool",
  y: "minecraft:light_gray_wool",
  z: "minecraft:cyan_wool",
};

world.beforeEvents.chatSend.subscribe((ev) => {
  if (!ev.message.startsWith("!")) return;

  ev.cancel = true;

  const player = ev.sender;
  const text = ev.message.slice(1).toLowerCase();
  const dim = player.dimension;

  system.run(() => {
    const x0 = Math.floor(player.location.x);
    const y0 = Math.floor(player.location.y);
    const z0 = Math.floor(player.location.z);
    const len = 1 + text.length;

    player.teleport({ x: x0 + 0.5, y: y0 + len + 2, z: z0 + 0.5 }, { dimension: dim });

    dim.fillBlocks(
      new BlockVolume({ x: x0, y: y0, z: z0 }, { x: x0, y: y0 + len - 1, z: z0 }),
      "minecraft:white_concrete"
    );
    dim.getBlock({ x: x0, y: y0, z: z0 })?.setType("minecraft:yellow_concrete");

    for (let i = 0; i < text.length; i++) {
      const c = text[text.length - 1 - i];
      if (c === " ") continue;
      const b = letters[c];
      if (b) dim.getBlock({ x: x0, y: y0 + 1 + i, z: z0 })?.setType(b);
    }

    player.teleport({ x: x0 + 0.5, y: y0 + len, z: z0 + 0.5 }, { dimension: dim });
  });
});
