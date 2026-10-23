import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';

import { Providers } from '@/app/providers';
import './globals.css';

// Poppins is not a variable font, so every weight is listed explicitly;
// anything not here would be synthesised by the browser rather than fail
// visibly. 700 stays declared for the rare real bold — an unused @font-face
// is never downloaded, so keeping it available costs nothing.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Weming',
  description: 'A one-line diary that assembles itself.',
  // Installed on a phone it is an app, so it gets an app's name and an
  // app's status bar rather than a browser's.
  appleWebApp: { capable: true, title: 'Weming', statusBarStyle: 'default' },
  icons: { apple: '/apple-touch-icon.png' },
  // Next emits only the modern `mobile-web-app-capable`. iOS before 16.4 reads
  // the Apple-prefixed name and nothing else, and 16.4+ ignores it in favour
  // of the manifest — so carrying both costs one tag and covers both.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

/**
 * `viewportFit: 'cover'` is load-bearing, not polish: the tab bar, the bottom
 * sheets and the Lanes strip all pad themselves with `env(safe-area-inset-*)`,
 * and those resolve to 0 under the default viewport. Without this the bar sits
 * under the home indicator on a notched phone and every sheet's last control
 * is half unreachable.
 *
 * Zoom is left alone. Pinching out of a small time label is the kind of thing
 * a diary has to allow.
 *
 * The status bar is white, not #0507C9. Law 5 gives a solid #0507C9 *content*
 * surface one meaning — a live session — and the status bar is always there,
 * so tinting it would claim the app is running something whenever it is open.
 * It is also the app's own ground, which is what makes the bar disappear into
 * the page instead of sitting on top of it as a band.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
