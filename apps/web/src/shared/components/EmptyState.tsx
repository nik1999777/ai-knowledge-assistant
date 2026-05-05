import styled from "styled-components";

export function EmptyState() {
  return (
    <Section>
      <Icon>💬</Icon>
      <Title>Задай вопрос по базе знаний</Title>
      <Text>
        Попробуй: «Что такое RAG?», «Что такое embeddings?» или «Почему LLM
        используют вместе с retrieval?». После первого ответа история появится
        ниже и будет сохранять предыдущие exchanges.
      </Text>
    </Section>
  );
}

const Section = styled.section`
  border: 1px dashed var(--border-strong);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  background: var(--surface-subtle);
`;

const Icon = styled.div`
  font-size: 36px;
  margin-bottom: 12px;
`;

const Title = styled.h2`
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--text-primary);
`;

const Text = styled.p`
  margin: 0;
  line-height: 1.7;
`;
