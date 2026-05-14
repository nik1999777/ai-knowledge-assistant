import styled, { keyframes } from "styled-components";
import { Link } from "react-router-dom";
import type { DocumentListItem } from "../types/documents";

type DocumentsPanelProps = {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  documentsSearching: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onDelete: (docId: string) => void;
};

export function DocumentsPanel({
  documents,
  documentsLoading,
  documentsSearching,
  searchQuery,
  onSearchChange,
  onDelete,
}: DocumentsPanelProps) {
  return (
    <Section>
      <Header>
        <SectionTitle>Документы в базе знаний</SectionTitle>
        <DocumentsCount>
          {documentsLoading ? "Загрузка..." : `${documents.length} шт.`}
        </DocumentsCount>
      </Header>

      <SearchRow>
        <SearchInput
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Поиск по title, имени файла или содержимому"
        />
        {documentsSearching && <SearchStatus>Поиск...</SearchStatus>}
      </SearchRow>

      {documents.length === 0 && !documentsLoading ? (
        <EmptyText>Документы пока не добавлены.</EmptyText>
      ) : (
        <DocumentsGrid>
          {documents.map((doc) => (
            <DocumentCard key={doc.docId}>
              <DocumentCardHeader>
                <DocumentInfo>
                  <DocumentTitle>{doc.title}</DocumentTitle>
                  <Meta>docId: {doc.docId}</Meta>
                </DocumentInfo>

                <Actions>
                  {doc.ingestionStatus === "processing" ? (
                    <StatusBadge $status="processing">Индексация...</StatusBadge>
                  ) : doc.ingestionStatus === "failed" ? (
                    <StatusBadge $status="failed">Ошибка</StatusBadge>
                  ) : (
                    <OpenLink to={`/documents/${doc.docId}`}>Открыть</OpenLink>
                  )}
                  <DeleteButton onClick={() => onDelete(doc.docId)}>
                    Удалить
                  </DeleteButton>
                </Actions>
              </DocumentCardHeader>
            </DocumentCard>
          ))}
        </DocumentsGrid>
      )}
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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
`;

const DocumentsCount = styled.span`
  color: var(--text-muted);
  font-size: 14px;
  white-space: nowrap;
`;

const EmptyText = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const SearchRow = styled.div`
  margin-bottom: 16px;
`;

const SearchInput = styled.input`
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  color: var(--text-primary);
  padding: 12px 14px;
  font-size: 15px;
  box-sizing: border-box;
`;

const SearchStatus = styled.div`
  margin-top: 10px;
  color: var(--accent-strong);
  font-size: 13px;
`;

const DocumentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
`;

const DocumentCard = styled.div`
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  background: var(--surface-subtle);
`;

const DocumentCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const DocumentInfo = styled.div`
  min-width: 0;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
`;

const DocumentTitle = styled.div`
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.4;
  word-break: break-word;
`;

const Meta = styled.div`
  font-size: 13px;
  color: var(--text-muted);
  word-break: break-word;
`;

const OpenLink = styled(Link)`
  text-decoration: none;
  text-align: center;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid rgba(16, 163, 127, 0.3);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
`;

const DeleteButton = styled.button`
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const StatusBadge = styled.span<{ $status: "processing" | "failed" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  ${({ $status }) =>
    $status === "processing"
      ? `
        background: rgba(234, 179, 8, 0.12);
        color: #ca8a04;
        border: 1px solid rgba(234, 179, 8, 0.3);
        animation: ${pulse} 1.5s ease-in-out infinite;
      `
      : `
        background: var(--danger-soft);
        color: var(--danger);
        border: 1px solid #fecaca;
      `}
`;
