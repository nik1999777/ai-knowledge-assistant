import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../app/queryKeys";
import {
  createChatSession,
  deleteChatSession,
  getChatSessionDetail,
  getChatSessions,
  streamQuestion,
} from "../api/chat";
import type { AnswerMode, ChatExchange } from "../types/chat";

export function useChatHistory() {
  const PAGE_SIZE = 5;
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("balanced");
  const [history, setHistory] = useState<ChatExchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [initializedLatestSession, setInitializedLatestSession] = useState(false);
  const [oldestLoadedPage, setOldestLoadedPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    totalExchanges: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }>();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: queryKeys.chatSessions(),
    queryFn: getChatSessions,
  });

  const createSessionMutation = useMutation({
    mutationFn: createChatSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions() });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions() });
    },
  });

  const sessions = sessionsQuery.data?.sessions ?? [];

  useEffect(() => {
    if (sessions.length === 0) {
      if (initializedLatestSession) {
        setInitializedLatestSession(false);
      }

      if (activeSessionId) {
        setActiveSessionId(undefined);
      }

      return;
    }

    if (!initializedLatestSession) {
      setActiveSessionId(sessions[0].id);
      setInitializedLatestSession(true);
      return;
    }

    const exists = sessions.some((session) => session.id === activeSessionId);

    if (!exists) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, initializedLatestSession, sessions]);

  useEffect(() => {
    if (loading || !activeSessionId) {
      if (!activeSessionId) {
        setHistory([]);
        setPagination(undefined);
        setOldestLoadedPage(1);
      }
      return;
    }

    let isCancelled = false;
    const sessionId = activeSessionId;

    async function loadInitialPage() {
      setLoadingHistory(true);

      try {
        const data = await queryClient.fetchQuery({
          queryKey: queryKeys.chatSession(sessionId, 1, PAGE_SIZE),
          queryFn: () =>
            getChatSessionDetail(sessionId, {
              page: 1,
              pageSize: PAGE_SIZE,
            }),
        });

        if (isCancelled) {
          return;
        }

        setHistory(data.exchanges);
        setPagination(data.pagination);
        setOldestLoadedPage(1);
        setError("");
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Ошибка загрузки диалога",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoadingHistory(false);
        }
      }
    }

    void loadInitialPage();

    return () => {
      isCancelled = true;
    };
  }, [activeSessionId, loading, queryClient]);

  async function handleAsk() {
    if (!question.trim()) {
      setError("Введите вопрос");
      return;
    }

    const questionValue = question.trim();
    const exchangeId = crypto.randomUUID();

    setOldestLoadedPage(1);
    setLoading(true);
    setError("");
    setQuestion("");
    setHistory((current) => [
      ...current,
      {
        id: exchangeId,
        question: questionValue,
        status: "loading",
        createdAt: new Date().toISOString(),
        streamedAnswer: "",
      },
    ]);

    try {
      let answer = "";

      const meta = await streamQuestion(questionValue, {
        answerMode,
        sessionId: activeSessionId,
        onChunk: (chunk) => {
          answer += chunk;

          setHistory((current) =>
            current.map((exchange) =>
              exchange.id === exchangeId
                ? {
                    ...exchange,
                    streamedAnswer: answer,
                  }
                : exchange,
            ),
          );
        },
      });

      if (meta.sessionId !== activeSessionId) {
        setActiveSessionId(meta.sessionId);
      } else {
        setPagination((current) => {
          const totalExchanges = (current?.totalExchanges ?? history.length) + 1;

          return {
            page: 1,
            pageSize: PAGE_SIZE,
            totalExchanges,
            totalPages: Math.max(1, Math.ceil(totalExchanges / PAGE_SIZE)),
            hasNextPage: totalExchanges > PAGE_SIZE,
            hasPreviousPage: false,
          };
        });
      }

      setHistory((current) =>
        current.map((exchange) =>
          exchange.id === exchangeId
            ? {
                ...exchange,
                status: "success",
                streamedAnswer: undefined,
                response: {
                  answer,
                  ...meta,
                },
              }
            : exchange,
        ),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions() }),
        queryClient.invalidateQueries({
          queryKey: ["chat-session", meta.sessionId],
        }),
      ]);
    } catch (err) {
      setHistory((current) =>
        current.map((exchange) =>
          exchange.id === exchangeId
            ? {
                ...exchange,
                status: "error",
                errorMessage:
                  err instanceof Error ? err.message : "Неизвестная ошибка",
              }
            : exchange,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    try {
      const session = await createSessionMutation.mutateAsync();
      setActiveSessionId(session.id);
      setOldestLoadedPage(1);
      setHistory([]);
      setPagination(undefined);
      setQuestion("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания диалога");
    }
  }

  async function handleClearHistory() {
    if (!activeSessionId) {
      return;
    }

    await handleDeleteSession(activeSessionId);
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await deleteSessionMutation.mutateAsync(sessionId);
      queryClient.removeQueries({ queryKey: ["chat-session", sessionId] });

      const refreshed = await sessionsQuery.refetch();
      const nextSessionId = refreshed.data?.sessions?.[0]?.id;
      const deletedActiveSession = sessionId === activeSessionId;

      if (deletedActiveSession) {
        setActiveSessionId(nextSessionId);
        setOldestLoadedPage(1);
        setHistory([]);
        setPagination(undefined);

        if (nextSessionId) {
          await queryClient.invalidateQueries({
            queryKey: ["chat-session", nextSessionId],
          });
        }
      }

      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления диалога");
    }
  }

  async function handleLoadOlder() {
    if (!activeSessionId || !pagination || loadingOlder || loadingHistory) {
      return;
    }

    if (oldestLoadedPage >= pagination.totalPages) {
      return;
    }

    const nextPage = oldestLoadedPage + 1;
    setLoadingOlder(true);

    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.chatSession(activeSessionId, nextPage, PAGE_SIZE),
        queryFn: () =>
          getChatSessionDetail(activeSessionId, {
            page: nextPage,
            pageSize: PAGE_SIZE,
          }),
      });

      setHistory((current) => [...data.exchanges, ...current]);
      setOldestLoadedPage(nextPage);
      setPagination((current) =>
        current
          ? {
              ...current,
              totalExchanges: data.pagination.totalExchanges,
              totalPages: data.pagination.totalPages,
              hasNextPage: nextPage < data.pagination.totalPages,
            }
          : data.pagination,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки старых сообщений",
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  const activeSessionTitle = useMemo(
    () => sessions.find((session) => session.id === activeSessionId)?.title ?? "",
    [activeSessionId, sessions],
  );

  return {
    activeSessionId,
    activeSessionTitle,
    sessions,
    sessionsLoading: sessionsQuery.isLoading,
    pagination,
    question,
    answerMode,
    history,
    loading,
    loadingHistory,
    loadingOlder,
    hasOlder: Boolean(pagination && oldestLoadedPage < pagination.totalPages),
    deletingSession: deleteSessionMutation.isPending,
    error,
    setQuestion,
    setAnswerMode,
    setActiveSessionId,
    handleAsk,
    handleLoadOlder,
    handleCreateSession,
    handleClearHistory,
    handleDeleteSession,
  };
}
