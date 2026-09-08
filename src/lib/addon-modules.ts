export type AddonModule = {
  id: string;
  label: string;
  info: string;
  icon?: string; // reuse на съществуващите икони в ModuleCard по id
};

export const ADDON_MODULES: AddonModule[] = [
  {
    id: "onsite-checklist",
    label: "Чек-лист за личен оглед на място",
    info: "Добавя практически списък с точки за проверка по време на физическия оглед на имота — неща, които AI няма как да знае.",
  },
];
