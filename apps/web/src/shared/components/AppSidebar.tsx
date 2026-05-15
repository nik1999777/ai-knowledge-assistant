import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import styled from "styled-components";

type AppSidebarProps = {
  onNewChat?: () => void;
  newChatLoading?: boolean;
  children?: ReactNode;
};

export function AppSidebar({ onNewChat, newChatLoading, children }: AppSidebarProps) {
  return (
    <Sidebar>
      <BrandRow>
        <BrandLink to="/">AI Assistant</BrandLink>
      </BrandRow>

      {onNewChat ? (
        <NewChatButton type="button" onClick={onNewChat} disabled={newChatLoading}>
          <PlusIcon />
          Новый чат
        </NewChatButton>
      ) : (
        <NewChatLink to="/">
          <PlusIcon />
          Новый чат
        </NewChatLink>
      )}

      <Nav>
        <NavItem to="/" end>
          <ChatIcon />
          Чат
        </NavItem>
        <NavItem to="/documents">
          <DocsIcon />
          Документы
        </NavItem>
        <NavItem to="/architecture">
          <ArchIcon />
          Архитектура
        </NavItem>
        <NavItem to="/eval">
          <EvalIcon />
          Eval
        </NavItem>
      </Nav>

      {children && (
        <>
          <Divider />
          {children}
        </>
      )}
    </Sidebar>
  );
}

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
  min-height: 0;
  padding: 12px 10px;
  background: rgba(248, 249, 250, 0.9);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 20px;
  overflow: hidden;
`;

const BrandRow = styled.div`
  padding: 4px 8px 10px;
`;

const BrandLink = styled(Link)`
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  text-decoration: none;
`;

const newChatBase = `
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  margin-bottom: 2px;
  text-decoration: none;
  color: var(--text-primary);
  background: transparent;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  svg { flex-shrink: 0; color: var(--text-secondary); }
`;

const NewChatButton = styled.button`
  ${newChatBase}
  border: 0;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const NewChatLink = styled(NavLink)`
  ${newChatBase}
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 120ms ease, color 120ms ease;

  svg { flex-shrink: 0; }

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-primary);
  }

  &.active {
    background: rgba(0, 0, 0, 0.07);
    color: var(--text-primary);
    font-weight: 600;
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  margin: 4px 4px;
`;

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ArchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="5" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v4M12 11l-5 6M12 11l5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function EvalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
