import { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import type { ChatResponse } from "../types/chat";

type AnswerSectionProps = {
  data: ChatResponse;
};

export function AnswerSection({ data }: AnswerSectionProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const decisionLabel =
    data.debug.decision === "answered" ? "Ответ сгенерирован" : "Ответ отклонен";
  const decisionSummary =
    data.debug.decision === "answered"
      ? "Модель сгенерировала ответ на основе найденного контекста."
      : "Система решила, что уверенности в контексте недостаточно.";
  const guardrailReasonLabel = formatGuardrailReason(data.debug.guardrailReason);

  return (
    <>
      <AnswerBubble>
        <AnswerText>{data.answer}</AnswerText>

        <SummaryRow>
          <MetricPill>
            <ScoreLabel>Decision</ScoreLabel>
            <ScoreValue>
              {data.debug.decision === "answered" ? "Answered" : "Declined"}
            </ScoreValue>
          </MetricPill>

          <MetricPill>
            <ScoreLabel>Best score</ScoreLabel>
            <ScoreValue>{data.bestScore.toFixed(3)}</ScoreValue>
          </MetricPill>

          <MetricPill>
            <ScoreLabel>Total</ScoreLabel>
            <ScoreValue>{data.timing.totalMs} ms</ScoreValue>
          </MetricPill>
        </SummaryRow>
      </AnswerBubble>

      <DetailsRow>
        <DetailsCard>
          <DebugHeader>
            <SectionTitle>Debug</SectionTitle>
            <DebugSummary>{decisionSummary}</DebugSummary>
            <DebugToggle
              type="button"
              onClick={() => setShowDebug((current) => !current)}
            >
              {showDebug ? "Скрыть" : "Показать"}
            </DebugToggle>
          </DebugHeader>

          {showDebug ? (
            <DetailsBody>
              <CompactGrid>
                <CompactItem>
                  <TimingLabel>Decision</TimingLabel>
                  <strong>{decisionLabel}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Answer threshold</TimingLabel>
                  <strong>{data.debug.threshold.toFixed(3)}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Decline threshold</TimingLabel>
                  <strong>{formatNumber(data.debug.declineThreshold)}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Domain evidence</TimingLabel>
                  <strong>{formatNumber(data.debug.domainEvidence)}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Vector / Lexical / Merged</TimingLabel>
                  <strong>
                    {data.debug.vectorCount ?? 0} / {data.debug.lexicalCount ?? 0} /{" "}
                    {data.debug.mergedCount ?? 0}
                  </strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Reranked count</TimingLabel>
                  <strong>{data.debug.rerankedCount ?? data.sources.length}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Top-K</TimingLabel>
                  <strong>{data.debug.topK}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Guardrail reason</TimingLabel>
                  <strong>{guardrailReasonLabel}</strong>
                </CompactItem>
              </CompactGrid>

              <TimingStrip>
                <TimingPill>
                  <TimingLabel>Embedding</TimingLabel>
                  <strong>{data.timing.embeddingMs} ms</strong>
                </TimingPill>
                <TimingPill>
                  <TimingLabel>Search</TimingLabel>
                  <strong>{data.timing.searchMs} ms</strong>
                </TimingPill>
                <TimingPill>
                  <TimingLabel>LLM</TimingLabel>
                  <strong>{data.timing.llmMs} ms</strong>
                </TimingPill>
                <TimingPill>
                  <TimingLabel>Total</TimingLabel>
                  <strong>{data.timing.totalMs} ms</strong>
                </TimingPill>
              </TimingStrip>
            </DetailsBody>
          ) : null}
        </DetailsCard>

        <DetailsCard>
          <DebugHeader>
            <SectionTitle>Контекст</SectionTitle>
            <DebugSummary>
              Chunk-ы, которые retrieval передал модели как grounding.
            </DebugSummary>
            <DebugToggle
              type="button"
              onClick={() => setShowSources((current) => !current)}
            >
              {showSources ? "Скрыть" : "Показать"}
            </DebugToggle>
          </DebugHeader>

          {showSources ? (
            <DetailsBody>
              <SectionDescription>
                Чем выше score, тем выше приоритет chunk-а в итоговом контексте.
              </SectionDescription>

              {data.sources.length === 0 ? (
                <NoSources>Подходящих источников не найдено.</NoSources>
              ) : (
                <Sources>
                  {data.sources.map((source, index) => (
                    <SourceCard key={`${source.docId}-${index}`}>
                      <SourceHeader>
                        <div>
                          <SourceTitleLink
                            to={`/documents/${source.docId}?chunk=${source.chunkIndex}`}
                            state={{ snippet: source.text }}
                          >
                            {source.title}
                          </SourceTitleLink>
                          <Meta>
                            docId: {source.docId} • chunk: {source.chunkIndex}
                          </Meta>
                          <Meta>
                            origin: {formatOrigin(source.origin)} • vector:{" "}
                            {formatRankScore(source.vectorRank, source.vectorScore)} •
                            lexical:{" "}
                            {formatRankScore(source.lexicalRank, source.lexicalScore)} •
                            RRF: {formatNumber(source.rrfScore)}
                          </Meta>
                        </div>

                        <ScoreBadge>
                          final {formatNumber(source.finalScore ?? source.score)}
                        </ScoreBadge>
                      </SourceHeader>

                      <SourceText>{source.text}</SourceText>
                    </SourceCard>
                  ))}
                </Sources>
              )}
            </DetailsBody>
          ) : null}
        </DetailsCard>
      </DetailsRow>
    </>
  );
}

const AnswerBubble = styled.section`
  background: transparent;
  border: none;
  padding: 2px 2px 0;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
`;

const SectionDescription = styled.p`
  margin-top: -2px;
  margin-bottom: 14px;
  color: var(--text-muted);
  line-height: 1.7;
`;

const AnswerText = styled.p`
  line-height: 1.7;
  font-size: 15px;
  margin-top: 0;
  margin-bottom: 14px;
  color: var(--text-primary);
`;

const SummaryRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const MetricPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
`;

const ScoreLabel = styled.span`
  font-size: 14px;
`;

const ScoreValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-weight: 700;
`;

const DetailsRow = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 12px;
`;

const DetailsCard = styled.section`
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(229, 231, 235, 0.85);
  border-radius: 16px;
  padding: 14px;
`;

const DetailsBody = styled.div`
  margin-top: 14px;
`;

const DebugHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const DebugSummary = styled.p`
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
  flex: 1 1 260px;
  font-size: 13px;
`;

const DebugToggle = styled.button`
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: var(--border-strong);
  }
`;

const CompactGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const CompactItem = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TimingLabel = styled.span`
  color: var(--text-muted);
  font-size: 13px;
`;

const TimingStrip = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
`;

const TimingPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.72);
`;

const Sources = styled.div`
  display: grid;
  gap: 10px;
`;

const SourceCard = styled.div`
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 13px;
  background: rgba(255, 255, 255, 0.72);
`;

const SourceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
`;

const SourceTitleLink = styled(Link)`
  display: inline-block;
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 6px;
  color: var(--text-primary);
  text-decoration: none;

  &:hover {
    color: var(--accent-strong);
    text-decoration: underline;
  }
`;

const Meta = styled.div`
  font-size: 13px;
  color: var(--text-muted);
`;

const ScoreBadge = styled.div`
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
`;

const SourceText = styled.p`
  margin: 0;
  line-height: 1.7;
  color: var(--text-secondary);
`;

const NoSources = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function formatRankScore(rank?: number, score?: number) {
  if (typeof rank !== "number" && typeof score !== "number") {
    return "—";
  }

  return `#${rank ?? "?"} / ${formatNumber(score)}`;
}

function formatOrigin(origin?: "vector" | "lexical" | "hybrid") {
  switch (origin) {
    case "vector":
      return "vector";
    case "lexical":
      return "lexical";
    case "hybrid":
      return "hybrid";
    default:
      return "unknown";
  }
}

function formatGuardrailReason(reason?: string) {
  if (!reason) {
    return "none";
  }

  switch (reason) {
    case "no_sources":
      return "Нет источников";
    case "score_below_decline_threshold":
      return "Score ниже decline threshold";
    case "low_domain_evidence_mid_band":
      return "Низкое evidence в серой зоне";
    case "low_relevance":
      return "Низкая релевантность";
    case "low_domain_evidence":
      return "Низкое domain evidence";
    default:
      return reason;
  }
}
