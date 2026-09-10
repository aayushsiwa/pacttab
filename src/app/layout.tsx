import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaProvider } from "@/components/pwa-provider";
import { getCurrentUser } from "@/lib/auth";
import { getUserPendingAdminActionsCount } from "@/lib/queries";
import { Navbar } from "@/components/navbar";
import { OfflineBanner } from "@/components/offline-banner";
import { Toaster } from "@/components/ui/sonner";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PactTab — Private Group Expenses & Chat",
  description: "A privacy-first progressive web app for small groups to chat, track shared expenses, and settle balances without emails or phone numbers.",
  manifest: "/manifest.json",
  applicationName: "PactTab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PactTab",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const pendingAdminActionsCount = user ? await getUserPendingAdminActionsCount(user.id) : 0;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PwaProvider>
            <OfflineBanner />
            <Navbar user={user} pendingAdminActionsCount={pendingAdminActionsCount} />
            <main className="flex-1">{children}</main>
            <Toaster position="top-center" richColors />
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
