# 英文复习记忆卡片

这是一个静态网页版英文复习卡片项目，用整理好的中英对照资料生成卡片，适合在电脑浏览器或 iPhone Safari 中复习。

当前数据规模：63 张卡片，192 个测试项。

## 启动方法

### 电脑本机预览

在 PowerShell 中进入项目目录：

```powershell
cd "E:\codex project\project2\memory-cards"
node scripts\serve.js 4173
```

然后在浏览器打开：

```text
http://127.0.0.1:4173/
```

不要直接双击 `index.html`，也不要用 `file://` 方式作为正式入口。页面需要通过 HTTP 读取 `data/cards.json`，直接打开 HTML 可能导致数据加载失败。

### iPhone 独立运行

正式手机入口使用 GitHub Pages：

```text
https://<GitHub用户名>.github.io/english-review-cards/
```

发布后，用 iPhone Safari 打开上面的 HTTPS 链接，等待页面正常显示卡片数据，再通过 Safari 的“分享”菜单添加到主屏幕。之后从主屏幕图标打开时，页面会使用 Service Worker 缓存，不再依赖电脑本机服务；电脑关机后，手机仍可通过线上链接或已缓存内容运行。

离线验证方法：

1. iPhone 在线打开 GitHub Pages 链接，确认显示 63 张卡片和 192 个测试项。
2. 添加到主屏幕后，先从主屏幕图标打开一次。
3. 打开飞行模式，再从主屏幕图标重新进入。
4. 如果卡片仍能加载，说明离线缓存已经可用。

GitHub Pages 发布设置：

```text
仓库名：english-review-cards
发布来源：main 分支 / root
仓库根目录：本目录 memory-cards/ 下的文件
```

本目录包含 `.nojekyll`，用于让 GitHub Pages 直接按静态文件发布。

### iPhone 临时预览

如果只是临时在同一 Wi-Fi 下预览，可以在电脑上启动一个监听局域网的静态服务器。例如在项目目录运行：

```powershell
py -m http.server 4173 --bind 0.0.0.0
```

然后在 iPhone Safari 中打开：

```text
http://电脑局域网IP:4173/
```

注意：项目自带的 `node scripts\serve.js 4173` 只监听 `127.0.0.1`，主要用于电脑本机验收；手机通常不能直接访问这个地址。

## 项目结构

```text
memory-cards/
  index.html                 页面入口
  styles.css                 页面样式和手机端适配
  app.js                     卡片渲染、测试、收藏、错题和本地记录逻辑
  data/cards.json            已生成的卡片数据
  scripts/build-cards.js     从整理好的 Markdown 生成 cards.json
  scripts/serve.js           本机静态预览服务器
  manifest.webmanifest       添加到主屏幕所需的 Web App 配置
  sw.js                      Service Worker 缓存逻辑
  icon.svg                   图标
  icon-192.png               PWA 图标
  icon-512.png               PWA 图标
  apple-touch-icon.png        iPhone 主屏幕图标
  .nojekyll                  GitHub Pages 静态发布标记
  output/                    验收截图等输出文件
```

源资料文件位于项目上一级：

```text
..\前四题和雨课堂全部_中英对照.md
```

## 主要功能

- 对照：在同一个界面查看原正文、改写或改正内容，以及中英对照。
- 测试：支持混合练习、组合句、正误判断、雨课堂判断、雨课堂四选一。
- 错题：自动收集最近答错或标记“不会”的测试项。
- 收藏：收藏当前卡片，并在收藏模式中集中查看。
- 筛选：按全部、前四题、雨课堂和具体章节筛选内容。
- 进度：显示当前卡片位置和测试统计。
- 本地记录：收藏和练习结果保存在当前浏览器的 `localStorage` 中。
- PWA 支持：包含 `manifest.webmanifest`、PNG 主屏幕图标和 `sw.js`，部署到 HTTPS 后可添加到 iPhone 主屏幕并缓存核心资源。

## 更新数据

修改源 Markdown 后，重新生成卡片数据：

```powershell
cd "E:\codex project\project2\memory-cards"
node scripts\build-cards.js
```

生成结果会写入：

```text
data/cards.json
```

当前验收时的生成结果为：

```text
Generated 63 cards: 23 rewrite, 10 correction, 30 quiz.
```

如果新增或改名了需要离线缓存的核心文件，需要同步更新 `sw.js` 的 `ASSETS` 列表，并升级 `CACHE_NAME`，让手机端重新获取缓存。

更新内容后，提交并推送到 `english-review-cards` 仓库的 `main` 分支，等待 GitHub Pages 自动发布。手机如果仍显示旧内容，可以刷新页面，或在 Safari 中清理该站点数据后重新打开。

## 验收记录

2026-06-30 已完成最终验收：

- `node --check app.js` 通过。
- `node --check sw.js` 通过。
- `node --check scripts\build-cards.js` 通过。
- `node scripts\build-cards.js` 通过，生成 63 张卡片。
- `http://127.0.0.1:4173/` 返回 HTTP 200。
- 桌面浏览器验收通过，页面无运行时错误。
- iPhone 15 Pro Max 视口验收通过，430 CSS px 宽度下无横向溢出。

验收截图保存在：

```text
output/playwright/desktop-acceptance.png
output/playwright/iphone-15-pro-max-acceptance.png
```
