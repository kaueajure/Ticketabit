"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Circle, FileCheck2, FileText, Folder, FolderOpen,
  LoaderCircle, Pencil, Plus, Save, Trash2, UserRound, X,
} from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { readApiJson } from "@/lib/client-http";
import { NoteBlock, NoteFile, NoteFileType, NoteFolder, NotesData } from "@/lib/types";

type MobilePane = "library" | "editor";
type NameDialog = { kind: "create-folder" | "rename-folder" | "create-note"; targetId?: string };
type DeleteTarget = { kind: "folder" | "note"; id: string; name: string };
type EditorLine = { id: string; content: string; checked?: boolean; responsibleId?: string };
type PendingFocus = { id: string; position: number } | null;

function newLine(content = "", checked?: boolean): EditorLine {
  return { id: window.crypto.randomUUID(), content, ...(checked === undefined ? {} : { checked }) };
}

function readBlocks(content: string): NoteBlock[] {
  try {
    const value = JSON.parse(content) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((raw): NoteBlock[] => {
      if (!raw || typeof raw !== "object") return [];
      const block = raw as Partial<NoteBlock>;
      if (typeof block.id !== "string" || typeof block.type !== "string" || typeof block.content !== "string") return [];
      return [{ id: block.id, type: block.type as NoteBlock["type"], content: block.content, ...(block.type === "checklist" ? { checked: Boolean(block.checked), ...(typeof block.responsibleId === "string" ? { responsibleId: block.responsibleId } : {}) } : {}) }];
    });
  } catch {
    return [];
  }
}

function blockAsPlainText(block: NoteBlock) {
  if (block.type === "heading") return `# ${block.content}`;
  if (block.type === "quote") return `> ${block.content}`;
  if (block.type === "code") return `\`\`\`\n${block.content}\n\`\`\``;
  if (block.type === "checklist") return `- [${block.checked ? "x" : " "}] ${block.content}`;
  return block.content;
}

function linesForNote(note: NoteFile): EditorLine[] {
  const blocks = readBlocks(note.content);
  if (note.type === "checklist") {
    const checklist = blocks.filter((block) => block.type === "checklist").map((block) => ({ id: block.id, content: block.content, checked: Boolean(block.checked), ...(block.responsibleId ? { responsibleId: block.responsibleId } : {}) }));
    return checklist.length ? checklist : [newLine("", false)];
  }
  return blocks.length
    ? [{ id: blocks[0].id, content: blocks.map(blockAsPlainText).join("\n") }]
    : [newLine()];
}

function formatUpdatedAt(value: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Atualizado recentemente";
  return `Atualizado ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

export function NotesView() {
  const { users } = useApp();
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [mobilePane, setMobilePane] = useState<MobilePane>("library");
  const [dialog, setDialog] = useState<NameDialog | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogNoteType, setDialogNoteType] = useState<NoteFileType>("text");
  const [dialogError, setDialogError] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFolderId, setDraftFolderId] = useState("");
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);

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
      const folderId = preferred?.folderId && data.folders.some((item) => item.id === preferred.folderId) ? preferred.folderId : data.folders[0]?.id ?? "";
      const noteId = preferred?.noteId && data.notes.some((item) => item.id === preferred.noteId) ? preferred.noteId : data.notes.find((item) => item.folderId === folderId)?.id ?? "";
      setSelectedFolderId(folderId);
      setSelectedNoteId(noteId);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Não foi possível carregar as anotações.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const folderNotes = useMemo(() => notes.filter((note) => note.folderId === selectedFolderId), [notes, selectedFolderId]);
  const checklistProgress = useMemo(() => ({ done: lines.filter((line) => line.checked).length, total: lines.length }), [lines]);

  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle(""); setDraftFolderId(""); setLines([]); setDirty(false); setSaveError("");
      return;
    }
    setDraftTitle(selectedNote.title);
    setDraftFolderId(selectedNote.folderId);
    setLines(linesForNote(selectedNote));
    setDirty(false);
    setSaveError("");
  }, [selectedNote]);

  useEffect(() => {
    if (!pendingFocus) return;
    const field = document.querySelector<HTMLTextAreaElement>(`[data-editor-id="${pendingFocus.id}"]`);
    if (field) {
      field.focus();
      field.setSelectionRange(pendingFocus.position, pendingFocus.position);
    }
    setPendingFocus(null);
  }, [lines, pendingFocus]);

  const serializedContent = useCallback(() => {
    if (selectedNote?.type === "checklist") {
      return JSON.stringify(lines.map((line) => ({ id: line.id, type: "checklist", content: line.content, checked: Boolean(line.checked), ...(line.responsibleId ? { responsibleId: line.responsibleId } : {}) })));
    }
    return JSON.stringify(lines.map((line) => ({ id: line.id, type: "text", content: line.content })));
  }, [lines, selectedNote?.type]);

  const saveDraft = useCallback(async () => {
    if (!selectedNote || !dirty) return true;
    if (!draftTitle.trim()) { setSaveError("Informe o título da anotação."); return false; }
    setSaving(true); setSaveError("");
    try {
      const content = serializedContent();
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
  }, [dirty, draftFolderId, draftTitle, request, selectedNote, serializedContent]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveDraft(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [saveDraft]);

  const selectFolder = async (folderId: string) => {
    if (!(await saveDraft())) return;
    setSelectedFolderId(folderId);
    setSelectedNoteId(notes.find((note) => note.folderId === folderId)?.id ?? "");
  };

  const selectNote = async (noteId: string) => {
    if (noteId !== selectedNoteId && !(await saveDraft())) return;
    setSelectedNoteId(noteId);
    setMobilePane("editor");
  };

  const openDialog = (nextDialog: NameDialog, initialName = "") => {
    setDialog(nextDialog); setDialogName(initialName); setDialogNoteType("text"); setDialogError("");
  };

  const submitDialog = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog || !dialogName.trim()) return;
    setDialogSaving(true); setDialogError("");
    try {
      if (dialog.kind === "create-folder") {
        const result = await request<{ id: string }>("/api/notes/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dialogName }) });
        await loadNotes({ folderId: result.id });
      } else if (dialog.kind === "rename-folder" && dialog.targetId) {
        await request<{ ok: true }>(`/api/notes/folders/${dialog.targetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dialogName }) });
        await loadNotes({ folderId: dialog.targetId, noteId: selectedNoteId });
      } else if (dialog.kind === "create-note" && selectedFolderId) {
        if (!(await saveDraft())) return;
        const result = await request<{ id: string }>("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: selectedFolderId, title: dialogName, type: dialogNoteType }) });
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
      await request<{ ok: true }>(deleteTarget.kind === "folder" ? `/api/notes/folders/${deleteTarget.id}` : `/api/notes/${deleteTarget.id}`, { method: "DELETE" });
      await loadNotes(deleteTarget.kind === "note" ? { folderId: selectedFolderId } : undefined);
      setDeleteTarget(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Não foi possível excluir.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const updateLine = (id: string, changes: Partial<EditorLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
    setDirty(true);
  };

  const handleLineKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const current = lines[index];
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const start = event.currentTarget.selectionStart;
      const end = event.currentTarget.selectionEnd;
      const next = newLine(current.content.slice(end), selectedNote?.type === "checklist" ? false : undefined);
      setLines((value) => value.flatMap((line, lineIndex) => lineIndex === index ? [{ ...line, content: current.content.slice(0, start) }, next] : [line]));
      setDirty(true);
      setPendingFocus({ id: next.id, position: 0 });
      return;
    }
    if (event.key === "Backspace" && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0 && index > 0) {
      event.preventDefault();
      const previous = lines[index - 1];
      const position = previous.content.length;
      setLines((value) => value.filter((_, lineIndex) => lineIndex !== index).map((line, lineIndex) => lineIndex === index - 1 ? { ...line, content: `${line.content}${current.content}` } : line));
      setDirty(true);
      setPendingFocus({ id: previous.id, position });
    }
  };

  if (loading) return <div className="notes-loading"><LoaderCircle className="spin" size={22}/><span>Carregando anotações...</span></div>;

  return <div className="notes-page-simple">
    {pageError && <div className="notes-page-error"><span>{pageError}</span><button onClick={() => void loadNotes({ folderId: selectedFolderId, noteId: selectedNoteId })}>Tentar novamente</button></div>}
    <div className="notes-simple-shell">
      <aside className={`notes-library ${mobilePane === "library" ? "mobile-active" : ""}`}>
        <section className="notes-library-folders"><div className="notes-library-label"><span>Pastas</span><button onClick={() => openDialog({ kind: "create-folder" })}><Plus size={13}/> Nova</button></div><div className="notes-folder-simple-list">
          {!folders.length && <button className="notes-first-folder" onClick={() => openDialog({ kind: "create-folder" })}><Folder size={18}/><span><strong>Crie sua primeira pasta</strong><small>Organize suas anotações</small></span></button>}
          {folders.map((folder) => <div className={`notes-folder-simple ${folder.id === selectedFolderId ? "active" : ""}`} key={folder.id}><button onClick={() => void selectFolder(folder.id)}>{folder.id === selectedFolderId ? <FolderOpen size={15}/> : <Folder size={15}/>}<span>{folder.name}</span><small>{notes.filter((note) => note.folderId === folder.id).length}</small></button><span><button onClick={() => openDialog({ kind: "rename-folder", targetId: folder.id }, folder.name)} aria-label={`Renomear ${folder.name}`}><Pencil size={11}/></button><button onClick={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })} aria-label={`Excluir ${folder.name}`}><Trash2 size={11}/></button></span></div>)}
        </div></section>

        <section className="notes-library-files"><div className="notes-library-label"><span>{selectedFolder?.name ?? "Arquivos"}</span>{selectedFolder && <button onClick={() => openDialog({ kind: "create-note" })}><Plus size={13}/> Novo</button>}</div><div className="notes-simple-file-list">
          {!selectedFolder && folders.length > 0 && <div className="notes-library-empty"><FolderOpen size={21}/><span>Selecione uma pasta</span></div>}
          {selectedFolder && !folderNotes.length && <button className="notes-first-file" onClick={() => openDialog({ kind: "create-note" })}><Plus size={18}/><span><strong>Novo arquivo</strong><small>Texto ou checklist</small></span></button>}
          {folderNotes.map((note) => { const Icon = note.type === "checklist" ? FileCheck2 : FileText; return <div className={`notes-simple-file ${note.id === selectedNoteId ? "active" : ""}`} key={note.id}><button onClick={() => void selectNote(note.id)}><span className={note.type}><Icon size={15}/></span><span><strong>{note.title}</strong><small>{formatUpdatedAt(note.updatedAt)}</small></span></button><button className="notes-file-more" onClick={() => setDeleteTarget({ kind: "note", id: note.id, name: note.title })} aria-label={`Excluir ${note.title}`}><Trash2 size={12}/></button></div>; })}
        </div></section>
      </aside>

      <main className={`notes-simple-editor ${mobilePane === "editor" ? "mobile-active" : ""}`}>
        {!selectedNote ? <div className="notes-simple-welcome"><span><FileText size={27}/></span><h1>Comece uma anotação</h1><p>Selecione um arquivo ao lado ou crie uma página simples para escrever.</p>{selectedFolder && <button className="primary-button" onClick={() => openDialog({ kind: "create-note" })}><Plus size={15}/>Novo arquivo</button>}</div> : <>
          <header className="notes-simple-toolbar"><button className="notes-editor-back" onClick={() => setMobilePane("library")} aria-label="Voltar"><ArrowLeft size={17}/></button><div className="notes-breadcrumb"><span>{selectedFolder?.name}</span><small>/</small><strong>{draftTitle || "Sem título"}</strong></div><label className="notes-move-folder" title="Mover para outra pasta"><Folder size={13}/><select value={draftFolderId} onChange={(event) => { setDraftFolderId(event.target.value); setDirty(true); }}>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><span className={`notes-save-state ${saveError ? "error" : ""}`}>{saveError || (saving ? "Salvando..." : dirty ? "Não salvo" : <><Check size={12}/>Salvo</>)}</span><button className="notes-save-button" onClick={() => void saveDraft()} disabled={!dirty || saving}><Save size={14}/>Salvar</button></header>

          <div className="notes-paper-scroll"><article className="notes-paper">
            <input className="notes-simple-title" value={draftTitle} onChange={(event) => { setDraftTitle(event.target.value); setDirty(true); }} maxLength={180} placeholder="Sem título"/>
            {selectedNote.type === "checklist" && <div className="notes-check-progress"><span><i style={{ width: `${checklistProgress.total ? checklistProgress.done / checklistProgress.total * 100 : 0}%` }}/></span><small>{checklistProgress.total ? Math.round(checklistProgress.done / checklistProgress.total * 100) : 0}%</small></div>}

            <div className={`notes-writing-area ${selectedNote.type}`}>
              {selectedNote.type === "checklist"
                ? lines.map((line, index) => <div className={`notes-check-row ${line.checked ? "checked" : ""}`} key={line.id}><button type="button" onClick={() => updateLine(line.id, { checked: !line.checked })} aria-label={line.checked ? "Marcar como pendente" : "Marcar como concluído"}>{line.checked ? <CheckCircle2 size={20}/> : <Circle size={20}/>}</button><div className="notes-check-content"><textarea data-editor-id={line.id} rows={Math.max(1, line.content.split("\n").length)} value={line.content} onChange={(event) => updateLine(line.id, { content: event.target.value })} onKeyDown={(event) => handleLineKeyDown(event, index)} placeholder={index === 0 ? "Digite uma tarefa..." : "Próxima tarefa..."}/><label className={`notes-check-responsible ${line.responsibleId ? "assigned" : ""}`}><UserRound size={13}/><select aria-label={`Responsável por ${line.content || "esta tarefa"}`} value={line.responsibleId ?? ""} onChange={(event) => updateLine(line.id, { responsibleId: event.target.value || undefined })}><option value="">Escolher responsável</option>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div></div>)
                : <textarea className="notes-notepad" value={lines[0]?.content ?? ""} onChange={(event) => updateLine(lines[0].id, { content: event.target.value })} placeholder="Comece a escrever..."/>}
            </div>
          </article></div>
        </>}
      </main>
    </div>

    {dialog && <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={() => setDialog(null)} aria-label="Fechar"/>
      <form className="small-modal notes-create-modal" onSubmit={submitDialog}>
        <div className="modal-header"><div><span className="eyebrow">Anotações</span><h2>{dialog.kind === "create-folder" ? "Nova pasta" : dialog.kind === "rename-folder" ? "Renomear pasta" : "Novo arquivo"}</h2><p>{dialog.kind === "create-note" ? `Configure o arquivo em ${selectedFolder?.name}.` : "Use um nome curto e fácil de encontrar."}</p></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Fechar"><X size={18}/></button></div>
        <div className="modal-body notes-create-fields">
          <label className="form-field"><span>Nome</span><input autoFocus required maxLength={dialog.kind === "create-note" ? 180 : 120} value={dialogName} onChange={(event) => setDialogName(event.target.value)} placeholder={dialog.kind === "create-note" ? "Ex.: Planejamento da semana" : "Ex.: Projetos pessoais"}/></label>
          {dialog.kind === "create-note" && <>
            <fieldset className="notes-type-field"><legend>Tipo do arquivo</legend><div><label className={dialogNoteType === "text" ? "active" : ""}><input type="radio" name="noteType" checked={dialogNoteType === "text"} onChange={() => setDialogNoteType("text")}/><span><FileText size={20}/></span><strong>Texto</strong><small>Um bloco de notas simples.</small></label><label className={dialogNoteType === "checklist" ? "active" : ""}><input type="radio" name="noteType" checked={dialogNoteType === "checklist"} onChange={() => setDialogNoteType("checklist")}/><span><FileCheck2 size={20}/></span><strong>Checklist</strong><small>Uma lista simples de tarefas.</small></label></div></fieldset>
          </>}
          {dialogError && <p className="form-error">{dialogError}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button className="primary-button" disabled={dialogSaving}>{dialogSaving ? "Salvando..." : dialog.kind === "create-note" ? "Criar arquivo" : "Salvar"}</button></div>
      </form>
    </div>}

    {deleteTarget && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setDeleteTarget(null)} aria-label="Fechar"/><div className="small-modal"><div className="modal-header"><div><span className="eyebrow">Excluir</span><h2>Excluir {deleteTarget.kind === "folder" ? "pasta" : "arquivo"}?</h2><p>{deleteTarget.kind === "folder" ? "Todos os arquivos dentro dela também serão excluídos." : "Esta ação não poderá ser desfeita."}</p></div><button className="icon-button" onClick={() => setDeleteTarget(null)} aria-label="Fechar"><X size={18}/></button></div><div className="modal-body notes-delete-copy"><strong>{deleteTarget.name}</strong></div><div className="modal-footer"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="danger-button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</button></div></div></div>}
  </div>;
}
