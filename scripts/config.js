const config = {
  addonName: "SafeContainer Preview",
  addonVersion: "1.0.0",
  mcVersion: "1.20.130+",
  hotbarModeEnabled: true,
  toolboxTypeId: "source:toolbox_closed",
  toolboxOpenedTypeId: "source:toolbox_open",
  items: {
    "source:toolbox_closed": "textures/items/toolbox_closed",
    "source:toolbox_open": "textures/items/toolbox_open",
    "source:selector_wand": "textures/items/selector_wand",
    "source:inspect": "textures/items/inspect",
    "source:settings": "textures/items/settings",
  },
  hotbarPresets: {
    toolboxOpened: {
      "source:toolbox_open": 0,
      "source:selector_wand": 4,
      "source:inspect": 5,
      "source:settings": 8,
    },
  },
};

export default config;
