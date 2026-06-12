import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/http";

export const useSessionStore = defineStore("session", () => {
  /** null = unknown (not yet checked). */
  const authenticated = ref<boolean | null>(null);
  const username = ref<string | null>(null);
  const isAdmin = ref(false);

  function apply(info: { authenticated: boolean; username?: string; isAdmin?: boolean }): void {
    authenticated.value = info.authenticated;
    username.value = info.authenticated ? (info.username ?? null) : null;
    isAdmin.value = info.authenticated ? !!info.isAdmin : false;
  }

  async function check(): Promise<void> {
    try {
      apply(await api.session());
    } catch {
      apply({ authenticated: false });
    }
  }

  async function login(name: string, password: string, deviceName?: string): Promise<void> {
    const res = await api.login(name, password, deviceName);
    apply({ authenticated: true, username: res.username, isAdmin: res.isAdmin });
  }

  /** Adopt the session minted by accepting an invitation (already logged in server-side). */
  function adopt(res: { username: string; isAdmin: boolean }): void {
    apply({ authenticated: true, username: res.username, isAdmin: res.isAdmin });
  }

  async function logout(): Promise<void> {
    try {
      await api.logout();
    } finally {
      apply({ authenticated: false });
    }
  }

  return { authenticated, username, isAdmin, check, login, adopt, logout };
});
