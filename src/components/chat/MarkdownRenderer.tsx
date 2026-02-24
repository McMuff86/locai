"use client";

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { Copy, Check, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

// ── Language color dot map ────────────────────────────────────────

const langColorMap: Record<string, string> = {
  typescript:  'bg-blue-400',
  tsx:         'bg-blue-400',
  javascript:  'bg-yellow-400',
  jsx:         'bg-yellow-400',
  python:      'bg-green-400',
  bash:        'bg-emerald-400',
  shell:       'bg-emerald-400',
  sh:          'bg-emerald-400',
  css:         'bg-pink-400',
  html:        'bg-orange-400',
  json:        'bg-yellow-300',
  markdown:    'bg-muted-foreground',
  rust:        'bg-orange-600',
  go:          'bg-cyan-400',
  sql:         'bg-purple-400',
  java:        'bg-red-400',
  cpp:         'bg-blue-600',
  c:           'bg-blue-600',
  csharp:      'bg-violet-400',
  ruby:        'bg-rose-500',
  php:         'bg-indigo-400',
  swift:       'bg-orange-500',
  kotlin:      'bg-purple-500',
  yaml:        'bg-amber-400',
  toml:        'bg-amber-400',
  xml:         'bg-green-300',
  text:        'bg-muted-foreground',
};

// ── Copy Button with animation ────────────────────────────────────

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  return (
    <motion.button
      onClick={handleCopy}
      animate={{ scale: copied ? 0.92 : 1 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
        copied
          ? 'bg-cyan-500/15 text-cyan-400'
          : 'hover:bg-white/8 text-muted-foreground hover:text-foreground',
      )}
      title={copied ? 'Kopiert!' : 'Code kopieren'}
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5" /><span>Kopiert</span></>
      ) : (
        <><Copy className="h-3.5 w-3.5" /><span>Copy</span></>
      )}
    </motion.button>
  );
}

// ── Word Wrap Toggle ──────────────────────────────────────────────

function WrapButton({ wrapped, onToggle }: { wrapped: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'p-1.5 rounded text-xs transition-colors',
        wrapped
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/8',
      )}
      title={wrapped ? 'Zeilenumbruch aus' : 'Zeilenumbruch ein'}
    >
      <WrapText className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Upgraded Code Block ───────────────────────────────────────────

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [wrapped, setWrapped] = useState(false);
  const colorClass = langColorMap[language] ?? 'bg-muted-foreground';
  const displayLabel = language || 'text';
  const lineCount = code.split('\n').length;
  const showLineNumbers = lineCount > 10;

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border/40">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          'bg-muted dark:bg-black/70',
          'border-b border-border/30',
        )}
      >
        {/* Left: language dot + label */}
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colorClass)} />
          <span className="text-xs font-mono text-muted-foreground">{displayLabel}</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5">
          <WrapButton wrapped={wrapped} onToggle={() => setWrapped((p) => !p)} />
          <CopyButton code={code} />
        </div>
      </div>

      {/* Code body */}
      <div className={cn('overflow-x-auto bg-muted/80 dark:bg-black/80')}>
        <SyntaxHighlighter
          style={oneDark as any}
          language={language || 'text'}
          PreTag="div"
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.8125rem',
            lineHeight: '1.6',
            background: 'transparent',
            whiteSpace: wrapped ? 'pre-wrap' : 'pre',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ── Main MarkdownRenderer ─────────────────────────────────────────

export function MarkdownRenderer({ content, className = '', style }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // ── Code blocks ────────────────────────────────────────
          code({ className: codeClass, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClass || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            const isCodeBlock = match || codeString.includes('\n');

            if (isCodeBlock) {
              return <CodeBlock language={language} code={codeString} />;
            }

            // Inline code
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted/70 text-sm font-mono text-primary"
                {...props}
              >
                {children}
              </code>
            );
          },

          // ── Headings ───────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground border-b border-border pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h4>
          ),

          // ── Paragraphs ─────────────────────────────────────────
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
          ),

          // ── Lists ──────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 ml-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          // ── Blockquotes ────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 italic text-muted-foreground bg-muted/30 rounded-r">
              {children}
            </blockquote>
          ),

          // ── Links ──────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-2"
            >
              {children}
            </a>
          ),

          // ── Tables ─────────────────────────────────────────────
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold border-b border-border">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border-b border-border">{children}</td>
          ),

          // ── HR ─────────────────────────────────────────────────
          hr: () => <hr className="my-6 border-border" />,

          // ── Bold / Italic / Strike ─────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
          ),

          // ── Images ─────────────────────────────────────────────
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || 'Image'}
              className="max-w-full rounded-lg my-3 border border-border"
            />
          ),

          // ── Task list checkboxes ────────────────────────────────
          input: ({ checked, ...inputProps }) => (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-2 accent-primary"
              {...inputProps}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
