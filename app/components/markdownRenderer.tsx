import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function MarkdownRenderer({ markdown }: { markdown: string }) {
  // Convert markdown to HTML and sanitize it
  const dirtyHtml = marked.parse(markdown);
  const cleanHtml = DOMPurify.sanitize(dirtyHtml as string);

  return (
    <div
      className="prose-sm prose-ul:list-disc prose-ol:list-decimal max-w-none break-words whitespace-pre-wrap overflow-hidden [&>p]:my-0 [&>ul]:my-0 [&>ol]:my-0 [&>h1]:my-0 [&>h2]:my-0 [&>h3]:my-0 [&>h4]:my-0 [&>h5]:my-0 [&>h6]:my-0"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
