import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styled from "styled-components";

type MarkdownAnswerProps = {
  content: string;
};

export function MarkdownAnswer({ content }: MarkdownAnswerProps) {
  return (
    <Root>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Root>
  );
}

const Root = styled.div`
  line-height: 1.7;
  font-size: 15px;
  color: var(--text-primary);

  p {
    margin: 0 0 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  h1,
  h2,
  h3,
  h4 {
    margin: 16px 0 6px;
    font-weight: 700;
    line-height: 1.35;
    color: var(--text-primary);

    &:first-child {
      margin-top: 0;
    }
  }

  h1 {
    font-size: 18px;
  }

  h2 {
    font-size: 16px;
  }

  h3,
  h4 {
    font-size: 15px;
  }

  ul,
  ol {
    margin: 0 0 10px;
    padding-left: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  li {
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  code {
    font-family: "Fira Code", "Cascadia Code", "Menlo", "Consolas", monospace;
    font-size: 13px;
    background: rgba(15, 23, 42, 0.07);
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 5px;
    padding: 1px 5px;
  }

  pre {
    margin: 10px 0;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(15, 23, 42, 0.15);
    overflow-x: auto;

    code {
      display: block;
      padding: 14px 16px;
      background: transparent;
      border: none;
      border-radius: 0;
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.6;
    }
  }

  blockquote {
    margin: 10px 0;
    padding: 8px 14px;
    border-left: 3px solid var(--accent);
    background: rgba(16, 163, 127, 0.06);
    border-radius: 0 8px 8px 0;
    color: var(--text-secondary);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 14px;

    th,
    td {
      padding: 8px 10px;
      border: 1px solid var(--border);
      text-align: left;
    }

    th {
      background: rgba(15, 23, 42, 0.05);
      font-weight: 700;
    }

    tr:nth-child(even) td {
      background: rgba(15, 23, 42, 0.02);
    }
  }

  strong {
    font-weight: 700;
  }

  em {
    font-style: italic;
  }

  a {
    color: var(--accent-strong);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 14px 0;
  }
`;
