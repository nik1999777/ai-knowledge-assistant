# RAG Eval Набор

Эта папка хранит baseline-данные для локальной проверки качества RAG.

## Файлы

- `questions.seed.json`: стабильный benchmark-набор для seed-документов
- `questions.generated.json`: локально сгенерированный набор из текущих user-документов
- `seed-docs/`: фиксированные документы, которые используются для воспроизводимого benchmark
- `last-seed-report.json`: отчет последнего прогона `eval:seed`
- `last-generated-report.json`: отчет последнего прогона `eval:generated`
- `last-mode-matrix-report.json`: сравнение `strict`, `balanced`, `tutor` на seed benchmark

Generated reports игнорируются git, потому что они могут содержать фрагменты
пользовательских документов. Mode matrix reports тоже игнорируются как
локальные runtime-артефакты.

## Режимы eval

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

Generated eval v2 добавляет category-aware кейсы:

- `answerable`: обычный extractive вопрос по chunk-у
- `definition`: вопрос на явное определение термина
- `mentioned-not-defined`: термин найден, но явного определения нет
- `partial`: вопрос просит больше, чем есть в найденном фрагменте
- `multi-chunk`: вопрос связывает ключевые слова из двух chunk-ов документа
- `tutor-broad`: широкий объясняющий вопрос для проверки поведения tutor-style формулировок

### `eval:generated`

```bash
cd apps/api
npm run eval:generated
```

Сначала регенерирует `questions.generated.json`, затем прогоняет его через обычный
RAG eval flow и пишет `last-generated-report.json`.

### `eval:modes`

```bash
cd apps/api
npm run eval:modes
```

Переиндексирует seed-документы, затем прогоняет `questions.seed.json` в трех
answer modes: `strict`, `balanced`, `tutor`. Итоговый report
`last-mode-matrix-report.json` сравнивает accuracy, FP/FN, decline rate,
policy/model declines и средний answer support score между режимами.

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
