# D&D Combat Manager (Vite + React)

Deployable on GitHub Pages.

## Local dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy to GitHub Pages
1. **Set the base path** in `vite.config.ts` to your repo name:
   ```ts
   export default defineConfig({ base: '/YOUR_REPO_NAME/' })
   ```
2. Commit & push to the `main` branch. The GitHub Actions workflow will build and publish to Pages automatically.
3. In your repo settings, enable **Pages** and set the **Build and deployment** source to **GitHub Actions** if not already.

> If you use a custom domain, set `base: '/'`.