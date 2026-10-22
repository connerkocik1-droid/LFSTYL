import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'LFSTYL',
    short_name: 'LFSTYL',
    description: 'Tasks, goals and a per-paycheck budget that all move the same money.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#121018',
    theme_color: '#121018',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the app icon (Android and desktop). On iPhone, use the same links in the Shortcuts app.
    shortcuts: [
      { name: 'Log expense', short_name: 'Expense', url: '/?do=expense', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Pouch +1', short_name: 'Pouch', url: '/?do=pouch', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Add task', short_name: 'Task', url: '/?do=task', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Add income', short_name: 'Income', url: '/?do=income', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
