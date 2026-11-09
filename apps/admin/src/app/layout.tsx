import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../lib/query-provider';
import { NavigationShell } from '../components/navigation-shell';

export const metadata: Metadata = {
  title: 'Workforce Geospatial Attendance — Admin Portal',
  description: 'Enterprise geofenced attendance, worksites, and compliance auditing portal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          <NavigationShell>{children}</NavigationShell>
        </QueryProvider>
      </body>
    </html>
  );
}
