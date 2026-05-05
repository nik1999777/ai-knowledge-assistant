import styled from "styled-components";

type ErrorCardProps = {
  message: string;
};

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <Section>
      <SectionTitle>Ошибка</SectionTitle>
      <ErrorText>{message}</ErrorText>
    </Section>
  );
}

const Section = styled.section`
  background: var(--danger-soft);
  border: 1px solid #fca5a5;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 14px;
  font-size: 22px;
  font-weight: 700;
`;

const ErrorText = styled.p`
  margin: 0;
  color: var(--danger);
`;
