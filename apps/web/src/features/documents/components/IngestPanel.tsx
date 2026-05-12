import { useId } from "react";
import styled from "styled-components";

type IngestPanelProps = {
  selectedFileName: string;
  uploadLoading: boolean;
  uploadMessage: string;
  onFileChange: (file: File | null) => void;
  onUploadSubmit: () => void;
};

export function IngestPanel({
  selectedFileName,
  uploadLoading,
  uploadMessage,
  onFileChange,
  onUploadSubmit,
}: IngestPanelProps) {
  const inputId = useId();

  return (
    <Section>
      <SectionTitle>Добавить документ</SectionTitle>
      <SectionText>
        Загрузка документов работает через upload файлов `.txt`, `.md`, `.csv`,
        `.pdf`, `.docx` и `.zip` с текстовыми файлами внутри.
        `docId` создаётся на backend автоматически.
      </SectionText>

      <PrimaryBlock>
        <BlockHeader>
          <BlockTitle>File Upload</BlockTitle>
          <BlockMeta>Основной ingestion flow</BlockMeta>
        </BlockHeader>

        <FormGroup>
          <Label>Файл</Label>
          <HiddenFileInput
            id={inputId}
            type="file"
            accept=".txt,.md,.csv,.pdf,.docx,.zip,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <FilePicker htmlFor={inputId}>
            <FilePickerButton>Choose File</FilePickerButton>
            <FilePickerMeta>
              {selectedFileName || "Файл ещё не выбран"}
            </FilePickerMeta>
          </FilePicker>
          <HelperText>
            Для экспорта Notion выбери Markdown & CSV, включи subpages/folders
            и загрузи получившийся `.zip`. Название документа будет взято из
            имени файла.
          </HelperText>
          {selectedFileName && (
            <SelectedFile>Выбран файл: {selectedFileName}</SelectedFile>
          )}
        </FormGroup>

        <Actions>
          <Button
            type="button"
            onClick={onUploadSubmit}
            disabled={uploadLoading}
            $loading={uploadLoading}
          >
            {uploadLoading ? "Загружаю файл..." : "Загрузить файл"}
          </Button>
        </Actions>

        {uploadMessage && <IngestMessage>{uploadMessage}</IngestMessage>}
      </PrimaryBlock>
    </Section>
  );
}

const Section = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 14px;
  font-size: 22px;
  font-weight: 700;
`;

const SectionText = styled.p`
  margin-top: 0;
  margin-bottom: 18px;
  color: var(--text-muted);
  line-height: 1.7;
`;

const PrimaryBlock = styled.div`
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  background: var(--surface-subtle);
  margin-bottom: 18px;
`;

const BlockHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const BlockTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const BlockMeta = styled.span`
  color: var(--text-muted);
  font-size: 13px;
`;

const FormGroup = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 15px;
`;

const HiddenFileInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
`;

const FilePicker = styled.label`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 12px 14px;
  box-sizing: border-box;
  cursor: pointer;

  &:hover {
    border-color: var(--border-strong);
  }
`;

const FilePickerButton = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid rgba(16, 163, 127, 0.24);
  font-size: 14px;
  font-weight: 700;
`;

const FilePickerMeta = styled.span`
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
`;

const HelperText = styled.p`
  margin-top: 10px;
  margin-bottom: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
`;

const SelectedFile = styled.p`
  margin-top: 10px;
  margin-bottom: 0;
  color: var(--text-primary);
  line-height: 1.6;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-start;
`;

const Button = styled.button<{ $loading: boolean }>`
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: white;
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(16, 163, 127, 0.24);

  opacity: ${({ $loading }) => ($loading ? 0.7 : 1)};
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
`;

const IngestMessage = styled.p`
  margin-top: 12px;
  margin-bottom: 0;
  color: var(--accent-strong);
  line-height: 1.6;
`;
