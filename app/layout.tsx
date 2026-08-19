import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { AppShell } from "@/components/layout/app-shell";

const initializeTheme = `(function(){try{var theme=localStorage.getItem("ticketabit:theme");if(theme!=="dark"&&theme!=="light")theme="light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(_){document.documentElement.dataset.theme="light";}})();`;

export const metadata: Metadata = {
  title: "Ticketabit — Gestão de tickets",
  description: "Sistema simples e eficiente de gestão de tickets.",
  icons: {
    icon: [
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icons/icon-32.png",
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><meta name="ticketabit-extension" content="v1" /><script dangerouslySetInnerHTML={{ __html: initializeTheme }} /></head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
