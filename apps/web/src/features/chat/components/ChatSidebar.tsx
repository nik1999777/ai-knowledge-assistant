import { useState } from "react";
import styled from "styled-components";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";

type ChatSidebarProps = {
  activeSessionId?: string;
  sessions: Array<{ id: string; title: string }>;
  sessionsLoading: boolean;
  deletingSession?: boolean;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSessionSelect: (sessionId: string) => void;
};

export function ChatSidebar({
  activeSessionId,
  sessions,
  sessionsLoading,
  deletingSession = false,
  onDeleteSession,
  onSessionSelect,
}: ChatSidebarProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    await onDeleteSession(pendingDeleteId);
    setPendingDeleteId(null);
  }

  return (
    <>
      <RecentsLabel>Диалоги</RecentsLabel>

      <SessionsList>
        {sessionsLoading ? (
          <SessionHint>Загружаю...</SessionHint>
        ) : sessions.length === 0 ? (
          <SessionHint>Первый диалог появится после вопроса.</SessionHint>
        ) : (
          sessions.map((session) => (
            <SessionRow key={session.id} $active={session.id === activeSessionId}>
              <SessionButton
                type="button"
                $active={session.id === activeSessionId}
                onClick={() => onSessionSelect(session.id)}
              >
                <SessionTitle>{session.title}</SessionTitle>
              </SessionButton>
              <DeleteButton
                type="button"
                onClick={() => setPendingDeleteId(session.id)}
                aria-label="Удалить диалог"
              >
                <CloseIcon />
              </DeleteButton>
            </SessionRow>
          ))
        )}
      </SessionsList>

      {pendingDeleteId ? (
        <ConfirmDialog
          confirmLabel="Удалить"
          message="Диалог будет удален из истории чатов."
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={handleConfirmDelete}
          open={Boolean(pendingDeleteId)}
          pending={deletingSession}
          title="Удалить этот диалог?"
        />
      ) : null}
    </>
  );
}

const RecentsLabel = styled.div`
  padding: 2px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
`;

const SessionHint = styled.div`
  padding: 8px 12px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
`;

const SessionRow = styled.div<{ $active: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border-radius: 10px;
  background: ${({ $active }) => ($active ? "rgba(0, 0, 0, 0.07)" : "transparent")};

  &:hover {
    background: ${({ $active }) =>
      $active ? "rgba(0, 0, 0, 0.07)" : "rgba(0, 0, 0, 0.05)"};
  }

  &:hover button:last-child {
    opacity: 1;
  }
`;

const SessionButton = styled.button<{ $active: boolean }>`
  display: block;
  width: 100%;
  padding: 9px 12px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: ${({ $active }) => ($active ? "var(--text-primary)" : "var(--text-secondary)")};
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
`;

const SessionTitle = styled.div`
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DeleteButton = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 6px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background 120ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--text-primary);
  }
`;

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
