import { NavLink } from "react-router-dom";
import styled from "styled-components";

export function AppHeader() {
  return (
    <HeaderWrapper>
      <HeaderContent>
        <Title>AI Knowledge Assistant</Title>

        <Subtitle>
          Локальный RAG-ассистент на React + Fastify + Qdrant + Ollama
        </Subtitle>

        <NavRow>
          <NavItem to="/" end>
            Чат
          </NavItem>
          <NavItem to="/documents">База знаний</NavItem>
          <NavItem to="/architecture">Architecture / Mind Map</NavItem>
          <NavItem to="/eval">Eval</NavItem>
        </NavRow>
      </HeaderContent>

      <Badge>Local RAG Demo</Badge>
    </HeaderWrapper>
  );
}

const HeaderWrapper = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
`;

const HeaderContent = styled.div``;

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const Subtitle = styled.p`
  margin-top: 6px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
`;

const NavRow = styled.nav`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const NavItem = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.72);

  &.active {
    border-color: rgba(16, 163, 127, 0.35);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }
`;

const Badge = styled.div`
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
`;
