import type { KeyboardEvent } from "react";
import styled from "styled-components";

type ChatPanelProps = {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatPanel({
  question,
  loading,
  onQuestionChange,
  onSubmit,
}: ChatPanelProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <Section>
      <ComposerRow>
        <Textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спроси о загруженных документах..."
        />

        <Button
          onClick={onSubmit}
          disabled={loading}
          $loading={loading}
          aria-label="Отправить сообщение"
        >
          {loading ? <LoadingDots>...</LoadingDots> : <SendIcon />}
        </Button>
      </ComposerRow>
    </Section>
  );
}

const Section = styled.section`
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 10px 12px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
`;

const ComposerRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 64px;
  max-height: 180px;
  resize: none;
  border-radius: 14px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  box-sizing: border-box;

  &::placeholder {
    color: var(--text-muted);
  }
`;

const Button = styled.button<{ $loading: boolean }>`
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: white;
  border: none;
  border-radius: 14px;
  padding: 0;
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(16, 163, 127, 0.22);

  opacity: ${({ $loading }) => ($loading ? 0.7 : 1)};
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
`;

const LoadingDots = styled.span`
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
`;

function SendIcon() {
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
        d="M4 11.5L20 4L13 20L11.2 13.3L4 11.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
