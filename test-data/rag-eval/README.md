# RAG Eval Набор

Эта папка хранит baseline-данные для локальной проверки качества RAG.

## Файлы

- `questions.json`: набор eval-кейсов для текущей пользовательской базы знаний
- `questions.seed.json`: стабильный benchmark-набор для seed-документов
- `seed-docs/`: фиксированные документы, которые используются для воспроизводимого benchmark
- `last-report.json`: отчет последнего прогона `eval:rag`
- `last-seed-report.json`: отчет последнего прогона `eval:seed`

## Режимы eval

### `eval:rag`

```bash
cd apps/api
npm run eval:rag
```

Прогоняет `questions.json` против текущей базы знаний. Этот режим полезен для ручной проверки конкретных загруженных документов, но метрики будут честными только если вопросы соответствуют этим документам.

### `eval:seed`

```bash
cd apps/api
npm run eval:seed
```

Переиндексирует только seed-документы со стабильными `docId`, затем прогоняет `questions.seed.json` и сохраняет `last-seed-report.json`.

Этот режим нужен как воспроизводимый benchmark: пользовательские документы могут меняться, а seed-набор остается стабильным.

## Формат кейса

```json
{
  "id": "baseline-001",
  "question": "Что такое RAG?",
  "expected": {
    "answerable": true,
    "answerKeywords": ["RAG", "контекст"],
    "sourceKeywords": ["RAG", "retrieval"]
  }
}
```

Поля:

- `expected.answerable`: должна ли система ответить или уйти в отказ
- `expected.answerKeywords`: опциональные ключевые слова для грубой проверки ответа
- `expected.sourceKeywords`: опциональные ключевые слова для грубой проверки источников

Скрипты прогоняют retrieval + answer flow для каждого кейса и сохраняют summary/results в JSON report.
