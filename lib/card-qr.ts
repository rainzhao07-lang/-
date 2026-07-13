import QRCode from "qrcode";

/**
 * 分享卡二维码:指向站点首页,看到卡片的人扫码即可进入测试。
 * 返回 PNG data URL,satori(next/og)可直接作为 <img src> 内嵌,渲染期无外部请求。
 * 未配置 NEXT_PUBLIC_SITE_URL 时返回 null,卡面不渲染二维码(不生成指向空地址的码)。
 */
export async function shareCardQr(colors: { dark: string; light: string }): Promise<string | null> {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!site) return null;
  return QRCode.toDataURL(site, {
    errorCorrectionLevel: "M",
    // 静区由卡面上的浅色面板内边距提供,这里不再额外留白
    margin: 0,
    width: 400,
    color: colors,
  });
}
