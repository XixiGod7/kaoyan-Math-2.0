import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/english-app/',plugins:[react(),tailwind()],publicDir:false,build:{outDir:'../../public/english-app',emptyOutDir:true}});
