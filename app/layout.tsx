import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'School OS — AI Platform',
  description: 'AI-first school operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
