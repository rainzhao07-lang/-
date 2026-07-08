"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type Phase = "loading" | "streaming" | "done" | "error";

export default function ReportViewer({ sessionId }: { sessionId: string }) {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("报告生成遇到了一点问题");
  const targetRef = useRef("");
  const streamDoneRef = useRef(false);
  const startedRef = useRef(false);
  const typeStartRef = useRef<number | null>(null);

  useEffect(() => {
    const charsPerSecond = 250;
    const timer = window.setInterval(() => {
      const target = targetRef.current;
      if (target.length === 0) return;

      typeStartRef.current ??= Date.now();
      const want = Math.ceil(((Date.now() - typeStartRef.current) / 1000) * charsPerSecond);

      setDisplayed((prev) => {
        const nextLen = Math.min(target.length, Math.max(prev.length, want));
        if (nextLen >= target.length && streamDoneRef.current) {
          setPhase("done");
        }
        return nextLen === prev.length ? prev : target.slice(0, nextLen);
      });
    }, 24);

    const maxPendingRetries = 10;

    async function run(attempt = 0) {
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (res.status === 409 && attempt < maxPendingRetries) {
          window.setTimeout(() => void run(attempt + 1), 3000);
          return;
        }

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error((data as { error?: string })?.error ?? "报告生成失败");
        }

        setPhase("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          targetRef.current += decoder.decode(value, { stream: true });
        }

        targetRef.current += decoder.decode();
        streamDoneRef.current = true;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "报告生成失败");
        setPhase("error");
      }
    }

    if (!startedRef.current) {
      startedRef.current = true;
      void run();
    }

    return () => window.clearInterval(timer);
  }, [sessionId]);

  if (phase === "error") {
    return (
      <section className="flex flex-col items-center gap-4 rounded-card bg-white p-8 text-center shadow-sm">
        <div className="text-4xl" aria-hidden>
          🙀
        </div>
        <p className="text-sm text-soft">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-accent px-8 py-3 font-bold text-white active:scale-95"
        >
          刷新重试
        </button>
        <p className="text-xs text-soft/70">
          兑换码已经核销的情况下，刷新不会重复消耗兑换码。
        </p>
      </section>
    );
  }

  if (phase === "loading" && displayed.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-card bg-white p-10 text-center shadow-sm">
        <div className="anim-reveal text-4xl" aria-hidden>
          ✍️
        </div>
        <p className="text-sm font-medium">正在为你生成专属报告...</p>
        <p className="text-xs text-soft">通常需要几秒钟</p>
      </section>
    );
  }

  return (
    <article className="rounded-card bg-white p-6 shadow-sm">
      <div className={phase !== "done" ? "typewriter-caret" : undefined}>
        {renderReport(displayed)}
      </div>
    </article>
  );
}

function renderReport(text: string) {
  const blocks = text.split(/\n{2,}/);

  return blocks.map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <h2
          key={index}
          className="mb-3 mt-7 flex items-center gap-2.5 text-lg font-bold text-accentDeep first:mt-0"
        >
          <span aria-hidden className="inline-block h-5 w-1.5 shrink-0 rounded-full bg-accent" />
          {trimmed.replace(/^#{1,3}\s*/, "")}
        </h2>
      );
    }

    if (trimmed === "---") {
      return <hr key={index} className="my-5 border-ink/10" />;
    }

    if (/^\d+[.、]\s*/.test(trimmed)) {
      const items = trimmed.split("\n").filter((line) => /^\d+[.、]/.test(line.trim()));
      return (
        <ol key={index} className="mb-4 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink/85">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item.trim().replace(/^\d+[.、]\s*/, ""))}</li>
          ))}
        </ol>
      );
    }

    if (/^[-*]\s/m.test(trimmed)) {
      const items = trimmed.split("\n").filter((line) => /^[-*]/.test(line.trim()));
      return (
        <ul key={index} className="mb-4 space-y-1.5 text-sm leading-relaxed text-ink/85">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-2">
              <span aria-hidden className="text-accent">
                ·
              </span>
              <span>{renderInline(item.trim().replace(/^[-*]\s*/, ""))}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={index} className="mb-4 text-[15px] leading-[1.9] text-ink/85">
        {renderInline(trimmed)}
      </p>
    );
  });
}

/** 行内渲染:**加粗** 渲染为强调,其余按纯文本(顺带去掉落单的 * 标记) */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index).replace(/\*/g, ""));
    nodes.push(
      <strong key={key++} className="font-bold text-ink">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last).replace(/\*/g, ""));
  return nodes;
}
