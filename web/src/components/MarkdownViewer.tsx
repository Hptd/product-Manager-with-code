import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownViewer.css';

interface MarkdownViewerProps {
  content: string;
  fileName: string;
}

export function MarkdownViewer({ content, fileName }: MarkdownViewerProps) {
  return (
    <div className="markdown-viewer">
      <div className="markdown-header">
        <span className="markdown-title">📄 {fileName}</span>
      </div>
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // 自定义渲染组件
            h1: ({ node, ...props }) => <h1 className="md-h1" {...props} />,
            h2: ({ node, ...props }) => <h2 className="md-h2" {...props} />,
            h3: ({ node, ...props }) => <h3 className="md-h3" {...props} />,
            h4: ({ node, ...props }) => <h4 className="md-h4" {...props} />,
            p: ({ node, ...props }) => <p className="md-p" {...props} />,
            a: ({ node, ...props }) => (
              <a className="md-link" target="_blank" rel="noopener noreferrer" {...props} />
            ),
            code: ({ node, inline, className, children, ...props }: any) => {
              return !inline ? (
                <pre className="md-code-block">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              ) : (
                <code className="md-inline-code" {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ node, ...props }) => {
              // pre 已经被 code 包装处理，如果单独出现则直接渲染
              return <>{props.children}</>;
            },
            blockquote: ({ node, ...props }) => (
              <blockquote className="md-blockquote" {...props} />
            ),
            ul: ({ node, ...props }) => <ul className="md-ul" {...props} />,
            ol: ({ node, ...props }) => <ol className="md-ol" {...props} />,
            li: ({ node, ...props }) => <li className="md-li" {...props} />,
            table: ({ node, ...props }) => (
              <div className="md-table-wrapper">
                <table className="md-table" {...props} />
              </div>
            ),
            th: ({ node, ...props }) => <th className="md-th" {...props} />,
            td: ({ node, ...props }) => <td className="md-td" {...props} />,
            hr: ({ node, ...props }) => <hr className="md-hr" {...props} />,
            img: ({ node, ...props }) => (
              <img className="md-img" alt={props.alt || 'image'} {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
