import { system, world } from "@minecraft/server";

/**
 * Known EventBus events and their callback payloads.
 * Add new entries here to get autocomplete for the event name and `data`.
 *
 * @typedef {Object} EventBusEvents
 * @property {import("@minecraft/server").WorldLoadAfterEvent} worldReady
 * @property {import("@minecraft/server").ItemUseBeforeEvent} itemUse
 * @property {import("@minecraft/server").PlayerInteractWithBlockBeforeEvent} playerInteractWithBlock
 * @property {import("@minecraft/server").PlayerBreakBlockBeforeEvent} playerBreakBlock
 * @property {import("@minecraft/server").PlayerInventoryItemChangeAfterEvent} playerInventoryItemChange
 * @property {import("@minecraft/server").PlayerJoinAfterEvent} playerJoin
 * @property {import("@minecraft/server").PlayerLeaveBeforeEvent} playerLeave
 * @property {import("@minecraft/server").EntitySpawnAfterEvent} entitySpawn
 * @property {import("@minecraft/server").PlayerSpawnAfterEvent} playerSpawn
 */

/** @typedef {keyof EventBusEvents} EventBusKnownEventName */
/**
 * Allows known event names (autocomplete) + any custom string events.
 * @typedef {EventBusKnownEventName | (string & {})} EventBusEventName
 */
/** @typedef {(data?: any) => void} EventBusCallback */

class EventBus {
  /** @type {Map<EventBusEventName, Set<EventBusCallback>>} */
  static _listeners = new Map();

  /** @type {Map<EventBusEventName, Map<EventBusCallback, EventBusCallback>>} */
  static _onceWrappers = new Map();

  static _initialized = false;
  static _worldReady = false;
  /** @type {import("@minecraft/server").WorldLoadAfterEvent | undefined} */
  static _worldReadyData = undefined;
  static _minecraftEventsAttached = false;

  /** @type {Array<() => void>} */
  static _minecraftUnsubscribers = [];

  /** @param {EventBusCallback} callback */
  static _safeCall(callback, data) {
    try {
      callback(data);
    } catch (err) {
      try {
        console.error("EventBus listener error:", err);
      } catch {}
    }
  }

  /** @param {EventBusCallback} callback */
  static _callSoon(callback, data) {
    try {
      system.run(() => this._safeCall(callback, data));
    } catch {
      this._safeCall(callback, data);
    }
  }

  static _subscribeSignal(signal, handler) {
    if (!signal || typeof signal.subscribe !== "function") return;
    signal.subscribe(handler);
    if (typeof signal.unsubscribe === "function") {
      this._minecraftUnsubscribers.push(() => {
        try {
          signal.unsubscribe(handler);
        } catch {}
      });
    }
  }

  static _attachDefaultMinecraftEvents() {
    if (this._minecraftEventsAttached) return;
    this._minecraftEventsAttached = true;

    /** @type {Array<{ name: string, signal: any }>} */
    const sources = [
      { name: "itemUse", signal: world.beforeEvents?.itemUse },
      { name: "playerInteractWithBlock", signal: world.beforeEvents?.playerInteractWithBlock },
      { name: "playerBreakBlock", signal: world.beforeEvents?.playerBreakBlock },
      { name: "playerInventoryItemChange", signal: world.afterEvents?.playerInventoryItemChange },
      { name: "playerJoin", signal: world.afterEvents?.playerJoin },
      { name: "playerLeave", signal: world.beforeEvents?.playerLeave },
      { name: "entitySpawn", signal: world.afterEvents?.entitySpawn },
      { name: "playerSpawn", signal: world.afterEvents?.playerSpawn },
    ];

    for (const { name, signal } of sources) {
      const handler = (ev) => this.emit(name, ev);
      this._subscribeSignal(signal, handler);
    }
  }

  static initialize() {
    if (this._initialized) return;
    this._initialized = true;

    world.afterEvents.worldLoad.subscribe((ev) => {
      system.run(() => {
        if (this._worldReady) return;
        this._worldReady = true;
        this._worldReadyData = ev;
        this._attachDefaultMinecraftEvents();
        this.emit("worldReady", ev);
      });
    });
  }

  /**
   * Subscribe to a typed EventBus event.
   * @template {keyof EventBusEvents} K
   * @overload
   * @param {K} event
   * @param {(data: EventBusEvents[K]) => void} callback
   * @returns {() => void} unsubscribe
   */
  /**
   * Subscribe to a custom (untyped) event.
   * @overload
   * @param {string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} unsubscribe
   */
  /**
   * @param {EventBusEventName | string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} unsubscribe
   */
  static on(event, callback) {
    if (typeof event !== "string" || event.length === 0) throw new TypeError("Event name must be a non-empty string");
    if (typeof callback !== "function") throw new TypeError("Callback must be a function");

    if (event === "worldReady" && this._worldReady) {
      this._callSoon(callback, this._worldReadyData);
      return () => {};
    }

    const set = this._listeners.get(event) ?? new Set();
    set.add(callback);
    this._listeners.set(event, set);

    return () => this.off(event, callback);
  }

  /**
   * Subscribe once to a typed EventBus event.
   * @template {keyof EventBusEvents} K
   * @overload
   * @param {K} event
   * @param {(data: EventBusEvents[K]) => void} callback
   * @returns {() => void} unsubscribe
   */
  /**
   * Subscribe once to a custom (untyped) event.
   * @overload
   * @param {string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} unsubscribe
   */
  /**
   * @param {EventBusEventName | string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} unsubscribe
   */
  static once(event, callback) {
    if (typeof event !== "string" || event.length === 0) throw new TypeError("Event name must be a non-empty string");
    if (typeof callback !== "function") throw new TypeError("Callback must be a function");

    if (event === "worldReady" && this._worldReady) {
      this._callSoon(callback, this._worldReadyData);
      return () => {};
    }

    const wrapper = (data) => {
      this.off(event, callback);
      this._safeCall(callback, data);
    };

    const perEvent = this._onceWrappers.get(event) ?? new Map();
    perEvent.set(callback, wrapper);
    this._onceWrappers.set(event, perEvent);

    const set = this._listeners.get(event) ?? new Set();
    set.add(wrapper);
    this._listeners.set(event, set);

    return () => this.off(event, callback);
  }
  /**
   * @param {EventBusEventName | string} event
   * @param {EventBusCallback} [callback]
   */
  static off(event, callback) {
    if (typeof event !== "string" || event.length === 0) throw new TypeError("Event name must be a non-empty string");

    if (callback === undefined) {
      this._listeners.delete(event);
      this._onceWrappers.delete(event);
      return;
    }

    if (typeof callback !== "function") throw new TypeError("Callback must be a function");

    const set = this._listeners.get(event);
    if (!set) return;

    const perEvent = this._onceWrappers.get(event);
    const wrapper = perEvent?.get(callback);
    if (wrapper) {
      set.delete(wrapper);
      perEvent.delete(callback);
      if (perEvent.size === 0) this._onceWrappers.delete(event);
    }

    set.delete(callback);
    if (set.size === 0) this._listeners.delete(event);
  }

  /**
   * Emit a typed EventBus event.
   * @template {keyof EventBusEvents} K
   * @overload
   * @param {K} event
   * @param {EventBusEvents[K]} data
   */
  /**
   * Emit a custom (untyped) event.
   * @overload
   * @param {string} event
   * @param {any} data
   */
  /**
   * @param {EventBusEventName | string} event
   * @param {any} data
   */
  static emit(event, data) {
    if (typeof event !== "string" || event.length === 0) throw new TypeError("Event name must be a non-empty string");
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;

    const snapshot = Array.from(set);
    for (const cb of snapshot) this._safeCall(cb, data);
  }
}
export default EventBus;
EventBus.initialize();
