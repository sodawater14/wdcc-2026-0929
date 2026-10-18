# 私有投稿服务接入

当前完成：本地信纸输入、分报告草稿、SQLite 接收、D1/Workers 代码、GitHub App 私有归档代码与自动化测试。配套私有仓库已创建并订阅：`sodawater14/wdcc-2026-0929-feedback`。

Cloudflare 账户已接入、远程 D1 数据库与表已创建、Turnstile 已配置，Worker 接口已部署。GitHub App 已仅安装到私有收集仓库；2026-10-18 已通过用户真实投稿验收：D1 记录 synced、机器人创建对应 Issue 并指派给所有者、GitHub 中存在对应 assign 通知。本地默认仍为测试模式；使用 `?feedback=remote` 才连接真实远程接口，本地测试的“已分享”不会被当作远程提交成功。公开网页通过 share-config.json 连接正式接口。

## 本地验收

使用 Node.js 24，在项目根目录运行 `node server.mjs`。分享页明确标记“本地测试 · 不上传 GitHub”。测试记录写入项目上级目录 `_wdcc-feedback-local/feedback.sqlite`，不在静态网站目录内。

```powershell
node --test backend/worker.test.mjs
node scripts/share_check.mjs
```

第一组用真实内存 SQLite 验证入库、重复请求、限流、私有仓库保护与 GitHub 失败后归档重试；第二组使用桌面浏览器和本地 SQLite 验证输入、草稿、成功/失败、丢失响应后的幂等重试，以及两种桌面尺寸。浏览器工具路径可用 `PLAYWRIGHT_PATH` 和 `EDGE_PATH` 覆盖。

## Cloudflare 部署

1. 在 https://dash.cloudflare.com/sign-up 注册并完成邮箱验证，再通过 Wrangler 的浏览器登录完成授权。账户密码、验证码不交给代码或聊天。
2. 在此 `backend` 目录运行以下命令：

```powershell
npx wrangler@4 login
npx wrangler@4 d1 create wdcc-0929-feedback
```

3. 将返回的数据库 ID 填入 `wrangler.jsonc` 的 `database_id`，然后初始化表：

```powershell
npx wrangler@4 d1 execute wdcc-0929-feedback --remote --file=schema.sql
```

4. 创建 Turnstile Managed 小组件，允许域名 `sodawater14.github.io`。需要本地直连远程测试时，额外允许 `localhost` 和 `127.0.0.1`，并临时在 Worker 的 `ALLOWED_ORIGINS` 与 `TURNSTILE_HOSTNAMES` 中加入本地来源/域名。正式发布删除测试来源。
5. 在 Workers Secrets 中配置 `TURNSTILE_SECRET` 和随机生成的 `RATE_LIMIT_SECRET`，不把它们写入普通 vars 或前端文件。Secret 可使用 `npx wrangler@4 secret put NAME` 交互录入；不要回显或提交密钥。

## GitHub App

在 https://github.com/settings/apps/new 创建专用 App：

- 名称：`WDCC Private Feedback`，若已被占用加账户名后缀。
- Homepage：`https://sodawater14.github.io/wdcc-2026-0929/`。
- 不需要 OAuth 回调、用户身份授权或 webhook；取消 Webhook Active。
- Repository permissions：仅 Issues Read and write；Metadata Read-only 为 GitHub 自动附带权限。Account/Organization permissions 不授予额外权限。
- 安装范围选择仅此账户，并且 **Only select repositories**：`wdcc-2026-0929-feedback`。

记录 App ID、Installation ID，下载 App 私钥。Worker 使用 PKCS#8 PEM（`BEGIN PRIVATE KEY`）；GitHub 下载的 PKCS#1 RSA PEM 应先在本机转换，转换文件仍须保持在忽略的 `.pem` 文件中，不在终端回显。

在 Workers Secrets 中配置 `GITHUB_APP_ID`、`GITHUB_INSTALLATION_ID`、`GITHUB_PRIVATE_KEY`。代码使用短期 installation token，仅申请指定收集仓库的 Issues 写权限。不会使用个人账户 token 代替机器人，以便核验来自独立身份的通知。

## 发布前验收

```powershell
npx wrangler@4 deploy --dry-run
npx wrangler@4 deploy
```

部署 Worker 不等于更新公开网页。将部署后的 HTTPS 地址加 `/api/submissions` 与 Turnstile Site Key 写入前端 `share-config.json`，Site Key 可公开，Secret 不可公开。先在本地授权测试来源下验证一条明确标注的远程测试投稿：

1. D1 的 `submissions` 存在对应记录。
2. 私有仓库出现机器人创建的 Issue，指派给 `sodawater14`，正文与报告对应；普通访客无法读取。
3. GitHub 账户通知栏实际收到通知；邮箱通知遵循账户个人设置。测试用 Issue 验收后关闭，正文不包含敏感资料。
4. 模拟 GitHub 暂时失败，数据库仍保留记录；恢复后定时任务归档，避免重复 Issue。
5. 确认代码和仓库中不含密钥或本地测试数据库，得到页面验收确认后再推送公开网页。

投稿正文不写日志。API 只提供 POST，不开放读取投稿接口。每来源每小时最多 10 次新提交；只保存按小时变化的来源 HMAC，不保存原始 IP。定时任务每 5 分钟尝试处理最多 10 条待归档记录，失败退避最长 1 小时。GitHub 或 Cloudflare 故障时通知可能延后。

可用 Cloudflare D1 控制台查看积压：

```sql
SELECT id, report_id, created_at, sync_status, attempts, last_error
FROM submissions WHERE sync_status != 'synced' ORDER BY created_at;
```

官方文档：[D1](https://developers.cloudflare.com/d1/get-started/)、[Turnstile 服务端校验](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)、[GitHub App 身份认证](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)。

## 已完成的云端验收

已通过用户真实投稿验收：D1 数据库记录同步成功，专用机器人在私有收集仓库建立对应 Issue 并指派给所有者，GitHub Notifications 中存在对应的 assign 通知。本地验收证据保存在忽略的 qa 目录，不含公开投稿数据。
