import type { Metadata, Viewport } from 'next';
import { RegisterServiceWorker } from '@/components/register-service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrewLite – Đặt cà phê không tiền mặt',
  description: 'Đặt đồ uống, chọn size/topping và thanh toán trực tuyến tại quầy BrewLite.',
  applicationName: 'BrewLite',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BrewLite',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4b2e1f',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
