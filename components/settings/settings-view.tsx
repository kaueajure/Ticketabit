"use client";

import { FormEvent, useState } from "react";
import { Box, CheckSquare2, Layers3, MoreHorizontal, Plus, Tag, Users, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Avatar } from "@/components/ui/avatar";
import { Category, Stage, SystemItem, User } from "@/lib/types";

type Tab = "systems" | "categories" | "users" | "stages";

const tabs = [
  { id: "systems" as Tab, label: "Sistemas", description: "Produtos vinculados aos tickets", icon: Layers3 },
  { id: "categories" as Tab, label: "Categorias", description: "Tipos de demanda", icon: Tag },
  { id: "users" as Tab, label: "Usuários", description: "Responsáveis e acessos", icon: Users },
  { id: "stages" as Tab, label: "Etapas", description: "Marcadores internos", icon: CheckSquare2 },
];

export function SettingsView() {
  const { systems, categories, users, stages, currentUser, addEntity, updateEntity } = useApp();
  const [tab, setTab] = useState<Tab>("systems");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Administrador" | "Usuário">("Usuário");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const items = tab === "systems" ? systems : tab === "categories" ? categories : tab === "users" ? users : stages;
  const selectedTab = tabs.find((item) => item.id === tab)!;
  const SelectedIcon = selectedTab.icon;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError("");
    let result;
    if (tab === "systems") result = await addEntity(tab, { id: "", name: name.trim(), active: true } as SystemItem);
    if (tab === "categories") result = await addEntity(tab, { id: "", name: name.trim(), color: "slate", active: true } as Category);
    if (tab === "users") result = await addEntity(tab, { id: "", name: name.trim(), email: extra.trim(), role, active: true } as User, password);
    if (tab === "stages") result = await addEntity(tab, { id: "", name: name.trim(), abbreviation: (extra.trim() || name[0]).slice(0, 2).toUpperCase(), position: stages.length + 1, active: true } as Stage);
    setSaving(false);
    if (!result?.ok) { setFormError(result?.error ?? "Não foi possível adicionar."); return; }
    setName(""); setExtra(""); setPassword(""); setRole("Usuário"); setAddOpen(false);
  };

  if (currentUser?.role !== "Administrador") return <div className="page"><div className="empty-state"><h3>Acesso restrito</h3><p>Somente administradores podem acessar as configurações.</p></div></div>;

  return (
    <div className="page settings-page">
      <div className="page-title-row"><div><div className="page-kicker">ADMINISTRAÇÃO</div><h1>Configurações</h1><p>Gerencie os dados básicos usados no Ticketabit.</p></div></div>
      <div className="settings-layout">
        <aside className="settings-nav">{tabs.map(({ id, label, description, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span><Icon size={17}/></span><div><strong>{label}</strong><small>{description}</small></div></button>)}</aside>
        <section className="settings-panel">
          <div className="settings-heading"><div><span className="settings-title-icon"><SelectedIcon size={18}/></span><div><h2>{selectedTab.label}</h2><p>{selectedTab.description}</p></div></div><button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={15}/>Adicionar</button></div>
          <div className="settings-table-head"><span>Nome</span><span>{tab === "users" ? "Perfil" : tab === "stages" ? "Abreviação" : "Status"}</span><span>Ações</span></div>
          <div className="settings-list">
            {items.map((rawItem) => {
              const item = rawItem as SystemItem & Category & User & Stage;
              return <div key={item.id} className={!item.active ? "inactive" : ""}>
                <span className="settings-name">{tab === "users" ? <Avatar name={item.name} size="sm"/> : tab === "categories" ? <i className={`category-color category-${item.color}`}/> : tab === "stages" ? <b className="stage-abbr">{item.abbreviation}</b> : <span className="system-icon"><Box size={14}/></span>}<span><strong>{item.name}</strong>{tab === "users" && <small>{item.email}</small>}</span></span>
                <span>{tab === "users" ? <span className="role-badge">{item.role}</span> : tab === "stages" ? item.abbreviation : <span className={`active-badge ${item.active ? "" : "disabled"}`}><i/>{item.active ? "Ativo" : "Inativo"}</span>}</span>
                <span className="settings-actions"><button className={`toggle ${item.active ? "on" : ""}`} onClick={() => void updateEntity(tab, item.id, { active: !item.active })} aria-label={item.active ? "Desativar" : "Ativar"}><i/></button><button className="icon-button"><MoreHorizontal size={17}/></button></span>
              </div>;
            })}
          </div>
          <div className="settings-footer"><span>{items.filter((item) => item.active).length} de {items.length} {selectedTab.label.toLowerCase()} ativos</span></div>
        </section>
      </div>
      {addOpen && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setAddOpen(false)}/><form className="small-modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">Configurações</span><h2>Adicionar {selectedTab.label.toLowerCase().slice(0, -1)}</h2></div><button type="button" className="icon-button" onClick={() => setAddOpen(false)}><X size={18}/></button></div><div className="modal-body settings-form-body"><label className="form-field"><span>Nome</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o nome"/></label>{tab === "users" && <><label className="form-field"><span>E-mail</span><input required type="email" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="nome@empresa.com"/></label><label className="form-field"><span>Senha inicial</span><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/></label><label className="form-field"><span>Perfil</span><select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option>Usuário</option><option>Administrador</option></select></label></>}{tab === "stages" && <label className="form-field"><span>Abreviação</span><input maxLength={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: T"/></label>}{formError && <p className="form-error">{formError}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Adicionando..." : "Adicionar"}</button></div></form></div>}
    </div>
  );
}
