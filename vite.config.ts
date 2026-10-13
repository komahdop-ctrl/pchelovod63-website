import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        event: resolve(import.meta.dirname, 'events/druzhba-2026.html'),
        apiaries: resolve(import.meta.dirname, 'apiaries/index.html'),
        hutorok: resolve(import.meta.dirname, 'apiaries/hutorok.html'),
        documents: resolve(import.meta.dirname, 'documents/index.html'),
        registration: resolve(import.meta.dirname, 'documents/registration.html'),
        transport: resolve(import.meta.dirname, 'documents/transport.html'),
        poisoning: resolve(import.meta.dirname, 'documents/poisoning.html'),
      },
    },
  },
})
