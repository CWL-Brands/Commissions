import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import AppShell from '@/components/templates/AppShell';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kanva Commission Calculator',
  description: 'Sales commission tracking and calculation for Kanva Botanicals',
  icons: {
    icon: '/icon.svg',
  },
};

// Force dynamic rendering for all pages (no static generation)
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#363636',
              boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.1), 0 2px 4px -1px rgba(34, 197, 94, 0.06)'
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        {/* Copper SDK Script - Only in iframe */}
        {typeof window !== 'undefined' && window.self !== window.top && (
          <Script
            src={process.env.NEXT_PUBLIC_COPPER_SDK_URL || 'https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js'}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
