import { useEffect } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { AppHeader } from "../../shared/components/AppHeader";
import { ErrorCard } from "../../shared/components/ErrorCard";
import { Layout } from "../../shared/components/Layout";
import { useDocumentDetailPage } from "./useDocumentDetailPage";

export function DocumentDetailPage() {
  const { activeChunkIndex, activeSnippet, data, isLoading, error, formatDate } =
    useDocumentDetailPage();

  useEffect(() => {
    if (!data || activeChunkIndex === null) {
      return;
    }

    const element = document.getElementById(`chunk-${activeChunkIndex}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeChunkIndex, data]);

  return (
    <Layout>
      <AppHeader />

      <BackLink to="/">← Назад к ассистенту</BackLink>

      {isLoading && <InfoCard>Загружаю документ...</InfoCard>}

      {error && (
        <ErrorCard
          message={error instanceof Error ? error.message : "Ошибка загрузки документа"}
        />
      )}

      {!isLoading && !error && data && (
        <PageGrid>
          <MainCard>
            <CardHeader>
              <TitleBlock>
                <Eyebrow>Document Preview</Eyebrow>
                <Title>{data.title}</Title>
              </TitleBlock>
              <SourceBadge>{data.sourceType.toUpperCase()}</SourceBadge>
            </CardHeader>

            <MetaGrid>
              <MetaItem>
                <MetaLabel>docId</MetaLabel>
                <MetaValue>{data.docId}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Файл</MetaLabel>
                <MetaValue>{data.originalFileName}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Символов</MetaLabel>
                <MetaValue>{data.characters}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Chunks</MetaLabel>
                <MetaValue>{data.chunksCount}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Создан</MetaLabel>
                <MetaValue>{formatDate(data.createdAt)}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Обновлён</MetaLabel>
                <MetaValue>{formatDate(data.updatedAt)}</MetaValue>
              </MetaItem>
            </MetaGrid>

            {data.warnings.length > 0 && (
              <WarningsCard>
                <WarningsTitle>Warnings</WarningsTitle>
                <WarningsList>
                  {data.warnings.map((warning) => (
                    <WarningItem key={warning}>{warning}</WarningItem>
                  ))}
                </WarningsList>
              </WarningsCard>
            )}

            <ContentSection>
              <SectionTitle>Chunks</SectionTitle>
              <ChunksGrid>
                {data.chunks.map((chunk) => (
                  <ChunkCard
                    id={`chunk-${chunk.chunkIndex}`}
                    key={chunk.chunkIndex}
                    $active={chunk.chunkIndex === activeChunkIndex}
                  >
                    <ChunkHeader>
                      <ChunkTitle>Chunk {chunk.chunkIndex}</ChunkTitle>
                      {chunk.chunkIndex === activeChunkIndex ? (
                        <ChunkBadge>Referenced in chat</ChunkBadge>
                      ) : null}
                    </ChunkHeader>
                    <ChunkText>
                      {renderHighlightedChunk(
                        chunk.text,
                        chunk.chunkIndex === activeChunkIndex ? activeSnippet : null,
                      )}
                    </ChunkText>
                  </ChunkCard>
                ))}
              </ChunksGrid>
            </ContentSection>

            <ContentSection>
              <SectionTitle>Extracted Text</SectionTitle>
              <ContentBlock>{data.textContent}</ContentBlock>
            </ContentSection>
          </MainCard>

          <SideCard>
            <SectionTitle>Inspect</SectionTitle>
            <SideText>
              Страница показывает не только полный extracted text, но и те же
              chunk-ы, которые используются в retrieval flow.
            </SideText>
            <SideText>
              Если открыть источник из чата, связанный chunk будет подсвечен и
              прокручен в центр экрана.
            </SideText>
          </SideCard>
        </PageGrid>
      )}
    </Layout>
  );
}

const BackLink = styled(Link)`
  display: inline-block;
  margin-bottom: 18px;
  text-decoration: none;
  color: var(--accent-strong);
  font-weight: 600;
`;

const InfoCard = styled.div`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow-soft);
`;

const PageGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 20px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const MainCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  box-shadow: var(--shadow-soft);
`;

const SideCard = styled.aside`
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  height: fit-content;
  box-shadow: var(--shadow-soft);
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const TitleBlock = styled.div``;

const Eyebrow = styled.div`
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 30px;
  line-height: 1.15;
`;

const SourceBadge = styled.div`
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid rgba(16, 163, 127, 0.3);
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const MetaItem = styled.div`
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-subtle);
  padding: 14px;
`;

const MetaLabel = styled.div`
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 8px;
`;

const MetaValue = styled.div`
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
`;

const WarningsCard = styled.div`
  margin-bottom: 20px;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  border-radius: 16px;
  padding: 16px;
`;

const WarningsTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
`;

const WarningsList = styled.ul`
  margin: 0;
  padding-left: 18px;
  color: #92400e;
`;

const WarningItem = styled.li`
  line-height: 1.6;
`;

const ContentSection = styled.section``;

const SectionTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 18px;
`;

const ContentBlock = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.75;
  font-family: "SFMono-Regular", "Menlo", "Monaco", monospace;
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  color: var(--text-secondary);
  max-height: 70vh;
  overflow: auto;
`;

const ChunksGrid = styled.div`
  display: grid;
  gap: 14px;
  margin-bottom: 22px;
`;

const ChunkCard = styled.article<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.35)" : "var(--border)"};
  border-radius: 18px;
  padding: 16px;
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface-subtle)"};
  box-shadow: ${({ $active }) =>
    $active ? "0 0 0 1px rgba(16, 163, 127, 0.18)" : "none"};
  scroll-margin-top: 24px;
`;

const ChunkHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
`;

const ChunkTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
`;

const ChunkBadge = styled.span`
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid rgba(16, 163, 127, 0.3);
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 700;
`;

const ChunkText = styled.p`
  margin: 0;
  line-height: 1.75;
  color: var(--text-secondary);
  white-space: pre-wrap;
`;

const SnippetMark = styled.mark`
  background: #fef3c7;
  color: #92400e;
  border-radius: 6px;
  padding: 1px 3px;
`;

const SideText = styled.p`
  margin-top: 0;
  margin-bottom: 14px;
  color: var(--text-muted);
  line-height: 1.7;
`;

function renderHighlightedChunk(text: string, snippet: string | null) {
  if (!snippet) {
    return text;
  }

  const normalizedSnippet = snippet.trim();

  if (!normalizedSnippet) {
    return text;
  }

  const startIndex = text.toLocaleLowerCase().indexOf(
    normalizedSnippet.toLocaleLowerCase(),
  );

  if (startIndex === -1) {
    return text;
  }

  const endIndex = startIndex + normalizedSnippet.length;

  return (
    <>
      {text.slice(0, startIndex)}
      <SnippetMark>{text.slice(startIndex, endIndex)}</SnippetMark>
      {text.slice(endIndex)}
    </>
  );
}
