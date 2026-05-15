import styled from "styled-components";
import { MarkdownAnswer } from "../../../shared/components/MarkdownAnswer";
import { AnswerSection } from "./AnswerSection";
import type { ChatExchange } from "../types/chat";

type ChatHistoryProps = {
  exchanges: ChatExchange[];
};

export function ChatHistory({ exchanges }: ChatHistoryProps) {
  return (
    <Section>
      <HistoryList>
        {exchanges.map((exchange) => (
          <HistoryItem key={exchange.id} id={`exchange-${exchange.id}`}>
            <UserMessage>
              <QuestionText>{exchange.question}</QuestionText>
            </UserMessage>

            {exchange.status === "loading" && (
              <AssistantMessage>
                <StatusText>
                  {exchange.streamedAnswer?.trim() ? (
                    <MarkdownAnswer content={exchange.streamedAnswer} />
                  ) : (
                    "Думаю..."
                  )}
                </StatusText>
              </AssistantMessage>
            )}

            {exchange.status === "error" && (
              <ErrorCard>
                <ErrorText>
                  {exchange.errorMessage ?? "Неизвестная ошибка"}
                </ErrorText>
              </ErrorCard>
            )}

            {exchange.status === "success" && exchange.response && (
              <AnswerSection data={exchange.response} />
            )}
          </HistoryItem>
        ))}
      </HistoryList>
    </Section>
  );
}

const Section = styled.section`
  background: transparent;
  border: none;
  padding: 0;
`;

const HistoryList = styled.div`
  display: grid;
  gap: 20px;
`;

const HistoryItem = styled.article`
  display: grid;
  gap: 10px;
`;

const UserMessage = styled.section`
  justify-self: end;
  width: min(100%, 720px);
  background: rgb(255, 233, 244);
  border: 1px solid rgba(244, 114, 182, 0.18);
  border-radius: 20px;
  padding: 12px 16px;
`;

const AssistantMessage = styled.section`
  justify-self: start;
  width: min(100%, 860px);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0 2px;
`;

const QuestionText = styled.p`
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.6;
`;

const StatusText = styled.p`
  margin: 0;
  color: var(--text-primary);
  line-height: 1.7;
`;

const ErrorCard = styled(AssistantMessage)`
  background: #fff5f5;
  border: 1px solid #fecaca;
  border-radius: 16px;
  padding: 12px 14px;
`;

const ErrorText = styled(StatusText)`
  color: #b91c1c;
`;
