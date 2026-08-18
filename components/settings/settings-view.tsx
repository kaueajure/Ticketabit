"use client";

import { FormEvent, useState } from "react";
import { Box, CircleDot, Layers3, Pencil, Plus, Tag, Users, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Category, StatusColor, StatusDefinition, SystemItem, User } from "@/lib/types";

type Tab = "systems" | "categories" | "statuses" | "users";
type EditableItem = SystemItem | Category | StatusDefinition | User;

const tabs = [
  { id: "systems" as Tab, label: "Sistemas", description: "Produtos vinculados aos tickets", icon: Layers3 },
  { id: "categories" as Tab, label: "Categorias", description: "Tipos de demanda", icon: Tag },
  { id: "statuses" as Tab, label: "Status", description: "Fluxo e situação dos tickets", icon: CircleDot },
  { id: "users" as Tab, label: "Usuários", description: "Responsáveis e acessos", icon: Users },
];

export function SettingsView() {
  const { systems, categories, statuses, users, addEntity, updateEntity } = useApp();
  const [tab, setTab] = useState<Tab>("systems");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [password, setPassword] = useState("");
  const [statusColor, setStatusColor] = useState<StatusColor>("neutral");
  const [categoryColor, setCategoryColor] = useState<Category["color"]>("slate");
  const [isFinal, setIsFinal] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const items = tab === "systems" ? systems : tab === "categories" ? categories : tab === "statuses" ? statuses : users;
  const selectedTab = tabs.find((item) => item.id === tab)!;
  const SelectedIcon = selectedTab.icon;

  const resetForm = () => {
    setName(""); setExtra(""); setPassword(""); setStatusColor("neutral"); setCategoryColor("slate"); setIsFinal(false); setEditingItem(null); setFormError("");
  };

  const openCreate = () => { resetForm(); setAddOpen(true); };
  const openEdit = (item: EditableItem) => {
    resetForm();
    setEditingItem(item);
    setName(item.name);
    if (tab === "categories") setCategoryColor((item as Category).color);
    if (tab === "statuses") {
      const status = item as StatusDefinition;
      setStatusColor(status.color);
      setIsFinal(status.isFinal);
    }
    if (tab === "users") setExtra((item as User).email);
    setAddOpen(true);
  };
  const closeModal = () => { setAddOpen(false); resetForm(); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError("");
    let result;
    if (editingItem) {
      if (tab === "systems") result = await updateEntity(tab, editingItem.id, { name: name.trim() });
      if (tab === "categories") result = await updateEntity(tab, editingItem.id, { name: name.trim(), color: categoryColor });
      if (tab === "statuses") result = await updateEntity(tab, editingItem.id, { name: name.trim(), color: statusColor, isFinal });
      if (tab === "users") result = await updateEntity(tab, editingItem.id, { name: name.trim(), email: extra.trim(), ...(password ? { password } : {}) });
    } else {
      if (tab === "systems") result = await addEntity(tab, { id: "", name: name.trim(), active: true } as SystemItem);
      if (tab === "categories") result = await addEntity(tab, { id: "", name: name.trim(), color: categoryColor, active: true } as Category);
      if (tab === "statuses") result = await addEntity(tab, { id: "", name: name.trim(), color: statusColor, position: statuses.length + 1, active: true, isFinal } as StatusDefinition);
      if (tab === "users") result = await addEntity(tab, { id: "", name: name.trim(), email: extra.trim(), active: true, avatarUrl: null } as User, password);
    }
    setSaving(false);
    if (!result?.ok) { setFormError(result?.error ?? "Não foi possível adicionar."); return; }
    closeModal();
  };

  return (
    <div className="page settings-page">
      <PageHeader eyebrow="SISTEMA" title="Configurações" description="Gerencie os dados básicos usados no Ticketabit." />
      <div className="settings-layout">
        <aside className="settings-nav">{tabs.map(({ id, label, description, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span><Icon size={17}/></span><div><strong>{label}</strong><small>{description}</small></div></button>)}</aside>
        <section className="settings-panel">
          <div className="settings-heading"><div><span className="settings-title-icon"><SelectedIcon size={18}/></span><div><h2>{selectedTab.label}</h2><p>{selectedTab.description}</p></div></div><button className="primary-button" onClick={openCreate}><Plus size={15}/>Adicionar</button></div>
          <div className="settings-table-head"><span>Nome</span><span>{tab === "statuses" ? "Exibição" : "Status"}</span><span>Ações</span></div>
          <div className="settings-list">
            {!items.length && <div className="settings-empty"><strong>Nenhum item cadastrado</strong><span>Use “Adicionar” para incluir o primeiro item.</span></div>}
            {items.map((rawItem) => {
              const item = rawItem as SystemItem & Category & User & StatusDefinition;
              return <div key={item.id} className={!item.active ? "inactive" : ""}>
                <span className="settings-name">{tab === "users" ? <Avatar name={item.name} photoUrl={item.avatarUrl} size="sm"/> : tab === "categories" ? <i className={`category-color category-${item.color}`}/> : tab === "statuses" ? <CircleDot size={16} className="status-setting-icon"/> : <span className="system-icon"><Box size={14}/></span>}<span><strong>{item.name}</strong>{tab === "users" && <small>{item.email}</small>}{tab === "statuses" && item.isFinal && <small>Status de conclusão</small>}</span></span>
                <span>{tab === "statuses" ? <StatusBadge status={item.name} color={item.color as StatusColor}/> : <span className={`active-badge ${item.active ? "" : "disabled"}`}><i/>{item.active ? "Ativo" : "Inativo"}</span>}</span>
                <span className="settings-actions"><button className={`toggle ${item.active ? "on" : ""}`} onClick={() => void updateEntity(tab, item.id, { active: !item.active })} aria-label={item.active ? "Desativar" : "Ativar"}><i/></button><button className="icon-button" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Pencil size={14}/></button></span>
              </div>;
            })}
          </div>
          <div className="settings-footer"><span>{items.filter((item) => item.active).length} de {items.length} {selectedTab.label.toLowerCase()} ativos</span></div>
        </section>
      </div>
      {addOpen && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={closeModal}/><form className="small-modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">Configurações</span><h2>{editingItem ? `Editar ${tab === "statuses" ? "status" : selectedTab.label.toLowerCase().slice(0, -1)}` : `Adicionar ${tab === "statuses" ? "status" : selectedTab.label.toLowerCase().slice(0, -1)}`}</h2></div><button type="button" className="icon-button" onClick={closeModal}><X size={18}/></button></div><div className="modal-body settings-form-body"><label className="form-field"><span>Nome</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o nome"/></label>{tab === "categories" && <label className="form-field"><span>Cor</span><select value={categoryColor} onChange={(e) => setCategoryColor(e.target.value as Category["color"])}><option value="slate">Cinza</option><option value="blue">Azul</option><option value="amber">Âmbar</option><option value="violet">Roxo</option><option value="emerald">Verde</option><option value="rose">Vermelho</option></select></label>}{tab === "statuses" && <><label className="form-field"><span>Cor</span><select value={statusColor} onChange={(e) => setStatusColor(e.target.value as StatusColor)}><option value="neutral">Cinza</option><option value="blue">Azul</option><option value="amber">Âmbar</option><option value="violet">Roxo</option><option value="red">Vermelho</option><option value="green">Verde</option></select></label><label className="final-status-option"><input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)}/><span><strong>Status de conclusão</strong><small>Identifica tickets concluídos, sem alterar datas.</small></span></label></>}{tab === "users" && <><label className="form-field"><span>E-mail</span><input required type="email" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="nome@empresa.com"/></label><label className="form-field"><span>{editingItem ? "Nova senha (opcional)" : "Senha inicial"}</span><input required={!editingItem} minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editingItem ? "Deixe em branco para manter" : "Mínimo de 6 caracteres"}/></label></>}{formError && <p className="form-error">{formError}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={closeModal}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Salvando..." : editingItem ? "Salvar alterações" : "Adicionar"}</button></div></form></div>}
    </div>
  );
}
