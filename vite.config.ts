import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:'/soft-sensor-studio/',build:{rollupOptions:{input:{home:'index.html',editor:'studio.html',research:'research.html',showcase:'showcase.html',threadlines:'threadlines.html'}}},plugins:[react(),tailwindcss()]});
