# 推颜九选

这是「推颜九选」的开源版本。[在线体验](https://oshi9.neofelis.fun)。

从预选、两两 PK 到生成九选图片，支持为不同成员选颜，也支持为同一个人挑选九个瞬间。前端使用原生 HTML / CSS / JavaScript，后端使用 Node.js 内置 HTTP 服务和 SQLite，不依赖云平台 SDK，也不加载第三方人机验证服务。

- DD版（誰でも）：浏览、搜索及筛选候选成员，支持本地自定义成员；预选后通过 PK 确定有序前九。
- 单推版（君だけ）：上传同一个人的 9 至 30 张照片，选出九个瞬间，名字和结果说明可编辑。
- 三种图片排版：九宫格、突出前三名、第一居中；支持更换本次照片、保存和系统分享。
- 两种模式分别保存本地进度；DD 版支持展开排序记录。再次查看已完成结果不会重复计票。
- 公共排行榜使用签名提交会话，并限制提交间隔和请求频率。

## 开源版内容

仓库附有 27 位虚构成员、3 个示意团体和几何示意头像，不对应真实人物。不含真实提交记录、用户身份信息、采集照片或原站凭证，也不包含数据总结页面。

原作者微博：[天阶君_Ortzadar](https://weibo.com/u/2049024895)。页面中的微博链接可以自行修改或移除，不要求保留。问题和漏洞请在本项目的 GitHub Issues 中反馈。

## 直接运行

安装 Node.js **22.16 或更新版本**，然后在项目目录执行：

```sh
npm start
```

也可以直接运行：

```sh
node --env-file-if-exists=.env server/index.js
```

打开 http://localhost:8788 。项目没有 npm 运行时或开发依赖，不需要安装第三方软件包，也无需单独安装数据库。部分 Node.js 版本会输出 SQLite 实验性功能提示。

首次启动会在 `storage/` 自动创建数据库、应用迁移，并生成签名密钥。后续启动保留数据和密钥，不清空榜单。启动后即可选人、生成图片和提交符合规则的名单，无需配置验证码账号。

需要修改端口、域名或存储位置时，复制 `.env.example` 为 `.env` 并编辑，详细说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。

```sh
npm run dev
npm test
npm run check:data
```

`dev` 启用 Node.js 文件监听；前端静态文件无需构建。测试使用临时数据库，不操作部署数据。

## Docker

```sh
docker compose up -d --build
```

默认访问 http://localhost:8788 ，数据库和签名密钥保存在独立命名卷。公网域名、反向代理、备份方式见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 数据与安全

成员快照在 `public/data/idols.json`，示意图片在 `public/images/demo/`，格式见 [DATA.md](DATA.md)。自定义照片和单推版数据仅保存在使用者自己的浏览器。

当前后端适合单进程、单实例部署。请求限流和榜单缓存保存在进程内；每浏览器一分钟一份的成功提交间隔持久化在 SQLite。重复结果编号不重复计票，含自定义成员的整份结果不提交。

本版不提供人机识别，签名会话和限流不能证明请求来自真人。部署者可自行接入验证码、登录或网关防护。扩展位置和边界见 [SECURITY.md](SECURITY.md)。公开评价默认关闭。

## 仓库结构

- `public/`：前端、品牌图标及示意成员。
- `server/`：HTTP 服务、SQLite、签名、提交逻辑、缓存及限流。
- `migrations/`：首次启动和升级时自动执行的数据库迁移。
- `scripts/`：名单校验和不写票的 API 检查。
- `tests/`：排序、存档、提交及 HTTP 集成测试。

保留 `package.json`、`package-lock.json`、配置示例和许可证。不要提交 `storage/`、`.env`、数据库、密钥、日志、导出或依赖缓存；这些路径已加入 `.gitignore`。项目无需提交构建产物。

## 排序与许可

算法假设偏好稳定且可传递：9 至 13 位候选使用 Ford-Johnson 合并插入排序，14 位及以上使用胜者树提取有序前九。撤销与恢复沿用同一局的比较记录。

项目采用 [MIT](LICENSE) 许可证；示意头像同样采用 MIT。依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。玩法参考 [女ドル好き顔9選](https://oshi-torisetsu.com/sukigao-girls)，不附带该站代码、成员数据或照片。
