import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        // Ye output build ko seedha wwwroot/dist 
        outDir: path.resolve(__dirname, '../wwwroot/dist'),
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: {
                reader: path.resolve(__dirname, 'src/reader.jsx'),
                authorDashboard: path.resolve(__dirname, 'src/authorDashboard.jsx')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        }
    }
});