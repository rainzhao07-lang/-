// 【Phase 2 占位,勿在 MVP 引用】
// 个体工商户资质办妥后,接微信支付官方回调的替换点在这里:
//
// 1. 实现 WechatPayProvider implements PaymentProvider:
//    - getPaymentEntry(): 返回 { type: "native" },前端据此改为拉起微信支付(JSAPI/H5支付)
//    - verify(): 不再由用户提交凭证,而是由 /api/payment/callback(新增路由)
//      接收微信服务器回调,验签后直接将 session 标记为已付费;
//      verify 本身可退化为查询 session.paid 状态
// 2. 在 code-redemption.ts 旁新建 index.ts 统一导出 paymentProvider,
//    业务代码(/api/redeem 与结果页)只依赖 PaymentProvider 接口,无需改动
// 3. 兑换码表与逻辑保留,作为线下渠道/补偿发放的备用通道
//
// export class WechatPayProvider implements PaymentProvider { ... }
export {};
