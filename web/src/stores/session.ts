import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/http";

export const useSessionStore = defineStore("session", () => {
  /** null = unknown (not yet checked). */
  const authenticated = ref<boolean | null>(null);

  async function check(): Promise<void> {
    try {
      authenticated.value = (await api.session()).authenticated;
    } catch {
      authenticated.value = false;
    }
  }

  async function login(password: string, deviceName?: string): Promise<void> {
    await api.login(password, deviceName);
    authenticated.value = true;
  }

  async function logout(): Promise<void> {
    try {
      await api.logout();
    } finally {
      authenticated.value = false;
    }
  }

  return { authenticated, check, login, logout };
});
