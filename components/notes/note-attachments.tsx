"use client";

import { CSSProperties, MouseEvent, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, MessageSquareText, Paperclip, Trash2 } from "lucide-react";
import { NoteAttachment } from "@/lib/types";

export function AttachmentBadge({ attachment, onRemove, onAdd, className = "" }: { attachment: NoteAttachment; onRemove: () => void; onAdd?: (event: MouseEvent<HTMLButtonElement>) => void; className?: string }) {
  const imageSource = attachment.dataUrl || (attachment.fileId ? `/api/notes/attachments/${encodeURIComponent(attachment.fileId)}` : "");
  return <span className={"note-attachment " + className}>
    <button type="button" className="note-attachment-icon" onClick={onAdd} aria-label={attachment.type === "image" ? "Imagem anexada: " + attachment.name : "Comentário anexado"} title={onAdd ? "Ver anexo ou adicionar outro" : undefined}>
      <Paperclip size={12}/>
    </button>
    <span className={"note-attachment-preview " + attachment.type}>
      <span className="note-attachment-preview-head">
        {attachment.type === "image" ? <ImageIcon size={13}/> : <MessageSquareText size={13}/>}
        <strong>{attachment.type === "image" ? attachment.name : "Comentário"}</strong>
        <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label="Remover anexo"><Trash2 size={12}/></button>
      </span>
      {attachment.type === "image"
        ? <img src={imageSource} alt={attachment.name || "Imagem anexada"}/>
        : <p>{attachment.comment}</p>}
    </span>
  </span>;
}

type TextNotepadProps = {
  lineId: string;
  content: string;
  attachments: NoteAttachment[];
  onChange: (content: string) => void;
  onAttachmentRequest: (event: MouseEvent<HTMLTextAreaElement>, lineId: string, position: number) => void;
  onRemoveAttachment: (attachmentId: string) => void;
};

export function TextNotepad({ lineId, content, attachments, onChange, onAttachmentRequest, onRemoveAttachment }: TextNotepadProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, CSSProperties>>({});
  const positionedAttachments = useMemo(() => attachments.filter((attachment) => typeof attachment.position === "number"), [attachments]);

  const measure = useCallback(() => {
    const shell = shellRef.current;
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!shell || !textarea || !mirror) return;
    const shellRect = shell.getBoundingClientRect();
    const next: Record<string, CSSProperties> = {};
    const stacks = new Map<string, number>();
    for (const attachment of positionedAttachments) {
      const marker = mirror.querySelector<HTMLElement>('[data-attachment-marker="' + attachment.id + '"]');
      if (!marker) continue;
      const markerRect = marker.getBoundingClientRect();
      const stackKey = String(attachment.position);
      const stack = stacks.get(stackKey) ?? 0;
      stacks.set(stackKey, stack + 1);
      next[attachment.id] = {
        left: Math.max(0, Math.min(markerRect.left - shellRect.left - textarea.scrollLeft + stack * 19, shell.clientWidth - 24)),
        top: Math.max(0, markerRect.top - shellRect.top - textarea.scrollTop - 1),
      };
    }
    setPositions(next);
  }, [positionedAttachments]);

  useLayoutEffect(() => {
    measure();
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [content, measure]);

  const mirrorParts = [];
  let cursor = 0;
  for (const attachment of [...positionedAttachments].sort((a, b) => Number(a.position) - Number(b.position))) {
    const position = Math.max(0, Math.min(Number(attachment.position), content.length));
    mirrorParts.push(content.slice(cursor, position));
    mirrorParts.push(<span key={attachment.id} data-attachment-marker={attachment.id}>​</span>);
    cursor = position;
  }
  mirrorParts.push(content.slice(cursor) || "​");

  return <div className="notes-notepad-shell" ref={shellRef}>
    <textarea
      ref={textareaRef}
      className="notes-notepad"
      value={content}
      onChange={(event) => onChange(event.target.value)}
      onScroll={measure}
      onContextMenu={(event) => {
        event.preventDefault();
        onAttachmentRequest(event, lineId, event.currentTarget.selectionStart);
      }}
      placeholder="Comece a escrever..."
    />
    <div className="notes-notepad-mirror" ref={mirrorRef} aria-hidden="true">{mirrorParts}</div>
    <div className="notes-inline-attachments">
      {positionedAttachments.map((attachment) => <span className="notes-inline-attachment-position" style={positions[attachment.id]} key={attachment.id}>
        <AttachmentBadge attachment={attachment} className="inline" onRemove={() => onRemoveAttachment(attachment.id)}/>
      </span>)}
    </div>
  </div>;
}
