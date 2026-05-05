import { useState } from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";

type ChatSidebarProps = {
  activeSessionId?: string;
  sessions: Array<{ id: string; title: string }>;
  sessionsLoading: boolean;
  loading: boolean;
  deletingSession?: boolean;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSessionSelect: (sessionId: string) => void;
};

export function ChatSidebar({
  activeSessionId,
  sessions,
  sessionsLoading,
  loading,
  deletingSession = false,
  onCreateSession,
  onDeleteSession,
  onSessionSelect,
}: ChatSidebarProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDeleteId) {
      return;
    }

    await onDeleteSession(pendingDeleteId);
    setPendingDeleteId(null);
  }

  return (
    <>
      <Sidebar>
        <SidebarCard>
          <BrandBlock>
            <BrandEyebrow>Local RAG Demo</BrandEyebrow>
            <BrandTitle>AI Knowledge Assistant</BrandTitle>
            <BrandText>Чат по документам с источниками и debug-контекстом.</BrandText>
          </BrandBlock>

          <AppNav>
            <NavItem to="/" end>
              Чат
            </NavItem>
            <NavItem to="/documents">Документы</NavItem>
            <NavItem to="/architecture">Архитектура</NavItem>
            <NavItem to="/eval">Eval</NavItem>
          </AppNav>

          <SidebarTop>
            <SidebarTitle>Диалоги</SidebarTitle>
            <NewChatButton type="button" onClick={onCreateSession} disabled={loading}>
              <PlusIcon />
            </NewChatButton>
          </SidebarTop>

          <SessionsList>
            {sessionsLoading ? (
              <SessionHint>Загружаю диалоги...</SessionHint>
            ) : sessions.length === 0 ? (
              <SessionHint>Первый диалог создастся после вопроса.</SessionHint>
            ) : (
              sessions.map((session) => (
                <SessionRow key={session.id} $active={session.id === activeSessionId}>
                  <SessionItem
                    type="button"
                    $active={session.id === activeSessionId}
                    onClick={() => onSessionSelect(session.id)}
                  >
                    <SessionTitle>{session.title}</SessionTitle>
                  </SessionItem>

                  <DeleteChatButton
                    type="button"
                    onClick={() => setPendingDeleteId(session.id)}
                    aria-label="Удалить диалог"
                  >
                    <CloseIcon />
                  </DeleteChatButton>
                </SessionRow>
              ))
            )}
          </SessionsList>
        </SidebarCard>
      </Sidebar>

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

const Sidebar = styled.aside`
  display: grid;
  align-content: stretch;
  min-width: 0;
  min-height: 0;
  height: 100%;
`;

const SidebarCard = styled.section`
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 24px;
  padding: 14px;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 12px;
`;

const BrandBlock = styled.div`
  display: grid;
  gap: 4px;
`;

const BrandEyebrow = styled.div`
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const BrandTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 700;
`;

const BrandText = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
`;

const AppNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const NavItem = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.78);

  &.active {
    border-color: rgba(16, 163, 127, 0.35);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }
`;

const SidebarTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
`;

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  min-height: 0;
  padding-right: 2px;
`;

const SessionHint = styled.div`
  color: var(--text-muted);
  line-height: 1.6;
  font-size: 14px;
`;

const SessionRow = styled.div<{ $active: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: stretch;
`;

const SessionItem = styled.button<{ $active: boolean }>`
  width: 100%;
  height: 44px;
  text-align: left;
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(16, 163, 127, 0.35)" : "var(--border)")};
  background: ${({ $active }) =>
    $active ? "rgba(16, 163, 127, 0.12)" : "transparent"};
  color: ${({ $active }) =>
    $active ? "var(--accent-strong)" : "var(--text-primary)"};
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
`;

const SessionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NewChatButton = styled.button`
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
  cursor: pointer;
`;

const DeleteChatButton = styled.button`
  width: 34px;
  height: 44px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
  cursor: pointer;
`;

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
