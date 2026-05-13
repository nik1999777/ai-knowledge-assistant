export type ViewId =
  | "pipeline"
  | "retrieval"
  | "eval"
  | "storage"
  | "api"
  | "debug"
  | "glossary"
  | "why"
  | "data"
  | "failures"
  | "roadmap"
  | "walkthrough";
export type TraceId = "question" | "decline" | "ingestion" | "seed_eval";
export type StageId =
  | "upload"
  | "parse_chunk"
  | "index"
  | "retrieve"
  | "decision"
  | "generation"
  | "history";

export type StageInfo = {
  id: StageId;
  title: string;
  subtitle: string;
  goal: string;
  flow: string[];
  metrics: string[];
  failures: string[];
  files: string[];
};

export type TraceStep = {
  title: string;
  description: string;
  files: string[];
};

export type GlossaryItem = {
  term: string;
  short: string;
  projectMeaning: string;
  example: string;
};

export type DecisionRecord = {
  decision: string;
  why: string;
  alternatives: string;
  tradeoff: string;
  files: string[];
};

export type PayloadExample = {
  title: string;
  explanation: string;
  code: string;
};

export type FailureRecord = {
  symptom: string;
  likelyCause: string;
  uiCheck: string;
  codeCheck: string;
  command: string;
};

export type VisualFlow = {
  title: string;
  summary: string;
  lanes: Array<{
    title: string;
    steps: string[];
  }>;
};

export type WalkthroughStep = {
  title: string;
  plain: string;
  technical: string;
  debug: string;
};

export const VIEWS: Array<{ id: ViewId; title: string; subtitle: string }> = [
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
  {
    id: "glossary",
    title: "Glossary",
    subtitle: "Термины простым языком",
  },
  {
    id: "why",
    title: "Why",
    subtitle: "Почему так спроектировано",
  },
  {
    id: "data",
    title: "Data",
    subtitle: "Payloads и lifecycle",
  },
  {
    id: "failures",
    title: "Failures",
    subtitle: "Диагностика проблем",
  },
  {
    id: "roadmap",
    title: "Roadmap",
    subtitle: "Ограничения и следующий шаг",
  },
  {
    id: "walkthrough",
    title: "Walkthrough",
    subtitle: "Один вопрос целиком",
  },
];

export const STAGES: StageInfo[] = [
  {
    id: "upload",
    title: "1. Upload",
    subtitle: "TXT / MD / CSV / PDF / DOCX / ZIP",
    goal: "Принять файл, проверить формат и отправить его в ingestion pipeline.",
    flow: [
      "Web отправляет multipart-запрос на backend.",
      "Fastify controller валидирует файл и запускает ingest service.",
      "Parser извлекает текст и warnings, если документ прочитан не идеально.",
      "Markdown links нормализуются до видимого текста, чтобы длинные URL/path targets не загрязняли retrieval.",
      "Standalone local `.md` links считаются archive navigation и не индексируются как содержательные chunks.",
      "Markdown pages, которые почти целиком состоят из headings и local `.md` links, пропускаются как navigation-only.",
      "Markdown parser терпим к export path с незакрытыми скобками, если target всё равно выглядит как local `.md` path.",
      "ZIP parser индексирует поддерживаемые `.txt`, `.md` и `.csv` файлы внутри как отдельные documents с archive path в `originalFileName`.",
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
      "Каждый chunk получает `chunkIndex`, `chunkLen`, `section`, `startOffset` и `endOffset`.",
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
      "Qdrant хранит vector + payload: `documentScope`, `docId`, `chunkIndex`, `section`, `startOffset`, `endOffset`, `text`.",
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
      "Prompt получает вопрос и top-K retrieved chunks с title, section и chunkIndex.",
      "Ollama `llama3` генерирует ответ.",
      "Backend отправляет chunks ответа по SSE.",
      "Meta содержит `sources`, `timing`, `debug`.",
      "`debug.promptVersion` фиксирует версию grounded prompt-а.",
      "`debug.generationOptions` фиксирует temperature/seed для repeatable eval.",
      "Если model output содержит фразу отказа с лишним текстом, backend нормализует saved answer до точного decline contract.",
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
      "Assistant message хранит answer, sources, timing и debug JSON, включая `promptVersion`.",
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

export const TRACES: Record<TraceId, { title: string; summary: string; steps: TraceStep[] }> = {
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

export const DEBUG_FIELDS = [
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

export const API_ROUTES = [
  ["POST /documents", "Загрузить файл `.txt/.md/.csv/.pdf/.docx/.zip` и запустить ingestion.", "documents.controller -> document-ingest.service"],
  ["GET /documents", "Список user documents, scoped query/search.", "documents.repository"],
  ["GET /documents/:docId", "Детальная страница документа и chunk preview.", "document-query.service"],
  ["DELETE /documents/:docId", "Удалить документ из Postgres и Qdrant.", "document-delete.service"],
  ["POST /chat/stream", "SSE chat flow: retrieval, decision, generation, meta.", "chat.controller -> chat.service"],
  ["GET /chat/sessions", "Список chat sessions.", "chat-history.service"],
  ["GET /chat/sessions/:id", "История session с сохраненными sources/debug.", "chat.repository"],
  ["GET /eval/report", "Последний eval report: seed или generated.", "eval-report.controller"],
  ["GET /ready", "Проверка Postgres, Qdrant и Ollama.", "readiness.service"],
];

export const STORAGE_ITEMS = [
  {
    title: "Postgres",
    body: "Хранит documents, chat_sessions, chat_messages, metadata, raw text для inspection, normalized text для retrieval и `search_vector` для lexical retrieval.",
    fields: ["document_scope", "doc_id", "raw_text_content", "text_content", "search_vector", "sources JSONB", "debug JSONB"],
  },
  {
    title: "Qdrant",
    body: "Хранит embeddings chunk-ов и payload. Vector search фильтруется по `documentScope` до top-K.",
    fields: ["vector", "docId", "documentScope", "chunkIndex", "section", "startOffset", "endOffset", "text"],
  },
  {
    title: "Ollama",
    body: "Локально генерирует embeddings и финальный ответ, без внешнего API.",
    fields: ["nomic-embed-text", "llama3", "stream=true", "local inference"],
  },
];

export const EVAL_FACTS = [
  ["eval:seed", "Переиндексирует стабильные seed docs в `documentScope=eval` и гоняет `questions.seed.json`."],
  ["eval:generate", "Создает `questions.generated.json` из текущих user chunks: question, keywords, evidence quote и spans."],
  ["eval:generated", "Основной smoke-test для текущей user KB: регенерирует generated dataset и пишет `last-generated-report.json`."],
  ["eval:modes", "Сравнивает `strict`, `balanced` и `tutor` на seed benchmark и пишет `last-mode-matrix-report.json`."],
  ["answerability_accuracy", "Главная метрика: правильно ли система ответила или отказалась."],
  ["tp/tn/fp/fn", "Confusion matrix по answerability: особенно важны FP, потому что это риск hallucination."],
  ["policyDeclined/modelDeclined", "Разделяет отказ policy и отказ самой модели после генерации."],
];

export const TROUBLESHOOTING = [
  ["Ollama не отвечает", "Проверить, что Ollama запущена и модели `nomic-embed-text`/`llama3` доступны."],
  ["Нет retrieval sources", "Проверить ingestion, `documentScope`, Qdrant collection и Postgres `search_vector`."],
  ["Eval внезапно просел", "Смотреть FP/FN cases, source previews, origin, ranks и finalScore."],
  ["Vite warning", "Node 20.10.0 староват для Vite 7; нужен Node 20.19+ или 22.12+."],
];

export const DECISION_TREE = [
  "Нет sources -> declined: no_sources.",
  "bestScore < declineThreshold -> declined: score_below_decline_threshold.",
  "bestScore >= answerThreshold -> answered.",
  "Mid-band + low domainEvidence + слабый hybrid signal -> declined.",
  "Иначе answered, но debug остается доступным для проверки.",
];

export const SYSTEM_SUMMARY = [
  {
    title: "Что строим",
    body: "Локальный помощник по знаниям. Он не ищет в интернете, а отвечает по документам, которые пользователь загрузил в проект.",
  },
  {
    title: "Почему это RAG",
    body: "Перед ответом система сначала достает релевантные фрагменты документов, а уже потом передает их LLM. Это снижает галлюцинации и делает ответ проверяемым.",
  },
  {
    title: "Где живут знания",
    body: "Полный текст, metadata, история чата и lexical index лежат в Postgres. Embeddings chunk-ов лежат в Qdrant. Модели запускаются локально через Ollama.",
  },
  {
    title: "Как понять ответ",
    body: "У каждого ответа есть sources, timing и debug. Sources показывают grounding, timing показывает скорость, debug объясняет decision, prompt version, generation options и качество retrieval.",
  },
];

export const GLOSSARY: GlossaryItem[] = [
  {
    term: "RAG",
    short: "Retrieval-Augmented Generation: генерация ответа с предварительным поиском контекста.",
    projectMeaning:
      "В нашем проекте вопрос сначала ищет chunk-и в Postgres/Qdrant, затем эти chunk-и вставляются в prompt для Ollama `llama3`.",
    example:
      "Если спросить про RRF, модель получает найденные фрагменты документа про retrieval и отвечает по ним, а не только из своей памяти.",
  },
  {
    term: "Chunk",
    short: "Небольшой фрагмент документа.",
    projectMeaning:
      "Backend режет документ на chunk-и, потому что искать и передавать в prompt весь PDF целиком дорого и неточно.",
    example:
      "Документ на 20 страниц может стать набором chunk-ов с `chunkIndex`, `chunkLen`, `section` и character spans.",
  },
  {
    term: "Embedding",
    short: "Числовой вектор, который описывает смысл текста.",
    projectMeaning:
      "Ollama `nomic-embed-text` превращает вопрос и chunk-и в vectors. Qdrant сравнивает эти vectors по похожести.",
    example:
      "Вопрос `что делает Qdrant` будет близок к chunk-у, где написано про vector database, даже если слова не совпали идеально.",
  },
  {
    term: "Vector Search",
    short: "Поиск по смысловой близости embeddings.",
    projectMeaning:
      "Qdrant возвращает top-K chunk-ов, похожих на embedding вопроса, и сразу фильтрует их по `documentScope`.",
    example:
      "`vectorRank=#1` значит Qdrant поставил source первым среди vector candidates.",
  },
  {
    term: "Lexical Search / FTS",
    short: "Поиск по словам и токенам.",
    projectMeaning:
      "Postgres `search_vector` ищет точные или близкие совпадения слов. Это помогает ловить названия, поля и редкие термины.",
    example:
      "Если вопрос содержит `finalStatusModels`, lexical search часто полезнее vector search.",
  },
  {
    term: "Hybrid Retrieval",
    short: "Комбинация semantic и lexical поиска.",
    projectMeaning:
      "Мы используем Qdrant + Postgres FTS, затем объединяем кандидатов через RRF.",
    example:
      "`origin=hybrid` значит один и тот же chunk нашли оба механизма.",
  },
  {
    term: "RRF",
    short: "Reciprocal Rank Fusion: способ объединить несколько ranked lists.",
    projectMeaning:
      "RRF смотрит на позиции кандидата в vector и lexical списках. Высокое место в обоих списках дает сильный общий сигнал.",
    example:
      "Chunk с `vectorRank=#1` и `lexicalRank=#1` получает `rrfScore=1.000`.",
  },
  {
    term: "Rerank",
    short: "Дополнительная сортировка кандидатов после первичного поиска.",
    projectMeaning:
      "После RRF мы добавляем локальные сигналы: overlap слов, совпадение title/section, phrase bonus и penalty для слишком коротких chunk-ов.",
    example:
      "`finalScore` может стать выше, если chunk содержит точную фразу вопроса.",
  },
  {
    term: "Grounding",
    short: "Привязка ответа модели к найденным источникам.",
    projectMeaning:
      "Prompt просит LLM отвечать только на основе retrieved context. UI показывает sources, чтобы ответ можно было проверить.",
    example:
      "Если sources пустые или слабые, система должна отказаться, а не придумывать.",
  },
  {
    term: "Decision Policy",
    short: "Правила, которые решают, отвечать или отказаться.",
    projectMeaning:
      "Policy смотрит на `bestScore`, thresholds, `domainEvidence` и наличие sources.",
    example:
      "`guardrailReason=score_below_decline_threshold` значит лучший source оказался слишком слабым.",
  },
  {
    term: "documentScope",
    short: "Разделение документов по назначению.",
    projectMeaning:
      "`user` используется обычным чатом и страницей Documents. `eval` используется стабильным seed benchmark.",
    example:
      "Seed documents не должны всплывать в обычном чате пользователя.",
  },
  {
    term: "SSE",
    short: "Server-Sent Events: поток данных от backend к frontend.",
    projectMeaning:
      "Ответ LLM приходит по частям, поэтому пользователь видит генерацию сразу, а не ждет полный ответ.",
    example:
      "Backend стримит text chunks, а в конце отправляет meta с sources/timing/debug.",
  },
  {
    term: "Eval",
    short: "Набор проверочных вопросов и отчет о качестве.",
    projectMeaning:
      "`eval:seed` проверяет стабильный benchmark, а `eval:generated` строит smoke-test из текущих user chunks.",
    example:
      "`fp=0` значит система не ответила там, где должна была отказаться.",
  },
];

export const DEBUG_EXAMPLE = [
  ["origin=hybrid", "Chunk найден и Qdrant, и Postgres FTS. Обычно это самый доверенный сигнал."],
  ["vectorRank=#1 / 0.649", "Qdrant поставил chunk первым, raw vector score около 0.649."],
  ["lexicalRank=#1 / 0.825", "Lexical pipeline тоже поставил chunk первым, raw lexical score около 0.825."],
  ["rrfScore=1.000", "Оба ранга первые, поэтому RRF дает максимальный fusion signal."],
  ["finalScore=0.911", "Итог после RRF + local rerank. Этот score участвует в bestScore."],
];

export const EVAL_READING_GUIDE = [
  ["TP", "Вопрос был answerable, система ответила. Это правильное поведение."],
  ["TN", "Вопрос был unanswerable, система отказалась. Это тоже правильное поведение."],
  ["FP", "Вопрос был unanswerable, но система ответила. Это самый опасный тип ошибки для RAG."],
  ["FN", "Вопрос был answerable, но система отказалась. Это раздражает пользователя, но обычно безопаснее FP."],
  ["answerKeywordHit", "Проверяет, есть ли ожидаемые слова в финальном answer."],
  ["sourceKeywordHit", "Проверяет, что retrieval достал source с нужными evidence словами."],
];

export const DESIGN_DECISIONS: DecisionRecord[] = [
  {
    decision: "Fastify backend",
    why: "Нужен легкий API server с хорошей поддержкой streaming/SSE, multipart upload и понятной модульной структурой без большого framework overhead.",
    alternatives: "Express проще и популярнее; Nest дает больше архитектурных правил, но добавляет слой DI/decorators.",
    tradeoff:
      "Fastify оставляет больше решений нам: структура services/repositories/modules держится дисциплиной проекта, а не framework магией.",
    files: ["apps/api/src/app.ts", "apps/api/src/server.ts"],
  },
  {
    decision: "Postgres + Qdrant",
    why: "Postgres удобен для документов, истории, FTS и JSON debug. Qdrant специализирован для vector search и payload filtering.",
    alternatives: "Только Postgres с pgvector; только Qdrant с metadata; внешние managed vector DB.",
    tradeoff:
      "Две базы требуют consistency checks и cleanup, зато дают сильный lexical search, нормальную историю и быстрый vector retrieval.",
    files: ["apps/api/src/repositories/documents.repository.ts", "apps/api/src/clients/qdrant.client.ts"],
  },
  {
    decision: "Ollama local models",
    why: "Проект локальный: embeddings и generation работают без внешнего API, ключей и отправки пользовательских документов наружу.",
    alternatives: "OpenAI/Anthropic API, hosted embeddings, managed inference.",
    tradeoff:
      "Локально проще с privacy, но качество/скорость зависит от машины, модели и состояния Ollama.",
    files: ["apps/api/src/clients/ollama.client.ts", "apps/api/src/services/llm.service.ts"],
  },
  {
    decision: "Hybrid retrieval",
    why: "Vector search ловит смысл, lexical FTS ловит точные термины. В RAG нужны оба сигнала, потому что пользовательские вопросы бывают и смысловыми, и терминологическими.",
    alternatives: "Только vector search; только FTS; внешний reranker без lexical layer.",
    tradeoff:
      "Hybrid pipeline сложнее дебажить, зато source debug показывает, какой слой нашел chunk и почему он попал в top-K.",
    files: ["apps/api/src/modules/chat/chat.service.ts", "apps/api/src/repositories/documents.repository.ts"],
  },
  {
    decision: "RRF вместо простого sort",
    why: "Raw vector score и lexical score имеют разные шкалы. RRF объединяет позиции в ranked lists, поэтому устойчивее к несовместимым score.",
    alternatives: "Сложить scores, взять максимум, вручную подобрать веса, использовать cross-encoder reranker.",
    tradeoff:
      "RRF проще и быстрее cross-encoder rerank, но не понимает текст глубоко; поэтому после него есть легкий local rerank.",
    files: ["apps/api/src/modules/chat/chat.service.ts"],
  },
  {
    decision: "Dual-threshold decision policy",
    why: "Одного порога мало: есть уверенная зона answer, уверенная зона decline и серая зона, где нужен domainEvidence.",
    alternatives: "Один threshold; всегда отвечать; отдавать решение полностью модели.",
    tradeoff:
      "Policy может иногда отказать на answerable вопрос, зато снижает риск уверенного ответа без evidence.",
    files: ["apps/api/src/modules/chat/chat.service.ts", "apps/api/src/config/env.ts"],
  },
  {
    decision: "documentScope user/eval",
    why: "Seed benchmark должен быть стабильным и не должен смешиваться с пользовательской базой. Обычный чат не должен видеть eval-документы.",
    alternatives: "Отдельные базы; отдельные Qdrant collections; фильтрация только в UI.",
    tradeoff:
      "Один shared storage проще, но каждый query обязан правильно применять scope в Postgres и Qdrant.",
    files: ["apps/api/src/db/migrations/003_document_scope.sql", "apps/api/src/clients/qdrant.client.ts"],
  },
];

export const PAYLOAD_EXAMPLES: PayloadExample[] = [
  {
    title: "Upload request",
    explanation:
      "Frontend отправляет файл как multipart. Backend не получает JSON с текстом: он сам парсит файл, чтобы контролировать extraction и warnings. ZIP uploads разворачиваются в отдельные documents для поддерживаемых `.txt`, `.md` и `.csv` файлов внутри.",
    code: `POST /documents
Content-Type: multipart/form-data

file: notion-export.zip`,
  },
  {
    title: "Parsed document",
    explanation:
      "Parser возвращает нормализованный textContent, тип источника и warnings. Warnings не блокируют ingestion, но помогают понять качество extraction.",
    code: `{
  "sourceType": "md",
  "textContent": "Retrieval-Augmented Generation...",
  "warnings": []
}`,
  },
  {
    title: "Chunk",
    explanation:
      "Chunk - минимальная единица retrieval. Именно chunk, а не весь документ, получает embedding и попадает в prompt.",
    code: `{
  "chunkIndex": 0,
  "section": "Основы RAG",
  "chunkLen": 1240,
  "text": "RAG - это подход..."
}`,
  },
  {
    title: "Qdrant payload",
    explanation:
      "Qdrant хранит vector отдельно от payload. Payload нужен, чтобы вернуть source и отфильтровать scope.",
    code: `{
  "docId": "00000000-0000-4000-8000-000000000101",
  "documentScope": "eval",
  "title": "rag-basics",
  "chunkIndex": 0,
  "section": "Основы RAG",
  "text": "RAG - это подход..."
}`,
  },
  {
    title: "Chat source",
    explanation:
      "Source показывает не только текст, но и происхождение score. По этим полям можно понять, почему chunk попал в ответ.",
    code: `{
  "origin": "hybrid",
  "vectorRank": 1,
  "vectorScore": 0.649,
  "lexicalRank": 1,
  "lexicalScore": 0.825,
  "rrfScore": 1,
  "finalScore": 0.911
}`,
  },
  {
    title: "Eval result",
    explanation:
      "Eval сохраняет не только answer, но и диагностику answerability: кто отказался, какие keywords найдены, какие sources были использованы.",
    code: `{
  "expectedAnswerable": true,
  "declined": false,
  "policyDeclined": false,
  "modelDeclined": false,
  "answerKeywordHit": true,
  "sourceKeywordHit": true
}`,
  },
];

export const FAILURE_PLAYBOOK: FailureRecord[] = [
  {
    symptom: "Документ загрузился, но чат его не находит",
    likelyCause: "Документ не попал в Qdrant, scope не совпал, или Postgres/Qdrant рассинхронизированы.",
    uiCheck: "Открыть /documents и страницу документа; проверить chunk count и текст.",
    codeCheck: "Проверить `document-ingest.service.ts`, `qdrant.client.ts`, `documents.repository.ts`.",
    command: "cd apps/api && npm run eval:generated",
  },
  {
    symptom: "Чат отвечает `Я не знаю` на очевидный вопрос",
    likelyCause: "bestScore ниже threshold, domainEvidence низкий, или retrieval достал не тот source.",
    uiCheck: "Открыть Debug и Sources: смотреть guardrailReason, origin, finalScore, source text.",
    codeCheck: "Проверить `decideAnswerability` и `rerankSources` в chat.service.ts.",
    command: "cd apps/api && npm run eval:seed",
  },
  {
    symptom: "Source есть, но ответ расплывчатый",
    likelyCause: "Prompt слишком общий, source содержит мало конкретики, top-K обрезал важный chunk.",
    uiCheck: "Сравнить source text с answer; проверить, есть ли evidence в показанных chunks.",
    codeCheck: "Проверить `prompt.service.ts`, `TOP_K`, порядок sources после rerank.",
    command: "cd apps/api && npx tsc --noEmit",
  },
  {
    symptom: "Eval просел после изменения retrieval",
    likelyCause: "Новый ranking поднял нерелевантные chunks или изменил score distribution относительно thresholds.",
    uiCheck: "Открыть /eval, смотреть failed cases, source previews и category summary.",
    codeCheck: "Сравнить RRF/rerank logic и recommendedThreshold в report.",
    command: "cd apps/api && npm run eval:seed",
  },
  {
    symptom: "Ollama медленная или не отвечает",
    likelyCause: "Модель не загружена, Ollama daemon не запущен, машина перегружена.",
    uiCheck: "Смотреть timing: embeddingMs и llmMs.",
    codeCheck: "Проверить `ollama.client.ts`, `readiness.service.ts`, env OLLAMA_URL.",
    command: "ollama list",
  },
  {
    symptom: "Vite ругается при build/dev",
    likelyCause: "Node 20.10.0 ниже требования Vite 7.",
    uiCheck: "Build все еще может проходить, но warning остается.",
    codeCheck: "Проверить `apps/web/package.json` и версию Node.",
    command: "node -v",
  },
];

export const LIFECYCLES = [
  {
    title: "Lifecycle документа",
    steps: [
      "Upload file",
      "Parse text",
      "Chunk text",
      "Generate embeddings",
      "Insert Postgres document",
      "Upsert Qdrant vectors",
      "Show in /documents",
      "Use in chat retrieval",
      "Delete from Postgres + Qdrant",
    ],
  },
  {
    title: "Lifecycle chat message",
    steps: [
      "Create/reuse session",
      "Send user question",
      "Build RAG context",
      "Decide answer/decline",
      "Stream LLM answer",
      "Collect final text",
      "Save assistant message",
      "Restore answer with sources/debug",
    ],
  },
];

export const MODULE_BOUNDARIES = [
  ["clients", "Обертки над внешними системами: Ollama, Qdrant."],
  ["repositories", "Доступ к Postgres и SQL-запросы. Здесь не должно быть UI-логики."],
  ["services", "Бизнес-логика: parsing, chunking, embeddings, prompt, LLM."],
  ["modules", "Use-cases и routes: chat, documents, eval."],
  ["features", "Frontend domain blocks: chat, documents, eval."],
  ["pages", "Экранные композиции: /chat, /documents, /architecture, /eval."],
];

export const KNOWN_LIMITATIONS = [
  "Нет auth/user ownership: пока база считается локальной и single-user.",
  "Ingestion синхронный: большие документы могут долго держать request.",
  "Нет ingestion statuses/retry queue.",
  "Есть chunk-level source spans, но нет citations внутри сгенерированного ответа.",
  "Generated eval v2 детерминированный/extractive и уже добавляет harder categories, но пока не использует LLM для разнообразных вопросов.",
  "Chunking простой, без сложной semantic segmentation.",
  "Rerank локальный, не cross-encoder.",
  "Нет observability dashboard и persistent tracing.",
  "Нет export/import knowledge base.",
];

export const ROADMAP_ITEMS = [
  ["1. Quality + eval foundation", "Главный следующий этап: укреплять eval до новых продуктовых фич. Mode Matrix уже сравнивает `strict`, `balanced` и `tutor` на seed benchmark; дальше нужно расширять eval-кейсы, категории (`answerable`, `unanswerable`, `tricky`, `exact`, `multi-hop`) и coverage сложных вопросов."],
  ["2. Generated eval for user docs", "`eval:generate` и `eval:generated` уже строят category-aware extractive dataset из текущих chunks: `definition`, `mentioned-not-defined`, `partial`, `multi-chunk`, `tutor-broad`. Красный generated report считается диагностикой текущей user KB/retrieval/prompt, а не стабильным release benchmark. Следующий шаг: улучшить формулировки и при желании добавить LLM-generator со строгой JSON validation."],
  ["3. Retrieval Debug panel", "RRF уже добавлен, но отдельная панель Retrieval Debug еще нужна: показать vector candidates, lexical candidates, merged/hybrid candidates, что отсеялось, raw ranks/scores и final rerank."],
  ["4. Async ingestion statuses", "Перевести upload в production-like flow: `uploaded -> processing -> indexed` или `failed`. API должен быстро вернуть docId, backend индексирует отдельно, UI показывает статус, retry и error message."],
  ["5. Citations/source spans", "Chunk-level section, chunkIndex, startOffset/endOffset уже есть. Следующий шаг: answer-level citations, page number для PDF и привязка claims к конкретному evidence месту."],
  ["6. Security / ownership", "Добавить user/tenant ownership: документы, chat history и retrieval должны фильтроваться по текущему user/tenant. Для Qdrant нужен payload filter по `tenantId`/`userId`."],
  ["7. LangChain comparison mode", "Не заменять handmade pipeline. Добавить experimental `/chat/langchain/stream`, повторить retrieval/generation через LangChain и описать разницу на Architecture."],
  ["8. LangGraph / agentic retrieval", "После крепкой базы можно добавить agentic flow: planner -> query rewrite -> retrieval -> rerank -> answer/clarify/decline."],
  ["9. Better chunking, reranker, observability", "Дальше улучшать semantic chunking, пробовать cross-encoder/LLM rerank и сохранять trace retrieval/generation для анализа latency и качества."],
];

export const VISUAL_FLOWS: VisualFlow[] = [
  {
    title: "Document Flow",
    summary:
      "Что происходит с файлом после upload. Важный момент: документ расходится в две системы хранения, потому что нам нужны и full-text search, и vector search.",
    lanes: [
      {
        title: "Ingestion",
        steps: ["Upload", "Parse", "Chunk", "Embed"],
      },
      {
        title: "Storage",
        steps: ["Postgres document + FTS", "Qdrant vectors + payload"],
      },
      {
        title: "Use",
        steps: ["Documents UI", "Retrieval", "Sources"],
      },
    ],
  },
  {
    title: "Chat Flow",
    summary:
      "Что происходит с вопросом пользователя. Тут есть ветвление: если evidence слабый, backend возвращает safe decline без вызова LLM.",
    lanes: [
      {
        title: "Question",
        steps: ["User asks", "Embedding", "Vector + lexical search"],
      },
      {
        title: "Reasoning",
        steps: ["RRF fusion", "Local rerank", "Decision policy"],
      },
      {
        title: "Output",
        steps: ["LLM answer", "or Safe decline", "Save history"],
      },
    ],
  },
  {
    title: "Eval Flow",
    summary:
      "Как проверяем, что изменения не сломали answerability. Seed eval использует отдельный scope, поэтому не зависит от пользовательских документов.",
    lanes: [
      {
        title: "Setup",
        steps: ["Seed docs", "documentScope=eval", "Fixed docIds"],
      },
      {
        title: "Run",
        steps: ["Questions", "Same RAG flow", "Collect sources/debug"],
      },
      {
        title: "Report",
        steps: ["Accuracy", "TP/TN/FP/FN", "Source previews"],
      },
    ],
  },
];

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "1. Пользователь спрашивает: Что дает RRF?",
    plain:
      "Система получает обычный текстовый вопрос. На этом этапе она еще не знает ответ и не вызывает LLM.",
    technical:
      "Chat API принимает question, создает embedding через Ollama `nomic-embed-text` и запускает retrieval в scope `user` или `eval`.",
    debug: "Смотреть `timing.embeddingMs`: если он большой, тормозит embedding model или Ollama.",
  },
  {
    title: "2. Vector search ищет смысловые совпадения",
    plain:
      "Qdrant ищет chunk-и, похожие по смыслу. Он может найти текст про ranking или retrieval, даже если там не повторяется точная формулировка вопроса.",
    technical:
      "searchSimilar отправляет vector в Qdrant, top-K ограничен, filter по `documentScope` применяется до выдачи результатов.",
    debug: "Смотреть `vectorCount`, `vectorRank`, `vectorScore` и source `origin=vector/hybrid`.",
  },
  {
    title: "3. Lexical search ищет точные термины",
    plain:
      "Postgres FTS ищет слова вроде `RRF`, `rank`, `fusion`. Это важно для технических терминов и названий полей.",
    technical:
      "searchDocumentsLexical строит strict/relaxed tsquery, ранжирует документы и затем chunk-level overlap выбирает подходящие фрагменты.",
    debug: "Смотреть `lexicalCount`, `lexicalRank`, `lexicalScore`.",
  },
  {
    title: "4. RRF объединяет два списка",
    plain:
      "Если chunk высоко и в semantic, и в lexical поиске, он получает сильный сигнал. Мы не складываем raw scores напрямую, потому что шкалы разные.",
    technical:
      "fuseSourcesWithRrf дедуплицирует по `docId:chunkIndex`, считает reciprocal rank score и смешивает его с rawScore.",
    debug: "Смотреть `origin=hybrid` и `rrfScore`. `rrfScore=1.000` означает лучший возможный fusion signal.",
  },
  {
    title: "5. Local rerank уточняет порядок",
    plain:
      "После RRF система чуть повышает chunk-и, где есть слова вопроса, совпадение в title/section или точная фраза.",
    technical:
      "rerankSources добавляет token overlap, titleOverlap, sectionOverlap, phraseBonus и shortPenalty.",
    debug: "Смотреть `finalScore`: это score после всех retrieval/rerank поправок.",
  },
  {
    title: "6. Decision policy выбирает answer или decline",
    plain:
      "Если лучший source достаточно сильный, система отвечает. Если evidence слабый, система честно говорит, что не знает.",
    technical:
      "decideAnswerability проверяет sources, declineThreshold, answerThreshold, mid-band и domainEvidence.",
    debug: "Смотреть `decision`, `bestScore`, `domainEvidence`, `guardrailReason`.",
  },
  {
    title: "7. LLM получает grounded prompt",
    plain:
      "Модель не получает всю базу знаний. Она получает только top-K chunks, выбранные retrieval pipeline.",
    technical:
      "buildRagPrompt собирает question + contextChunks, streamLLM вызывает Ollama `llama3` со streaming.",
    debug: "Смотреть `sources`: именно они стали grounding-контекстом.",
  },
  {
    title: "8. UI показывает ответ и сохраняет историю",
    plain:
      "Пользователь видит streaming answer, sources, timing и debug. Потом этот ответ можно открыть из history.",
    technical:
      "Assistant message сохраняет answer, sources, timing и debug JSON в Postgres, включая версию prompt-а и generation options.",
    debug: "Если прошлый ответ выглядит странно, history сохраняет debug для повторного анализа.",
  },
];
