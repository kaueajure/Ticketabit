export async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (!body.trim()) return {} as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    const receivedHtml = /^\s*</.test(body);
    const detail = receivedHtml
      ? "O servidor retornou uma página HTML no lugar da resposta da API."
      : "O servidor retornou uma resposta inválida.";
    throw new Error(`${detail} Código HTTP ${response.status}.`);
  }
}
