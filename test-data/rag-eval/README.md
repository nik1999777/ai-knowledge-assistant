# RAG Eval Набор

Эта папка хранит baseline-данные для локальной проверки качества RAG.

## Файлы

- `questions.json`: набор eval-кейсов для текущей пользовательской базы знаний
- `questions.seed.json`: стабильный benchmark-набор для seed-документов
- `questions.generated.json`: локально сгенерированный набор из текущих user-документов
- `seed-docs/`: фиксированные документы, которые используются для воспроизводимого benchmark
- `last-report.json`: отчет последнего прогона `eval:rag`
- `last-seed-report.json`: отчет последнего прогона `eval:seed`
- `last-generated-report.json`: отчет последнего прогона `eval:generated`

`questions.generated.json` и `last-generated-report.json` игнорируются git, потому что
они могут содержать фрагменты пользовательских документов.

## Режимы eval

### `eval:current`

```bash
cd apps/api
npm run eval:current
```

Прогоняет `questions.json` против текущей базы знаний. Этот режим полезен для ручной проверки конкретных загруженных документов, но метрики будут честными только если вопросы соответствуют этим документам.

`npm run eval:rag` оставлен как alias для `eval:current`.

### `eval:seed`

```bash
cd apps/api
npm run eval:seed
```

Переиндексирует только seed-документы со стабильными `docId` и `document_scope = 'eval'`, затем прогоняет `questions.seed.json` и сохраняет `last-seed-report.json`.

Этот режим нужен как воспроизводимый benchmark: пользовательские документы могут меняться, а seed-набор остается стабильным и не показывается в обычном списке документов.

### `eval:generate`

```bash
cd apps/api
npm run eval:generate
```

Создает `questions.generated.json` из текущих документов в `document_scope = 'user'`.
Генератор детерминированный: выбирает полезные chunks, берет ключевые слова,
сохраняет evidence quote и chunk spans, затем добавляет несколько unanswerable
guardrail-кейсов.

### `eval:generated`

```bash
cd apps/api
npm run eval:generated
```

Сначала регенерирует `questions.generated.json`, затем прогоняет его через обычный
RAG eval flow и пишет `last-generated-report.json`.

## Формат кейса

```json
{
  "id": "baseline-001",
  "question": "Что такое RAG?",
  "expected": {
    "answerable": true,
    "answerKeywords": ["RAG", "контекст"],
    "evidenceQuote": "RAG добавляет retrieved context перед генерацией.",
    "sourceKeywords": ["RAG", "retrieval"]
  }
}
```

Поля:

- `expected.answerable`: должна ли система ответить или уйти в отказ
- `expected.answerKeywords`: опциональные ключевые слова для грубой проверки ответа
- `expected.evidenceQuote`: опциональная цитата-ориентир из generated eval
- `expected.sourceKeywords`: опциональные ключевые слова для грубой проверки источников

Скрипты прогоняют retrieval + answer flow для каждого кейса и сохраняют summary/results в JSON report.
