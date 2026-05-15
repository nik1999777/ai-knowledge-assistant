import { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { MarkdownAnswer } from "../../../shared/components/MarkdownAnswer";
import type { ChatResponse, RetrievalTraceItem } from "../types/chat";

type AnswerSectionProps = {
  data: ChatResponse;
};

type TextPart = {
  key: string;
  highlighted: boolean;
  text: string;
};

const TRACE_STAGES: Array<{
  key: keyof NonNullable<ChatResponse["debug"]["retrievalTrace"]>;
  label: string;
}> = [
  { key: "vector", label: "Vector" },
  { key: "lexical", label: "Lexical" },
  { key: "merged", label: "Merged" },
  { key: "reranked", label: "Rerank" },
  { key: "final", label: "Final" },
];

export function AnswerSection({ data }: AnswerSectionProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [activeTraceStage, setActiveTraceStage] =
    useState<keyof NonNullable<ChatResponse["debug"]["retrievalTrace"]>>("final");
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
        <MarkdownAnswer content={data.answer} />

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

          {data.debug.answerSupport ? (
            <MetricPill>
              <ScoreLabel>Support</ScoreLabel>
              <ScoreValue>
                {formatSupportStatus(data.debug.answerSupport.status)}{" "}
                {data.debug.answerSupport.score.toFixed(2)}
              </ScoreValue>
            </MetricPill>
          ) : null}
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
                  <TimingLabel>Answer mode</TimingLabel>
                  <strong>{formatAnswerMode(data.debug.answerMode)}</strong>
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
                  <TimingLabel>Answer support</TimingLabel>
                  <strong>
                    {data.debug.answerSupport
                      ? `${formatSupportStatus(data.debug.answerSupport.status)} ${data.debug.answerSupport.score.toFixed(3)}`
                      : "—"}
                  </strong>
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
                  <TimingLabel>Prompt</TimingLabel>
                  <strong>{data.debug.promptVersion ?? "unknown"}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Generation</TimingLabel>
                  <strong>{formatGenerationOptions(data.debug.generationOptions)}</strong>
                </CompactItem>

                <CompactItem>
                  <TimingLabel>Guardrail reason</TimingLabel>
                  <strong>{guardrailReasonLabel}</strong>
                </CompactItem>

                {data.debug.searchQuery ? (
                  <CompactItem style={{ gridColumn: "1 / -1" }}>
                    <TimingLabel>Search query (rewritten)</TimingLabel>
                    <strong>{data.debug.searchQuery}</strong>
                  </CompactItem>
                ) : null}
              </CompactGrid>

              {data.debug.answerSupport ? (
                <SupportTerms>
                  <TermGroup>
                    <TimingLabel>Matched terms</TimingLabel>
                    <TermList>
                      {formatTerms(data.debug.answerSupport.matchedTerms)}
                    </TermList>
                  </TermGroup>
                  <TermGroup>
                    <TimingLabel>Missing terms</TimingLabel>
                    <TermList>
                      {formatTerms(data.debug.answerSupport.missingTerms)}
                    </TermList>
                  </TermGroup>
                </SupportTerms>
              ) : null}

              <TimingStrip>
                {data.timing.rewriteMs !== undefined ? (
                  <TimingPill>
                    <TimingLabel>Rewrite</TimingLabel>
                    <strong>{data.timing.rewriteMs} ms</strong>
                  </TimingPill>
                ) : null}
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

              {data.debug.retrievalTrace ? (
                <TracePanel>
                  <TraceHeader>
                    <SectionTitle>Retrieval trace</SectionTitle>
                    <TraceTabs>
                      {TRACE_STAGES.map((stage) => (
                        <TraceTab
                          key={stage.key}
                          type="button"
                          $active={activeTraceStage === stage.key}
                          onClick={() => setActiveTraceStage(stage.key)}
                        >
                          {stage.label}
                        </TraceTab>
                      ))}
                    </TraceTabs>
                  </TraceHeader>

                  <TraceList>
                    {data.debug.retrievalTrace[activeTraceStage].map((item, index) => (
                      <TraceItemCard key={`${activeTraceStage}-${item.docId}-${item.chunkIndex}-${index}`}>
                        <TraceItemHeader>
                          <div>
                            <TraceTitle>{item.title}</TraceTitle>
                            <Meta>
                              chunk: {item.chunkIndex}
                              {item.section ? ` • section: ${item.section}` : ""}
                            </Meta>
                            <Meta>
                              origin: {formatOrigin(item.origin)} • vector:{" "}
                              {formatRankScore(item.vectorRank, item.vectorScore)} •
                              lexical:{" "}
                              {formatRankScore(item.lexicalRank, item.lexicalScore)} •
                              RRF: {formatNumber(item.rrfScore)}
                            </Meta>
                          </div>
                          <ScoreBadge>{formatTraceScore(item)}</ScoreBadge>
                        </TraceItemHeader>
                        <TracePreview>{item.textPreview}</TracePreview>
                      </TraceItemCard>
                    ))}
                  </TraceList>
                </TracePanel>
              ) : null}
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
                            {formatSourceSpan(source.startOffset, source.endOffset)}
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

                      <SourceText>
                        {renderHighlightedText(
                          source.text,
                          data.debug.answerSupport?.matchedTerms ?? [],
                        )}
                      </SourceText>
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

const TracePanel = styled.div`
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.66);
`;

const TraceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const TraceTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const TraceTab = styled.button<{ $active: boolean }>`
  min-height: 28px;
  border: 1px solid ${({ $active }) => ($active ? "var(--accent)" : "var(--border)")};
  border-radius: 999px;
  background: ${({ $active }) =>
    $active ? "rgba(16, 163, 127, 0.1)" : "rgba(255, 255, 255, 0.78)"};
  color: ${({ $active }) =>
    $active ? "var(--accent-strong)" : "var(--text-secondary)"};
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;

const TraceList = styled.div`
  display: grid;
  gap: 8px;
`;

const TraceItemCard = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 11px;
  background: rgba(255, 255, 255, 0.72);
`;

const TraceItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const TraceTitle = styled.div`
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.35;
`;

const TracePreview = styled.p`
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
`;

const SupportTerms = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 14px;

  @media (min-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const TermGroup = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TermList = styled.span`
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.5;
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

const Highlight = styled.mark`
  border-radius: 5px;
  padding: 1px 3px;
  background: rgba(250, 204, 21, 0.28);
  color: inherit;
`;

const NoSources = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function formatAnswerMode(value?: string) {
  switch (value) {
    case "strict":
      return "Strict";
    case "tutor":
      return "Tutor";
    case "balanced":
      return "Balanced";
    default:
      return "Balanced";
  }
}

function formatSupportStatus(value: string) {
  switch (value) {
    case "fully_supported":
      return "Full";
    case "partially_supported":
      return "Partial";
    case "unsupported":
      return "Weak";
    default:
      return value;
  }
}

function formatTerms(terms: string[]) {
  return terms.length > 0 ? terms.slice(0, 8).join(", ") : "—";
}

function renderHighlightedText(text: string, terms: string[]) {
  const parts = splitHighlightedText(text, terms);

  return parts.map((part) =>
    part.highlighted ? (
      <Highlight key={part.key}>{part.text}</Highlight>
    ) : (
      <span key={part.key}>{part.text}</span>
    ),
  );
}

function splitHighlightedText(text: string, terms: string[]): TextPart[] {
  const uniqueTerms = [...new Set(terms)]
    .filter((term) => term.length >= 3)
    .sort((left, right) => right.length - left.length);

  if (uniqueTerms.length === 0) {
    return [{ highlighted: false, key: "text-0", text }];
  }

  const pattern = new RegExp(`(${uniqueTerms.map(escapeRegExp).join("|")})`, "giu");
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let partIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchText = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        highlighted: false,
        key: `text-${partIndex++}`,
        text: text.slice(lastIndex, index),
      });
    }

    parts.push({
      highlighted: true,
      key: `mark-${partIndex++}`,
      text: matchText,
    });
    lastIndex = index + matchText.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      highlighted: false,
      key: `text-${partIndex++}`,
      text: text.slice(lastIndex),
    });
  }

  return parts;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatSourceSpan(startOffset?: number, endOffset?: number) {
  if (typeof startOffset !== "number" || typeof endOffset !== "number") {
    return "";
  }

  return ` • span: ${startOffset}-${endOffset}`;
}

function formatGenerationOptions(
  options?: { temperature: number; seed: number },
) {
  if (!options) {
    return "unknown";
  }

  return `temp ${options.temperature} / seed ${options.seed}`;
}

function formatRankScore(rank?: number, score?: number) {
  if (typeof rank !== "number" && typeof score !== "number") {
    return "—";
  }

  return `#${rank ?? "?"} / ${formatNumber(score)}`;
}

function formatTraceScore(item: RetrievalTraceItem) {
  if (typeof item.finalScore === "number") {
    return `final ${formatNumber(item.finalScore)}`;
  }

  return `score ${formatNumber(item.score)}`;
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
