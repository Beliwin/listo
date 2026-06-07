import { defineStore } from "pinia";
import { ref } from "vue";
import { type AppLocale, currentLocale, setLocale } from "@/i18n";

export type ListLayout = "list" | "grid";

function readDeviceName(): string {
  try {
    return localStorage.getItem("listo.deviceName") ?? "";
  } catch {
    return "";
  }
}

function readLayout(): ListLayout {
  try {
    return localStorage.getItem("listo.layout") === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const deviceName = ref(readDeviceName());
  const locale = ref<AppLocale>(currentLocale());
  const layout = ref<ListLayout>(readLayout());

  function setDeviceName(name: string): void {
    deviceName.value = name;
    try {
      localStorage.setItem("listo.deviceName", name);
    } catch {
      /* ignore */
    }
  }

  function changeLocale(next: AppLocale): void {
    locale.value = next;
    setLocale(next);
  }

  function setLayout(next: ListLayout): void {
    layout.value = next;
    try {
      localStorage.setItem("listo.layout", next);
    } catch {
      /* ignore */
    }
  }

  function toggleLayout(): void {
    setLayout(layout.value === "grid" ? "list" : "grid");
  }

  return { deviceName, locale, layout, setDeviceName, changeLocale, setLayout, toggleLayout };
});
