import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders the AI Brewmaster's replies. react-markdown doesn't render raw HTML, so model output (which
// can echo text from pages the user linked) can't inject markup; links always open in a new tab.
const components: Components = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-0.5 pl-4 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-0.5 pl-4 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <p className="mt-2 text-[13px] font-bold text-ink-text first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-2 text-[13px] font-bold text-ink-text first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-2 text-[12.5px] font-bold text-ink-text first:mt-0">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-brand-500 underline underline-offset-2 hover:text-brand-400"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-ink-card px-1 py-0.5 font-mono text-[11.5px] text-ink-text">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-ink-card p-2 font-mono text-[11.5px]">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-ink-border-strong pl-3 text-ink-text-faint">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-ink-divider" />,
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-ink-divider px-2 py-1 font-semibold text-ink-text">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-ink-divider/50 px-2 py-1">{children}</td>,
};

export const ChatMarkdown = ({ children }: { children: string }) => (
  <div className="min-w-0 break-words">
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </Markdown>
  </div>
);
