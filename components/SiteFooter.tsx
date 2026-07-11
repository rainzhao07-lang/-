import Link from "next/link";

/**
 * 全站统一页脚:合规链接 + 反馈入口。
 * 反馈入口读环境变量 NEXT_PUBLIC_FEEDBACK_URL(问卷/表单地址);未配置则不显示,不做死链。
 */
export default function SiteFooter() {
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  return (
    <footer id="site-footer" className="mt-10 flex flex-col items-center gap-3 pb-6 text-center text-xs leading-relaxed text-soft/80">
      <p>我们倡导领养代替购买。报告中的性格特质，田园猫中同样存在。</p>
      <p>本测试与报告均为参考建议，不构成任何专业意见；每只猫都是独立的个体。</p>
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-soft">
        <Link href="/privacy" className="underline underline-offset-2 hover:text-accentDeep">
          隐私政策
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="underline underline-offset-2 hover:text-accentDeep">
          免责声明
        </Link>
        <span aria-hidden>·</span>
        <Link href="/about-ai" className="underline underline-offset-2 hover:text-accentDeep">
          结果如何生成
        </Link>
        {feedbackUrl && (
          <>
            <span aria-hidden>·</span>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-accentDeep"
            >
              意见反馈
            </a>
          </>
        )}
      </nav>
    </footer>
  );
}
