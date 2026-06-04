import { defineStore } from "pinia";
import { ref } from "vue";
import { type AppLocale, currentLocale, setLocale } from "@/i18n";

function readDeviceName(): string {
  try {
    return localStorage.getItem("listo.deviceName") ?? "";
  } catch {
    return "";
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const deviceName = ref(readDeviceName());
  const locale = ref<AppLocale>(currentLocale());

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

  return { deviceName, locale, setDeviceName, changeLocale };
});
