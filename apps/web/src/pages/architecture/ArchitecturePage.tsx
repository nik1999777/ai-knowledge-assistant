import { useMemo, useState } from "react";
import styled from "styled-components";
import { AppHeader } from "../../shared/components/AppHeader";
import { Layout } from "../../shared/components/Layout";
import {
  API_ROUTES,
  DEBUG_EXAMPLE,
  DEBUG_FIELDS,
  DECISION_TREE,
  DESIGN_DECISIONS,
  EVAL_FACTS,
  EVAL_READING_GUIDE,
  FAILURE_PLAYBOOK,
  GLOSSARY,
  KNOWN_LIMITATIONS,
  LIFECYCLES,
  MODULE_BOUNDARIES,
  PAYLOAD_EXAMPLES,
  ROADMAP_ITEMS,
  STAGES,
  STORAGE_ITEMS,
  SYSTEM_SUMMARY,
  TRACES,
  TROUBLESHOOTING,
  VIEWS,
  VISUAL_FLOWS,
  WALKTHROUGH_STEPS,
} from "./architectureContent";
import type { StageInfo, StageId, TraceId, ViewId } from "./architectureContent";

export function ArchitecturePage() {
  const [activeView, setActiveView] = useState<ViewId>("pipeline");
  const [selectedStageId, setSelectedStageId] = useState<StageId>("retrieve");
  const [selectedTraceId, setSelectedTraceId] = useState<TraceId>("question");
  const [selectedTerm, setSelectedTerm] = useState(GLOSSARY[0].term);

  const selectedStage = useMemo(
    () => STAGES.find((stage) => stage.id === selectedStageId) ?? STAGES[0],
    [selectedStageId],
  );
  const selectedTrace = TRACES[selectedTraceId];
  const activeTerm =
    GLOSSARY.find((item) => item.term === selectedTerm) ?? GLOSSARY[0];

  return (
    <Layout>
      <AppHeader />

      <Intro>
        <Eyebrow>Architecture</Eyebrow>
        <Title>AI Knowledge Assistant: как проект работает внутри</Title>
        <Subtitle>
          Это интерактивная карта проекта: pipeline, retrieval, eval, storage,
          API и debug. Ее цель простая: открыть страницу через неделю и быстро
          вспомнить, что происходит с документом, вопросом, source score и eval
          report.
        </Subtitle>
        <SummaryGrid>
          {SYSTEM_SUMMARY.map((item) => (
            <SummaryItem key={item.title}>
              <SummaryLabel>{item.title}</SummaryLabel>
              <SummaryText>{item.body}</SummaryText>
            </SummaryItem>
          ))}
        </SummaryGrid>
      </Intro>

      <NavGrid>
        {VIEWS.map((view) => (
          <NavButton
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            $active={activeView === view.id}
          >
            <strong>{view.title}</strong>
            <span>{view.subtitle}</span>
          </NavButton>
        ))}
      </NavGrid>

      {activeView === "pipeline" ? (
        <>
          <Section>
            <SectionTitle>Короткая версия</SectionTitle>
            <PipelineLine>
              {"Upload -> Parse -> Chunk -> Embed -> Store -> Retrieve -> RRF -> Decide -> Generate -> Stream -> Save history"}
            </PipelineLine>
            <TagList>
              <MetricTag>Fastify API</MetricTag>
              <MetricTag>React/Vite UI</MetricTag>
              <MetricTag>Postgres FTS</MetricTag>
              <MetricTag>Qdrant vectors</MetricTag>
              <MetricTag>Ollama local models</MetricTag>
            </TagList>
          </Section>

          <Section>
            <SectionTitle>Визуальные схемы</SectionTitle>
            <LeadText>
              Эти схемы показывают три главных потока проекта отдельно. Так
              проще не смешивать ingestion, chat runtime и eval: у каждого
              потока свой вход, свои промежуточные шаги и свой результат.
            </LeadText>
            <FlowGrid>
              {VISUAL_FLOWS.map((flow) => (
                <FlowCard key={flow.title}>
                  <BlockTitle>{flow.title}</BlockTitle>
                  <Text>{flow.summary}</Text>
                  <FlowLanes>
                    {flow.lanes.map((lane) => (
                      <FlowLane key={lane.title}>
                        <FlowLaneTitle>{lane.title}</FlowLaneTitle>
                        {lane.steps.map((step, index) => (
                          <FlowStep key={step}>
                            <span>{step}</span>
                            {index < lane.steps.length - 1 ? <FlowArrow>↓</FlowArrow> : null}
                          </FlowStep>
                        ))}
                      </FlowLane>
                    ))}
                  </FlowLanes>
                </FlowCard>
              ))}
            </FlowGrid>
          </Section>

          <Section>
            <SectionTitle>Trace Explorer</SectionTitle>
            <Segmented>
              {Object.entries(TRACES).map(([id, trace]) => (
                <SegmentButton
                  key={id}
                  type="button"
                  onClick={() => setSelectedTraceId(id as TraceId)}
                  $active={selectedTraceId === id}
                >
                  {trace.title}
                </SegmentButton>
              ))}
            </Segmented>
            <TraceSummary>{selectedTrace.summary}</TraceSummary>
            <StepGrid>
              {selectedTrace.steps.map((step, index) => (
                <StepCard key={step.title}>
                  <StepNumber>{index + 1}</StepNumber>
                  <BlockTitle>{step.title}</BlockTitle>
                  <Text>{step.description}</Text>
                  <PathList>
                    {step.files.map((file) => (
                      <PathItem key={file}>{file}</PathItem>
                    ))}
                  </PathList>
                </StepCard>
              ))}
            </StepGrid>
          </Section>

          <Section>
            <SectionTitle>Этапы pipeline</SectionTitle>
            <StagePicker>
              {STAGES.map((stage) => (
                <StageButton
                  key={stage.id}
                  type="button"
                  onClick={() => setSelectedStageId(stage.id)}
                  $active={selectedStageId === stage.id}
                >
                  <strong>{stage.title}</strong>
                  <span>{stage.subtitle}</span>
                </StageButton>
              ))}
            </StagePicker>
            <StageDetail stage={selectedStage} />
          </Section>
        </>
      ) : null}

      {activeView === "retrieval" ? (
        <>
          <Section>
            <SectionTitle>Retrieval сейчас</SectionTitle>
            <LeadText>
              Retrieval отвечает на вопрос: какие куски документов стоит показать
              модели перед генерацией. Важно не просто найти похожий текст, а
              собрать доказательный контекст: точные термины, смысловую близость,
              корректный scope и устойчивый порядок кандидатов.
            </LeadText>
            <TwoColumn>
              <InfoPanel>
                <BlockTitle>Почему hybrid</BlockTitle>
                <InfoList>
                  <InfoItem>Vector search хорошо ловит смысл, даже если слова отличаются.</InfoItem>
                  <InfoItem>Lexical FTS хорошо ловит точные термины, имена и названия полей.</InfoItem>
                  <InfoItem>RRF объединяет ранги, а не raw score, потому что vector и lexical score живут в разных шкалах.</InfoItem>
                </InfoList>
              </InfoPanel>
              <InfoPanel>
                <BlockTitle>Формула в проекте</BlockTitle>
                <CodeBlock>
                  {`RRF_K = 60
vector_rrf = 1 / (RRF_K + vectorRank)
lexical_rrf = 1 / (RRF_K + lexicalRank)
rrfScore = normalized(vector_rrf + lexical_rrf)
score = rawScore * 0.82 + rrfScore * 0.18
finalScore = localRerank(score)`}
                </CodeBlock>
              </InfoPanel>
            </TwoColumn>
          </Section>
          <Section>
            <SectionTitle>Как читать один source</SectionTitle>
            <ExampleStrip>
              {DEBUG_EXAMPLE.map(([field, explanation]) => (
                <ExampleItem key={field}>
                  <ExampleKey>{field}</ExampleKey>
                  <Text>{explanation}</Text>
                </ExampleItem>
              ))}
            </ExampleStrip>
          </Section>
          <Section>
            <SectionTitle>Decision tree</SectionTitle>
            <DecisionList>
              {DECISION_TREE.map((item, index) => (
                <DecisionItem key={item}>
                  <StepNumber>{index + 1}</StepNumber>
                  <span>{item}</span>
                </DecisionItem>
              ))}
            </DecisionList>
          </Section>
        </>
      ) : null}

      {activeView === "eval" ? (
        <Section>
          <SectionTitle>Eval Lab</SectionTitle>
          <LeadText>
            Eval нужен не для красивой цифры, а для защиты от регрессий. Когда мы
            меняем retrieval, prompt или thresholds, один субъективный ручной
            вопрос не доказывает, что система стала лучше. Seed benchmark дает
            стабильный минимум: answerable вопросы должны получать ответ, а
            unanswerable вопросы должны получать отказ.
          </LeadText>
          <Grid>
            {EVAL_FACTS.map(([title, body]) => (
              <InfoPanel key={title}>
                <BlockTitle>{title}</BlockTitle>
                <Text>{body}</Text>
              </InfoPanel>
            ))}
          </Grid>
          <SubsectionTitle>Как читать confusion matrix</SubsectionTitle>
          <Grid>
            {EVAL_READING_GUIDE.map(([title, body]) => (
              <InfoPanel key={title}>
                <BlockTitle>{title}</BlockTitle>
                <Text>{body}</Text>
              </InfoPanel>
            ))}
          </Grid>
          <Callout>
            После любого изменения retrieval, thresholds, prompt или scope logic
            сначала запускаем `cd apps/api && npm run eval:seed`. Последний
            стабильный результат после RRF: `answerability_accuracy=1.000`,
            `tp=11`, `tn=4`, `fp=0`, `fn=0`.
          </Callout>
        </Section>
      ) : null}

      {activeView === "storage" ? (
        <>
          <Section>
            <SectionTitle>Storage Map</SectionTitle>
            <Grid>
              {STORAGE_ITEMS.map((item) => (
                <InfoPanel key={item.title}>
                  <BlockTitle>{item.title}</BlockTitle>
                  <Text>{item.body}</Text>
                  <TagList>
                    {item.fields.map((field) => (
                      <MetricTag key={field}>{field}</MetricTag>
                    ))}
                  </TagList>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
          <Section>
            <SectionTitle>Cleanup и consistency</SectionTitle>
            <InfoList>
              <InfoItem>Удаление документа должно убрать metadata из Postgres и vectors из Qdrant.</InfoItem>
              <InfoItem>Vector results дополнительно проверяются через Postgres, чтобы не показывать устаревший docId.</InfoItem>
              <InfoItem>`documentScope` применяется и в Postgres, и в Qdrant.</InfoItem>
            </InfoList>
          </Section>
        </>
      ) : null}

      {activeView === "api" ? (
        <Section>
          <SectionTitle>API Explorer</SectionTitle>
          <Table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Что делает</th>
                <th>Где смотреть</th>
              </tr>
            </thead>
            <tbody>
              {API_ROUTES.map(([route, action, file]) => (
                <tr key={route}>
                  <td><code>{route}</code></td>
                  <td>{action}</td>
                  <td><code>{file}</code></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : null}

      {activeView === "debug" ? (
        <>
          <Section>
            <SectionTitle>Debug Decoder</SectionTitle>
            <LeadText>
              Debug блок отвечает на вопрос “почему система поступила именно
              так”. Это не просто технические детали: по нему можно понять,
              был ли найден правильный source, почему сработал declined, где
              задержка, и какой слой retrieval внес главный вклад.
            </LeadText>
            <Grid>
              {DEBUG_FIELDS.map(([field, explanation]) => (
                <InfoPanel key={field}>
                  <BlockTitle>{field}</BlockTitle>
                  <Text>{explanation}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
          <Section>
            <SectionTitle>Troubleshooting</SectionTitle>
            <Grid>
              {TROUBLESHOOTING.map(([title, body]) => (
                <InfoPanel key={title}>
                  <BlockTitle>{title}</BlockTitle>
                  <Text>{body}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
        </>
      ) : null}

      {activeView === "why" ? (
        <Section>
          <SectionTitle>Why This Design?</SectionTitle>
          <LeadText>
            Этот раздел отвечает на вопрос “почему проект устроен именно так”.
            Архитектура состоит не из случайных библиотек, а из решений с
            trade-off: где-то мы выбираем простоту, где-то explainability, где-то
            локальность и приватность вместо managed-сервисов.
          </LeadText>
          <DecisionGrid>
            {DESIGN_DECISIONS.map((item) => (
              <DecisionCard key={item.decision}>
                <BlockTitle>{item.decision}</BlockTitle>
                <DefinitionBlock>
                  <DefinitionLabel>Почему выбрали</DefinitionLabel>
                  <Text>{item.why}</Text>
                </DefinitionBlock>
                <DefinitionBlock>
                  <DefinitionLabel>Альтернативы</DefinitionLabel>
                  <Text>{item.alternatives}</Text>
                </DefinitionBlock>
                <DefinitionBlock>
                  <DefinitionLabel>Trade-off</DefinitionLabel>
                  <Text>{item.tradeoff}</Text>
                </DefinitionBlock>
                <PathList>
                  {item.files.map((file) => (
                    <PathItem key={file}>{file}</PathItem>
                  ))}
                </PathList>
              </DecisionCard>
            ))}
          </DecisionGrid>
        </Section>
      ) : null}

      {activeView === "data" ? (
        <>
          <Section>
            <SectionTitle>Data Flow With Real Payloads</SectionTitle>
            <LeadText>
              Здесь видно, какие данные реально проходят через систему. Это
              полезно, когда абстрактные слова вроде “chunk”, “payload” и
              “source” начинают смешиваться. Каждый блок показывает форму данных
              и объясняет, зачем она нужна.
            </LeadText>
            <PayloadGrid>
              {PAYLOAD_EXAMPLES.map((item) => (
                <PayloadCard key={item.title}>
                  <BlockTitle>{item.title}</BlockTitle>
                  <Text>{item.explanation}</Text>
                  <CodeBlock>{item.code}</CodeBlock>
                </PayloadCard>
              ))}
            </PayloadGrid>
          </Section>
          <Section>
            <SectionTitle>Lifecycles</SectionTitle>
            <TwoColumn>
              {LIFECYCLES.map((item) => (
                <InfoPanel key={item.title}>
                  <BlockTitle>{item.title}</BlockTitle>
                  <DecisionList>
                    {item.steps.map((step, index) => (
                      <DecisionItem key={step}>
                        <StepNumber>{index + 1}</StepNumber>
                        <span>{step}</span>
                      </DecisionItem>
                    ))}
                  </DecisionList>
                </InfoPanel>
              ))}
            </TwoColumn>
          </Section>
          <Section>
            <SectionTitle>Boundaries And Ownership</SectionTitle>
            <Grid>
              {MODULE_BOUNDARIES.map(([name, body]) => (
                <InfoPanel key={name}>
                  <BlockTitle>{name}</BlockTitle>
                  <Text>{body}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
        </>
      ) : null}

      {activeView === "failures" ? (
        <Section>
          <SectionTitle>Failure Playbook</SectionTitle>
          <LeadText>
            Если поведение кажется странным, сначала ищем симптом, потом
            проверяем UI debug, потом код и команду. Так диагностика становится
            повторяемой, а не превращается в угадывание.
          </LeadText>
          <FailureList>
            {FAILURE_PLAYBOOK.map((item) => (
              <FailureCard key={item.symptom}>
                <BlockTitle>{item.symptom}</BlockTitle>
                <FailureGrid>
                  <DefinitionBlock>
                    <DefinitionLabel>Вероятная причина</DefinitionLabel>
                    <Text>{item.likelyCause}</Text>
                  </DefinitionBlock>
                  <DefinitionBlock>
                    <DefinitionLabel>Что проверить в UI</DefinitionLabel>
                    <Text>{item.uiCheck}</Text>
                  </DefinitionBlock>
                  <DefinitionBlock>
                    <DefinitionLabel>Что проверить в коде</DefinitionLabel>
                    <Text>{item.codeCheck}</Text>
                  </DefinitionBlock>
                  <DefinitionBlock>
                    <DefinitionLabel>Команда</DefinitionLabel>
                    <PathItem>{item.command}</PathItem>
                  </DefinitionBlock>
                </FailureGrid>
              </FailureCard>
            ))}
          </FailureList>
        </Section>
      ) : null}

      {activeView === "roadmap" ? (
        <>
          <Section>
            <SectionTitle>Known Limitations</SectionTitle>
            <LeadText>
              Прозрачная архитектура должна показывать не только то, что уже
              работает, но и границы текущей версии. Это список вещей, которые
              сознательно оставлены на следующие этапы.
            </LeadText>
            <InfoList>
              {KNOWN_LIMITATIONS.map((item) => (
                <InfoItem key={item}>{item}</InfoItem>
              ))}
            </InfoList>
          </Section>
          <Section>
            <SectionTitle>Roadmap From Here</SectionTitle>
            <Grid>
              {ROADMAP_ITEMS.map(([title, body]) => (
                <InfoPanel key={title}>
                  <BlockTitle>{title}</BlockTitle>
                  <Text>{body}</Text>
                </InfoPanel>
              ))}
            </Grid>
          </Section>
        </>
      ) : null}

      {activeView === "walkthrough" ? (
        <Section>
          <SectionTitle>Walkthrough: один вопрос целиком</SectionTitle>
          <LeadText>
            Пример ниже проводит один вопрос через весь RAG pipeline. Это самый
            полезный способ понять проект: не по отдельным терминам, а как живой
            запрос проходит frontend, backend, retrieval, decision policy, LLM и
            history.
          </LeadText>
          <QuestionBox>
            <DefinitionLabel>Пример вопроса</DefinitionLabel>
            <QuestionText>Что дает Reciprocal Rank Fusion в retrieval?</QuestionText>
          </QuestionBox>
          <WalkthroughList>
            {WALKTHROUGH_STEPS.map((step) => (
              <WalkthroughCard key={step.title}>
                <BlockTitle>{step.title}</BlockTitle>
                <WalkthroughColumns>
                  <DefinitionBlock>
                    <DefinitionLabel>Простыми словами</DefinitionLabel>
                    <Text>{step.plain}</Text>
                  </DefinitionBlock>
                  <DefinitionBlock>
                    <DefinitionLabel>Технически</DefinitionLabel>
                    <Text>{step.technical}</Text>
                  </DefinitionBlock>
                  <DefinitionBlock>
                    <DefinitionLabel>Что смотреть в debug</DefinitionLabel>
                    <Text>{step.debug}</Text>
                  </DefinitionBlock>
                </WalkthroughColumns>
              </WalkthroughCard>
            ))}
          </WalkthroughList>
        </Section>
      ) : null}

      {activeView === "glossary" ? (
        <Section>
          <SectionTitle>Glossary: термины простым языком</SectionTitle>
          <LeadText>
            Здесь собраны слова, которые постоянно встречаются в коде и UI.
            Слева выбери термин, справа смотри три уровня объяснения: общее
            значение, как это устроено именно в проекте, и живой пример.
          </LeadText>
          <GlossaryLayout>
            <TermList>
              {GLOSSARY.map((item) => (
                <TermButton
                  key={item.term}
                  type="button"
                  onClick={() => setSelectedTerm(item.term)}
                  $active={selectedTerm === item.term}
                >
                  {item.term}
                </TermButton>
              ))}
            </TermList>
            <TermDetail>
              <Eyebrow>Selected term</Eyebrow>
              <TermTitle>{activeTerm.term}</TermTitle>
              <DefinitionBlock>
                <DefinitionLabel>Коротко</DefinitionLabel>
                <Text>{activeTerm.short}</Text>
              </DefinitionBlock>
              <DefinitionBlock>
                <DefinitionLabel>В нашем проекте</DefinitionLabel>
                <Text>{activeTerm.projectMeaning}</Text>
              </DefinitionBlock>
              <DefinitionBlock>
                <DefinitionLabel>Пример</DefinitionLabel>
                <Text>{activeTerm.example}</Text>
              </DefinitionBlock>
            </TermDetail>
          </GlossaryLayout>
        </Section>
      ) : null}
    </Layout>
  );
}

function StageDetail({ stage }: { stage: StageInfo }) {
  return (
    <DetailWrap>
      <InfoPanel>
        <BlockTitle>{stage.title}</BlockTitle>
        <Text>{stage.goal}</Text>
      </InfoPanel>
      <ThreeColumn>
        <InfoPanel>
          <BlockTitle>Как работает</BlockTitle>
          <InfoList>
            {stage.flow.map((item) => (
              <InfoItem key={item}>{item}</InfoItem>
            ))}
          </InfoList>
        </InfoPanel>
        <InfoPanel>
          <BlockTitle>Метрики</BlockTitle>
          <TagList>
            {stage.metrics.map((metric) => (
              <MetricTag key={metric}>{metric}</MetricTag>
            ))}
          </TagList>
        </InfoPanel>
        <InfoPanel>
          <BlockTitle>Риски</BlockTitle>
          <InfoList>
            {stage.failures.map((item) => (
              <InfoItem key={item}>{item}</InfoItem>
            ))}
          </InfoList>
        </InfoPanel>
      </ThreeColumn>
      <InfoPanel>
        <BlockTitle>Файлы</BlockTitle>
        <PathList>
          {stage.files.map((file) => (
            <PathItem key={file}>{file}</PathItem>
          ))}
        </PathList>
      </InfoPanel>
    </DetailWrap>
  );
}

const Intro = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
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
  max-width: 920px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryItem = styled.div`
  border-left: 3px solid var(--accent);
  background: var(--surface-subtle);
  padding: 12px 13px;
`;

const SummaryLabel = styled.div`
  color: var(--text-primary);
  font-weight: 800;
  margin-bottom: 6px;
`;

const SummaryText = styled.p`
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 13px;
`;

const NavGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;

  @media (max-width: 1240px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const NavButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.45)" : "var(--border)"};
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface)"};
  color: var(--text-primary);
  border-radius: 8px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  min-height: 76px;

  span {
    display: block;
    margin-top: 5px;
    color: var(--text-muted);
    font-size: 13px;
  }
`;

const Section = styled.section`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-soft);
`;

const SectionTitle = styled.h3`
  margin: 0 0 14px;
  font-size: 22px;
`;

const SubsectionTitle = styled.h4`
  margin: 18px 0 12px;
  font-size: 18px;
  color: var(--text-primary);
`;

const LeadText = styled.p`
  margin: 0 0 16px;
  max-width: 980px;
  color: var(--text-secondary);
  line-height: 1.75;
`;

const PipelineLine = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.6;
  margin-bottom: 12px;
`;

const Segmented = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.45)" : "var(--border)"};
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface-subtle)"};
  color: var(--text-primary);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
`;

const TraceSummary = styled.p`
  margin: 0 0 14px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const StepGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StepCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 800;
  margin-bottom: 10px;
`;

const StagePicker = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const StageButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.45)" : "var(--border)"};
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface-subtle)"};
  border-radius: 8px;
  padding: 11px;
  text-align: left;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 76px;

  span {
    display: block;
    margin-top: 5px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.4;
  }
`;

const DetailWrap = styled.div`
  display: grid;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const TwoColumn = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ThreeColumn = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const InfoPanel = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const BlockTitle = styled.h4`
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text-primary);
`;

const Text = styled.p`
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 14px;
`;

const InfoList = styled.ul`
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
`;

const InfoItem = styled.li`
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 14px;
`;

const TagList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const MetricTag = styled.span`
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--accent-strong);
`;

const PathList = styled.div`
  display: grid;
  gap: 7px;
  margin-top: 10px;
`;

const PathItem = styled.code`
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
`;

const CodeBlock = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  overflow-x: auto;
  line-height: 1.6;
`;

const DecisionList = styled.div`
  display: grid;
  gap: 10px;
`;

const DecisionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-secondary);
`;

const ExampleStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const ExampleItem = styled.div`
  border: 1px solid var(--border);
  border-top: 3px solid var(--accent);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 12px;
`;

const ExampleKey = styled.div`
  color: var(--accent-strong);
  font-weight: 800;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
`;

const GlossaryLayout = styled.div`
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 14px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const TermList = styled.div`
  display: grid;
  gap: 8px;
  align-content: start;
`;

const TermButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(16, 163, 127, 0.45)" : "var(--border)"};
  background: ${({ $active }) =>
    $active ? "var(--accent-soft)" : "var(--surface-subtle)"};
  color: var(--text-primary);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: left;
  font-weight: 800;
  cursor: pointer;
`;

const TermDetail = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 18px;
`;

const TermTitle = styled.h3`
  margin: 0 0 14px;
  font-size: 24px;
`;

const DefinitionBlock = styled.div`
  border-left: 3px solid var(--accent);
  background: var(--surface);
  padding: 12px 14px;
  margin-top: 10px;
`;

const DefinitionLabel = styled.div`
  color: var(--text-primary);
  font-weight: 800;
  margin-bottom: 6px;
`;

const DecisionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const DecisionCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const PayloadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const PayloadCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;

  ${CodeBlock} {
    margin-top: 12px;
  }
`;

const FailureList = styled.div`
  display: grid;
  gap: 12px;
`;

const FailureCard = styled.div`
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const FailureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const FlowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`;

const FlowCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const FlowLanes = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const FlowLane = styled.div`
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 10px;
`;

const FlowLaneTitle = styled.div`
  color: var(--text-primary);
  font-weight: 800;
  margin-bottom: 8px;
  font-size: 13px;
`;

const FlowStep = styled.div`
  display: grid;
  justify-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  text-align: center;

  span {
    width: 100%;
    border: 1px solid var(--border);
    background: var(--surface-subtle);
    border-radius: 8px;
    padding: 8px;
  }
`;

const FlowArrow = styled.div`
  color: var(--accent-strong);
  font-weight: 900;
`;

const QuestionBox = styled.div`
  border: 1px solid rgba(16, 163, 127, 0.35);
  background: var(--accent-soft);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 14px;
`;

const QuestionText = styled.div`
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
`;

const WalkthroughList = styled.div`
  display: grid;
  gap: 12px;
`;

const WalkthroughCard = styled.div`
  border: 1px solid var(--border);
  background: var(--surface-subtle);
  border-radius: 8px;
  padding: 14px;
`;

const WalkthroughColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Callout = styled.div`
  margin-top: 14px;
  border: 1px solid rgba(16, 163, 127, 0.28);
  background: var(--accent-soft);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 14px;
  line-height: 1.7;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 8px;

  th,
  td {
    border: 1px solid var(--border);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  th {
    color: var(--text-primary);
    background: var(--surface-subtle);
  }

  code {
    color: var(--accent-strong);
    overflow-wrap: anywhere;
  }
`;
