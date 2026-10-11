import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // shared/sim_config.json lives one level above frontend/, so the dev
    // server needs permission to serve files from the repo root.
    fs: { allow: [".."] },
  },
});
