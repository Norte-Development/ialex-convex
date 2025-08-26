import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          convex: ['convex'],
          ui: ['@radix-ui/react-avatar', '@radix-ui/react-collapsible', '@radix-ui/react-hover-card', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-slot', '@radix-ui/react-tooltip'],
          tiptap: ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
          auth: ['@clerk/clerk-react'],
          routing: ['react-router-dom'],
          utils: ['clsx', 'class-variance-authority', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
  },
  preview: {
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '192.168.1.100','y8kos4kc0wgowocowk8cogg4.31.97.20.213.sslip.io', 'app.ialex.com.ar', 'ialex.com.ar', 'app2.ialex.com.ar', 'nortedev.net', 'app.nortedev.net' ],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'convex'],
  },
});
