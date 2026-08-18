"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Braces, Check, Code2, FileText, Folder, FolderOpen,
  Heading1, ListChecks, LoaderCircle, Pencil, Pilcrow, Plus, Quote, Save, Trash2, X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { readApiJson } from "@/lib/client-http";
import { NoteBlock, NoteBlockType, NoteFile, NoteFolder, NotesData } from "@/lib/types";

type MobilePane = "folders" | "files" | "editor";
type NameDialog = { kind: "create-folder" | "rename-folder" | "create-note"; targetId?: string };
type DeleteTarget = { kind: "folder" | "note"; id: string; name: string };

const blockOptions: Array<{ type: NoteBlockType; label: string; icon: typeof Pilcrow }> = [
  { type: "text", label: "Texto", icon: Pilcrow },
  { type: "heading", label: "Título", icon: Heading1 },
  { type: "markdown", label: "Markdown", icon: Braces },
  { type: "checklist", label: "Checklist", icon: ListChecks },
  { type: "quote", label: "Citação", icon: Quote },
  { type: "code", label: "Código", icon: Code2 },
];
const allowedBlockTypes = new Set(blockOptions.map((item) => item.type));

function blockId() {
  return window.crypto.randomUUID();
}

function createBlock(type: NoteBlockType): NoteBlock {
  return { id: blockId(), type, content: "", ...(type === "checklist" ? { checked: false } : {}) };
}

function parseBlocks(content: string): NoteBlock[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((raw): NoteBlock[] => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Partial<NoteBlock>;
      if (typeof item.id !== "string" || typeof item.type !== "string" || !allowedBlockTypes.has(item.type as NoteBlockType) || typeof item.content !== "string") return [];
      return [{ id: item.id, type: item.type as NoteBlockType, content: item.content, ...(item.type === "checklist" ? { checked: Boolean(item.checked) } : {}) }];
    });
  } catch {
    return [];
  }
}

function inlineMarkdown(value: string): ReactNode[] {
  return value.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split("\n");
  return <div className="note-markdown-preview">{lines.map((line, index) => {
    if (line.startsWith("### ")) return <h4 key={index}>{inlineMarkdown(line.slice(4))}</h4>;
    if (line.startsWith("## ")) return <h3 key={index}>{inlineMarkdown(line.slice(3))}</h3>;
    if (line.startsWith("# ")) return <h2 key={index}>{inlineMarkdown(line.slice(2))}</h2>;
    if (/^- \[[ xX]\] /.test(line)) return <div className="markdown-check" key={index}><span>{/^- \[[xX]\]/.test(line) ? "✓" : ""}</span>{inlineMarkdown(line.slice(6))}</div>;
    if (line.startsWith("- ")) return <div className="markdown-list" key={index}>• <span>{inlineMarkdown(line.slice(2))}</span></div>;
    if (line.startsWith("> ")) return <blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>;
    return line ? <p key={index}>{inlineMarkdown(line)}</p> : <br key={index}/>;
  })}</div>;
}

function formatUpdatedAt(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Atualizado recentemente";
  return `Atualizado em ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

export function NotesView() {
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [mobilePane, setMobilePane] = useState<MobilePane>("folders");
  const [dialog, setDialog] = useState<NameDialog | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFolderId, setDraftFolderId] = useState("");
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const request = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    if (response.status === 401) {
      window.location.replace(`/login?next=${encodeURIComponent("/anotacoes")}`);
      throw new Error("Sua sessão expirou.");
    }
    const result = await readApiJson<T & { error?: string }>(response);
    if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a ação.");
    return result;
  }, []);

  const loadNotes = useCallback(async (preferred?: { folderId?: string; noteId?: string }) => {
    setPageError("");
    try {
      const data = await request<NotesData>("/api/notes", { cache: "no-store" });
      setFolders(data.folders);
      setNotes(data.notes);
      const folderId = preferred?.folderId && data.folders.some((item) => item.id === preferred.folderId)
        ? preferred.folderId
        : data.folders[0]?.id ?? "";
      const noteId = preferred?.noteId && data.notes.some((item) => item.id === preferred.noteId)
        ? preferred.noteId
        : data.notes.find((item) => item.folderId === folderId)?.id ?? "";
      setSelectedFolderId(folderId);
      setSelectedNoteId(noteId);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Não foi possível carregar as anotações.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const selectedFolder = folders.find((item) => item.id === selectedFolderId) ?? null;
  const selectedNote = notes.find((item) => item.id === selectedNoteId) ?? null;
  const folderNotes = useMemo(() => notes.filter((item) => item.folderId === selectedFolderId), [notes, selectedFolderId]);

  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle(""); setDraftFolderId(""); setBlocks([]); setDirty(false); setSaveError("");
      return;
    }
    const parsed = parseBlocks(selectedNote.content);
    setDraftTitle(selectedNote.title);
    setDraftFolderId(selectedNote.folderId);
    setBlocks(parsed.length ? parsed : [createBlock("text")]);
    setDirty(false);
    setSaveError("");
  }, [selectedNote]);

  const saveDraft = useCallback(async () => {
    if (!selectedNote || !dirty) return true;
    if (!draftTitle.trim()) { setSaveError("Informe o nome do arquivo."); return false; }
    setSaving(true); setSaveError("");
    try {
      const content = JSON.stringify(blocks);
      await request<{ ok: true }>(`/api/notes/${selectedNote.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle.trim(), folderId: draftFolderId, content }),
      });
      const updatedAt = new Date().toISOString();
      setNotes((current) => current.map((note) => note.id === selectedNote.id ? { ...note, title: draftTitle.trim(), folderId: draftFolderId, content, updatedAt } : note));
      setSelectedFolderId(draftFolderId);
      setDirty(false);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [blocks, dirty, draftFolderId, draftTitle, request, selectedNote]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDraft();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [saveDraft]);

  const chooseFolder = async (folderId: string) => {
    if (!(await saveDraft())) return;
    setSelectedFolderId(folderId);
    setSelectedNoteId(notes.find((item) => item.folderId === folderId)?.id ?? "");
    setMobilePane("files");
  };

  const chooseNote = async (noteId: string) => {
    if (noteId === selectedNoteId) { setMobilePane("editor"); return; }
    if (!(await saveDraft())) return;
    setSelectedNoteId(noteId);
    setMobilePane("editor");
  };

  const openDialog = (nextDialog: NameDialog, initialName = "") => {
    setDialog(nextDialog); setDialogName(initialName); setDialogError("");
  };

  const submitNameDialog = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog || !dialogName.trim()) return;
    setDialogSaving(true); setDialogError("");
    try {
      if (dialog.kind === "create-folder") {
        const result = await request<{ id: string }>("/api/notes/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dialogName }) });
        await loadNotes({ folderId: result.id });
        setMobilePane("files");
      } else if (dialog.kind === "rename-folder" && dialog.targetId) {
        await request<{ ok: true }>(`/api/notes/folders/${dialog.targetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dialogName }) });
        await loadNotes({ folderId: dialog.targetId, noteId: selectedNoteId });
      } else if (dialog.kind === "create-note" && selectedFolderId) {
        const result = await request<{ id: string }>("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: selectedFolderId, title: dialogName }) });
        await loadNotes({ folderId: selectedFolderId, noteId: result.id });
        setMobilePane("editor");
      }
      setDialog(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setDialogSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.kind === "folder" ? `/api/notes/folders/${deleteTarget.id}` : `/api/notes/${deleteTarget.id}`;
      await request<{ ok: true }>(url, { method: "DELETE" });
      const folderId = deleteTarget.kind === "note" ? selectedFolderId : undefined;
      await loadNotes(folderId ? { folderId } : undefined);
      setDeleteTarget(null);
      setMobilePane(deleteTarget.kind === "note" ? "files" : "folders");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Não foi possível excluir.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const updateBlock = (id: string, changes: Partial<NoteBlock>) => {
    setBlocks((current) => current.map((block) => block.id === id ? { ...block, ...changes } : block));
    setDirty(true);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.length === 1 ? [createBlock("text")] : current.filter((block) => block.id !== id));
    setDirty(true);
  };

  if (loading) return <div className="page notes-page notes-loading"><LoaderCircle className="spin" size={22}/><span>Carregando anotações...</span></div>;

  return (
    <div className="page notes-page">
      <PageHeader eyebrow="ESPAÇO PESSOAL" title="Anotações" description="Organize textos, Markdown e listas em pastas." actions={<button className="primary-button" onClick={() => openDialog({ kind: "create-folder" })}><Plus size={15}/>Nova pasta</button>}/>
      {pageError && <div className="notes-page-error"><span>{pageError}</span><button onClick={() => void loadNotes({ folderId: selectedFolderId, noteId: selectedNoteId })}>Tentar novamente</button></div>}
      <div className="notes-workspace">
        <aside className={`notes-folders-panel ${mobilePane === "folders" ? "mobile-active" : ""}`}>
          <div className="notes-panel-heading"><div><span>Pastas</span><small>{folders.length}</small></div><button className="icon-button" onClick={() => openDialog({ kind: "create-folder" })} aria-label="Nova pasta"><Plus size={16}/></button></div>
          <div className="notes-folder-list">
            {!folders.length && <div className="notes-mini-empty"><Folder size={25}/><strong>Nenhuma pasta</strong><span>Crie uma pasta para começar.</span></div>}
            {folders.map((folder) => <div className={`notes-folder-row ${selectedFolderId === folder.id ? "active" : ""}`} key={folder.id}>
              <button className="notes-folder-select" onClick={() => void chooseFolder(folder.id)}>{selectedFolderId === folder.id ? <FolderOpen size={16}/> : <Folder size={16}/>}<span>{folder.name}</span><small>{notes.filter((note) => note.folderId === folder.id).length}</small></button>
              <span className="notes-row-actions"><button onClick={() => openDialog({ kind: "rename-folder", targetId: folder.id }, folder.name)} aria-label={`Renomear ${folder.name}`}><Pencil size={12}/></button><button onClick={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })} aria-label={`Excluir ${folder.name}`}><Trash2 size={12}/></button></span>
            </div>)}
          </div>
        </aside>

        <section className={`notes-files-panel ${mobilePane === "files" ? "mobile-active" : ""}`}>
          <div className="notes-panel-heading"><button className="notes-mobile-back" onClick={() => setMobilePane("folders")}><ArrowLeft size={15}/></button><div><span>{selectedFolder?.name ?? "Arquivos"}</span><small>{folderNotes.length}</small></div>{selectedFolder && <button className="icon-button" onClick={() => openDialog({ kind: "create-note" })} aria-label="Novo arquivo"><Plus size={16}/></button>}</div>
          <div className="notes-file-list">
            {!selectedFolder && <div className="notes-mini-empty"><FolderOpen size={25}/><strong>Selecione uma pasta</strong><span>Os arquivos aparecerão aqui.</span></div>}
            {selectedFolder && !folderNotes.length && <div className="notes-mini-empty"><FileText size={25}/><strong>Pasta vazia</strong><span>Crie o primeiro arquivo de texto.</span><button className="secondary-button" onClick={() => openDialog({ kind: "create-note" })}><Plus size={14}/>Novo arquivo</button></div>}
            {folderNotes.map((note) => <div className={`notes-file-row ${selectedNoteId === note.id ? "active" : ""}`} key={note.id}>
              <button onClick={() => void chooseNote(note.id)}><FileText size={15}/><span><strong>{note.title}</strong><small>{formatUpdatedAt(note.updatedAt)}</small></span></button>
              <button className="notes-file-delete" onClick={() => setDeleteTarget({ kind: "note", id: note.id, name: note.title })} aria-label={`Excluir ${note.title}`}><Trash2 size={12}/></button>
            </div>)}
          </div>
        </section>

        <main className={`notes-editor-panel ${mobilePane === "editor" ? "mobile-active" : ""}`}>
          {!selectedNote ? <div className="notes-editor-empty"><span><FileText size={28}/></span><h2>Nenhum arquivo aberto</h2><p>Selecione ou crie um arquivo para começar a escrever.</p></div> : <>
            <div className="notes-editor-toolbar"><button className="notes-mobile-back" onClick={() => setMobilePane("files")}><ArrowLeft size={15}/></button><label><span>Pasta</span><select value={draftFolderId} onChange={(event) => { setDraftFolderId(event.target.value); setDirty(true); }}>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><span className={`notes-save-state ${saveError ? "error" : ""}`}>{saveError || (saving ? "Salvando..." : dirty ? "Alterações não salvas" : <><Check size={12}/>Salvo</>)}</span><button className="primary-button" onClick={() => void saveDraft()} disabled={saving || !dirty}><Save size={14}/>Salvar</button></div>
            <div className="notes-editor-scroll">
              <input className="notes-title-input" value={draftTitle} onChange={(event) => { setDraftTitle(event.target.value); setDirty(true); }} maxLength={180} placeholder="Nome do arquivo"/>
              <div className="notes-blocks">
                {blocks.map((block, index) => <div className={`note-block note-block-${block.type}`} key={block.id}>
                  <div className="note-block-controls"><select value={block.type} onChange={(event) => updateBlock(block.id, { type: event.target.value as NoteBlockType, checked: event.target.value === "checklist" ? Boolean(block.checked) : undefined })}>{blockOptions.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}</select><button onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="Mover bloco para cima"><ArrowUp size={12}/></button><button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label="Mover bloco para baixo"><ArrowDown size={12}/></button><button onClick={() => removeBlock(block.id)} aria-label="Excluir bloco"><Trash2 size={12}/></button></div>
                  {block.type === "heading" ? <input className="note-heading-input" value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="Título da seção"/>
                    : block.type === "checklist" ? <label className="note-check-input"><input type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })}/><input value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="Item a fazer"/></label>
                    : <textarea className={block.type === "code" ? "code" : ""} value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} rows={block.type === "markdown" || block.type === "code" ? 5 : 3} placeholder={block.type === "markdown" ? "# Título\n**negrito**, *itálico*, `código`, - lista..." : block.type === "quote" ? "Digite uma citação..." : block.type === "code" ? "Digite ou cole seu código..." : "Comece a escrever..."}/>} 
                  {block.type === "markdown" && block.content && <MarkdownPreview value={block.content}/>} 
                </div>)}
              </div>
              <div className="note-add-block"><span>Adicionar bloco</span><div>{blockOptions.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => { setBlocks((current) => [...current, createBlock(type)]); setDirty(true); }}><Icon size={13}/>{label}</button>)}</div></div>
            </div>
          </>}
        </main>
      </div>

      {dialog && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setDialog(null)} aria-label="Fechar"/><form className="small-modal" onSubmit={submitNameDialog}><div className="modal-header"><div><span className="eyebrow">Anotações</span><h2>{dialog.kind === "create-folder" ? "Nova pasta" : dialog.kind === "rename-folder" ? "Renomear pasta" : "Novo arquivo"}</h2><p>{dialog.kind === "create-note" ? `Será criado em ${selectedFolder?.name}.` : "Use um nome curto e fácil de encontrar."}</p></div><button type="button" className="icon-button" onClick={() => setDialog(null)}><X size={18}/></button></div><div className="modal-body"><label className="form-field"><span>Nome</span><input autoFocus required maxLength={dialog.kind === "create-note" ? 180 : 120} value={dialogName} onChange={(event) => setDialogName(event.target.value)} placeholder={dialog.kind === "create-note" ? "Ex.: Ajustes da integração" : "Ex.: A fazer - PTS"}/></label>{dialogError && <p className="form-error">{dialogError}</p>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button className="primary-button" disabled={dialogSaving}>{dialogSaving ? "Salvando..." : "Salvar"}</button></div></form></div>}

      {deleteTarget && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setDeleteTarget(null)} aria-label="Fechar"/><div className="small-modal"><div className="modal-header"><div><span className="eyebrow">Excluir</span><h2>Excluir {deleteTarget.kind === "folder" ? "pasta" : "arquivo"}?</h2><p>{deleteTarget.kind === "folder" ? "Todos os arquivos dentro dela também serão excluídos." : "Esta ação não poderá ser desfeita."}</p></div><button className="icon-button" onClick={() => setDeleteTarget(null)}><X size={18}/></button></div><div className="modal-body notes-delete-copy"><strong>{deleteTarget.name}</strong></div><div className="modal-footer"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="danger-button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</button></div></div></div>}
    </div>
  );
}
