import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { readDoc } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function ViewPage({ params }) {
  const { slug } = await params;
  const doc = readDoc(slug);
  if (!doc) notFound();
  return (
    <article>
      <div className="crumb">{doc.rel}</div>
      <div className="md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {doc.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
