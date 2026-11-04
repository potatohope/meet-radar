# 遇见雷达 · 宠物人格测评 🐾

上传你家毛孩子的照片，AI 一眼看穿它的隐藏人格——测测它是高冷霸总还是治愈小太阳。

## 功能

- 📸 上传宠物照片（自动压缩）
- 🤖 调用百炼 `qwen3-vl-plus` 视觉模型分析宠物神态
- 🎯 输出 6 大人格类型 + 6 维雷达图 + 专属评语 + 前世身份 + 相处指南 + 内心独白
- 📤 一键生成分享海报 / 复制文案
- 🔄 再测一次

## 目录结构

```
.
├── index.html        # 前端站点（部署到 GitHub Pages）
├── css/style.css
├── js/app.js
└── backend/          # 后端函数（部署到阿里云函数计算 FC）
    ├── main.py       # FC 入口（纯标准库，零依赖）
    ├── local_server.py  # 本地联调服务器
    ├── test_local.py    # 本地测试脚本
    └── s.yaml        # Serverless Devs 部署配置
```

## 本地联调

```bash
# 1. 启动后端（需要百炼 API Key）
cd backend
export DASHSCOPE_API_KEY=sk-xxx
python local_server.py   # 监听 127.0.0.1:9000

# 2. 前端 js/app.js 中 API_BASE 指向 http://127.0.0.1:9000
# 3. 用任意静态服务器打开 index.html
```

## 部署

- **前端**：仓库根目录即站点，GitHub Pages 从 `main` 分支根目录部署。
- **后端**：`backend/` 目录用 Serverless Devs 部署到函数计算 FC：
  ```bash
  cd backend
  npm i @serverless-devs/s -g
  s config add      # 配置阿里云 AccessKey
  s deploy
  ```
  部署后在控制台把环境变量 `DASHSCOPE_API_KEY` 填入真实值。

部署完成后，把前端 `js/app.js` 里的 `API_BASE` 改成 FC 的 HTTP 触发器地址。

> 安全提示：百炼 API Key 只放在后端环境变量，切勿提交到仓库或写进前端。
