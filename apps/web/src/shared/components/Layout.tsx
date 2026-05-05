import type { PropsWithChildren } from "react";
import styled from "styled-components";

export function Layout({ children }: PropsWithChildren) {
  return (
    <Page>
      <Container>{children}</Container>
    </Page>
  );
}

const Page = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at top, var(--bg-page-accent) 0%, transparent 32%),
    linear-gradient(180deg, #fcfcfd 0%, var(--bg-page) 100%);
  color: var(--text-primary);
  padding: 32px 16px 48px;
`;

const Container = styled.div`
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
`;
