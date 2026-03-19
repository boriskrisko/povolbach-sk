import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://povolbach.sk"),
  title: "povolbach.sk — Efektívnosť čerpania európskych fondov na Slovensku",
  description: "Zistite, ako efektívne vaša obec čerpá európske fondy. Prehľad čerpania EÚ fondov pre všetky obce a mestá na Slovensku.",
  openGraph: {
    title: "povolbach.sk",
    description: "Efektívnosť čerpania európskych fondov na Slovensku",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
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
