// App Router 的 template 在每次路由切换时都会重新挂载(layout 不会),
// 用它给每个页面一次柔和的整体进场动画,消除页面间的硬切突兀感。
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
