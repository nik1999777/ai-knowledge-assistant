import { useMemo, useState } from "react";
import styled from "styled-components";
import { AppHeader } from "../../shared/components/AppHeader";
import { Layout } from "../../shared/components/Layout";

type ViewId = "pipeline" | "retrieval" | "eval" | "storage" | "api" | "debug";
type TraceId = "question" | "decline" | "ingestion" | "seed_eval";
type StageId =
  | "upload"
  | "parse_chunk"
  | "index"
  | "retrieve"
  | "decision"
  | "generation"
  | "history";

type StageInfo = {
  id: StageId;
  title: string;
  subtitle: string;
  goal: string;
  flow: string[];
  metrics: string[];
  failures: string[];
  files: string[];
};

type TraceStep = {
  title: string;
  description: string;
  files: string[];
};

const VIEWS: Array<{ id: ViewId; title: string; subtitle: string }> = [
  {
    id: "pipeline",
    title: "Pipeline",
    subtitle: "Весь путь данных",
  },
  {
    id: "retrieval",
    title: "Retrieval",
    subtitle: "Vector + FTS + RRF",
  },
  {
    id: "eval",
    title: "Eval",
    subtitle: "Как меряем качество",
  },
  {
    id: "storage",
    title: "Storage",
    subtitle: "Postgres, Qdrant, Ollama",
  },
  {
    id: "api",
    title: "API",
    subtitle: "Routes и UI",
  },
  {
    id: "debug",
    title: "Debug",
    subtitle: "Как читать ответ",
  },
];

const STAGES: StageInfo[] = [
  {
    id: "upload",
    title: "1. Upload",
    subtitle: "TXT / MD / PDF / DOCX",
    goal: "Принять файл, проверить формат и отправить его в ingestion pipeline.",
    flow: [
      "Web отправляет multipart-запрос на backend.",
      "Fastify controller валидирует файл и запускает ingest service.",
      "Parser извлекает текст и warnings, если документ прочитан не идеально.",
    ],
    metrics: ["upload_success_rate", "ingest_error_rate", "parse_warning_rate"],
    failures: [
      "Неподдерживаемый формат.",
      "Пустой текст после extraction.",
      "Большой PDF может долго парситься.",
    ],
    files: [
      "apps/web/src/features/documents/components/IngestPanel.tsx",
      "apps/api/src/modules/documents/documents.controller.ts",
      "apps/api/src/services/document-parser.service.ts",
    ],
  },
  {
    id: "parse_chunk",
    title: "2. Parse + Chunk",
    subtitle: "Текст -> стабильные фрагменты",
    goal: "Разбить документ на chunk-и, которые удобно искать и передавать модели.",
    flow: [
      "Текст нормализуется.",
      "Chunk service режет документ на фрагменты.",
      "Каждый chunk получает `chunkIndex`, `chunkLen` и `section`.",
    ],
    metrics: ["avg_chunk_len", "chunks_per_doc", "section_coverage"],
    failures: [
      "Слишком большие chunk-и ухудшают precision.",
      "Слишком маленькие chunk-и теряют смысловой контекст.",
      "Плохая структура документа снижает качество retrieval.",
    ],
    files: [
      "apps/api/src/services/chunk.service.ts",
      "apps/api/src/modules/documents/document-query.service.ts",
      "apps/web/src/pages/document-detail/DocumentDetailPage.tsx",
    ],
  },
  {
    id: "index",
    title: "3. Index",
    subtitle: "Postgres + Qdrant + scope",
    goal: "Сохранить документ так, чтобы потом искать его семантически и лексически.",
    flow: [
      "Ollama `nomic-embed-text` строит embedding для каждого chunk-а.",
      "Qdrant хранит vector + payload: `documentScope`, `docId`, `chunkIndex`, `section`, `text`.",
      "Postgres хранит документ, metadata и `search_vector` для FTS.",
      "`documentScope=user` и `documentScope=eval` изолируют обычные документы от benchmark.",
    ],
    metrics: ["embedding_latency_ms", "qdrant_upsert_ms", "document_scope"],
    failures: [
      "Если Qdrant и Postgres расходятся, retrieval может показывать устаревшие источники.",
      "Без scope isolation eval может загрязнить обычный чат.",
      "Медленные embeddings тормозят ingestion.",
    ],
    files: [
      "apps/api/src/services/embeddings.service.ts",
      "apps/api/src/clients/qdrant.client.ts",
      "apps/api/src/repositories/documents.repository.ts",
      "apps/api/src/db/migrations/003_document_scope.sql",
    ],
  },
  {
    id: "retrieve",
    title: "4. Retrieve",
    subtitle: "Vector + FTS -> RRF -> rerank",
    goal: "Найти chunk-и, которые лучше всего отвечают на вопрос.",
    flow: [
      "Вопрос превращается в embedding.",
      "Qdrant ищет похожие vectors сразу с filter по `documentScope`.",
      "Postgres FTS ищет lexical matches через `search_vector`.",
      "Кандидаты дедуплицируются по `docId:chunkIndex`.",
      "RRF объединяет vector rank и lexical rank.",
      "Local rerank добавляет token overlap, title/section overlap, phrase bonus и short penalty.",
    ],
    metrics: [
      "vector_count",
      "lexical_count",
      "merged_count",
      "origin",
      "rrf_score",
      "final_score",
    ],
    failures: [
      "Vector может пропустить точный термин.",
      "Lexical может шуметь на общих словах.",
      "Если fusion плохой, хороший chunk не попадет в top-K.",
    ],
    files: [
      "apps/api/src/modules/chat/chat.service.ts",
      "apps/api/src/repositories/documents.repository.ts",
      "apps/api/src/clients/qdrant.client.ts",
      "apps/web/src/features/chat/components/AnswerSection.tsx",
    ],
  },
  {
    id: "decision",
    title: "5. Decision",
    subtitle: "Thresholds + guardrails",
    goal: "Решить, можно ли отвечать на основе найденного контекста.",
    flow: [
      "`bestScore` берется из лучшего source после RRF и rerank.",
      "Если score ниже `declineThreshold`, система отклоняет вопрос.",
      "Если score выше `answerThreshold`, система отвечает.",
      "В mid-band учитывается `domainEvidence`.",
      "Причина записывается в `debug.guardrailReason`.",
    ],
    metrics: ["best_score", "domain_evidence", "decision", "guardrail_reason"],
    failures: [
      "Слишком мягкая policy повышает false positive.",
      "Слишком строгая policy повышает false negative.",
      "Высокий score без evidence может привести к уверенной ошибке.",
    ],
    files: [
      "apps/api/src/modules/chat/chat.service.ts",
      "apps/api/src/config/env.ts",
      "apps/api/src/modules/chat/chat.types.ts",
    ],
  },
  {
    id: "generation",
    title: "6. Generation",
    subtitle: "Grounded prompt + SSE",
    goal: "Сгенерировать ответ только из retrieved context и стримить его в UI.",
    flow: [
      "Prompt получает вопрос и top-K retrieved chunks.",
      "Ollama `llama3` генерирует ответ.",
      "Backend отправляет chunks ответа по SSE.",
      "Meta содержит `sources`, `timing`, `debug`.",
    ],
    metrics: ["llm_latency_ms", "total_latency_ms", "stream_error_rate"],
    failures: [
      "Слабый prompt может ослабить grounding.",
      "SSE может оборваться.",
      "Если context плохой, generation уже не спасет ответ.",
    ],
    files: [
      "apps/api/src/services/prompt.service.ts",
      "apps/api/src/services/llm.service.ts",
      "apps/api/src/utils/sse.ts",
      "apps/web/src/features/chat/api/chat.ts",
    ],
  },
  {
    id: "history",
    title: "7. History",
    subtitle: "Sessions + saved debug",
    goal: "Сохранить вопрос, ответ, sources, timing и debug для повторного просмотра.",
    flow: [
      "Chat session создается или переиспользуется.",
      "User message и assistant message пишутся в Postgres.",
      "Assistant message хранит answer, sources, timing и debug JSON.",
      "Sidebar показывает sessions, а history восстанавливает прошлые ответы.",
    ],
    metrics: ["sessions_count", "messages_count", "history_restore_success"],
    failures: [
      "История бесполезна, если не сохранять debug рядом с ответом.",
      "Удаление session должно чистить связанные messages.",
      "Название session должно обновляться после первого вопроса.",
    ],
    files: [
      "apps/api/src/repositories/chat.repository.ts",
      "apps/api/src/modules/chat/chat-history.service.ts",
      "apps/web/src/features/chat/hooks/useChatHistory.ts",
      "apps/web/src/features/chat/components/ChatSidebar.tsx",
    ],
  },
];

const TRACES: Record<TraceId, { title: string; summary: string; steps: TraceStep[] }> = {
  question: {
    title: "Пользователь задает вопрос",
    summary: "Главный production flow: вопрос проходит retrieval, decision, generation и сохраняется в историю.",
    steps: [
      {
        title: "Web отправляет chat request",
        description: "Chat hook открывает SSE stream и показывает ответ по мере генерации.",
        files: ["apps/web/src/features/chat/hooks/useChatHistory.ts", "apps/web/src/features/chat/api/chat.ts"],
      },
      {
        title: "Backend строит RAG context",
        description: "Сервис делает embedding, vector search, lexical search, RRF fusion и rerank.",
        files: ["apps/api/src/modules/chat/chat.service.ts"],
      },
      {
        title: "Decision policy выбирает answer/decline",
        description: "Policy смотрит на bestScore, thresholds, domainEvidence и наличие sources.",
        files: ["apps/api/src/modules/chat/chat.service.ts", "apps/api/src/config/env.ts"],
      },
      {
        title: "LLM stream + saved history",
        description: "Если отвечаем, Ollama stream идет в UI, а финальный ответ с debug сохраняется в Postgres.",
        files: ["apps/api/src/services/llm.service.ts", "apps/api/src/repositories/chat.repository.ts"],
      },
    ],
  },
  decline: {
    title: "Система отказывается отвечать",
    summary: "Этот flow нужен, чтобы не галлюцинировать, если контекст слабый или не найден.",
    steps: [
      {
        title: "Retrieval вернул слабые или пустые sources",
        description: "Причина может быть `no_sources`, низкий score или слабый domainEvidence.",
        files: ["apps/api/src/modules/chat/chat.service.ts"],
      },
      {
        title: "Policy возвращает safe answer",
        description: "Backend стримит фразу `Я не знаю на основе предоставленных данных.` без вызова LLM.",
        files: ["apps/api/src/modules/chat/chat.service.ts"],
      },
      {
        title: "UI показывает reason",
        description: "Debug block показывает decision, thresholds, domainEvidence и guardrail reason.",
        files: ["apps/web/src/features/chat/components/AnswerSection.tsx"],
      },
    ],
  },
  ingestion: {
    title: "Пользователь загружает документ",
    summary: "Документ превращается в search-ready данные в Postgres и Qdrant.",
    steps: [
      {
        title: "Upload",
        description: "Frontend отправляет файл, backend принимает multipart.",
        files: ["apps/web/src/features/documents/components/IngestPanel.tsx", "apps/api/src/modules/documents/documents.controller.ts"],
      },
      {
        title: "Parse + chunk",
        description: "Parser извлекает текст, chunk service режет его на фрагменты.",
        files: ["apps/api/src/services/document-parser.service.ts", "apps/api/src/services/chunk.service.ts"],
      },
      {
        title: "Embed + store",
        description: "Embeddings уходят в Qdrant, metadata и FTS search_vector уходят в Postgres.",
        files: ["apps/api/src/modules/documents/document-ingest.service.ts", "apps/api/src/clients/qdrant.client.ts"],
      },
    ],
  },
  seed_eval: {
    title: "Запуск eval:seed",
    summary: "Стабильный benchmark переиндексирует seed docs в scope=eval и проверяет answerability.",
    steps: [
      {
        title: "Seed docs reindex",
        description: "Скрипт кладет три стабильных русских документа с фиксированными docId.",
        files: ["apps/api/src/eval/seed-rag-eval.ts", "test-data/rag-eval/seed-docs"],
      },
      {
        title: "Run questions",
        description: "Каждый вопрос проходит тот же RAG flow, но с `documentScope=eval`.",
        files: ["apps/api/src/eval/run-rag-eval.ts", "test-data/rag-eval/questions.seed.json"],
      },
      {
        title: "Report",
        description: "Report сохраняет accuracy, confusion matrix, policy/model decline и source previews.",
        files: ["test-data/rag-eval/last-seed-report.json", "apps/web/src/pages/eval/EvalPage.tsx"],
      },
    ],
  },
};

const DEBUG_FIELDS = [
  ["decision", "Итог policy: `answered` или `declined`."],
  ["bestScore", "Score лучшего source после RRF fusion и local rerank."],
  ["origin", "`vector`, `lexical` или `hybrid`; показывает, откуда пришел chunk."],
  ["vectorRank/vectorScore", "Позиция и raw score chunk-а в Qdrant results."],
  ["lexicalRank/lexicalScore", "Позиция и raw score chunk-а в Postgres FTS/chunk overlap results."],
  ["rrfScore", "Нормализованный сигнал Reciprocal Rank Fusion."],
  ["finalScore", "Финальный score после local rerank; он отображается как source score."],
  ["domainEvidence", "Доля query tokens, найденных в итоговых sources."],
  ["guardrailReason", "Почему policy отклонила вопрос, если был declined."],
  ["timing", "embedding/search/llm/total latency для диагностики скорости."],
];

const API_ROUTES = [
  ["POST /documents", "Загрузить файл и запустить ingestion.", "documents.controller -> document-ingest.service"],
  ["GET /documents", "Список user documents, scoped query/search.", "documents.repository"],
  ["GET /documents/:docId", "Детальная страница документа и chunk preview.", "document-query.service"],
  ["DELETE /documents/:docId", "Удалить документ из Postgres и Qdrant.", "document-delete.service"],
  ["POST /chat/stream", "SSE chat flow: retrieval, decision, generation, meta.", "chat.controller -> chat.service"],
  ["GET /chat/sessions", "Список chat sessions.", "chat-history.service"],
  ["GET /chat/sessions/:id", "История session с сохраненными sources/debug.", "chat.repository"],
  ["GET /eval/report", "Последний eval report: seed или current.", "eval-report.controller"],
  ["GET /ready", "Проверка Postgres, Qdrant и Ollama.", "readiness.service"],
];

const STORAGE_ITEMS = [
  {
    title: "Postgres",
    body: "Хранит documents, chat_sessions, chat_messages, metadata, full text и `search_vector` для lexical retrieval.",
    fields: ["document_scope", "doc_id", "text_content", "search_vector", "sources JSONB", "debug JSONB"],
  },
  {
    title: "Qdrant",
    body: "Хранит embeddings chunk-ов и payload. Vector search фильтруется по `documentScope` до top-K.",
    fields: ["vector", "docId", "documentScope", "chunkIndex", "section", "text"],
  },
  {
    title: "Ollama",
    body: "Локально генерирует embeddings и финальный ответ, без внешнего API.",
    fields: ["nomic-embed-text", "llama3", "stream=true", "local inference"],
  },
];

const EVAL_FACTS = [
  ["eval:seed", "Переиндексирует стабильные seed docs в `documentScope=eval` и гоняет `questions.seed.json`."],
  ["eval:current", "Гоняет `questions.json` по текущей пользовательской базе `documentScope=user`."],
  ["eval:rag", "Alias для `eval:current`, оставлен для совместимости."],
  ["answerability_accuracy", "Главная метрика: правильно ли система ответила или отказалась."],
  ["tp/tn/fp/fn", "Confusion matrix по answerability: особенно важны FP, потому что это риск hallucination."],
  ["policyDeclined/modelDeclined", "Разделяет отказ policy и отказ самой модели после генерации."],
];

const TROUBLESHOOTING = [
  ["Ollama не отвечает", "Проверить, что Ollama запущена и модели `nomic-embed-text`/`llama3` доступны."],
  ["Нет retrieval sources", "Проверить ingestion, `documentScope`, Qdrant collection и Postgres `search_vector`."],
  ["Eval внезапно просел", "Смотреть FP/FN cases, source previews, origin, ranks и finalScore."],
  ["Vite warning", "Node 20.10.0 староват для Vite 7; нужен Node 20.19+ или 22.12+."],
];

const DECISION_TREE = [
  "Нет sources -> declined: no_sources.",
  "bestScore < declineThreshold -> declined: score_below_decline_threshold.",
  "bestScore >= answerThreshold -> answered.",
  "Mid-band + low domainEvidence + слабый hybrid signal -> declined.",
  "Иначе answered, но debug остается доступным для проверки.",
];

export function ArchitecturePage() {
  const [activeView, setActiveView] = useState<ViewId>("pipeline");
  const [selectedStageId, setSelectedStageId] = useState<StageId>("retrieve");
  const [selectedTraceId, setSelectedTraceId] = useState<TraceId>("question");

  const selectedStage = useMemo(
    () => STAGES.find((stage) => stage.id === selectedStageId) ?? STAGES[0],
    [selectedStageId],
  );
  const selectedTrace = TRACES[selectedTraceId];

  return (
    <Layout>
      <AppHeader />

      <Intro>
        <Eyebrow>Architecture</Eyebrow>
        <Title>AI Knowledge Assistant: как проект работает внутри</Title>
        <Subtitle>
          Это интерактивная карта проекта: pipeline, retrieval, eval, storage,
          API и debug. Ее цель простая: открыть страницу через неделю и быстро
          вспомнить, что происходит с документом, вопросом, source score и eval
          report.
        </Subtitle>
      </Intro>

      <NavGrid>
        {VIEWS.map((view) => (
          <NavButton
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            $active={activeView === view.id}
          >
            <strong>{view.title}</strong>
            <span>{view.subtitle}</span>
          </NavButton>
        ))}
      </NavGrid>

      {activeView === "pipeline" ? (
        <>
          <Section>
            <SectionTitle>Короткая версия</SectionTitle>
            <PipelineLine>
              {"Upload -> Parse -> Chunk -> Embed -> Store -> Retrieve -> RRF -> Decide -> Generate -> Stream -> Save history"}
            </PipelineLine>
            <TagList>
              <MetricTag>Fastify API</MetricTag>
              <MetricTag>React/Vite UI</MetricTag>
              <MetricTag>Postgres FTS</MetricTag>
              <MetricTag>Qdrant vectors</MetricTag>
              <MetricTag>Ollama local models</MetricTag>
            </TagList>
          </Section>

          <Section>
            <SectionTitle>Trace Explorer</SectionTitle>
            <Segmented>
              {Object.entries(TRACES).map(([id, trace]) => (
                <SegmentButton
                  key={id}
                  type="button"
                  onClick={() => setSelectedTraceId(id as TraceId)}
                  $active={selectedTraceId === id}
                >
                  {trace.title}
                </SegmentButton>
              ))}
            </Segmented>
            <TraceSummary>{selectedTrace.summary}</TraceSummary>
            <StepGrid>
              {selectedTrace.steps.map((step, index) => (
                <StepCard key={step.title}>
                  <StepNumber>{index + 1}</StepNumber>
                  <BlockTitle>{step.title}</BlockTitle>
                  <Text>{step.description}</Text>
                  <PathList>
                    {step.files.map((file) => (
                      <PathItem key={file}>{file}</PathItem>
                    ))}
                  </PathList>
                </StepCard>
              ))}
            </StepGrid>
          </Section>

          <Section>
            <SectionTitle>Этапы pipeline</SectionTitle>
            <StagePicker>
              {STAGES.map((stage) => (
                <StageButton
                  key={stage.id}
                  type="button"
                  onClick={() => setSelectedStageId(stage.id)}
                  $active={selectedStageId === stage.id}
                >
                  <strong>{stage.title}</strong>
                  <span>{stage.subtitle}</span>
                </StageButton>
              ))}
            </StagePicker>
            <StageDetail stage={selectedStage} />
          </Section>
        </>
      ) : null}

      {activeView === "retrieval" ? (
        <>
          <Section>
            <SectionTitle>Retrieval сейчас</SectionTitle>
            <TwoColumn>
              <InfoPanel>
                <BlockTitle>Почему hybrid</BlockTitle>
                <InfoList>
                  <InfoItem>Vector search хорошо ловит смысл, даже если слова отличаются.</InfoItem>
                  <InfoItem>Lexical FTS хорошо ловит точные термины, имена и названия полей.</InfoItem>
                  <InfoItem>RRF объединяет ранги, а не raw score, потому что vector и lexical score живут в разных шкалах.</InfoItem>
                </InfoList>
              </InfoPanel>
              <InfoPanel>
                <BlockTitle>Формула в проекте</BlockTitle>
                <CodeBlock>
                  {`RRF_K = 60
vector_rrf = 1 / (RRF_K + vectorRank)
lexical_rrf = 1 / (RRF_K + lexicalRank)
rrfScore = normalized(vector_rrf + lexical_rrf)
score = rawScore * 0.82 + rrfScore * 0.18
finalScore = localRerank(score)`}
                </CodeBlock>
              </InfoPanel>
            </TwoColumn>
          </Section>
          <Section>
            <SectionTitle>Decision tree</SectionTitle>
            <DecisionList>
              {DECISION_TREE.map((item, index) => (
                <DecisionItem key={item}>
                  <StepNumber>{index + 1}</StepNumber>
                  <span>{item}</span>
                </DecisionItem>
              ))}
            </DecisionList>
          </Section>
        </>
      ) : null}

      {activeView === "eval" ? (
        <Section>
          <SectionTitle>Eval Lab</SectionTitle>
          <Grid>
            {EVAL_FACTS.map(([title, body]) => (
              <InfoPanel key={title}>
                <BlockTitle>{title}</BlockTitle>
                <Text>{body}</Text>
              </InfoPanel>
            ))}
          </Grid>
          <Callout>
            После любого изменения retrieval, thresholds, prompt или scope logic
            сначала запускаем `cd apps/api && npm run eval:seed`. Последний
            стабильный результат после RRF: `answerability_accuracy=1.000`,
            `tp=11`, `tn=4`, `fp=0`, `fn=0`.
          </Callout>
        </Section>
      ) : null}

      {activeView === "storage" ? (
        <>
          <Section>
            <SectionTitle>Storage Map</SectionTitle>
            <Grid>
              {STORAGE_ITEMS.map((item) => (
                <InfoPanel key={item.title}>
                  <BlockTitle>{item.title}</BlockTitle>
                  <Text>{item.body}</Text>
                  <TagList>
                    {item.fields.map((field) => (
                      <MetricTag key={field}>{field}</MetricTag>
                    ))}
                  </TagList>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
          <Section>
            <SectionTitle>Cleanup и consistency</SectionTitle>
            <InfoList>
              <InfoItem>Удаление документа должно убрать metadata из Postgres и vectors из Qdrant.</InfoItem>
              <InfoItem>Vector results дополнительно проверяются через Postgres, чтобы не показывать устаревший docId.</InfoItem>
              <InfoItem>`documentScope` применяется и в Postgres, и в Qdrant.</InfoItem>
            </InfoList>
          </Section>
        </>
      ) : null}

      {activeView === "api" ? (
        <Section>
          <SectionTitle>API Explorer</SectionTitle>
          <Table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Что делает</th>
                <th>Где смотреть</th>
              </tr>
            </thead>
            <tbody>
              {API_ROUTES.map(([route, action, file]) => (
                <tr key={route}>
                  <td><code>{route}</code></td>
                  <td>{action}</td>
                  <td><code>{file}</code></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : null}

      {activeView === "debug" ? (
        <>
          <Section>
            <SectionTitle>Debug Decoder</SectionTitle>
            <Grid>
              {DEBUG_FIELDS.map(([field, explanation]) => (
                <InfoPanel key={field}>
                  <BlockTitle>{field}</BlockTitle>
                  <Text>{explanation}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
          <Section>
            <SectionTitle>Troubleshooting</SectionTitle>
            <Grid>
              {TROUBLESHOOTING.map(([title, body]) => (
                <InfoPanel key={title}>
                  <BlockTitle>{title}</BlockTitle>
                  <Text>{body}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
        </>
      ) : null}
    </Layout>
  );
}

function StageDetail({ stage }: { stage: StageInfo }) {
  return (
    <DetailWrap>
      <InfoPanel>
        <BlockTitle>{stage.title}</BlockTitle>
        <Text>{stage.goal}</Text>
      </InfoPanel>
      <ThreeColumn>
        <InfoPanel>
          <BlockTitle>Как работает</BlockTitle>
          <InfoList>
            {stage.flow.map((item) => (
              <InfoItem key={item}>{item}</InfoItem>
            ))}
          </InfoList>
        </InfoPanel>
        <InfoPanel>
          <BlockTitle>Метрики</BlockTitle>
          <TagList>
            {stage.metrics.map((metric) => (
              <MetricTag key={metric}>{metric}</MetricTag>
            ))}
          </TagList>
        </InfoPanel>
        <InfoPanel>
          <BlockTitle>Риски</BlockTitle>
          <InfoList>
            {stage.failures.map((item) => (
              <InfoItem key={item}>{item}</InfoItem>
            ))}
          </InfoList>
        </InfoPanel>
      </ThreeColumn>
      <InfoPanel>
        <BlockTitle>Файлы</BlockTitle>
        <PathList>
          {stage.files.map((file) => (
            <PathItem key={file}>{file}</PathItem>
          ))}
        </PathList>
      </InfoPanel>
    </DetailWrap>
  );
}

const Intro = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 16px;
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

const NavGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const NavButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? "rgba(16, 163, 127, 0.45)" : "var(--border)")};
  background: ${({ $active }) => ($active ? "var(--accent-soft)" : "var(--surface)")};
  color: var(--text-primary);
  border-radius: 12px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  min-height: 76px;

  span {
    display: block;
    margin-top: 5px;
    color: var(--text-muted);
    font-size: 13px;
  }
`;

const Section = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-soft);
`;

const SectionTitle = styled.h3`
  margin: 0 0 14px;
  font-size: 22px;
`;

const PipelineLine = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 12px;
  padding: 14px;
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.6;
  margin-bottom: 12px;
`;

const Segmented = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? "rgba(16, 163, 127, 0.45)" : "var(--border)")};
  background: ${({ $active }) => ($active ? "var(--accent-soft)" : "var(--surface-subtle)")};
  color: var(--text-primary);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
`;

const TraceSummary = styled.p`
  margin: 0 0 14px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const StepGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StepCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 14px;
  padding: 14px;
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 800;
  margin-bottom: 10px;
`;

const StagePicker = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const StageButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? "rgba(16, 163, 127, 0.45)" : "var(--border)")};
  background: ${({ $active }) => ($active ? "var(--accent-soft)" : "var(--surface-subtle)")};
  border-radius: 12px;
  padding: 11px;
  text-align: left;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 76px;

  span {
    display: block;
    margin-top: 5px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.4;
  }
`;

const DetailWrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const TwoColumn = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ThreeColumn = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const InfoPanel = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 14px;
  padding: 14px;
`;

const BlockTitle = styled.h4`
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text-primary);
`;

const Text = styled.p`
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 14px;
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
  gap: 7px;
  margin-top: 10px;
`;

const PathItem = styled.code`
  display: block;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
`;

const CodeBlock = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  overflow-x: auto;
  line-height: 1.6;
`;

const DecisionList = styled.div`
  display: grid;
  gap: 10px;
`;

const DecisionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 12px;
  padding: 10px 12px;
  color: var(--text-secondary);
`;

const Callout = styled.div`
  margin-top: 14px;
  border: 1px solid rgba(16, 163, 127, 0.28);
  background: var(--accent-soft);
  color: var(--text-primary);
  border-radius: 14px;
  padding: 14px;
  line-height: 1.7;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 14px;

  th,
  td {
    border: 1px solid var(--border);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  th {
    color: var(--text-primary);
    background: var(--surface-subtle);
  }

  code {
    color: var(--accent-strong);
    overflow-wrap: anywhere;
  }
`;
