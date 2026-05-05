import styled from "styled-components";
import { DocumentsPanel } from "../../features/documents/components/DocumentsPanel";
import { IngestPanel } from "../../features/documents/components/IngestPanel";
import { AppHeader } from "../../shared/components/AppHeader";
import { ErrorCard } from "../../shared/components/ErrorCard";
import { Layout } from "../../shared/components/Layout";
import { useDocumentsPage } from "./useDocumentsPage";

export function DocumentsPage() {
  const {
    pageError,
    selectedFile,
    uploadMessage,
    documentsSearch,
    documents,
    documentsLoading,
    documentsSearching,
    uploadLoading,
    setSelectedFile,
    setDocumentsSearch,
    handleUpload,
    handleDeleteDocument,
  } = useDocumentsPage();

  return (
    <Layout>
      <AppHeader />

      <HeroCard>
        <Eyebrow>Knowledge Base</Eyebrow>
        <Title>Документы и ingestion</Title>
        <Subtitle>
          Здесь мы управляем знаниями системы: загружаем файлы, проверяем базу
          знаний, удаляем документы и открываем их детали.
        </Subtitle>
      </HeroCard>

      {pageError ? <ErrorCard message={pageError} /> : null}

      <PageGrid>
        <IngestPanel
          selectedFileName={selectedFile?.name ?? ""}
          uploadLoading={uploadLoading}
          uploadMessage={uploadMessage}
          onFileChange={setSelectedFile}
          onUploadSubmit={handleUpload}
        />

        <DocumentsPanel
          documents={documents}
          documentsLoading={documentsLoading}
          documentsSearching={documentsSearching}
          searchQuery={documentsSearch}
          onSearchChange={setDocumentsSearch}
          onDelete={handleDeleteDocument}
        />
      </PageGrid>
    </Layout>
  );
}

const HeroCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const Eyebrow = styled.div`
  color: #93c5fd;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin: 0 0 10px;
  font-size: 30px;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
`;

const PageGrid = styled.div`
  display: grid;
  gap: 20px;
`;
