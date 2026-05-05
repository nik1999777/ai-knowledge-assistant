import { useChatHistory } from "../../features/chat/hooks/useChatHistory";

export function useHomePage() {
  const chat = useChatHistory();

  return {
    pageError: chat.error,
    chat,
  };
}
