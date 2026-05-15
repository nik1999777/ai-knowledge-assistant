import type { ReactNode } from "react";
import styled from "styled-components";
import { AppSidebar } from "./AppSidebar";

type AppShellProps = {
  children: ReactNode;
  sidebarContent?: ReactNode;
  onNewChat?: () => void;
  newChatLoading?: boolean;
  scrollable?: boolean;
};

export function AppShell({
  children,
  sidebarContent,
  onNewChat,
  newChatLoading,
  scrollable = false,
}: AppShellProps) {
  return (
    <Shell>
      <AppSidebar onNewChat={onNewChat} newChatLoading={newChatLoading}>
        {sidebarContent}
      </AppSidebar>
      <Content $scrollable={scrollable}>{children}</Content>
    </Shell>
  );
}

const Shell = styled.div`
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 10px;
  height: 100vh;
  padding: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--bg-page-accent) 0%, transparent 28%),
    linear-gradient(180deg, #fcfcfd 0%, var(--bg-page) 100%);
  color: var(--text-primary);

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
`;

const Content = styled.main<{ $scrollable: boolean }>`
  min-width: 0;
  min-height: 0;
  overflow-y: ${({ $scrollable }) => ($scrollable ? "auto" : "hidden")};
  display: flex;
  flex-direction: column;
`;
