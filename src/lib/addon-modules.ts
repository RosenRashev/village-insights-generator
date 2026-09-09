export type AddonModule = {
  id: string;
  label: string;
  info: string;
  icon?: string; // reuse на съществуващите икони в ModuleCard по id
};

export const ADDON_MODULES: AddonModule[] = [];
