import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { initSync, isReady } from "@/sync/service";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
    { path: "/", name: "lists", component: () => import("@/views/ListsView.vue") },
    { path: "/lists/:id", name: "list", component: () => import("@/views/ListView.vue"), props: true },
    { path: "/lists/:id/shop", name: "shop", component: () => import("@/views/ShoppingView.vue"), props: true },
    { path: "/settings", name: "settings", component: () => import("@/views/SettingsView.vue") },
    { path: "/settings/categories", name: "categories", component: () => import("@/views/CategoriesView.vue") },
    { path: "/settings/catalog", name: "catalog", component: () => import("@/views/CatalogView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (session.authenticated === null) await session.check();

  if (!to.meta.public && !session.authenticated) return { name: "login" };
  if (to.name === "login" && session.authenticated) return { name: "lists" };

  // Ensure the sync engine is up before any authenticated view mounts (so
  // mutations can rely on the shared clock).
  if (session.authenticated && !to.meta.public && !isReady()) {
    const sync = useSyncStore();
    await initSync((s) => sync.set(s));
  }
  return true;
});
