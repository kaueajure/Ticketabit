"use client";

import { CSSProperties, MouseEvent, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, Paperclip, Trash2 } from "lucide-react";
import { NoteAttachment } from "@/lib/types";

export function AttachmentBadge({ attachment, onRemove, onAdd, className = "" }: { attachment: NoteAttachment; onRemove: () => void; onAdd?: (event: MouseEvent<HTMLButtonElement>) => void; className?: string }) {
  const imageSource = attachment.dataUrl || (attachment.fileId ? `/api/notes/attachments/${encodeURIComponent(attachment.fileId)}` : "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ left: 0, top: 0, placement: "above" as "above" | "below", ready: false });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const showPreview = useCallback(() => {
    cancelClose();
    setPreviewOpen(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setPreviewOpen(false), 140);
  }, [cancelClose]);

  const updatePreviewPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const preview = previewRef.current;
    if (!trigger || !preview) return;
    const anchor = trigger.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const margin = 10;
    const gap = 7;
    const maxLeft = Math.max(margin, window.innerWidth - previewRect.width - margin);
    const left = Math.min(maxLeft, Math.max(margin, anchor.left + anchor.width / 2 - previewRect.width / 2));
    const roomAbove = anchor.top - gap;
    const roomBelow = window.innerHeight - anchor.bottom - gap;
    const placement = roomAbove >= previewRect.height || roomAbove >= roomBelow ? "above" : "below";
    const desiredTop = placement === "above" ? anchor.top - previewRect.height - gap : anchor.bottom + gap;
    const maxTop = Math.max(margin, window.innerHeight - previewRect.height - margin);
    const top = Math.min(maxTop, Math.max(margin, desiredTop));
    setPreviewPosition({ left, top, placement, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (!previewOpen) return;
    updatePreviewPosition();
    window.addEventListener("resize", updatePreviewPosition);
    window.addEventListener("scroll", updatePreviewPosition, true);
    return () => {
      window.removeEventListener("resize", updatePreviewPosition);
      window.removeEventListener("scroll", updatePreviewPosition, true);
      cancelClose();
    };
  }, [cancelClose, previewOpen, updatePreviewPosition]);

  const preview = previewOpen && typeof document !== "undefined" ? createPortal(
    <span
      ref={previewRef}
      className={`note-attachment-preview portal ${attachment.type}`}
      data-placement={previewPosition.placement}
      data-ready={previewPosition.ready}
      style={{ left: previewPosition.left, top: previewPosition.top }}
      onMouseEnter={showPreview}
      onMouseLeave={scheduleClose}
    >
      {attachment.type === "image"
        ? <><button type="button" className="note-attachment-image-delete" onClick={(event) => { event.stopPropagation(); setPreviewOpen(false); onRemove(); }} aria-label="Remover imagem"><Trash2 size={12}/></button><img src={imageSource} alt="Imagem anexada" onLoad={updatePreviewPosition}/></>
        : <><span className="note-attachment-preview-head"><MessageSquareText size={13}/><strong>Comentário</strong><button type="button" onClick={(event) => { event.stopPropagation(); setPreviewOpen(false); onRemove(); }} aria-label="Remover anexo"><Trash2 size={12}/></button></span><p>{attachment.comment}</p></>}
    </span>,
    document.body,
  ) : null;

  return <>
    <span className={"note-attachment " + className} onMouseEnter={showPreview} onMouseLeave={scheduleClose}>
      <button ref={triggerRef} type="button" className="note-attachment-icon" onClick={(event) => { if (onAdd) { setPreviewOpen(false); onAdd(event); } }} onFocus={showPreview} onBlur={scheduleClose} aria-label={attachment.type === "image" ? "Imagem anexada" : "Comentário anexado"} title={onAdd ? "Ver anexo ou adicionar outro" : undefined}>
        <Paperclip size={12}/>
      </button>
    </span>
    {preview}
  </>;
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
      const rawTop = markerRect.top - shellRect.top - textarea.scrollTop - 1;
      const stackKey = String(Math.round(rawTop));
      const stack = stacks.get(stackKey) ?? 0;
      stacks.set(stackKey, stack + 1);
      next[attachment.id] = {
        left: Math.max(0, shell.clientWidth - 25),
        top: Math.max(0, rawTop + stack * 21),
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
