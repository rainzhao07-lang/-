import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "结果如何生成" };

export default function AboutAiPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-10 text-sm leading-relaxed text-ink/85">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-ink">你的结果是怎么来的</h1>
        <p className="mt-1 text-xs text-soft">我们希望你用得明白、也用得放心</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">人格与品种是怎么匹配的</h2>
        <p>根据你的每一道答案，我们用一套固定的算分规则匹配出最贴近你的铲屎官人格与本命猫品种，并用规则检测你的现实条件（预算、空间、作息等）与品种是否存在冲突。<b>同样的答案，永远得到同样的结果</b>，公开透明、可复现。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">报告文字是怎么生成的</h2>
        <p>报告由我们<b>预先撰写并审校的专业文案库</b>，根据你的答案组合而成。当前版本不调用大语言模型，因此内容稳定、不会跑偏，也不会出现胡编乱造的信息。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">关于"AI"这个词</h2>
        <p>本产品的"智能"，体现在匹配与判断的逻辑上，而非由 AI 现场生成文字。未来在数据验证成熟后，我们可能引入 AI 让报告更个性化——若有变化，会在此页更新说明。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">边界</h2>
        <p>报告不构成兽医、医疗或行为学专业意见，仅供参考。养猫是一份长期责任，请结合线下接触审慎决定。</p>
      </section>

      <Link href="/" className="mt-4 text-center text-sm text-accentDeep underline underline-offset-4">
        返回首页
      </Link>
    </main>
  );
}
