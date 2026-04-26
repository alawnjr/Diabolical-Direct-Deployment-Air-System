import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'D³AS — Data Driven Distributed Autonomous Systems',
  description: 'SEAD/DEAD Air Defense Wargaming Simulator — SCSP Hackathon 2026',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-mono), monospace' }}>
        {children}
      </body>
    </html>
  );
}
