import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mood.chele.bi"),
  applicationName: "mood",
  title: {
    default: "mood — Ege Chelebi",
    template: "%s · mood",
  },
  description:
    "An infinite plane of design reference from the designers, studios and galleries worth keeping.",
  authors: [{ name: "Ege Chelebi", url: "https://www.chele.bi/about" }],
  creator: "Ege Chelebi",
  publisher: "Ege Chelebi",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon.png?v=3", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "mood — Ege Chelebi",
    description:
      "An infinite plane of design reference from the designers, studios and galleries worth keeping.",
    siteName: "Ege Chelebi",
    url: "https://mood.chele.bi",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@woosal1337",
    creator: "@woosal1337",
    title: "mood — Ege Chelebi",
    description: "An infinite plane of design reference.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,

  userScalable: false,
};

const themeInit = `try{var t=localStorage.getItem("mood.theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
