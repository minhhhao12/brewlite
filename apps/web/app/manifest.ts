import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrewLite – Đặt cà phê không tiền mặt',
    short_name: 'BrewLite',
    description: 'Menu, giỏ hàng và thanh toán đồ uống tại quầy BrewLite.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f1e8',
    theme_color: '#4b2e1f',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
