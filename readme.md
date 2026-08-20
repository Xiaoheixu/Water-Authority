# 东川市水利局事件

一款基于「东川市水利局官网」的**深度推理解密游戏**。你扮演新任档案管理员林屿，通过浏览官网、拨打电话、发送邮件，层层解开栅栏密码→五行替换→模十凯撒三道加密，最终揭开水库地基下被掩埋的真相。

- 严格**线性推理链**：每一步的输出是下一步唯一的输入
- 三种真实密码算法（栅栏 / 五行单表 / 模十凯撒）
- 交互式**电话模拟** + **邮件自动回复**（含乱码与恐怖内容）
- 六关 + 隐藏彩蛋（3 个恐怖电话 + 3 封恐怖邮件 + 图片细节）

---

## 项目结构

```
.
├── package.json          # 根目录 package.json（Render 从此启动）
├── render.yaml           # Render Blueprint 一键部署配置
├── .gitignore
├── 攻略.md               # 玩家攻略（分级提示+速查+彩蛋）
├── 通关答案.md           # 完整推理链+真相复盘
├── public/               # 静态站点（Express 直接 serve）
│   ├── index.html        # 首页
│   ├── about.html        # 组织机构 / 周海生遗照
│   ├── contact.html      # 联系我们 / 办公楼外景 / 可点击电话&邮箱
│   ├── news.html         # 新闻列表
│   ├── news-reservoir.html # 通水新闻（含图注栅栏密码 + 大坝全景图）
│   ├── notice.html       # 通知公告
│   ├── water-data.html   # 水文监测表（WS-0741 + 周海生联系方式）
│   ├── sitemap.html      # 网站地图（两个隐藏页的入口）
│   ├── archive/197.html  # 197号柜夹层手记（五行替换密语 + 档案室走廊图）
│   ├── data/haisheng.html# 周海生加密档案（密码门 + 大坝廊道图 + 真相）
│   ├── images/           # 7 张游戏配图（本地 .jpg）
│   ├── css/style.css
│   └── js/main.js        # 电话弹窗 / 邮件弹窗 / 密码验证前端
└── server/
    ├── package.json      # 本地调试用子 package.json（可选）
    └── server.js         # Express 后端：静态服务 + /api/call + /api/email + /api/verify
```

---

## 一、本地运行

```bash
# 方式一：根目录（推荐，和 Render 行为一致）
npm install
npm start
# → 访问 http://localhost:3001

# 方式二：server 子目录
cd server && npm install && npm start
```

- 端口被占用：`set PORT=3002 && npm start`

---

## 二、上传 GitHub

> ⚠️ 本仓库**尚未关联远程**，首提已在本地完成（分支 `main`，commit `aece2fd`）。你需要在 GitHub 自己账号下**新建空仓库**，然后把本地推上去。

### 步骤

1. 打开 <https://github.com/new>，创建一个**空仓库**（不要勾选 Initialize with README / .gitignore / license）。
   - 假设你起的仓库名是 `dongchuan-water-authority`，账号是 `YourName`。
2. 回到项目根目录，执行：

```powershell
# 关联远程
git remote add origin https://github.com/YourName/dongchuan-water-authority.git

# 如果你的 GitHub 开启了双因素，推荐用 Personal Access Token：
# 1. https://github.com/settings/tokens → Generate new token (classic)
# 2. 勾选 repo 范围 → 复制 token
# 3. 改用带 token 的 remote：
# git remote add origin https://<your-token>@github.com/YourName/dongchuan-water-authority.git

# 推送首提
git push -u origin main
```

3. 刷新 GitHub 仓库页面，应该能看到全部文件。

---

## 三、Render 一键部署（推荐 Blueprint）

Render Blueprint 会一次性帮你创建好 Web Service，所有参数从 `render.yaml` 读，零手动配置。

### 方式 A：Blueprint（最快，推荐）

1. 打开 <https://dashboard.render.com/blueprints> → **New Blueprint Instance**。
2. 选择 **Connect a repository**，把你刚才的 GitHub 仓库授权给 Render 并选中。
3. 分支选 `main`，YAML 路径填 `render.yaml`（默认就是）→ **Apply**。
4. Render 会自动：
   - 安装 Node 20 + `npm install`
   - 跑 `npm start`（即 `node server/server.js`）
   - 注入 `PORT` 环境变量
   - 分配一个 `xxx.onrender.com` 子域名
5. 等状态变 **Live**，点那个域名就能玩了（免费实例首次冷启动约 1-2 分钟）。

### 方式 B：手动创建 Web Service（不用 Blueprint）

如果不想用 Blueprint，也可以手动建：

1. <https://dashboard.render.com> → **New +** → **Web Service**。
2. 选你的 GitHub 仓库 → 下一步。
3. 按如下填：

| 字段 | 值 |
|------|-----|
| Name | `dongchuan-water-authority`（随便起，全英文短横线） |
| Region | Oregon（默认即可，离大陆越近延迟越低，也可换 Singapore） |
| Branch | `main` |
| Runtime | **Node** |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free（免费） |
| Environment Variables / Node Version | Key=`NODE_VERSION` Value=`20` |

4. 点 **Create Web Service** → 等构建+部署完成（约 2-3 分钟）。

### 部署后验证

浏览器打开分配的 `https://xxx.onrender.com`：

- 首页横幅图正常显示
- 点「联系我们」→ 档案室邮箱 `archive@dcslj.gov.cn` → 写邮件 → 数秒后收到自动回复 = API 正常
- 点电话号码 `0587-62190417` → 弹出通话窗口，文字按节奏出现 = API 正常

### 关于 Render 免费实例的小提示

- **空闲会休眠**：15 分钟没人访问，免费实例会睡掉，下次第一次访问会等 30-60 秒冷启动，属正常现象。
- **带宽 / 内存完全够用**：这个项目只有一个 Express 服务 + 静态页面（约 5MB），没有数据库，免费额度完全扛得住。
- **要自定义域名**：在 Render 服务 → **Custom Domains** 添加，然后按提示去你的 DNS 服务商加 CNAME。

---

## 四、第一次玩的指引

详见项目根目录下：

- **[攻略.md](攻略.md)** — 给玩家，分层提示不剧透，卡关时看
- **[通关答案.md](通关答案.md)** — 给作者/复盘，完整推理链和真相

**最快通关路径（6 步，见攻略速查表）：**

```
archive@dcslj.gov.cn 发邮件
  → 通水报道图注 栅栏解码 → /archive/197.html
  → 五行替换 得 0741 + 记住三月
  → 水文监测找 WS-0741 → 打 0587-62190432
  → 密文42023648 每位减3(三月) → 19790315
  → /data/haisheng.html 输 19790315 → 通关
```

祝好运。水管已经在响了。
