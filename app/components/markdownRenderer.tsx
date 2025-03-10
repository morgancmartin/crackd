import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function MarkdownRenderer({ markdown }: { markdown: string }) {
  // Convert markdown to HTML and sanitize it
  const dirtyHtml = marked.parse(markdown);
  const cleanHtml = DOMPurify.sanitize(dirtyHtml as string);

  return (
    <div
      className="prose-sm prose-ul:list-disc prose-ol:list-decimal max-w-none"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
