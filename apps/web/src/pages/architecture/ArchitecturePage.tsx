import { useState } from "react";
import styled from "styled-components";
import { AppHeader } from "../../shared/components/AppHeader";
import { Layout } from "../../shared/components/Layout";

type StageId =
  | "upload"
  | "parse_chunk"
  | "index"
  | "retrieve"
  | "decision"
  | "generation";

type StageInfo = {
  id: StageId;
  title: string;
  subtitle: string;
  goal: string;
  flow: string[];
  metrics: string[];
  failures: string[];
  interview: string[];
  backendFiles: string[];
  frontendFiles: string[];
};

const STAGES: StageInfo[] = [
  {
    id: "upload",
    title: "1. Upload",
    subtitle: "TXT / MD / PDF / DOCX",
    goal: "Принять файл, валидировать формат и передать в ingestion pipeline.",
    flow: [
      "Frontend отправляет multipart-запрос с файлом.",
      "Backend проверяет mime/type и размер.",
      "Файл уходит в parser для извлечения текста.",
    ],
    metrics: [
      "upload_success_rate",
      "ingest_error_rate",
      "avg_upload_latency_ms",
    ],
    failures: [
      "Неподдерживаемый формат файла.",
      "Пустой extraction result после парсинга.",
      "Слишком большой файл и таймаут.",
    ],
    interview: [
      "Почему multipart, а не JSON?",
      "Как проект защищается от плохих файлов?",
      "Что делаем с частично испорченными PDF?",
    ],
    backendFiles: [
      "apps/api/src/modules/documents/documents.controller.ts",
      "apps/api/src/modules/documents/document-ingest.service.ts",
    ],
    frontendFiles: [
      "apps/web/src/features/documents/components/IngestPanel.tsx",
      "apps/web/src/pages/home/useHomePage.ts",
    ],
  },
  {
    id: "parse_chunk",
    title: "2. Parse + Chunk",
    subtitle: "Normalization + section-aware chunks",
    goal: "Преобразовать сырой документ в стабильные chunk-ы для retrieval.",
    flow: [
      "Parser извлекает textContent и warnings.",
      "Chunk service нормализует текст и режет на фрагменты.",
      "Каждый chunk получает metadata: index/section/chunkLen.",
    ],
    metrics: ["avg_chunk_len", "chunks_per_doc", "parse_warning_rate"],
    failures: [
      "Огромные chunk-ы ухудшают retrieval precision.",
      "Слишком мелкие chunk-ы ухудшают контекст для LLM.",
      "Потеря структуры документа (заголовков/секций).",
    ],
    interview: [
      "Почему chunking влияет на качество сильнее, чем модель?",
      "Как выбирали размер chunk-ов?",
      "Зачем хранить section/chunkLen в metadata?",
    ],
    backendFiles: [
      "apps/api/src/services/document-parser.service.ts",
      "apps/api/src/services/chunk.service.ts",
      "apps/api/src/modules/documents/document-query.service.ts",
    ],
    frontendFiles: [
      "apps/web/src/pages/document-detail/DocumentDetailPage.tsx",
      "apps/web/src/features/documents/types/documents.ts",
    ],
  },
  {
    id: "index",
    title: "3. Index",
    subtitle: "Embeddings -> Qdrant, metadata -> Postgres, scope isolation",
    goal: "Сохранить документ так, чтобы потом искать и семантически, и лексически.",
    flow: [
      "Для chunk-ов строятся embeddings.",
      "Вектора и payload сохраняются в Qdrant, включая `documentScope`, `docId`, `chunkIndex`, `section` и текст chunk-а.",
      "Metadata + text + search_vector сохраняются в Postgres, тоже с `documentScope`.",
      "Один и тот же chunk становится доступен и для vector retrieval, и для lexical search.",
      "`user` документы отделены от `eval` benchmark документов, чтобы обычный чат и seed eval не загрязняли друг друга.",
    ],
    metrics: [
      "index_success_rate",
      "embedding_latency_ms",
      "qdrant_upsert_ms",
      "document_scope",
    ],
    failures: [
      "Несогласованность между Qdrant и Postgres после частичной ошибки.",
      "Слишком долгая генерация embeddings.",
      "Слабый chunking портит качество retrieval еще до запроса пользователя.",
    ],
    interview: [
      "Зачем хранить вектора отдельно от metadata?",
      "Почему нужна FTS в Postgres, если есть vector search?",
      "Как делаем cleanup при удалении документа?",
      "Зачем нужен document_scope для eval и user документов?",
    ],
    backendFiles: [
      "apps/api/src/clients/qdrant.client.ts",
      "apps/api/src/repositories/documents.repository.ts",
      "apps/api/src/db/migrations/002_documents_search_vector.sql",
      "apps/api/src/db/migrations/003_document_scope.sql",
    ],
    frontendFiles: ["apps/web/src/features/documents/api/documents.ts"],
  },
  {
    id: "retrieve",
    title: "4. Retrieve",
    subtitle: "Vector + lexical -> RRF fusion -> rerank",
    goal: "Найти лучшие фрагменты знаний для конкретного вопроса.",
    flow: [
      "Вопрос -> embedding -> vector search в Qdrant, сразу с filter по `documentScope`.",
      "Параллельно lexical search в Postgres FTS.",
      "Кандидаты дедуплицируются по `docId:chunkIndex`.",
      "Reciprocal Rank Fusion (RRF) объединяет ранги vector и lexical кандидатов: если chunk высоко в обоих списках, он получает сильный общий сигнал.",
      "После RRF применяется легкий local rerank: token overlap, совпадение title/section, phrase bonus и short chunk penalty.",
      "Финальные chunk-ы попадают в `sources` и становятся grounding-контекстом для LLM.",
    ],
    metrics: [
      "vector_count",
      "lexical_count",
      "merged_count",
      "reranked_count",
      "origin",
      "vector_rank",
      "lexical_rank",
      "rrf_score",
      "final_score",
    ],
    failures: [
      "Vector находит мало кандидатов при узких формулировках.",
      "Lexical шумит на длинных вопросах.",
      "Неверный fusion/rerank усиливает нерелевантные chunk-ы.",
      "Слабый retrieval потом приводит к расплывчатому ответу даже при хорошей модели.",
      "Без Qdrant scope filter top-K может заполниться чужими eval/user документами еще до дедупликации.",
    ],
    interview: [
      "Почему hybrid retrieval лучше чисто vector?",
      "Что дает RRF по сравнению с простым sort по score?",
      "Почему score vector и score lexical нельзя просто складывать напрямую?",
      "Как дебажить, если есть score, но контекст плохой?",
    ],
    backendFiles: [
      "apps/api/src/modules/chat/chat.service.ts",
      "apps/api/src/repositories/documents.repository.ts",
      "apps/api/src/clients/qdrant.client.ts",
      "apps/api/src/utils/tokenization.ts",
    ],
    frontendFiles: [
      "apps/web/src/features/chat/components/AnswerSection.tsx",
      "apps/web/src/features/chat/types/chat.ts",
    ],
  },
  {
    id: "decision",
    title: "5. Decision Policy",
    subtitle: "Dual-threshold + guardrails",
    goal: "Решить: отвечаем или безопасно отклоняем вопрос.",
    flow: [
      "Считается `bestScore`: это итоговый score лучшего source после RRF fusion и local rerank.",
      "Срабатывают `declineThreshold` и `answerThreshold`.",
      "В mid-band зоне учитываются `domainEvidence` и дополнительные guardrails.",
      "В debug пишется `decision` и `guardrailReason`, чтобы решение было объяснимым.",
    ],
    metrics: [
      "answerability_accuracy",
      "fp_rate",
      "fn_rate",
      "decline_rate",
      "domain_evidence",
    ],
    failures: [
      "Слишком строгая policy: много false negative.",
      "Слишком мягкая policy: много false positive/hallucinations.",
      "Непрозрачные причины declined для пользователя.",
      "Высокий score без evidence может привести к правдоподобной, но неверной генерации.",
    ],
    interview: [
      "Почему один threshold хуже dual-threshold?",
      "Как вы выбирали пороги в проекте?",
      "Какие риски у высокого FP vs высокого FN?",
      "Почему после изменения retrieval нужно снова прогонять `eval:seed`?",
    ],
    backendFiles: [
      "apps/api/src/modules/chat/chat.service.ts",
      "apps/api/src/config/env.ts",
      "apps/api/src/modules/chat/chat.types.ts",
    ],
    frontendFiles: [
      "apps/web/src/features/chat/components/AnswerSection.tsx",
      "apps/web/src/features/chat/types/chat.ts",
    ],
  },
  {
    id: "generation",
    title: "6. Generation",
    subtitle: "LLM отвечает только из retrieved context",
    goal: "Сгенерировать итоговый ответ и отдать его стримингом в UI.",
    flow: [
      "Prompt строится из вопроса + retrieved chunks + правил grounded-ответа.",
      "LLM стримит ответ по SSE.",
      "Frontend показывает answer, timing, sources и debug.",
      "Качество generation оценивается не отдельно, а вместе с качеством контекста и decision policy.",
    ],
    metrics: ["llm_latency_ms", "total_latency_ms", "stream_error_rate"],
    failures: [
      "Слишком общий prompt без жесткого grounding.",
      "Неполный context при обрезке top-k.",
      "Срыв SSE и обрыв ответа на фронте.",
      "Хороший retrieval можно испортить слабой prompt-сборкой.",
    ],
    interview: [
      "Как контролируете hallucinations на этапе generation?",
      "Почему стриминг важен для UX?",
      "Что показываете пользователю для explainability?",
    ],
    backendFiles: [
      "apps/api/src/services/prompt.service.ts",
      "apps/api/src/services/llm.service.ts",
      "apps/api/src/modules/chat/chat.controller.ts",
    ],
    frontendFiles: [
      "apps/web/src/features/chat/api/chat.ts",
      "apps/web/src/features/chat/hooks/useChatHistory.ts",
      "apps/web/src/features/chat/components/ChatHistory.tsx",
    ],
  },
];

export function ArchitecturePage() {
  const [selectedStageId, setSelectedStageId] = useState<StageId>("retrieve");
  const selectedStage =
    STAGES.find((stage) => stage.id === selectedStageId) ?? STAGES[0];

  return (
    <Layout>
      <AppHeader />

      <IntroCard>
        <Eyebrow>Architecture</Eyebrow>
        <Title>RAG Mind Map: интерактивный разбор проекта</Title>
        <Subtitle>
          Это живая шпаргалка по пайплайну. Здесь зафиксировано, как документы
          проходят ingestion, как user/eval scope изолирует данные, как hybrid
          retrieval использует RRF, и какие debug-поля смотреть, чтобы понять,
          почему конкретный chunk попал в ответ.
        </Subtitle>
      </IntroCard>

      <SectionCard>
        <SectionTitle>Текущая версия пайплайна</SectionTitle>
        <StageGoal>
          Документ загружается в Postgres и Qdrant с `documentScope`. Вопрос
          идет одновременно в vector search и lexical search. Затем RRF
          объединяет ранги, local rerank уточняет порядок, decision policy
          решает отвечать или declined, а UI показывает answer, sources, timing
          и retrieval debug.
        </StageGoal>
        <TagList>
          <MetricTag>document_scope: user/eval</MetricTag>
          <MetricTag>Qdrant scope filter</MetricTag>
          <MetricTag>Postgres FTS</MetricTag>
          <MetricTag>RRF_K=60</MetricTag>
          <MetricTag>origin: vector/lexical/hybrid</MetricTag>
          <MetricTag>final_score</MetricTag>
        </TagList>
      </SectionCard>

      <SectionCard>
        <SectionTitle>Mind Map (кликни этап)</SectionTitle>
        <MapGrid>
          {STAGES.map((stage, index) => (
            <MapItem key={stage.id}>
              <NodeButton
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                $active={selectedStage.id === stage.id}
              >
                <NodeTitle>{stage.title}</NodeTitle>
                <NodeText>{stage.subtitle}</NodeText>
              </NodeButton>
              {index < STAGES.length - 1 ? <Arrow>→</Arrow> : null}
            </MapItem>
          ))}
        </MapGrid>
      </SectionCard>

      <SectionCard>
        <SectionTitle>Выбранный этап: {selectedStage.title}</SectionTitle>
        <StageGoal>{selectedStage.goal}</StageGoal>

        <ThreeColumn>
          <DetailBlock>
            <BlockTitle>Как работает</BlockTitle>
            <InfoList>
              {selectedStage.flow.map((item) => (
                <InfoItem key={item}>{item}</InfoItem>
              ))}
            </InfoList>
          </DetailBlock>

          <DetailBlock>
            <BlockTitle>Ключевые метрики</BlockTitle>
            <TagList>
              {selectedStage.metrics.map((metric) => (
                <MetricTag key={metric}>{metric}</MetricTag>
              ))}
            </TagList>
          </DetailBlock>

          <DetailBlock>
            <BlockTitle>Частые проблемы</BlockTitle>
            <InfoList>
              {selectedStage.failures.map((item) => (
                <InfoItem key={item}>{item}</InfoItem>
              ))}
            </InfoList>
          </DetailBlock>
        </ThreeColumn>

        <TwoColumn>
          <DetailBlock>
            <BlockTitle>Файлы Backend (где смотреть код)</BlockTitle>
            <PathList>
              {selectedStage.backendFiles.map((file) => (
                <PathItem key={file}>{file}</PathItem>
              ))}
            </PathList>
          </DetailBlock>

          <DetailBlock>
            <BlockTitle>Файлы Frontend (где смотреть код)</BlockTitle>
            <PathList>
              {selectedStage.frontendFiles.map((file) => (
                <PathItem key={file}>{file}</PathItem>
              ))}
            </PathList>
          </DetailBlock>
        </TwoColumn>

        <InterviewBlock>
          <BlockTitle>Что говорить на собеседовании по этому этапу</BlockTitle>
          <InfoList>
            {selectedStage.interview.map((item) => (
              <InfoItem key={item}>{item}</InfoItem>
            ))}
          </InfoList>
        </InterviewBlock>
      </SectionCard>

    </Layout>
  );
}

const IntroCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const Eyebrow = styled.div`
  color: var(--accent-strong);
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

const SectionCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const SectionTitle = styled.h3`
  margin: 0 0 14px;
  font-size: 22px;
`;

const MapGrid = styled.div`
  display: grid;
  gap: 12px;
`;

const MapItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  align-items: center;
  gap: 12px;
`;

const NodeButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.35)" : "var(--border)"};
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface-subtle)"};
  border-radius: 14px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
`;

const NodeTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-primary);
`;

const NodeText = styled.div`
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
`;

const Arrow = styled.div`
  color: var(--accent);
  font-size: 22px;
  font-weight: 700;
  text-align: center;
`;

const StageGoal = styled.p`
  margin: 0 0 14px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const TwoColumn = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 14px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ThreeColumn = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const DetailBlock = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 14px;
  padding: 14px;
`;

const InterviewBlock = styled(DetailBlock)`
  margin-top: 14px;
`;

const BlockTitle = styled.h4`
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text-primary);
`;

const InfoList = styled.ul`
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
`;

const InfoItem = styled.li`
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 14px;
`;

const TagList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const MetricTag = styled.span`
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--accent-strong);
`;

const PathList = styled.div`
  display: grid;
  gap: 8px;
`;

const PathItem = styled.code`
  display: block;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
`;
