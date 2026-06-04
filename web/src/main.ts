import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { router } from "./router";
import "./styles.css";

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);

// Resolve the first route (auth check + sync init in the guard) before mounting,
// to avoid a blank flash and guarantee the engine is ready.
router.isReady().then(() => app.mount("#app"));
