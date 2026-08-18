"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileSpreadsheet, Info, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/providers/app-provider";
import { TicketImportError, TicketImportField, TicketImportRow } from "@/lib/types";

type ImportField = TicketImportField;
type ImportSheet = { name: string; headers: string[]; rows: string[][]; mapping: Array<ImportField | "">; enabled: boolean; issue?: string };
type ImportWorkbook = { fileName: string; sheets: ImportSheet[]; excel: boolean; multipleCsv: boolean };

const importFields: Array<{ value: ImportField; label: string; required: boolean }> = [
  { value: "ticketNumber", label: "Ticket", required: true },
  { value: "system", label: "Sistema", required: true },
  { value: "status", label: "Status", required: true },
  { value: "category", label: "Categoria", required: true },
  { value: "description", label: "Descrição", required: true },
  { value: "responsible", label: "Responsável", required: true },
  { value: "receivedAt", label: "Data de recebimento", required: true },
  { value: "finishedAt", label: "Data de finalização", required: false },
];

const aliases: Record<ImportField, string[]> = {
  ticketNumber: ["ticket", "codigo", "numero", "numerodoticket", "ticketnumber"],
  system: ["sistema", "system"],
  status: ["status", "situacao"],
  category: ["categoria", "category", "tipo"],
  description: ["descricao", "description", "objetivo", "resumo"],
  responsible: ["responsavel", "responsible", "owner", "emaildoresponsavel"],
  receivedAt: ["recebido", "datarecebimento", "dataderecebimento", "receivedat"],
  finishedAt: ["finalizado", "datafinalizacao", "datadefinalizacao", "finishedat"],
};

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter((item) => item.some((cell) => cell.trim() !== ""));
}

function parseCsv(text: string) {
  const content = text.replace(/^\uFEFF/, "");
  const candidates = [";", ",", "\t"].map((delimiter) => parseDelimited(content, delimiter));
  return candidates.sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0))[0] ?? [];
}

function cellToString(cell: unknown) {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
  }
  return String(cell).trim();
}

function createImportSheet(name: string, rawRows: unknown[][]): ImportSheet {
  const rows = rawRows.map((row) => row.map(cellToString)).filter((row) => row.some(Boolean));
  const headers = (rows[0] ?? []).map((header, index) => header || `Coluna ${index + 1}`);
  const mapping = headers.map((header) => {
    const normalized = normalizeHeader(header);
    return importFields.find((field) => aliases[field.value].includes(normalized))?.value ?? "";
  });
  const issue = headers.length < 2 || rows.length < 2 ? "A aba precisa possuir um cabeçalho e ao menos uma linha de dados." : undefined;
  return { name, headers, rows: rows.slice(1), mapping, enabled: !issue, issue };
}

function mappedDataRows(sheet: ImportSheet) {
  const ticketColumn = sheet.mapping.indexOf("ticketNumber");
  return sheet.rows.map((cells, rowIndex) => ({ cells, rowIndex })).filter(({ cells }) => ticketColumn < 0 || Boolean(cells[ticketColumn]?.trim()));
}

async function readFile(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function csvSheetName(fileName: string) {
  const baseName = fileName.replace(/\.csv$/i, "");
  return baseName.split(" - ").at(-1)?.trim() || baseName;
}

export function CsvImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reloadData, showNotice } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [workbook, setWorkbook] = useState<ImportWorkbook | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [rowErrors, setRowErrors] = useState<TicketImportError[]>([]);
  const [importing, setImporting] = useState(false);
  const [forcing, setForcing] = useState(false);

  const reset = () => {
    setWorkbook(null); setActiveSheetIndex(0); setFileError(""); setServerError(""); setRowErrors([]); setImporting(false); setForcing(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  const close = () => { if (!importing) { reset(); onClose(); } };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const loadFiles = async (fileList?: FileList | File[]) => {
    setFileError(""); setServerError(""); setRowErrors([]);
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const extensions = files.map((file) => file.name.toLowerCase().split(".").pop());
    if (extensions.some((extension) => extension !== "csv" && extension !== "xlsx")) { setFileError("Selecione arquivos .csv ou um arquivo .xlsx."); return; }
    if (extensions.includes("xlsx") && files.length > 1) { setFileError("Para Excel, selecione um único .xlsx. Para CSV, você pode escolher vários arquivos juntos."); return; }
    if (files.reduce((total, file) => total + file.size, 0) > 5 * 1024 * 1024) { setFileError("Os arquivos devem possuir no máximo 5 MB no total."); return; }
    try {
      let sheets: ImportSheet[];
      const excel = extensions[0] === "xlsx";
      if (excel) {
        const { default: readExcelFile } = await import("read-excel-file/browser");
        const excelSheets = await readExcelFile(files[0]);
        sheets = excelSheets.map((sheet) => createImportSheet(sheet.sheet, sheet.data as unknown[][])).filter((sheet) => sheet.headers.length || sheet.rows.length);
      } else {
        sheets = await Promise.all(files.map(async (file) => createImportSheet(csvSheetName(file.name), parseCsv(await readFile(file)))));
      }
      if (!sheets.length) { setFileError("O arquivo não possui nenhuma aba com dados."); return; }
      setWorkbook({ fileName: files.length === 1 ? files[0].name : `${files.length} arquivos CSV`, sheets, excel, multipleCsv: !excel && files.length > 1 });
      setActiveSheetIndex(0);
    } catch {
      setFileError("Não foi possível ler o arquivo. Verifique se ele não está corrompido ou protegido por senha.");
    }
  };

  const activeSheet = workbook?.sheets[activeSheetIndex] ?? null;
  const selected = (activeSheet?.mapping ?? []).filter((field): field is ImportField => Boolean(field));
  const duplicateFields = selected.filter((field, index) => selected.indexOf(field) !== index);
  const missingFields = importFields.filter((field) => field.required && !selected.includes(field.value));
  const enabledSheets = workbook?.sheets.filter((sheet) => sheet.enabled) ?? [];
  const activeRows = activeSheet ? mappedDataRows(activeSheet) : [];
  const totalRows = enabledSheets.reduce((total, sheet) => total + mappedDataRows(sheet).length, 0);
  const invalidSheets = enabledSheets.filter((sheet) => {
    const mapped = sheet.mapping.filter((field): field is ImportField => Boolean(field));
    return importFields.some((field) => field.required && !mapped.includes(field.value)) || new Set(mapped).size !== mapped.length;
  });
  const mappingValid = enabledSheets.length > 0 && totalRows <= 1000 && !invalidSheets.length;
  const fieldLabels = useMemo(() => new Map(importFields.map((field) => [field.value, field.label])), []);
  const duplicateErrorCount = rowErrors.filter((error) => error.kind === "duplicate").length;
  const blockingErrorCount = rowErrors.length - duplicateErrorCount;

  const changeMapping = (sheetIndex: number, column: number, value: ImportField | "") => {
    setWorkbook((current) => current ? { ...current, sheets: current.sheets.map((sheet, index) => index === sheetIndex ? { ...sheet, mapping: sheet.mapping.map((item, itemIndex) => itemIndex === column ? value : item) } : sheet) } : current);
    setServerError(""); setRowErrors([]);
  };

  const setSheetEnabled = (sheetIndex: number, enabled: boolean) => {
    setWorkbook((current) => current ? { ...current, sheets: current.sheets.map((sheet, index) => index === sheetIndex ? { ...sheet, enabled } : sheet) } : current);
    setServerError(""); setRowErrors([]);
  };

  const importCsv = async (force = false) => {
    if (!workbook || !mappingValid) return;
    setImporting(true); setForcing(force);
    if (!force) { setServerError(""); setRowErrors([]); }
    const rows = enabledSheets.flatMap((sheet) => mappedDataRows(sheet).map(({ cells, rowIndex }) => {
      const item: TicketImportRow = { sourceSheet: sheet.name, sourceRow: rowIndex + 2 };
      sheet.mapping.forEach((field, index) => { if (field) item[field] = cells[index]?.trim() ?? ""; });
      return item;
    }));
    try {
      const response = await fetch("/api/tickets/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, force }),
      });
      const result = await response.json() as { imported?: number; skipped?: number; error?: string; errors?: TicketImportError[] };
      if (!response.ok) {
        setServerError(result.error ?? "Não foi possível importar o CSV.");
        setRowErrors(result.errors ?? []);
        return;
      }
      await reloadData();
      showNotice(result.skipped ? `${result.imported ?? 0} importados · ${result.skipped} ignorados` : `${result.imported ?? rows.length} tickets importados`);
      reset(); onClose();
    } catch {
      setServerError("Falha de conexão com o servidor.");
    } finally {
      setImporting(false); setForcing(false);
    }
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-layer ticket-modal-layer csv-import-layer" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
      <button className="modal-backdrop" onClick={close} aria-label="Fechar importação" />
      <section className={`ticket-modal csv-import-modal ${workbook ? "has-workbook" : ""}`}>
        <div className="modal-header">
          <div><span className="eyebrow">IMPORTAÇÃO</span><h2 id="csv-import-title">Importar tickets</h2><p>Importe um CSV ou todas as abas de uma planilha Excel.</p></div>
          <button className="icon-button" onClick={close} disabled={importing} aria-label="Fechar"><X size={18}/></button>
        </div>
        <div className="modal-body csv-import-body">
          <input ref={inputRef} className="visually-hidden" type="file" multiple accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event: ChangeEvent<HTMLInputElement>) => void loadFiles(event.target.files ?? undefined)}/>
          {!workbook ? (
            <button className="csv-file-picker" type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); void loadFiles(event.dataTransfer.files); }}>
              <span><Upload size={21}/></span><strong>Selecionar CSV ou Excel</strong><small>arquivos .csv ou .xlsx · máximo de 5 MB e 1.000 tickets</small>
            </button>
          ) : (
            <>
              <div className="csv-file-summary"><span><FileSpreadsheet size={18}/></span><div><strong>{workbook.fileName}</strong><small>{workbook.excel ? `${workbook.sheets.length} ${workbook.sheets.length === 1 ? "aba encontrada" : "abas encontradas"} · ` : ""}{totalRows} {totalRows === 1 ? "ticket selecionado" : "tickets selecionados"}</small></div><button type="button" onClick={() => inputRef.current?.click()}>Trocar arquivo</button></div>
              {!workbook.excel && !workbook.multipleCsv && <div className="csv-format-notice"><Info size={15}/><div><strong>Uma aba CSV encontrada: {workbook.sheets[0].name}</strong><p>Para importar outras abas em CSV, clique em “Trocar arquivo” e selecione todos os CSVs exportados ao mesmo tempo. Você também pode enviar um .xlsx.</p></div></div>}
              <section className="csv-sheet-picker"><div><strong>{workbook.excel ? "Abas a importar" : "Abas/arquivos CSV a importar"}</strong><p>{workbook.excel ? "Marque todas as abas que contêm tickets." : "Cada CSV selecionado representa uma aba exportada. Marque os que deseja importar."}</p></div><div>{workbook.sheets.map((sheet, index) => { const sheetRows = mappedDataRows(sheet); return <label className={sheet.issue ? "disabled" : ""} key={`${sheet.name}-option-${index}`} title={sheet.issue}><input type="checkbox" checked={sheet.enabled} disabled={Boolean(sheet.issue)} onChange={(event) => setSheetEnabled(index, event.target.checked)}/><span><strong>{sheet.name}</strong><small>{sheet.issue ?? `${sheetRows.length} ${sheetRows.length === 1 ? "linha" : "linhas"}`}</small></span></label>; })}</div></section>
              {workbook.sheets.length > 1 && <div className="csv-sheet-tabs" role="tablist" aria-label="Configurar mapeamento por aba">{workbook.sheets.map((sheet, index) => <button type="button" role="tab" aria-selected={activeSheetIndex === index} className={`${activeSheetIndex === index ? "active" : ""} ${!sheet.enabled ? "excluded" : ""}`} key={`${sheet.name}-${index}`} onClick={() => setActiveSheetIndex(index)}><span>{sheet.name}</span><small>{mappedDataRows(sheet).length}</small></button>)}</div>}
              {activeSheet && <>
                <div className="csv-sheet-control"><div><strong>Configurando: {activeSheet.name}</strong><small>{activeRows.length} {activeRows.length === 1 ? "linha de dados" : "linhas de dados"}</small></div><span className={`csv-sheet-state ${activeSheet.enabled ? "included" : ""}`}>{activeSheet.enabled ? "Incluída na importação" : "Não será importada"}</span></div>
                {activeSheet.issue ? <p className="form-error">{activeSheet.issue} Esta aba não será importada.</p> : <>
                  <div className="csv-mapping-intro"><div><strong>Mapeamento das colunas</strong><p>Defina o campo correspondente para cada coluna desta {workbook.excel ? "aba" : "planilha"}.</p></div><span>{selected.length} de {activeSheet.headers.length} mapeadas</span></div>
                  <div className={`csv-mapping-list ${!activeSheet.enabled ? "disabled" : ""}`}>
                    <div className="csv-mapping-head"><span>Coluna no arquivo</span><span>Exemplo</span><span>Campo no Ticketabit</span></div>
                    {activeSheet.headers.map((header, index) => (
                      <div className={`csv-mapping-row ${!activeSheet.mapping[index] ? "unmapped" : ""}`} key={`${header}-${index}`}>
                        <strong title={header}>{header}</strong>
                        <span title={activeRows[0]?.cells[index] ?? ""}>{activeRows[0]?.cells[index] || "—"}</span>
                        <select disabled={!activeSheet.enabled} aria-label={`Campo correspondente a ${header}`} value={activeSheet.mapping[index] ?? ""} onChange={(event) => changeMapping(activeSheetIndex, index, event.target.value as ImportField | "")}>
                          <option value="">Ignorar coluna</option>
                          {importFields.map((field) => <option key={field.value} value={field.value}>{field.label}{field.required ? " *" : ""}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="csv-date-hint">Datas aceitas: D/M/AAAA, DD/MM/AAAA ou AAAA-MM-DD. O responsável pode ser identificado pelo nome ou e-mail.</p>
                  {activeSheet.enabled && missingFields.length > 0 && <p className="form-error">Nesta aba, mapeie: {missingFields.map((field) => field.label).join(", ")}.</p>}
                  {activeSheet.enabled && duplicateFields.length > 0 && <p className="form-error">Nesta aba, cada campo só pode ser associado uma vez. Revise: {[...new Set(duplicateFields)].map((field) => fieldLabels.get(field)).join(", ")}.</p>}
                </>}
              </>}
              {totalRows > 1000 && <p className="form-error">As abas selecionadas somam {totalRows} tickets. Selecione no máximo 1.000 por importação.</p>}
              {invalidSheets.length > 0 && <p className="form-error">Revise o mapeamento de {invalidSheets.length} {invalidSheets.length === 1 ? "aba selecionada" : "abas selecionadas"} antes de importar.</p>}
            </>
          )}
          {fileError && <p className="form-error">{fileError}</p>}
          {serverError && <div className="csv-server-errors"><p className="form-error"><AlertCircle size={14}/>{serverError} Nenhuma linha foi gravada.</p>{rowErrors.length > 0 && <><div className="csv-force-summary"><strong>Ao importar mesmo assim:</strong><span>{duplicateErrorCount > 0 ? `${duplicateErrorCount} ${duplicateErrorCount === 1 ? "duplicado será importado" : "duplicados serão importados"}.` : ""} {blockingErrorCount > 0 ? `${blockingErrorCount} ${blockingErrorCount === 1 ? "linha inválida será ignorada" : "linhas inválidas serão ignoradas"}.` : ""}</span></div><ul>{rowErrors.slice(0, 20).map((error, index) => <li key={`${error.sheet}-${error.row}-${error.field}-${index}`}><strong>{error.sheet ? `Aba “${error.sheet}” · linha ${error.row}:` : `Linha ${error.row}:`}</strong> {error.message}</li>)}</ul></>}{rowErrors.length > 20 && <small>Mais {rowErrors.length - 20} erros não exibidos. Corrija o arquivo e tente novamente.</small>}</div>}
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={close} disabled={importing}>Cancelar</button>{serverError && rowErrors.length > 0 && <button type="button" className="secondary-button force-import-button" disabled={!mappingValid || importing} onClick={() => void importCsv(true)}>{importing && forcing ? "Importando..." : "Importar mesmo assim"}</button>}<button type="button" className="primary-button" disabled={!mappingValid || importing} onClick={() => void importCsv()}>{importing && !forcing ? "Validando e importando..." : `Validar e importar${workbook ? ` ${totalRows} tickets` : ""}`}</button></div>
      </section>
    </div>,
    document.body,
  );
}
