import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: Replace REPO_NAME below with your GitHub repo name (case-sensitive), e.g. 'dnd-combat-manager'
export default defineConfig({
  plugins: [react()],
  base: '/dnd-combat-manager/'
})