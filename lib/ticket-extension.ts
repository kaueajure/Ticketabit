export interface ExtensionTicketPayload {
  version: 1;
  source: "movidesk" | "manual";
  ticketNumber: string;
  title: string;
  system: string;
  url: string;
  capturedAt: string;
}

const CHANNEL = "ticketabit-extension";
const REQUEST_TYPE = "REQUEST_LAST_TICKET";
const RESPONSE_TYPE = "LAST_TICKET_RESPONSE";

function cleanString(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function validSourceUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return /^https:$/.test(url.protocol) && /\.movidesk\.com(?:\.br)?$/i.test(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

function parsePayload(value: unknown): ExtensionTicketPayload {
  if (!value || typeof value !== "object") throw new Error("Nenhum ticket foi capturado. Abra um ticket no Movidesk e tente novamente.");
  const payload = value as Record<string, unknown>;
  const ticketNumber = cleanString(payload.ticketNumber, 80).replace(/^#/, "");
  if (!ticketNumber) throw new Error("A extensão não encontrou o número do ticket. Confira a captura no ícone da extensão.");

  return {
    version: 1,
    source: payload.source === "manual" ? "manual" : "movidesk",
    ticketNumber,
    title: cleanString(payload.title, 500),
    system: cleanString(payload.system, 200),
    url: validSourceUrl(cleanString(payload.url, 2048)),
    capturedAt: cleanString(payload.capturedAt, 40),
  };
}

export function requestTicketFromExtension(timeoutMs = 2500) {
  return new Promise<ExtensionTicketPayload>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    let timeout = 0;

    const finish = (callback: () => void) => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      callback();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data;
      if (message?.source !== "ticketabit-extension" || message.channel !== CHANNEL || message.type !== RESPONSE_TYPE || message.requestId !== requestId) return;
      finish(() => {
        if (message.error) reject(new Error(String(message.error)));
        else {
          try { resolve(parsePayload(message.payload)); }
          catch (error) { reject(error); }
        }
      });
    };

    window.addEventListener("message", onMessage);
    timeout = window.setTimeout(() => finish(() => reject(new Error("A extensão não respondeu. Instale a Ticketensão ou abra o ícone dela nesta página e conecte este domínio."))), timeoutMs);
    window.postMessage({ source: "ticketabit-web", channel: CHANNEL, type: REQUEST_TYPE, requestId }, window.location.origin);
  });
}
