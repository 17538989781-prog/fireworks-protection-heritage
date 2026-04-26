# Gitee Pages 免费部署（国内可访问）

## 1. 当前项目状态（可直接部署）

- 页面入口：`index.html`
- 资源目录：`static/`
- 数据文件：`heritage-data.json`
- 当前仓库已包含可直接运行的数据与资源，**不需要本地执行任何命令**

## 2. 发布到 Gitee Pages（零本地操作）

1. 在 Gitee 新建仓库（公开仓库）。
2. 把本项目代码推送到仓库。
3. 进入仓库页面，打开 **服务 -> Gitee Pages**。
4. 选择部署分支（通常 `master` 或 `main`）。
5. 部署目录选根目录 `/`，点击部署。
6. 得到一个公开访问链接，其他人可直接打开。

## 3. 每次更新后的发布

提交并推送代码后，在 Gitee Pages 页面点击“更新部署”即可。

## 4. 可选：从 docx 重新生成数据

仅在你想重新从 `data/<城市>/*.docx` 生成数据时，才需要：

```bash
python generate_data.py
```

脚本会自动：

- 更新 `heritage-data.json`
- 把图片提取到 `static/generated_images/`
