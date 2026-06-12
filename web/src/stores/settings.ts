import { defineStore } from "pinia";
import { ref } from "vue";
import { type AppLocale, currentLocale, setLocale } from "@/i18n";

export type ListLayout = "list" | "grid";

function readLayout(): ListLayout {
  try {
    return localStorage.getItem("listo.layout") === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const locale = ref<AppLocale>(currentLocale());
  const layout = ref<ListLayout>(readLayout());

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

  return { locale, layout, changeLocale, setLayout, toggleLayout };
});
