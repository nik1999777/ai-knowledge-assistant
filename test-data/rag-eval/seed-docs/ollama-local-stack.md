# Локальный стек Ollama

Ollama используется в этом проекте как локальный runtime для моделей.

API обращается к Ollama для двух разных задач:

1. Embeddings: модель `nomic-embed-text` превращает chunk-и документов и вопросы пользователя в векторы.
2. Generation: модель `llama3` генерирует итоговый ответ из grounded prompt.

Локальный стек также включает Postgres и Qdrant.

Postgres хранит metadata документов, полный извлеченный текст, full-text search vectors, chat sessions и chat messages.

Qdrant хранит vector embeddings для chunk-ов документов и поддерживает similarity search.

Fastify API координирует RAG pipeline. Он парсит загруженные документы, создает chunk-и, запрашивает embeddings у Ollama, пишет metadata в Postgres, пишет векторы в Qdrant, достает контекст, применяет answerability rules и стримит итоговый ответ.

React frontend позволяет пользователю загружать документы, общаться с knowledge base, смотреть источники и проверять eval metrics.

