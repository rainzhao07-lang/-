import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "免责声明" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-10 text-sm leading-relaxed text-ink/85">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-ink">免责声明与使用条款</h1>
        <p className="mt-1 text-xs text-soft">最后更新：2026 年 7 月</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">产品性质</h2>
        <p>本产品是一个宠物性格匹配与科普参考工具。测试结果与养猫决策报告均为<b>参考建议</b>，不构成兽医、医疗、行为学或任何专业意见。真实的养育决策，请结合线下接触与专业咨询。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">领养倡导</h2>
        <p>我们倡导领养代替购买。报告中提到的性格特质，在田园猫及待领养猫咪中同样普遍存在。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">关于兑换码</h2>
        <p>兑换码为一次性核销，成功解锁报告后不可重复使用。若在购买或兑换中遇到问题，请联系客服协助处理。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">重要提醒</h2>
        <p>每只猫都是独立的个体，品种特征只是概率参考，不代表每只同品种猫的真实性格。养宠是一份长期责任，请在确认自身条件后审慎决定。未成年人使用建议在监护人知情下进行。</p>
      </section>

      <Link href="/" className="mt-4 text-center text-sm text-accentDeep underline underline-offset-4">
        返回首页
      </Link>
    </main>
  );
}
