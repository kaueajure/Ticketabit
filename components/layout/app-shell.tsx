"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, LogOut, NotebookPen, Plus, Search, Settings, Ticket, UserRound } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Avatar } from "@/components/ui/avatar";
import { Toast } from "@/components/ui/toast";
import { TicketFormModal } from "@/components/tickets/ticket-form-modal";
import { TicketDrawer } from "@/components/tickets/ticket-drawer";

const nav = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/anotacoes", label: "Anotações", icon: NotebookPen },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, loadError, reloadData, openNewTicket, globalSearch, setGlobalSearch } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);

  useEffect(() => {
    setDockVisible(window.localStorage.getItem("ticketabit:dock-visible") !== "false");
  }, []);

  const changeDockVisibility = (visible: boolean) => {
    setDockVisible(visible);
    window.localStorage.setItem("ticketabit:dock-visible", String(visible));
  };

  const onSearch = (value: string) => {
    setGlobalSearch(value);
    if (value && pathname !== "/tickets") router.push("/tickets");
  };

  if (pathname === "/login") return <>{children}</>;

  if (loading || !currentUser) {
    return <div className="app-loading"><span className="brand-mark"><Ticket size={18}/></span>{loadError ? <><h1>Não foi possível carregar o Ticketabit</h1><p>{loadError}</p><button className="primary-button" onClick={() => void reloadData()}>Tentar novamente</button></> : <><i/><p>Conectando ao banco de dados...</p></>}</div>;
  }

  return (
    <div className={`app-shell ${dockVisible ? "" : "dock-hidden"}`}>
      <div className="app-content">
        <header className="topbar">
          <Link href="/" className="topbar-brand" aria-label="Ir para o dashboard">
            <span className="brand-mark"><Ticket size={16} strokeWidth={2.25} /></span>
            <strong>Ticketabit</strong>
          </Link>
          <label className="global-search">
            <Search size={16} />
            <input value={globalSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Pesquisar tickets..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="primary-button new-ticket-button" onClick={openNewTicket}><Plus size={16} />Novo ticket</button>
            <div className="topbar-profile">
              <button className="header-avatar" onClick={() => setProfileOpen(!profileOpen)} aria-label="Abrir perfil" aria-expanded={profileOpen}><Avatar name={currentUser.name} photoUrl={currentUser.avatarUrl} /></button>
              {profileOpen && (
                <div className="profile-popover">
                  <div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div>
                  <Link href="/conta" onClick={() => setProfileOpen(false)}><UserRound size={14} /> Configurações da conta</Link>
                  <Link href="/configuracoes" onClick={() => setProfileOpen(false)}><Settings size={14} /> Configurações</Link>
                  <form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={14} /> Sair</button></form>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={`main-content ${pathname.startsWith("/tickets") ? "tickets-main" : pathname.startsWith("/anotacoes") ? "notes-main" : ""}`}>{children}</main>
      </div>
      {dockVisible ? (
        <nav className="bottom-dock" aria-label="Navegação principal">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link href={href} key={href} className={`dock-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button className="dock-visibility-toggle" onClick={() => changeDockVisibility(false)} aria-label="Esconder barra de navegação" title="Esconder barra">
            <ChevronDown size={17} />
          </button>
        </nav>
      ) : (
        <button className="dock-show-button" onClick={() => changeDockVisibility(true)} aria-label="Mostrar barra de navegação" title="Mostrar barra de navegação">
          <ChevronUp size={17} />
          <span>Mostrar navegação</span>
        </button>
      )}
      <button className="mobile-new-ticket" onClick={openNewTicket} aria-label="Novo ticket"><Plus size={23} /></button>
      <TicketFormModal />
      <TicketDrawer />
      <Toast />
    </div>
  );
}
