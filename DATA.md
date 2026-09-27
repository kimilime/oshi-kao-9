# 成员数据

开源版只包含虚构示意数据，其中的省级行政区、团名和名字不代表现实人物信息。

`public/data/idols.json` 示例：

```json
{
  "demo": true,
  "reviews_enabled": false,
  "snapshot_version": "demo-v1",
  "idols": [
    {
      "id": "demo-01",
      "name": "示意成员 01",
      "group": "示意团体 A",
      "province": "浙江省",
      "pic": "/images/demo/member-01.svg",
      "weibo_link": ""
    }
  ]
}
```

实际名单至少需要九位成员。`id` 必须唯一且稳定，只使用字母、数字、下划线和连字符，不得以 `local-` 开头。空团体使用空字符串，微博链接可不填。

兼团可添加 `groups` 数组，多地区可添加 `provinces` 数组；保留 `group` 和 `province` 基本字段。省级行政区使用规范全称。图片优先放在 `public/images/` 下使用同源路径，避免跨域导出问题。

替换为自己的真实资料后，将 `demo` 改为 `false`，更新 `snapshot_version`，并修改首页的数据来源说明。运行 `npm run check:data` 验证。成员 ID 被移除后，包含该成员的整份旧结果不再计入当前榜单。

发布名单和照片前，应确认自己有权使用及分发相关资料。代码许可证不授予第三方照片的使用权。不要把用户上传的内容、本地备份或数据库导出放进公共目录。
