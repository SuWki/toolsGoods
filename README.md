# toolsGoods

香水商品运营平台第一版仓库，当前聚焦四件事：

- 防止好卖商品断货
- 识别临期和过期风险批次
- 找出长期不动销的滞销商品
- 给出门店之间的调拨建议

## 文件说明

- `index.html`：平台主页面，直接打开即可使用
- `perfume_template.csv`：导入模板
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动部署脚本

## 本地使用

1. 直接在浏览器打开 `index.html`
2. 点击“导入 CSV”加载你自己的商品数据
3. 在左侧调整生产交期、临期阈值、调拨天数等规则参数

## GitHub Pages

推送到 `main` 分支后，GitHub Actions 会自动部署静态页面到 GitHub Pages。
