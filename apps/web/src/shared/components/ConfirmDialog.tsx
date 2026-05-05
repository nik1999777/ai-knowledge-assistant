import styled from "styled-components";

type ConfirmDialogProps = {
  confirmLabel?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  pending?: boolean;
  title: string;
};

export function ConfirmDialog({
  confirmLabel = "Подтвердить",
  message,
  onCancel,
  onConfirm,
  open,
  pending = false,
  title,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <ModalBackdrop
      role="button"
      tabIndex={0}
      aria-label="Закрыть окно подтверждения"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          onCancel();
        }
      }}
    >
      <ModalCard onClick={(event) => event.stopPropagation()}>
        <ModalTitle>{title}</ModalTitle>
        <ModalText>{message}</ModalText>

        <ModalActions>
          <ModalButton type="button" onClick={onCancel} disabled={pending}>
            Отмена
          </ModalButton>
          <DangerButton type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Удаляю..." : confirmLabel}
          </DangerButton>
        </ModalActions>
      </ModalCard>
    </ModalBackdrop>
  );
}

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.16);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalCard = styled.div`
  width: min(520px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 20px;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.14);
`;

const ModalTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 22px;
  line-height: 1.25;
`;

const ModalText = styled.p`
  margin: 0 0 18px;
  color: var(--text-muted);
  line-height: 1.7;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const ModalButton = styled.button`
  background: var(--surface-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;

const DangerButton = styled(ModalButton)`
  background: var(--danger-soft);
  border-color: #fca5a5;
  color: var(--danger);
`;
