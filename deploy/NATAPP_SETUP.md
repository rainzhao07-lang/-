# NATAPP 国内固定隧道测试方案

用途：在没有完成正式云服务器和备案前，先给伙伴一个大陆相对稳定的测试链接。

限制：

- 电脑必须开机，项目服务必须运行。
- 隧道服务需要 NATAPP 账号和 authtoken。
- 适合测试，不适合正式收款和小程序业务域名。
- 小程序 web-view 正式接入仍建议使用备案后的自有域名。

推荐购买：

- NATAPP VIP_1 型，约 9 元/月，支持固定域名和 HTTPS。

需要提供给 Codex：

```text
NATAPP authtoken
固定域名，例如 xxxx.natapp1.cc
```

本地项目端口：

```text
3100
```

启动方式：

```powershell
npm run build
npm run start
natapp -authtoken=你的token
```

如果使用 cpolar，也同理需要账号 token 和保留域名信息。
