// All logging must go to stderr — stdout is reserved for JSON-RPC (stdio transport)
export const logger = {
  info: (msg: string) => console.error(`[japan-sakura-koyo-mcp] ${msg}`),
  warn: (msg: string) => console.error(`[japan-sakura-koyo-mcp:warn] ${msg}`),
  error: (msg: string) => console.error(`[japan-sakura-koyo-mcp:error] ${msg}`),
};
