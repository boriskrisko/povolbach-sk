import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "povolbach.sk — Efektívnosť čerpania európskych fondov na Slovensku",
  description: "Zistite, ako efektívne vaša obec čerpá európske fondy. Prehľad čerpania EÚ fondov pre všetky obce a mestá na Slovensku.",
  openGraph: {
    title: "povolbach.sk",
    description: "Efektívnosť čerpania európskych fondov na Slovensku",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
