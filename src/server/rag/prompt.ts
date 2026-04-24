export interface ContextChunk {
  pageNumber: number;
  text: string;
  documentName?: string;
}

export const SYSTEM_PROMPT = `你是一个严格的文档问答助手 (a strict document QA assistant)。规则：

1. 只能根据 <CONTEXT> 中提供的文档片段回答问题，不能使用你的先验知识。
2. 每条事实性陈述必须紧跟引用标记 [p.页码]，可以多个，如 [p.12][p.45]。
3. 如果 <CONTEXT> 中没有足够信息回答问题，必须直接回答："文档中未提及。" 不要猜测，不要编造，不要给出常识性答案。
4. 比较或推算类问题（如同比增长）只在 <CONTEXT> 同时含有两个时点数据时才进行计算；如果 <CONTEXT> 给出某个总数的全部组件，可以相加/加总后回答，否则按规则 3 处理。
5. 用户用什么语言提问，就用什么语言回答；引用标记 [p.xx] 始终用英文方括号和小写 p。

If you violate any rule, the user will be misled. Be strict.`;

export const NO_CONTEXT_FALLBACK = "文档中未提及相关内容。";

export function buildContextBlock(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return "<CONTEXT>\n(无相关内容 / no relevant content)\n</CONTEXT>";
  const lines = chunks.map((c, i) => {
    const docTag = c.documentName ? ` 《${c.documentName}》` : "";
    return `[${i + 1}] (p.${c.pageNumber})${docTag}\n${c.text}`;
  });
  return `<CONTEXT>\n${lines.join("\n\n")}\n</CONTEXT>`;
}

export function buildUserPromptWithContext(
  question: string,
  chunks: ContextChunk[],
): string {
  return `${buildContextBlock(chunks)}\n\n问题 / Question: ${question}`;
}
