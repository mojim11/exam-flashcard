# ExamFlash · 闪卡速记与自测

ExamFlash 是一个轻量级、纯前端的备考工具：把资料整理成闪卡，完成主动回忆、AI 深挖和闯关自测。无需注册、无需后端，所有题库与学习进度默认只保存在当前浏览器。

## 核心特性

- **3D 闪卡**：点击或按 `Space` 翻转，`1 / 2 / 3` 快速评分，`← / →` 切换卡片。
- **多格式导入**：支持 Markdown / 文本，以及 `.pdf`、`.pptx` 文档。PDF 与 PPTX 在浏览器内提取全文，不上传服务器。
- **AI 深度出题（BYOK）**：使用用户自己的 API Key 和模型，从全文提炼少量理解性问题，过滤页码题、定义题和原文重复题。
- **苏格拉底式 AI 助教**：闪卡背面与自测错题可打开 AI 抽屉，支持生活化讲解、变式追问、易混点分析和多轮点评。
- **闯关自测**：四选一 / 判断正误、连击、彩带、计时、得分率、击败比例和错题专项。
- **本地数据管理**：一键导出 / 导入 JSON 备份，清空数据并恢复初始预设（二次确认）。
- **浅色 / 深色主题**：手动切换明暗模式，深色模式下卡片和面板带微光与边框质感。
- **移动端适配**：窄屏导航、全宽 AI 抽屉、适合单手操作的评分与选项按钮。
- **纯静态可部署**：`output: "export"`，构建产物可直接拖到 Netlify Drop 或任意静态托管。

## 界面预览

> 📷 **截图占位 · 闪卡主界面（浅色）**  
> 建议替换为：`docs/screenshots/flashcards-light.png`

> 📷 **截图占位 · 闪卡主界面（深色）**  
> 建议替换为：`docs/screenshots/flashcards-dark.png`

> 📷 **截图占位 · 苏格拉底式 AI 助教**  
> 建议替换为：`docs/screenshots/ai-tutor.png`

> 📷 **截图占位 · 闯关结算页**  
> 建议替换为：`docs/screenshots/quiz-summary.png`

## 技术栈

- **Next.js 16**（App Router / Turbopack / Static Export）
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **Framer Motion**
- **lucide-react**
- **canvas-confetti**
- **react-markdown**
- **pdfjs-dist**（PDF 文本提取）
- **fflate**（PPTX 解压）
- **next-themes**（明暗主题）
- **clsx + tailwind-merge**
- **localStorage / sessionStorage**（本地状态与 BYOK 配置）

## 本地运行

环境要求：Node.js 20+，npm 10+。

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

常用命令：

```bash
npm run lint    # ESLint
npm run build   # 生产构建 + TypeScript 检查，产物输出到 ./out
npm run start   # 本地静态预览 ./out（首次运行会下载 serve）
```

> 项目已配置 `output: "export"`，因此不再使用 `next start`。请使用 `npm run start` 或任意静态服务器预览 `out` 目录。

## AI 配置（BYOK）

1. 点击顶部 **AI 设置**。
2. 选择服务商，或填写自定义 OpenAI 兼容的 Base URL。
3. 输入自己的 API Key，选择 / 输入模型名称。
4. 点击 **测试连接并获取模型**，保存配置。

请求由浏览器直接发送给用户选择的模型服务商，**不需要在项目中配置环境变量，也不会经过 ExamFlash 后端**。DeepSeek 预设的 Base URL 为 `https://api.deepseek.com/v1`。

- 默认只保存到 `sessionStorage`，关闭标签页后失效。
- 勾选“记住 API Key”后才会写入 `localStorage`。
- 部分服务商可能禁止浏览器跨域直连（CORS），测试失败时请更换兼容服务或代理地址。

## 拖拽部署到 Netlify Drop（纯静态）

本项目已经配置 `output: "export"`，`npm run build` 后会生成完整的纯静态站点 `out/`。

1. 在项目根目录执行 `npm run build`。
2. 打开 [app.netlify.com/drop](https://app.netlify.com/drop)。
3. 将整个 **`out` 文件夹**拖入页面，等待上传和发布完成。

注意事项：

- **不要拖项目根目录**：Netlify Drop 不会执行构建，拖根目录会部署源码而不是网站。
- 拖入的是 `out` 文件夹；站点根目录应能看到 `index.html` 和 `_next/`。
- 发布后会获得一个 `https://<随机名>.netlify.app` 地址，可在 Netlify 后台修改站点名。
- 本地数据按域名隔离：从 `localhost` 迁移到 Netlify 域名后，需要在线上重新导入 JSON 备份并配置 API Key。
- 本项目没有 API Routes 或服务端运行时，静态托管即可完整运行 AI、导入和本地数据功能。

## 一键部署到 Vercel

### 第 1 步：推送到 GitHub

```bash
git init
git add .
git commit -m "feat: ExamFlash"
git branch -M main
git remote add origin https://github.com/<your-name>/<your-repo>.git
git push -u origin main
```

### 第 2 步：在 Vercel 导入项目

1. 打开 [vercel.com/new](https://vercel.com/new) 并登录。
2. 选择 **Import Git Repository**，授权并选中刚推送的仓库。
3. Framework Preset 会自动识别为 **Next.js**，无需填写环境变量。

### 第 3 步：部署并自动上线

点击 **Deploy**，等待构建完成即可获得线上地址。此后每次推送到 `main`，Vercel 都会自动重新部署。

> Vercel 同样会使用 `output: "export"` 生成纯静态站点；项目不需要 API Key 环境变量，每个用户在使用时自行填写，密钥只保存在用户浏览器。

## 目录结构

```text
app/                    App Router 页面、全局样式与字体
components/             闪卡、导入、AI 助教、AI 设置、数据备份、闯关等 UI
context/                DeckProvider（题库/进度）与 AIConfigProvider（BYOK）
data/                   内置示例题库
lib/                    解析、PDF/PPTX 提取、AI 客户端、数据备份与存储
types/                  领域类型、AI 配置与助教上下文
out/                    npm run build 生成的纯静态站点（可直接部署）
public/                 静态资源
```

## 数据与隐私

- 题库、掌握度、错题和当前轮次保存在浏览器 `localStorage`。
- API Key 默认保存在 `sessionStorage`，用户主动勾选后才会持久化到 `localStorage`。
- AI 请求由浏览器直连用户选择的模型服务商。
- JSON 备份不包含 API Key；导入文件会在浏览器内做结构校验，并需用户确认后才覆盖现有数据。
- 清除站点数据或使用隐私模式可能导致本地题库丢失，建议定期导出备份。

## 已知限制

- 扫描版 / 纯图片 PDF 没有文本层，需要先 OCR。
- 旧版二进制 `.ppt` 需要先另存为 `.pptx`。
- AI 出题单次分析上限约 32,000 字符，超长文档会截取并提示。
- AI 生成内容可能有误，请结合教材核对；当前不提供逐题人工编辑。

## License

本项目作为学习与个人备考工具使用。第三方依赖遵循其各自的开源许可证。
