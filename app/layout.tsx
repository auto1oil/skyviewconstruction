import './globals.css';
import type { Metadata, Viewport } from 'next';
import LocationReporter from '@/components/LocationReporter';

export const metadata: Metadata = {
  title: 'Skyview Construction Time Clock',
  description: 'Clock in and out, track hours, and manage job sites.',
  appleWebApp: {
    capable: true,
    title: 'Skyview Time Clock',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1E3A8A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Reports GPS only while the signed-in user is clocked in. */}
        <LocationReporter />
        {children}
      </body>
    </html>
  );
}
