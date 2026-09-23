import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { APP_NAME } from "@revivenotes/shared";
import { AppToaster } from "@/components/app-toaster";
import { LocaleProvider } from "@/components/locale-provider";
import { LocaleScript } from "@/components/locale-script";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "ReviveNotes — bring your notes back",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <LocaleScript />
      </head>
      <body className={ibmPlexArabic.className}>
        <ThemeProvider>
          <LocaleProvider>
            <QueryProvider>
              {children}
              <AppToaster />
            </QueryProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
