"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Circle, FileCheck2, FileText, Folder, FolderOpen,
  ImagePlus, LoaderCircle, MessageSquarePlus, Paperclip, Pencil, Plus, Save, Trash2, UserRound, X,
} from "lucide-react";
import { AttachmentBadge, TextNotepad } from "@/components/notes/note-attachments";
import { useApp } from "@/components/providers/app-provider";
import { readApiJson } from "@/lib/client-http";
import { NoteAttachment, NoteBlock, NoteFile, NoteFileType, NoteFolder, NotesData } from "@/lib/types";

type MobilePane = "library" | "editor";
type NameDialog = { kind: "create-folder" | "rename-folder" | "create-note"; targetId?: string };
type DeleteTarget = { kind: "folder" | "note"; id: string; name: string };
type EditorLine = { id: string; content: string; checked?: boolean; responsibleId?: string; attachments?: NoteAttachment[] };
type PendingFocus = { id: string; position: number } | null;
type AttachmentTarget = { lineId: string; position?: number };
type AttachmentMenu = AttachmentTarget & { x: number; y: number };

function readAttachments(value: unknown): NoteAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): NoteAttachment[] => {
    if (!raw || typeof raw !== "object") return [];
    const attachment = raw as Partial<NoteAttachment>;
    if (typeof attachment.id !== "string" || (attachment.type !== "image" && attachment.type !== "comment")) return [];
    if (attachment.type === "image" && (typeof attachment.dataUrl === "string" || typeof attachment.fileId === "string")) return [{ id: attachment.id, type: "image", name: typeof attachment.name === "string" ? attachment.name : "Imagem", ...(typeof attachment.dataUrl === "string" ? { dataUrl: attachment.dataUrl } : {}), ...(typeof attachment.fileId === "string" ? { fileId: attachment.fileId } : {}), ...(typeof attachment.mimeType === "string" ? { mimeType: attachment.mimeType } : {}), ...(typeof attachment.position === "number" ? { position: attachment.position } : {}) }];
    if (attachment.type === "comment" && typeof attachment.comment === "string") return [{ id: attachment.id, type: "comment", comment: attachment.comment, ...(typeof attachment.position === "number" ? { position: attachment.position } : {}) }];
    return [];
  });
}

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
      const attachments = readAttachments(block.attachments);
      return [{ id: block.id, type: block.type as NoteBlock["type"], content: block.content, ...(attachments.length ? { attachments } : {}), ...(block.type === "checklist" ? { checked: Boolean(block.checked), ...(typeof block.responsibleId === "string" ? { responsibleId: block.responsibleId } : {}) } : {}) }];
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
    const checklist = blocks.filter((block) => block.type === "checklist").map((block) => ({ id: block.id, content: block.content, checked: Boolean(block.checked), ...(block.responsibleId ? { responsibleId: block.responsibleId } : {}), ...(block.attachments?.length ? { attachments: block.attachments } : {}) }));
    return checklist.length ? checklist : [newLine("", false)];
  }
  if (!blocks.length) return [newLine()];
  const parts = blocks.map(blockAsPlainText);
  let offset = 0;
  const attachments = blocks.flatMap((block, index) => {
    const adjusted = (block.attachments ?? []).map((attachment) => ({ ...attachment, position: offset + (attachment.position ?? 0) }));
    offset += parts[index].length + (index < parts.length - 1 ? 1 : 0);
    return adjusted;
  });
  return [{ id: blocks[0].id, content: parts.join("\n"), ...(attachments.length ? { attachments } : {}) }];
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
  const [attachmentMenu, setAttachmentMenu] = useState<AttachmentMenu | null>(null);
  const [commentTarget, setCommentTarget] = useState<AttachmentTarget | null>(null);
  const [commentText, setCommentText] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef<AttachmentTarget | null>(null);

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
    setAttachmentMenu(null);
    setCommentTarget(null);
    setAttachmentError("");
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

  const serializedContent = useCallback((sourceLines = lines) => {
    if (selectedNote?.type === "checklist") {
      return JSON.stringify(sourceLines.map((line) => ({ id: line.id, type: "checklist", content: line.content, checked: Boolean(line.checked), ...(line.responsibleId ? { responsibleId: line.responsibleId } : {}), ...(line.attachments?.length ? { attachments: line.attachments } : {}) })));
    }
    return JSON.stringify(sourceLines.map((line) => ({ id: line.id, type: "text", content: line.content, ...(line.attachments?.length ? { attachments: line.attachments } : {}) })));
  }, [lines, selectedNote?.type]);

  const uploadPendingAttachments = useCallback(async (sourceLines: EditorLine[]) => {
    const uploadedLines: EditorLine[] = [];
    for (const line of sourceLines) {
      const attachments: NoteAttachment[] = [];
      for (const attachment of line.attachments ?? []) {
        if (attachment.type !== "image" || !attachment.dataUrl || attachment.fileId) {
          attachments.push(attachment);
          continue;
        }
        const blob = await fetch(attachment.dataUrl).then((response) => response.blob());
        const formData = new FormData();
        formData.set("file", new File([blob], attachment.name || "imagem", { type: blob.type }));
        const uploaded = await request<{ fileId: string; name: string; mimeType: string }>("/api/notes/attachments", { method: "POST", body: formData });
        attachments.push({ id: attachment.id, type: "image", fileId: uploaded.fileId, name: uploaded.name, mimeType: uploaded.mimeType, ...(typeof attachment.position === "number" ? { position: attachment.position } : {}) });
      }
      uploadedLines.push({ ...line, ...(attachments.length ? { attachments } : { attachments: undefined }) });
    }
    return uploadedLines;
  }, [request]);

  const saveDraft = useCallback(async () => {
    if (!selectedNote || !dirty) return true;
    if (!draftTitle.trim()) { setSaveError("Informe o título da anotação."); return false; }
    setSaving(true); setSaveError("");
    try {
      const uploadedLines = await uploadPendingAttachments(lines);
      setLines(uploadedLines);
      const content = serializedContent(uploadedLines);
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
  }, [dirty, draftFolderId, draftTitle, lines, request, selectedNote, serializedContent, uploadPendingAttachments]);

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

  const updateTextContent = (id: string, content: string) => {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      const previous = line.content;
      let prefix = 0;
      while (prefix < previous.length && prefix < content.length && previous[prefix] === content[prefix]) prefix += 1;
      let suffix = 0;
      while (suffix < previous.length - prefix && suffix < content.length - prefix && previous[previous.length - 1 - suffix] === content[content.length - 1 - suffix]) suffix += 1;
      const previousChangedEnd = previous.length - suffix;
      const delta = content.length - previous.length;
      const attachments = line.attachments?.map((attachment) => {
        if (typeof attachment.position !== "number") return attachment;
        if (attachment.position < prefix) return attachment;
        if (attachment.position >= previousChangedEnd) return { ...attachment, position: Math.max(0, attachment.position + delta) };
        return { ...attachment, position: Math.max(0, content.length - suffix) };
      });
      return { ...line, content, ...(attachments ? { attachments } : {}) };
    }));
    setDirty(true);
  };

  const addAttachment = (target: AttachmentTarget, attachment: NoteAttachment) => {
    setLines((current) => current.map((line) => line.id === target.lineId
      ? { ...line, attachments: [...(line.attachments ?? []), { ...attachment, ...(typeof target.position === "number" ? { position: target.position } : {}) }] }
      : line));
    setDirty(true);
    setAttachmentError("");
  };

  const removeAttachment = (lineId: string, attachmentId: string) => {
    setLines((current) => current.map((line) => line.id === lineId ? { ...line, attachments: line.attachments?.filter((attachment) => attachment.id !== attachmentId) } : line));
    setDirty(true);
  };

  const openAttachmentMenu = (event: MouseEvent<HTMLElement>, target: AttachmentTarget) => {
    event.preventDefault();
    setAttachmentError("");
    setAttachmentMenu({ ...target, x: Math.min(event.clientX, window.innerWidth - 205), y: Math.min(event.clientY, window.innerHeight - 115) });
  };

  const chooseImage = () => {
    if (!attachmentMenu) return;
    fileTargetRef.current = { lineId: attachmentMenu.lineId, ...(typeof attachmentMenu.position === "number" ? { position: attachmentMenu.position } : {}) };
    setAttachmentMenu(null);
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = fileTargetRef.current;
    event.target.value = "";
    if (!file || !target) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(file.type)) { setAttachmentError("Use uma imagem PNG, JPEG, WebP ou GIF."); return; }
    if (file.size > 1_500_000) { setAttachmentError("A imagem deve possuir no máximo 1,5 MB."); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error());
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      addAttachment(target, { id: window.crypto.randomUUID(), type: "image", name: file.name.slice(0, 180), dataUrl });
    } catch {
      setAttachmentError("Não foi possível ler a imagem selecionada.");
    }
  };

  const openCommentDialog = () => {
    if (!attachmentMenu) return;
    setCommentTarget({ lineId: attachmentMenu.lineId, ...(typeof attachmentMenu.position === "number" ? { position: attachmentMenu.position } : {}) });
    setCommentText("");
    setAttachmentMenu(null);
  };

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!commentTarget || !commentText.trim()) return;
    addAttachment(commentTarget, { id: window.crypto.randomUUID(), type: "comment", comment: commentText.trim() });
    setCommentTarget(null);
    setCommentText("");
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
      setLines((value) => value.filter((_, lineIndex) => lineIndex !== index).map((line, lineIndex) => lineIndex === index - 1 ? { ...line, content: `${line.content}${current.content}`, attachments: [...(line.attachments ?? []), ...(current.attachments ?? [])] } : line));
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
                ? lines.map((line, index) => <div className={`notes-check-row ${line.checked ? "checked" : ""}`} key={line.id}><button type="button" onClick={() => updateLine(line.id, { checked: !line.checked })} aria-label={line.checked ? "Marcar como pendente" : "Marcar como concluído"}>{line.checked ? <CheckCircle2 size={20}/> : <Circle size={20}/>}</button><div className="notes-check-content"><textarea data-editor-id={line.id} rows={Math.max(1, line.content.split("\n").length)} value={line.content} onChange={(event) => updateLine(line.id, { content: event.target.value })} onKeyDown={(event) => handleLineKeyDown(event, index)} placeholder={index === 0 ? "Digite uma tarefa..." : "Próxima tarefa..."}/><label className={`notes-check-responsible ${line.responsibleId ? "assigned" : ""}`}><UserRound size={13}/><select aria-label={`Responsável por ${line.content || "esta tarefa"}`} value={line.responsibleId ?? ""} onChange={(event) => updateLine(line.id, { responsibleId: event.target.value || undefined })}><option value="">Escolher responsável</option>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><div className="notes-check-attachments">{line.attachments?.map((attachment) => <AttachmentBadge key={attachment.id} attachment={attachment} onRemove={() => removeAttachment(line.id, attachment.id)} onAdd={(event) => openAttachmentMenu(event, { lineId: line.id })}/>) }{!line.attachments?.length && <button type="button" className="notes-add-attachment" onClick={(event) => openAttachmentMenu(event, { lineId: line.id })} aria-label="Adicionar anexo à tarefa" title="Adicionar anexo"><Paperclip size={13}/></button>}</div></div></div>)
                : lines[0] && <TextNotepad lineId={lines[0].id} content={lines[0].content} attachments={lines[0].attachments ?? []} onChange={(content) => updateTextContent(lines[0].id, content)} onAttachmentRequest={(event, lineId, position) => openAttachmentMenu(event, { lineId, position })} onRemoveAttachment={(attachmentId) => removeAttachment(lines[0].id, attachmentId)}/>}
            </div>
            {selectedNote.type === "text" && <p className="notes-attachment-hint"><Paperclip size={12}/> Clique com o botão direito no ponto exato do texto para adicionar uma imagem ou comentário.</p>}
            {attachmentError && <p className="notes-attachment-error">{attachmentError}</p>}
          </article></div>
        </>}
      </main>
    </div>

    <input ref={fileInputRef} className="notes-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleImageSelected(event)}/>

    {attachmentMenu && <><button className="notes-attachment-menu-backdrop" onClick={() => setAttachmentMenu(null)} aria-label="Fechar menu de anexos"/><div className="notes-attachment-menu" style={{ left: attachmentMenu.x, top: attachmentMenu.y }} role="menu"><button type="button" onClick={chooseImage}><ImagePlus size={15}/><span><strong>Anexar imagem</strong><small>PNG, JPEG, WebP ou GIF</small></span></button><button type="button" onClick={openCommentDialog}><MessageSquarePlus size={15}/><span><strong>Adicionar comentário</strong><small>Texto exibido ao passar o mouse</small></span></button></div></>}

    {commentTarget && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setCommentTarget(null)} aria-label="Fechar"/><form className="small-modal notes-attachment-comment-modal" onSubmit={submitComment}><div className="modal-header"><div><span className="eyebrow">Anexo</span><h2>Novo comentário</h2><p>O comentário será exibido ao passar o mouse sobre o ícone.</p></div><button type="button" className="icon-button" onClick={() => setCommentTarget(null)} aria-label="Fechar"><X size={18}/></button></div><div className="modal-body"><label className="form-field"><span>Comentário</span><textarea autoFocus required maxLength={1000} rows={5} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Digite o comentário..."/></label></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setCommentTarget(null)}>Cancelar</button><button className="primary-button" disabled={!commentText.trim()}>Adicionar</button></div></form></div>}

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
