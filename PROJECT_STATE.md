# PROJECT_STATE

更新时间：2026-06-30

## 当前完成状态

项目已经完成最终验收，可以作为复习用的静态记忆卡片页面使用。

当前版本状态：

- 卡片数据已生成：63 张卡片，192 个测试项。
- 主要模式可用：对照、测试、错题、收藏。
- 测试题型可用：混合、组合句、正误判断、雨课堂判断、雨课堂四选一。
- 收藏、错题和练习统计能写入当前浏览器的本地存储。
- Service Worker、Web App Manifest、PNG 主屏幕图标和 `.nojekyll` 已存在，适合部署到 GitHub Pages 后添加到 iPhone 主屏幕。

## 手机独立运行准备

2026-06-30 已按 GitHub Pages 发布方案补齐手机端准备工作：

- 计划仓库名：`english-review-cards`。
- 发布目录：只发布 `memory-cards/` 目录内容，作为仓库根目录。
- 正式手机入口模板：`https://<GitHub用户名>.github.io/english-review-cards/`。
- 已新增 `apple-touch-icon.png`、`icon-192.png`、`icon-512.png`。
- `manifest.webmanifest` 已声明 PNG 图标。
- `index.html` 已改用 PNG `apple-touch-icon`。
- `sw.js` 缓存名已升级到 `english-review-cards-v3`，并缓存新增图标。
- `README.md` 已补充 GitHub Pages 发布、iPhone 添加到主屏幕和飞行模式离线验证步骤。

## 已完成验收

本次验收执行于 2026-06-30。

命令检查：

```text
node --check app.js
node --check sw.js
node --check scripts\build-cards.js
node scripts\build-cards.js
```

结果：

- JavaScript 语法检查通过。
- 数据生成脚本通过。
- 生成结果为 `Generated 63 cards: 23 rewrite, 10 correction, 30 quiz.`
- 本地 HTTP 服务访问 `http://127.0.0.1:4173/` 返回 200。

浏览器验收：

- 桌面 Chrome 验收通过，无运行时错误。
- iPhone 15 Pro Max 模拟视口验收通过。
- 手机端检查结果：视口宽度 430，文档宽度 430，横向溢出元素数量为 0。
- 对照、下一题、收藏、测试答题、错题模式、雨课堂四选一等关键流程均可操作。

验收截图：

```text
output/playwright/desktop-acceptance.png
output/playwright/iphone-15-pro-max-acceptance.png
```

## 已知限制

- 不建议直接用 `file://` 打开 `index.html`，因为页面需要通过 HTTP 读取 `data/cards.json`。
- `scripts\serve.js` 当前只监听 `127.0.0.1`，适合电脑本机预览，不适合作为手机局域网访问入口。
- iPhone 长期使用建议部署到 HTTPS 静态站点，再用 Safari 添加到主屏幕。
- 收藏、错题和统计保存在浏览器 `localStorage`，换浏览器、换设备或清理缓存后不会自动同步。
- Service Worker 使用网络优先策略并带有缓存兜底；部署更新后如果看到旧内容，可以刷新页面或清理站点数据。

## 后续维护注意事项

- 更新复习内容时，优先修改源文件 `..\前四题和雨课堂全部_中英对照.md`，再运行 `node scripts\build-cards.js` 生成 `data/cards.json`。
- 不建议手工大规模改 `data/cards.json`，除非只是临时修正极小的数据问题。
- 如果修改了 `cards.json` 的字段结构，需要同步检查 `app.js` 的渲染和测试逻辑。
- 如果修改了 `styles.css` 或页面结构，需要重新检查手机端，重点确认 430 CSS px 宽度下没有横向溢出、底部导航不遮挡正文。
- 如果部署到线上，建议使用 HTTPS；这对 iPhone 添加到主屏幕和离线缓存更稳定。
- 如果用户反馈更新后页面仍显示旧内容，优先检查 Service Worker 缓存和浏览器站点数据。

## 维护边界

当前线程的目标是最终验收和文档补齐，不再增加新功能，也不做大规模重构。后续若要新增导出、同步、搜索或更多题型，建议另开任务单独设计和验收。
