import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-10 text-sm leading-relaxed text-ink/85">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-ink">隐私政策</h1>
        <p className="mt-1 text-xs text-soft">最后更新：2026 年 7 月</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">我们收集什么</h2>
        <p>为了给你生成测试结果与报告，我们只收集：你的答题选项（仅记录选项编号，不含任何文字输入）、一个随机生成的会话编号、以及你使用的兑换码。</p>
        <p>我们<b>不要求登录</b>，也<b>不收集</b>你的姓名、手机号、身份信息或精确位置。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">这些信息怎么用</h2>
        <p>仅用于计算你的铲屎官人格、匹配本命猫品种、生成你的养猫决策报告，以及核销兑换码。报告生成后会被缓存，同一次测试不会重复生成。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">存储与安全</h2>
        <p>数据存储在受访问控制保护的数据库中，仅服务端可读写，不对外公开。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">我们不做什么</h2>
        <p>我们不会出售你的数据，也不会将其共享给第三方用于广告或与本服务无关的用途。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-accentDeep">你的权利</h2>
        <p>如需删除你的测试记录，或对隐私有任何疑问，请通过客服联系我们。</p>
      </section>

      <Link href="/" className="mt-4 text-center text-sm text-accentDeep underline underline-offset-4">
        返回首页
      </Link>
    </main>
  );
}
