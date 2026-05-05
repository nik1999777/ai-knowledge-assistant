export const queryKeys = {
  chatSession: (sessionId = "", page = 1, pageSize = 5) =>
    ["chat-session", sessionId, page, pageSize] as const,
  chatSessions: () => ["chat-sessions"] as const,
  documents: (query = "") => ["documents", query] as const,
  documentDetail: (docId = "") => ["document-detail", docId] as const,
};
