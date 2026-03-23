import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://povolbach.sk"),
  title: "povolbach.sk — Efektívnosť čerpania európskych fondov na Slovensku",
  description: "Zistite, ako efektívne vaša obec čerpá európske fondy. 2 926 obcí, 3.32 mld. €, obdobie 2014–2027.",
  openGraph: {
    title: "povolbach.sk — Efektívnosť čerpania európskych fondov na Slovensku",
    description: "Zistite, ako efektívne vaša obec čerpá európske fondy. 2 926 obcí, 3.32 mld. €, obdobie 2014–2027.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
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
