import { useEffect, useRef } from "react";
import styled from "styled-components";
import { ChatHistory } from "../../features/chat/components/ChatHistory";
import { ChatPanel } from "../../features/chat/components/ChatPanel";
import { ChatSidebar } from "../../features/chat/components/ChatSidebar";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorCard } from "../../shared/components/ErrorCard";
import { useHomePage } from "./useHomePage";

export function HomePage() {
  const { pageError, chat } = useHomePage();
  const historyViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependRef = useRef<{
    previousScrollHeight: number;
    previousScrollTop: number;
  } | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousHistoryLengthRef = useRef(0);
  const previousSessionIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const viewport = historyViewportRef.current;

    if (!viewport) {
      return;
    }

    const currentViewport = viewport;

    function handleScroll() {
      shouldStickToBottomRef.current = isNearBottom(currentViewport);

      if (
        !chat.loading &&
        !chat.loadingHistory &&
        currentViewport.scrollTop < 80 &&
        chat.hasOlder &&
        !chat.loadingOlder &&
        !pendingPrependRef.current
      ) {
        pendingPrependRef.current = {
          previousScrollHeight: currentViewport.scrollHeight,
          previousScrollTop: currentViewport.scrollTop,
        };
        void chat.handleLoadOlder();
      }
    }

    currentViewport.addEventListener("scroll", handleScroll);

    return () => {
      currentViewport.removeEventListener("scroll", handleScroll);
    };
  }, [
    chat.handleLoadOlder,
    chat.hasOlder,
    chat.loading,
    chat.loadingHistory,
    chat.loadingOlder,
  ]);

  useEffect(() => {
    const viewport = historyViewportRef.current;

    if (!viewport) {
      return;
    }

    if (pendingPrependRef.current && !chat.loadingOlder) {
      const { previousScrollHeight, previousScrollTop } = pendingPrependRef.current;
      const nextScrollTop =
        previousScrollTop + (viewport.scrollHeight - previousScrollHeight);

      viewport.scrollTop = nextScrollTop;
      pendingPrependRef.current = null;
      return;
    }

    const sessionChanged = previousSessionIdRef.current !== chat.activeSessionId;
    const historyGrew = chat.history.length > previousHistoryLengthRef.current;

    if (sessionChanged && !chat.loadingHistory) {
      scrollToBottom(viewport);
      shouldStickToBottomRef.current = true;
    } else if ((historyGrew || chat.loading) && shouldStickToBottomRef.current) {
      scrollToBottom(viewport);
    }

    previousHistoryLengthRef.current = chat.history.length;
    previousSessionIdRef.current = chat.activeSessionId;
  }, [
    chat.activeSessionId,
    chat.history,
    chat.loading,
    chat.loadingHistory,
    chat.loadingOlder,
  ]);

  return (
    <Page>
      <PageShell>
        <Workspace>
          <ChatSidebar
            activeSessionId={chat.activeSessionId}
            sessions={chat.sessions}
            sessionsLoading={chat.sessionsLoading}
            loading={chat.loading}
            deletingSession={chat.deletingSession}
            onCreateSession={chat.handleCreateSession}
            onDeleteSession={chat.handleDeleteSession}
            onSessionSelect={chat.setActiveSessionId}
          />

          <MainColumn>
            {pageError && <ErrorCard message={pageError} />}

            <ChatShell>
              {chat.hasOlder || chat.loadingOlder ? (
                <LoadMoreHint>
                  {chat.loadingOlder
                    ? "Загружаю более ранние сообщения..."
                    : "Прокрутите вверх, чтобы загрузить более ранние сообщения."}
                </LoadMoreHint>
              ) : null}

              <HistoryViewport ref={historyViewportRef}>
                {chat.history.length === 0 && !chat.loading && !pageError ? (
                  <EmptyWrap>
                    <EmptyState />
                  </EmptyWrap>
                ) : (
                  <ChatHistory exchanges={chat.history} />
                )}
              </HistoryViewport>

              <ComposerDock>
                <ChatPanel
                  question={chat.question}
                  loading={chat.loading}
                  onQuestionChange={chat.setQuestion}
                  onSubmit={chat.handleAsk}
                />
              </ComposerDock>
            </ChatShell>
          </MainColumn>
        </Workspace>
      </PageShell>

    </Page>
  );
}

const Page = styled.div`
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--bg-page-accent) 0%, transparent 28%),
    linear-gradient(180deg, #fcfcfd 0%, var(--bg-page) 100%);
  color: var(--text-primary);
  padding: 10px;
`;

const PageShell = styled.div`
  height: 100%;
  min-height: 0;
`;

const Workspace = styled.div`
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
    overflow: visible;
  }
`;

const MainColumn = styled.div`
  min-width: 0;
  display: grid;
  min-height: 0;
  overflow: hidden;
`;

const ChatShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 24px;
  padding: 14px;
`;

const EmptyWrap = styled.div`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow-soft);
`;

const LoadMoreHint = styled.div`
  min-width: 220px;
  width: fit-content;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(229, 231, 235, 0.95);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
`;

const HistoryViewport = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  padding-bottom: 12px;
  scroll-padding-bottom: 24px;
`;

const ComposerDock = styled.div`
  z-index: 2;
  margin-top: auto;
`;

function scrollToBottom(element: HTMLDivElement) {
  element.scrollTop = element.scrollHeight;
}

function isNearBottom(element: HTMLDivElement, threshold = 96) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
  );
}
