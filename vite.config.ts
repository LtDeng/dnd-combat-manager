import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// IMPORTANT: Replace REPO_NAME below with your GitHub repo name (case-sensitive), e.g. 'dnd-combat-manager'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/dnd-combat-manager/',
});
