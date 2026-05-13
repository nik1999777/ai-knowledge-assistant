import type { KeyboardEvent } from "react";
import styled from "styled-components";
import type { AnswerMode } from "../types/chat";

type ChatPanelProps = {
  answerMode: AnswerMode;
  question: string;
  loading: boolean;
  onAnswerModeChange: (value: AnswerMode) => void;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
};

const ANSWER_MODES: Array<{
  description: string;
  label: string;
  value: AnswerMode;
}> = [
  {
    description: "Только прямой ответ из найденного контекста, иначе отказ.",
    label: "Strict",
    value: "strict",
  },
  {
    description: "Честный частичный ответ по документам без внешних знаний.",
    label: "Balanced",
    value: "balanced",
  },
  {
    description: "Сначала по документам, затем отдельное общее пояснение.",
    label: "Tutor",
    value: "tutor",
  },
];

export function ChatPanel({
  answerMode,
  question,
  loading,
  onAnswerModeChange,
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
      <ModeRow aria-label="Режим ответа">
        {ANSWER_MODES.map((mode) => (
          <ModeItem key={mode.value}>
            <ModeButton
              type="button"
              $active={answerMode === mode.value}
              aria-describedby={`answer-mode-${mode.value}`}
              disabled={loading}
              onClick={() => onAnswerModeChange(mode.value)}
            >
              {mode.label}
            </ModeButton>
            <ModeTooltip id={`answer-mode-${mode.value}`} role="tooltip">
              {mode.description}
            </ModeTooltip>
          </ModeItem>
        ))}
      </ModeRow>

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

const ModeRow = styled.div`
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  width: min(360px, 100%);
  padding: 3px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.9);
`;

const ModeItem = styled.div`
  position: relative;
  min-width: 0;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  width: 100%;
  min-height: 30px;
  border: 0;
  border-radius: 9px;
  background: ${({ $active }) => ($active ? "var(--surface)" : "transparent")};
  color: ${({ $active }) =>
    $active ? "var(--text-primary)" : "var(--text-secondary)"};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: ${({ $active }) =>
    $active ? "0 1px 5px rgba(15, 23, 42, 0.08)" : "none"};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const ModeTooltip = styled.span`
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 4;
  width: max-content;
  max-width: min(260px, 80vw);
  transform: translateX(-50%) translateY(2px);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.96);
  color: white;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 140ms ease,
    transform 140ms ease,
    visibility 140ms ease;

  ${ModeItem}:hover &,
  ${ModeItem}:focus-within & {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(15, 23, 42, 0.96);
  }
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
