# 自部署说明

## Node.js 直接运行

安装 Node.js 22.16 或更新版本，在项目目录执行 `npm start`。服务会自动创建 SQLite 数据库并依次应用尚未执行的 SQL 迁移，无需额外数据库服务或平台账号。

默认监听 `127.0.0.1:8788`，仅允许本机访问。开发监听模式用 `npm run dev`。本项目没有构建步骤或第三方 npm 依赖。

可复制 `.env.example` 为 `.env`；`npm start` 自动读取该文件，进程已有环境变量优先。配置如下：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址；容器内使用 `0.0.0.0` |
| `PORT` | `8788` | HTTP 端口 |
| `PUBLIC_ORIGIN` | 本机访问地址 | 公网或局域网访问必须填写，例如 `https://example.com`，不含路径或结尾斜杠 |
| `DATA_DIR` | `./storage` | 数据库和签名密钥目录，相对于启动工作目录 |
| `SUBMISSION_SECRET` | 自动生成并保存 | 可选覆盖值，至少 32 字符，建议使用 32 字节随机值的十六进制编码 |
| `TRUST_PROXY_HOPS` | `0` | 受控反向代理层数；默认不信任转发地址 |

`DATA_DIR` 必须放在公共静态目录之外，且对运行服务的用户可写。建议通过 systemd、容器或其他进程管理器持续运行，并固定工作目录。当前限流只在单个进程内生效，请使用单实例运行。

## Docker Compose

```sh
docker compose up -d --build
docker compose logs -f
```

默认只将端口映射到宿主机 `127.0.0.1:8788`。镜像使用非 root 用户运行；数据库和自动生成的签名密钥保存在 `app-data` 命名卷中。容器重建会保留命名卷，`docker compose down -v` 会删除它及所有数据，不要用该命令做普通升级。

Compose 自动读取项目根目录 `.env` 中的 `PUBLIC_ORIGIN` 和 `TRUST_PROXY_HOPS`。其他变量以 `compose.yaml` 的容器配置为准；需要自定义时修改该文件。公网运行前设置自己的完整来源地址，例如：

```dotenv
PUBLIC_ORIGIN=https://example.com
TRUST_PROXY_HOPS=1
```

升级代码后执行 `docker compose up -d --build`。修改成员快照后也需要重建镜像。

## 域名与反向代理

公网使用 HTTPS，由 Nginx、Caddy 或其他反向代理终止 TLS。后端仍可使用 HTTP；`PUBLIC_ORIGIN=https://example.com` 用于校验来源和签名 Cookie 的 Secure 标志。

单层 Nginx 示例（放入已配置证书的 HTTPS server 内）：

```nginx
location / {
    proxy_pass http://127.0.0.1:8788;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 16k;
}
```

使用该单层代理时设置 `TRUST_PROXY_HOPS=1`。后端端口只能由受控代理访问，不要同时暴露到公网。多层代理需要按实际链路设置固定跳数，应用从地址链右侧取值；跳数过大或允许绕过代理都会造成错误识别。应用不使用客户端传入的转发协议或 Host 推导公网来源。

图片上传仅在浏览器本地处理，因此服务器无需接收照片文件。HTTP 请求体上限为 8 KiB，限制的是榜单、评论等 JSON 请求，不影响本地选图。

## 数据持久化与备份

存储目录包含 `oshi9.sqlite`、运行时可能出现的 WAL/SHM 文件和 `signing-key`。签名密钥自动生成后会复用；更换密钥会让已有 Cookie 和待提交会话失效，不删除历史票数。

简单可靠的备份方式是先停止服务，再备份整个存储目录或命名卷；不要在运行中只复制主 SQLite 文件而遗漏 WAL。恢复到新的实例后，确认运行用户有读写权限再启动。备份必须保持私有，不放入 `public/` 或 GitHub。

## 验收与限制

运行 `npm test` 和 `npm run check:data`。服务启动后可执行：

```sh
node scripts/api-smoke.mjs http://localhost:8788
```

该检查不写入票数。测试真实提交应使用独立数据目录，避免给正式榜单制造记录。

当前仅支持单进程、单实例：SQLite 保存提交与成功提交间隔，进程内存保存有效期为 30 秒的榜单缓存和请求频率记录。重启会清空缓存及请求频率记录，但保留数据库中的提交间隔。多实例或更大流量需要自行接入共享限流、共享数据库或网关。
