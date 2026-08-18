"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { BarChart3, ChevronDown, CircleHelp, LogOut, Menu, Plus, Search, Settings, Ticket, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Avatar } from "@/components/ui/avatar";
import { Toast } from "@/components/ui/toast";
import { TicketFormModal } from "@/components/tickets/ticket-form-modal";
import { TicketDrawer } from "@/components/tickets/ticket-drawer";

const nav = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, loadError, reloadData, openNewTicket, globalSearch, setGlobalSearch } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const onSearch = (value: string) => {
    setGlobalSearch(value);
    if (value && pathname !== "/tickets") router.push("/tickets");
  };

  if (pathname === "/login") return <>{children}</>;

  if (loading || !currentUser) {
    return <div className="app-loading"><span className="brand-mark"><Ticket size={18}/></span>{loadError ? <><h1>Não foi possível carregar o Ticketabit</h1><p>{loadError}</p><button className="primary-button" onClick={() => void reloadData()}>Tentar novamente</button></> : <><i/><p>Conectando ao banco de dados...</p></>}</div>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-mark"><Ticket size={17} strokeWidth={2.25} /></span>
            <span>Ticketabit</span>
          </Link>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <span className="nav-label">Workspace</span>
          {nav.filter((item) => item.href !== "/configuracoes" || currentUser.role === "Administrador").map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link href={href} key={href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
                {label === "Tickets" && <span className="nav-shortcut">T</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item help-item"><CircleHelp size={17} /><span>Ajuda e suporte</span></button>
          <button className="profile-card" onClick={() => setProfileOpen(!profileOpen)}>
            <Avatar name={currentUser.name} />
            <span className="profile-copy"><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div>
              <Link href="/configuracoes"><Settings size={14} /> Configurações da conta</Link>
              <form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={14} /> Sair</button></form>
            </div>
          )}
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
      <div className="app-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="mobile-brand"><span className="brand-mark"><Ticket size={15} /></span>Ticketabit</div>
          <label className="global-search">
            <Search size={16} />
            <input value={globalSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Pesquisar tickets..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="primary-button new-ticket-button" onClick={openNewTicket}><Plus size={16} />Novo ticket</button>
            <button className="header-avatar" onClick={() => setProfileOpen(!profileOpen)} aria-label="Abrir perfil"><Avatar name={currentUser.name} /></button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
      <button className="mobile-new-ticket" onClick={openNewTicket} aria-label="Novo ticket"><Plus size={23} /></button>
      <TicketFormModal />
      <TicketDrawer />
      <Toast />
    </div>
  );
}
