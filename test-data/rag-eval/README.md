# RAG Eval Набор

Эта папка хранит baseline-данные для локальной проверки качества RAG.

## Файлы

- `questions.json`: набор eval-кейсов
- `last-report.json`: отчет последнего прогона

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

## Запуск

Из `apps/api`:

```bash
npm run eval:rag
```

Скрипт прогоняет retrieval + answer flow для каждого кейса и сохраняет summary/results в `last-report.json`.
