# Заметки о vector search

Embeddings — это числовые векторные представления текста. Тексты с похожим смыслом должны иметь близкие векторы в векторном пространстве.

Vector search ищет chunk-и, embeddings которых похожи на embedding вопроса. Это полезно, когда пользователь формулирует вопрос другими словами, чем написано в исходном документе.

Qdrant — это vector database в этом проекте. Он хранит embeddings chunk-ов и payload metadata: `docId`, `title`, `chunkIndex`, `section` и текст chunk-а.

Similarity search выполняет Qdrant. Приложение отправляет embedding вопроса в Qdrant и получает ближайшие chunk-и с similarity score.

Lexical search отличается от vector search. Lexical search ищет совпадения по словам и токенам, а vector search ищет семантическую близость.

Hybrid retrieval объединяет vector candidates и lexical candidates. Часто он лучше, чем каждый метод отдельно, потому что semantic search и keyword search ошибаются по-разному.

Reranking — это второй этап скоринга после retrieval. Он переупорядочивает candidate chunk-и, чтобы итоговый контекст для языковой модели был релевантнее.

