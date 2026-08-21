import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { AppShell } from "@/components/layout/app-shell";

const staleAssetRecoveryScript = `(function(){
var recoveryKey="ticketabit:asset-recovery";
var recoveryParameter="__ticketabit_reload";
function isNextAsset(value){return typeof value==="string"&&value.indexOf("/_next/static/")!==-1;}
function recover(){
  try{
    var now=Date.now();
    var previousAttempt=Number(sessionStorage.getItem(recoveryKey)||0);
    if(now-previousAttempt<30000)return;
    sessionStorage.setItem(recoveryKey,String(now));
    var url=new URL(window.location.href);
    url.searchParams.set(recoveryParameter,String(now));
    window.location.replace(url.toString());
  }catch(_){window.location.reload();}
}
window.addEventListener("error",function(event){
  var target=event.target;
  if(!target)return;
  var source=target.src||target.href;
  if((target.tagName==="SCRIPT"||target.tagName==="LINK")&&isNextAsset(source))recover();
},true);
window.addEventListener("unhandledrejection",function(event){
  var reason=event.reason;
  var message=String(reason&&(reason.message||reason)||"");
  if(/ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module/i.test(message))recover();
});
window.addEventListener("load",function(){
  window.setTimeout(function(){
    try{
      sessionStorage.removeItem(recoveryKey);
      var url=new URL(window.location.href);
      if(!url.searchParams.has(recoveryParameter))return;
      url.searchParams.delete(recoveryParameter);
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    }catch(_){}
  },3000);
});
})();`;

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
      <head>
        <meta name="ticketabit-extension" content="v1" />
        <script dangerouslySetInnerHTML={{ __html: staleAssetRecoveryScript }} />
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
