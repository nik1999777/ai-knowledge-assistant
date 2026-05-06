import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import { getEvalReport } from "../../features/eval/api/eval";
import type { EvalCaseResult } from "../../features/eval/types/eval";
import { AppHeader } from "../../shared/components/AppHeader";
import { ErrorCard } from "../../shared/components/ErrorCard";
import { Layout } from "../../shared/components/Layout";

export function EvalPage() {
  const reportQuery = useQuery({
    queryKey: ["eval-report"],
    queryFn: getEvalReport,
  });
  const report = reportQuery.data;
  const failedCases = useMemo(
    () =>
      (report?.results ?? [])
        .filter((result) => !result.answerabilityCorrect)
        .sort((left, right) => right.bestScore - left.bestScore),
    [report],
  );

  return (
    <Layout>
      <AppHeader />

      <HeroCard>
        <Eyebrow>RAG Eval</Eyebrow>
        <Title>Качество retrieval и decision policy</Title>
        <Subtitle>
          Эта страница читает последний `test-data/rag-eval/last-report.json`.
          После изменений в retrieval запускай `npm run eval:rag` из `apps/api`
          и смотри, стало ли лучше.
        </Subtitle>
      </HeroCard>

      {reportQuery.isLoading ? <InfoCard>Загружаю eval report...</InfoCard> : null}

      {reportQuery.error ? (
        <ErrorCard
          message={
            reportQuery.error instanceof Error
              ? reportQuery.error.message
              : "Ошибка загрузки eval report"
          }
        />
      ) : null}

      {report ? (
        <>
          <MetaLine>Последний прогон: {formatDate(report.generatedAt)}</MetaLine>

          <MetricGrid>
            <MetricCard $tone={qualityTone(report.summary.answerabilityAccuracy)}>
              <MetricLabel>Answerability accuracy</MetricLabel>
              <MetricValue>{formatPercent(report.summary.answerabilityAccuracy)}</MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Total cases</MetricLabel>
              <MetricValue>{report.summary.total}</MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Decline rate</MetricLabel>
              <MetricValue>{formatPercent(report.summary.declineRate)}</MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Avg best score</MetricLabel>
              <MetricValue>{report.summary.avgBestScore.toFixed(3)}</MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Policy declined</MetricLabel>
              <MetricValue>{report.summary.policyDeclined ?? "—"}</MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Model declined</MetricLabel>
              <MetricValue>{report.summary.modelDeclined ?? "—"}</MetricValue>
            </MetricCard>

            <MetricCard $tone="warn">
              <MetricLabel>Model refusals after policy answer</MetricLabel>
              <MetricValue>
                {report.summary.modelDeclinedAfterPolicyAnswer ?? "—"}
              </MetricValue>
            </MetricCard>

            <MetricCard>
              <MetricLabel>Avg domain evidence</MetricLabel>
              <MetricValue>
                {formatOptionalNumber(report.summary.avgDomainEvidence)}
              </MetricValue>
            </MetricCard>
          </MetricGrid>

          <TwoColumn>
            <SectionCard>
              <SectionTitle>Confusion matrix</SectionTitle>
              <MatrixGrid>
                <MatrixItem>
                  <SmallLabel>TP</SmallLabel>
                  <strong>{report.summary.confusion.tp}</strong>
                </MatrixItem>
                <MatrixItem>
                  <SmallLabel>TN</SmallLabel>
                  <strong>{report.summary.confusion.tn}</strong>
                </MatrixItem>
                <MatrixItem $danger>
                  <SmallLabel>FP</SmallLabel>
                  <strong>{report.summary.confusion.fp}</strong>
                </MatrixItem>
                <MatrixItem $danger>
                  <SmallLabel>FN</SmallLabel>
                  <strong>{report.summary.confusion.fn}</strong>
                </MatrixItem>
              </MatrixGrid>
            </SectionCard>

            <SectionCard>
              <SectionTitle>Recommended thresholds</SectionTitle>
              <ThresholdRow>
                <ThresholdBlock>
                  <SmallLabel>Single</SmallLabel>
                  <strong>{report.summary.recommendedThreshold.threshold.toFixed(3)}</strong>
                  <ThresholdMeta>
                    accuracy {formatPercent(report.summary.recommendedThreshold.accuracy)}
                  </ThresholdMeta>
                </ThresholdBlock>
                <ThresholdBlock>
                  <SmallLabel>Dual decline / answer</SmallLabel>
                  <strong>
                    {report.summary.recommendedDualThreshold.declineThreshold.toFixed(3)}
                    {" / "}
                    {report.summary.recommendedDualThreshold.answerThreshold.toFixed(3)}
                  </strong>
                  <ThresholdMeta>
                    accuracy{" "}
                    {formatPercent(report.summary.recommendedDualThreshold.accuracy)}
                  </ThresholdMeta>
                </ThresholdBlock>
              </ThresholdRow>
            </SectionCard>
          </TwoColumn>

          {report.summary.categorySummary?.length ? (
            <SectionCard>
              <SectionTitle>Categories</SectionTitle>
              <CategoryTable>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Accuracy</th>
                    <th>Decline</th>
                    <th>Avg score</th>
                    <th>FP/FN</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.categorySummary.map((category) => (
                    <tr key={category.category}>
                      <td>{category.category}</td>
                      <td>{category.total}</td>
                      <td>{formatPercent(category.accuracy)}</td>
                      <td>{formatPercent(category.declineRate)}</td>
                      <td>{category.avgBestScore.toFixed(3)}</td>
                      <td>
                        {category.confusion.fp} / {category.confusion.fn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CategoryTable>
            </SectionCard>
          ) : null}

          <SectionCard>
            <SectionHeader>
              <SectionTitle>Failed cases</SectionTitle>
              <Muted>{failedCases.length} кейсов требуют внимания</Muted>
            </SectionHeader>

            {failedCases.length === 0 ? (
              <InfoText>Все кейсы прошли по answerability.</InfoText>
            ) : (
              <CasesList>
                {failedCases.map((result) => (
                  <CaseCard key={result.id} result={result} />
                ))}
              </CasesList>
            )}
          </SectionCard>
        </>
      ) : null}
    </Layout>
  );
}

function CaseCard({ result }: { result: EvalCaseResult }) {
  return (
    <CaseArticle>
      <CaseHeader>
        <div>
          <CaseId>
            {result.id} · {result.category ?? "uncategorized"}
          </CaseId>
          <Question>{result.question}</Question>
        </div>
        <StatusBadge $bad>
          {result.expectedAnswerable ? "False negative" : "False positive"}
        </StatusBadge>
      </CaseHeader>

      <AnswerText>{result.answer}</AnswerText>

      <DebugLine>
        <span>expected: {result.expectedAnswerable ? "answer" : "decline"}</span>
        <span>actual: {result.declined ? "declined" : "answered"}</span>
        <span>reason: {result.declineReason ?? "none"}</span>
        <span>policy: {result.policyDeclined ? "declined" : "answered"}</span>
        <span>model: {result.modelDeclined ? "declined" : "answered"}</span>
        <span>score: {result.bestScore.toFixed(3)}</span>
        <span>decision: {result.decision ?? "unknown"}</span>
        <span>guardrail: {result.guardrailReason ?? "none"}</span>
      </DebugLine>

      {result.sources?.length ? (
        <SourcesList>
          {result.sources.slice(0, 3).map((source) => (
            <SourcePreview key={`${source.docId}-${source.chunkIndex}`}>
              <SourcePreviewHeader>
                <strong>{source.title}</strong>
                <span>
                  chunk {source.chunkIndex} · {source.score.toFixed(3)}
                </span>
              </SourcePreviewHeader>
              <SourcePreviewText>{source.textPreview}</SourcePreviewText>
            </SourcePreview>
          ))}
        </SourcesList>
      ) : null}
    </CaseArticle>
  );
}

const HeroCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const Eyebrow = styled.div`
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin: 0 0 10px;
  font-size: 30px;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
`;

const InfoCard = styled.div`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
`;

const MetaLine = styled.p`
  margin: 0 0 14px;
  color: var(--text-muted);
  line-height: 1.6;
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;

  @media (max-width: 980px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const MetricCard = styled.section<{ $tone?: "good" | "warn" | "bad" }>`
  background: ${({ $tone }) =>
    $tone === "good"
      ? "#ecfdf5"
      : $tone === "warn"
        ? "#fffbeb"
        : $tone === "bad"
          ? "#fef2f2"
          : "var(--surface)"};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "good"
        ? "#bbf7d0"
        : $tone === "warn"
          ? "#fde68a"
          : $tone === "bad"
            ? "#fecaca"
            : "var(--border)"};
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-soft);
`;

const MetricLabel = styled.div`
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 8px;
`;

const MetricValue = styled.div`
  color: var(--text-primary);
  font-size: 26px;
  font-weight: 800;
  line-height: 1.1;
`;

const TwoColumn = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const SectionCard = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-soft);
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h3`
  margin: 0 0 14px;
  font-size: 20px;
`;

const MatrixGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
`;

const MatrixItem = styled.div<{ $danger?: boolean }>`
  border: 1px solid ${({ $danger }) => ($danger ? "#fecaca" : "var(--border)")};
  background: ${({ $danger }) => ($danger ? "#fef2f2" : "var(--surface-subtle)")};
  border-radius: 14px;
  padding: 12px;
`;

const SmallLabel = styled.div`
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 6px;
`;

const ThresholdRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const ThresholdBlock = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 14px;
  padding: 12px;
  display: grid;
  gap: 6px;
`;

const Muted = styled.span`
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
`;

const ThresholdMeta = styled.span`
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
`;

const CategoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 10px 8px;
    text-align: left;
  }

  th {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }
`;

const InfoText = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const CasesList = styled.div`
  display: grid;
  gap: 12px;
`;

const CaseArticle = styled.article`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 16px;
  padding: 14px;
`;

const CaseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
`;

const CaseId = styled.div`
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 6px;
`;

const Question = styled.h4`
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
`;

const StatusBadge = styled.span<{ $bad?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ $bad }) => ($bad ? "#fecaca" : "var(--border)")};
  background: ${({ $bad }) => ($bad ? "#fef2f2" : "var(--surface)")};
  color: ${({ $bad }) => ($bad ? "var(--danger)" : "var(--text-secondary)")};
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
`;

const AnswerText = styled.p`
  margin: 0 0 10px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const DebugLine = styled.div`
  display: flex;
  gap: 8px 12px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 13px;
`;

const SourcesList = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;
`;

const SourcePreview = styled.div`
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 12px;
`;

const SourcePreviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-primary);
  font-size: 13px;
  margin-bottom: 6px;
  flex-wrap: wrap;

  span {
    color: var(--text-muted);
  }
`;

const SourcePreviewText = styled.p`
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
`;

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatOptionalNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function qualityTone(value: number) {
  if (value >= 0.8) {
    return "good";
  }

  if (value >= 0.65) {
    return "warn";
  }

  return "bad";
}
