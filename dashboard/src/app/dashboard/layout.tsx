import Nav from '@/components/Nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8 w-full">
        {children}
      </main>
    </>
  );
}
