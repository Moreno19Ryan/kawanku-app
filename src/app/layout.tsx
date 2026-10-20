import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KawanKu",
    template: "%s · KawanKu",
  },
  description:
    "Aplikasi manajemen Desa Kartika Wanasari: database warga, absensi, dan monitoring kegiatan.",
  applicationName: "KawanKu",
  // Ikon tab & iPhone diambil otomatis dari src/app/{favicon.ico,icon.svg,apple-icon.png}.
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "KawanKu",
    description:
      "Database warga, absensi, dan monitoring kegiatan Desa Kartika Wanasari.",
    images: ["/brand/og-image.png"],
    locale: "id_ID",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "KawanKu",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-sans text-fg">{children}</body>
    </html>
  );
}
