"use client";

// 报告流式渲染(任务书§6):打字机效果;已有缓存则直接展示(依然走同一接口)。
// 实现:fetch 流入 targetRef 缓冲,定时器按固定步进追赶,兼顾"真流式"与"缓存秒回"两种节奏。
import { useEffect, useRef, useState } from "react";

type Phase = "loading" | "streaming" | "done" | "error";

export default function ReportViewer({ sessionId }: { sessionId: string }) {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const targetRef = useRef("");
  const streamDoneRef = useRef(false);
  const startedRef = useRef(false);
  const typeStartRef = useRef<number | null>(null);

  useEffect(() => {
    // 打字机计时器:每次挂载都要启动(StrictMode 会挂载→卸载→再挂载,
    // cleanup 只清计时器;拉流则只启动一次,写入跨挂载存活的 targetRef)。
    // 进度按"经过时间"计算而非每跳固定步进:页面切后台时浏览器会节流计时器,
    // 回到前台的第一跳就能追平应显示的位置,不会出现慢动作残影。
    const CHARS_PER_SECOND = 250;
    const timer = window.setInterval(() => {
      const target = targetRef.current;
      if (target.length === 0) return;
      typeStartRef.current ??= Date.now();
      const want = Math.ceil(((Date.now() - typeStartRef.current) / 1000) * CHARS_PER_SECOND);
      setDisplayed((prev) => {
        const nextLen = Math.min(target.length, Math.max(prev.length, want));
        if (nextLen >= target.length && streamDoneRef.current) {
          setPhase("done");
        }
        return nextLen === prev.length ? prev : target.slice(0, nextLen);
      });
    }, 24);

    async function run() {
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error((data as { error?: string })?.error ?? "生成失败");
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
      } catch {
        setPhase("error");
      }
    }
    if (!startedRef.current) {
      startedRef.current = true; // 同一会话只触发一次生成,防止重复请求
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
        <p className="text-sm text-soft">报告生成遇到了一点问题</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-accent px-8 py-3 font-bold text-white active:scale-95"
        >
          刷新重试
        </button>
        <p className="text-xs text-soft/70">已生成的报告不会重复计费,放心刷新</p>
      </section>
    );
  }

  if (phase === "loading" && displayed.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-card bg-white p-10 text-center shadow-sm">
        <div className="anim-reveal text-4xl" aria-hidden>
          ✍️
        </div>
        <p className="text-sm font-medium">鉴定师正在为你撰写报告…</p>
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

/** 极简 Markdown 渲染:只处理 ## 小标题 / - 列表 / 分隔线 / 段落,不引第三方库 */
function renderReport(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <h2 key={i} className="mb-3 mt-6 text-lg font-bold text-accentDeep first:mt-0">
          {trimmed.replace(/^#{1,3}\s*/, "")}
        </h2>
      );
    }
    if (trimmed === "---") {
      return <hr key={i} className="my-5 border-ink/10" />;
    }
    if (/^[-*]\s/m.test(trimmed)) {
      const items = trimmed.split("\n").filter((l) => /^[-*\d]/.test(l.trim()));
      return (
        <ul key={i} className="mb-4 space-y-1.5 text-sm leading-relaxed text-ink/85">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2">
              <span aria-hidden className="text-accent">
                ·
              </span>
              <span>{stripInlineMarkup(item.replace(/^[-*]\s*/, ""))}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mb-4 text-[15px] leading-[1.9] text-ink/85">
        {stripInlineMarkup(trimmed)}
      </p>
    );
  });
}

function stripInlineMarkup(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}
