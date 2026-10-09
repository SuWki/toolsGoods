/* 门店 SKU 销售排名分析看板 · 界面与交互逻辑
 * 依赖：SalesEngine（engine.js）、RankCharts（charts.js）、XLSX、echarts
 */
(function (global) {
  'use strict';

  var E = global.SalesEngine;
  var C = global.RankCharts;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    dataset: null,
    skuKey: null,
    startDate: '',
    endDate: '',
    storeSelection: null,     // null = 全部门店
    basis: 'qty',
    method: 'competition',
    excludeCancelled: true,
    tableSort: { key: 'qtyRank', dir: 'asc' },
    contribViewAll: false,
    skuPeriodStats: new Map(), // skuKey -> {qty, amount}（当前时间段）
    upload: null              // {headers, rows, mapping, fileName, sheetName}
  };

  /* ---------------- 日期工具 ---------------- */

  function strToKey(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    return +m[1] * 10000 + +m[2] * 100 + +m[3];
  }
  function keyToStr(k) { return E.dayKeyToString(k); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function shiftDays(s, n) {
    var d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- 数据载入 ---------------- */

  function loadDataset(dataset, defaults) {
    state.dataset = dataset;
    state.storeSelection = null;
    state.tableSort = { key: 'qtyRank', dir: 'asc' };
    state.contribViewAll = false;
    state.excludeCancelled = dataset.hasCancelData;

    // 默认 SKU
    var hero = defaults && defaults.skuKey && dataset.skus.find(function (s) { return s.key === defaults.skuKey; });
    state.skuKey = hero ? hero.key : (dataset.skus.length ? dataset.skus[0].key : null);

    // 默认时间段
    if (defaults && defaults.startDate && defaults.endDate) {
      state.startDate = defaults.startDate;
      state.endDate = defaults.endDate;
    } else if (dataset.dateMinKey && dataset.dateMaxKey) {
      var span = dataset.dateMaxKey - dataset.dateMinKey;
      if (span <= 9200) { // 约 92 天内直接取全量
        state.startDate = keyToStr(dataset.dateMinKey);
        state.endDate = keyToStr(dataset.dateMaxKey);
      } else {
        state.endDate = keyToStr(dataset.dateMaxKey);
        state.startDate = shiftDays(state.endDate, -30);
      }
    } else {
      state.startDate = '';
      state.endDate = '';
    }

    // 徽标 / 演示提示
    var badge = $('dataSourceBadge');
    badge.classList.toggle('is-real', !dataset.isDemo);
    badge.title = dataset.isDemo
      ? '当前为系统生成的演示数据，仅用于功能演示'
      : '数据源：' + dataset.sourceName + '（仅在本地浏览器解析，不会上传）';
    $('dataSourceText').textContent = (dataset.isDemo ? '演示数据 · ' : '已载入 · ') + dataset.sourceName + ' · ' + dataset.quality.totalRows.toLocaleString('zh-CN') + ' 行原始记录';
    $('demoBanner').hidden = !dataset.isDemo;
    $('srcMain').textContent = dataset.isDemo
      ? '演示数据：由页面内脚本在本地生成的模拟销售明细（' + dataset.sourceName + '），仅供功能演示与自测。'
      : ('用户数据：' + dataset.sourceName + '，已在本地浏览器完成解析与计算。' +
        (dataset.quality.giftRows > 0 ? '已剔除赠品/小样标记记录 ' + dataset.quality.giftRows.toLocaleString('zh-CN') + ' 行。' : ''));

    // 日期可选范围
    if (dataset.dateMinKey && dataset.dateMaxKey) {
      $('dateStart').min = $('dateEnd').min = keyToStr(dataset.dateMinKey);
      $('dateStart').max = $('dateEnd').max = keyToStr(dataset.dateMaxKey);
    } else {
      $('dateStart').min = $('dateEnd').min = '';
      $('dateStart').max = $('dateEnd').max = '';
    }

    // 口径开关可见性
    $('caliberRow').hidden = !dataset.hasCancelData;
    $('caliberExclude').checked = state.excludeCancelled;

    renderStoreList();
    syncControls();
    applyAndRender();
  }

  function loadDemo() {
    var demo = E.generateDemoData();
    var mapping = E.detectMapping(demo.headers);
    var ds = E.buildDataset(demo.headers, demo.rows, mapping, { sourceName: '演示销售明细（2026-08-15 ~ 2026-10-08）', isDemo: true });
    loadDataset(ds, { skuKey: demo.heroKey, startDate: demo.defaultStart, endDate: demo.defaultEnd });
  }

  /* ---------------- 主渲染 ---------------- */

  function applyAndRender() {
    var ds = state.dataset;
    if (!ds) return;
    var startKey = strToKey(state.startDate), endKey = strToKey(state.endDate);
    if (startKey === null || endKey === null) {
      renderAllEmpty('请先选择有效的统计时间段');
      return;
    }
    if (startKey > endKey) {
      var t = state.startDate; state.startDate = state.endDate; state.endDate = t;
      $('dateStart').value = state.startDate; $('dateEnd').value = state.endDate;
      startKey = strToKey(state.startDate); endKey = strToKey(state.endDate);
    }
    if (!state.skuKey && ds.skus.length) state.skuKey = ds.skus[0].key;

    computeSkuPeriodStats(startKey, endKey);

    var query = {
      skuKey: state.skuKey,
      startKey: startKey,
      endKey: endKey,
      stores: state.storeSelection ? Array.from(state.storeSelection) : null,
      rankMethod: state.method,
      excludeCancelled: state.excludeCancelled && ds.hasCancelData,
      netRefund: ds.hasRefundColumns
    };
    var m = E.computeMetrics(ds, query);
    var sku = ds.skus.find(function (s) { return s.key === state.skuKey; });
    var ctx = {
      skuLabel: sku ? sku.label : '（未选择 SKU）',
      startDate: state.startDate,
      endDate: state.endDate,
      methodLabel: state.method === 'competition' ? '竞赛排名' : '顺序排名'
    };

    renderKpis(m, sku);
    var emptyMsg = m.ranked.length === 0
      ? '当前门店范围内没有可统计的门店'
      : (m.totalQty === 0 && m.totalAmount === 0 ? '该 SKU 在所选时间段内没有销售数据' : null);
    renderCharts(m, emptyMsg);
    renderTable(m);
    renderAnalysis(m, ctx);
    renderNotes(m, ctx, query);
    renderTableMeta(m);
  }

  function renderAllEmpty(msg) {
    ['chartBarEmpty', 'chartContribEmpty', 'chartScatterEmpty'].forEach(function (id) {
      var el = $(id);
      el.innerHTML = '<span class="big">' + msg + '</span><span>设置筛选条件后自动更新</span>';
      el.classList.add('show');
    });
    if (C) { C.renderBar([], 'qty', ''); C.renderContrib([], false, ''); C.renderScatter([], ''); }
    $('takeawayBar').textContent = '—';
    $('takeawayContrib').textContent = '—';
    $('takeawayScatter').textContent = '—';
    $('rankTableBody').innerHTML = '<tr><td colspan="10" class="empty-tip">' + msg + '</td></tr>';
    $('analysisList').innerHTML = '<li class="insight"><span class="insight-tag t-note">提示</span><span>' + msg + '</span></li>';
  }

  /* 各 SKU 在当前时间段内的销量（供 SKU 下拉展示，与主表同口径） */
  function computeSkuPeriodStats(startKey, endKey) {
    var ds = state.dataset;
    var stats = new Map();
    var cancelSet = new Set(ds.cancelValues || []);
    var exclCancel = state.excludeCancelled && ds.hasCancelData;
    for (var i = 0; i < ds.rows.length; i++) {
      var r = ds.rows[i];
      if (r.dateKey < startKey || r.dateKey > endKey) continue;
      if (r.isGift) continue;
      if (exclCancel && cancelSet.size > 0 && r.status !== '' && cancelSet.has(r.status)) continue;
      var qty = r.qty, amount = r.amount;
      if (ds.hasRefundColumns) {
        if (r.refundQty !== null) qty -= r.refundQty;
        if (r.refundAmount !== null) amount -= r.refundAmount;
      }
      var s = stats.get(r.skuKey);
      if (!s) { s = { qty: 0, amount: 0 }; stats.set(r.skuKey, s); }
      s.qty += qty; s.amount += amount;
    }
    state.skuPeriodStats = stats;
  }

  /* ---------------- KPI ---------------- */

  function renderKpis(m, sku) {
    var v = function (id, html) { $(id).querySelector('.kpi-value').innerHTML = html; };
    var sub = function (id, html) { $(id).querySelector('.kpi-sub').innerHTML = html; };

    v('kpiSku', sku ? esc(sku.name + (sku.spec ? ' ' + sku.spec : '')) : '—');
    sub('kpiSku', sku && sku.code ? 'SKU编码：' + esc(sku.code) : '—');

    v('kpiPeriod', state.startDate + ' ~ ' + state.endDate);
    sub('kpiPeriod', '共 ' + (Math.round((new Date(state.endDate) - new Date(state.startDate)) / 86400000) + 1) + ' 天 · 数据源范围 ' + (state.dataset.dateMinKey ? keyToStr(state.dataset.dateMinKey) + ' ~ ' + keyToStr(state.dataset.dateMaxKey) : '—'));

    v('kpiQty', E.fmtInt(m.totalQty));
    sub('kpiQty', m.storeCount > 0 ? '有数据门店平均 ' + E.fmtMoney(m.avgQty) + ' 件/店' : '—');

    v('kpiAmount', E.fmtMoney(m.totalAmount));
    sub('kpiAmount', m.overallAvgPrice !== null ? '整体均价 ' + E.fmtPrice(m.overallAvgPrice) + ' 元/件' : '总销量为 0，无法计算均价');

    v('kpiStores', m.soldStoreCount + '<em> / ' + m.includedStoreCount + '</em>');
    sub('kpiStores', '零销售 ' + m.zeroStoreCount + ' 家 · 数据缺失 ' + m.missingStoreCount + ' 家');

    var byAmount = m.ranked.slice().sort(function (a, b) { return b.amount - a.amount; })[0];
    if (byAmount && byAmount.amount > 0) {
      v('kpiTop', esc(byAmount.store));
      sub('kpiTop', '金额 ' + E.fmtMoney(byAmount.amount) + ' 元 · 金额第1名 · 数量第' + byAmount.qtyRank + '名');
    } else {
      v('kpiTop', '—');
      sub('kpiTop', '本期无销售');
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 图表与解读 ---------------- */

  function renderCharts(m, emptyMsg) {
    C.renderBar(m.ranked, state.basis, emptyMsg);
    var footNote = C.renderContrib(m.ranked, state.contribViewAll, emptyMsg);
    C.renderScatter(m.ranked, emptyMsg);

    // 柱状图解读
    var tk = $('takeawayBar');
    if (emptyMsg) { tk.textContent = emptyMsg + '。可尝试更换 SKU、时间段或门店范围。'; }
    else {
      var sorted = m.ranked.slice().sort(function (a, b) { return state.basis === 'amount' ? b.amount - a.amount : b.qty - a.qty; });
      var top = sorted[0], last = sorted[sorted.length - 1];
      var metric = state.basis === 'amount' ? '金额' : '数量';
      tk.innerHTML = '按' + metric + '从高到低排列：<b>' + esc(top.store) + '</b>居首（' +
        (state.basis === 'amount' ? E.fmtMoney(top.amount) + ' 元' : E.fmtInt(top.qty) + ' 件') +
        '），<b>' + esc(last.store) + '</b>末位（' +
        (state.basis === 'amount' ? E.fmtMoney(last.amount) + ' 元' : E.fmtInt(last.qty) + ' 件') +
        '），首末差距 ' + E.fmtPct(state.basis === 'amount'
          ? (top.amount > 0 ? 1 - (last.amount || 0) / top.amount : 0)
          : (top.qty > 0 ? 1 - (last.qty || 0) / top.qty : 0)) + '。悬停柱体可查看双排名与贡献率。';
    }

    // 贡献图解读（各店分母为本店自身业绩，不做跨店加总）
    var tk2 = $('takeawayContrib');
    var withSales = m.ranked.filter(function (r) { return r.amountShare !== null && (r.qty > 0 || r.amount > 0); })
      .sort(function (a, b) { return b.amountShare - a.amountShare; });
    if (emptyMsg || !withSales.length) { tk2.textContent = '本期无销售金额，贡献率不可计算。'; }
    else {
      var top1 = withSales[0], low1 = withSales[withSales.length - 1];
      tk2.innerHTML = '该 SKU 业绩占比最高的门店是 <b>' + esc(top1.store) + '</b>（占其本店同期业绩 ' + E.fmtPct(top1.amountShare) + '）' +
        (withSales.length > 1 ? '，最低的是 <b>' + esc(low1.store) + '</b>（' + E.fmtPct(low1.amountShare) + '）' : '') + '。' + (footNote || '') +
        (state.contribViewAll ? '' : '当前展示 Top ' + Math.min(10, withSales.length) + '，可点击右上角查看全部。');
    }

    // 散点解读
    var tk3 = $('takeawayScatter');
    if (emptyMsg) { tk3.textContent = emptyMsg + '。'; }
    else {
      var diverg = m.ranked.filter(function (r) {
        return r.qtyRank !== null && r.amountRank !== null && Math.abs(r.qtyRank - r.amountRank) >= 3;
      });
      if (!diverg.length) {
        tk3.textContent = '所有门店的销量排名与金额排名相差均不足 3 名，量、款表现基本一致。';
      } else {
        diverg.sort(function (a, b) { return Math.abs(b.qtyRank - b.amountRank) - Math.abs(a.qtyRank - a.amountRank); });
        var texts = diverg.slice(0, 3).map(function (r) {
          return '<b>' + esc(r.store) + '</b>（数量第' + r.qtyRank + ' → 金额第' + r.amountRank + '）';
        });
        tk3.innerHTML = '共 ' + diverg.length + ' 家门店出现排名背离（相差≥3名）：' + texts.join('、') +
          '。紫色点为背离门店，蓝色点为排名一致门店。';
      }
    }
  }

  /* ---------------- 排名表格 ---------------- */

  function statusTag(r) {
    if (r.dataStatus === 'zero') return ' <span class="tag tag-zero" title="门店本期有营业记录，但该 SKU 销量为 0，按 0 参与排名">本期无销售</span>';
    if (r.dataStatus === 'missing') return ' <span class="tag tag-missing" title="门店本期无任何上报数据，不参与排名与平均">数据缺失</span>';
    return '';
  }

  function sortRows(rows) {
    var key = state.tableSort.key, dir = state.tableSort.dir;
    var mul = dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      var aMiss = a.dataStatus === 'missing', bMiss = b.dataStatus === 'missing';
      if (aMiss !== bMiss) return aMiss ? 1 : -1;           // 缺失门店永远排最后
      if (key === 'store') return mul * String(av).localeCompare(String(bv), 'zh-CN');
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return mul * (av - bv);
    });
  }

  function rankBadge(rank) {
    if (rank === null || rank === undefined) return '<span class="rank-badge na">—</span>';
    var cls = rank === 1 ? 'r1' : (rank === 2 || rank === 3) ? 'r' + rank : '';
    return '<span class="rank-badge ' + cls + '">' + rank + '</span>';
  }

  function renderTable(m) {
    var tbody = $('rankTableBody');
    var rows = sortRows(m.rows);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-tip">当前条件下没有纳入统计的门店</td></tr>';
      return;
    }
    var html = [];
    rows.forEach(function (r) {
      var isMissing = r.dataStatus === 'missing';
      var diffHtml;
      if (isMissing || r.qtyDiff === null) diffHtml = '<span class="zero">—</span>';
      else if (r.qtyDiff > 0) diffHtml = '<span class="up">+' + E.fmtMoney(r.qtyDiff) + '</span>';
      else if (r.qtyDiff < 0) diffHtml = '<span class="down">' + E.fmtMoney(r.qtyDiff) + '</span>';
      else diffHtml = '<span class="zero">0</span>';

      html.push('<tr>' +
        '<td class="td-store" title="' + esc(r.store) + (isMissing ? '（本期无任何上报数据）' : '') + '">' + esc(r.store) + statusTag(r) + '</td>' +
        '<td>' + (isMissing ? '<span class="zero">—</span>' : E.fmtInt(r.qty)) + '</td>' +
        '<td>' + rankBadge(isMissing ? null : r.qtyRank) + '</td>' +
        '<td>' + (isMissing ? '<span class="zero">—</span>' : E.fmtMoney(r.amount)) + '</td>' +
        '<td>' + rankBadge(isMissing ? null : r.amountRank) + '</td>' +
        '<td title="' + (isMissing || r.storeTotalQty === null ? '' : '本店同期全部 SKU 总量 ' + E.fmtInt(r.storeTotalQty) + ' 件') + '">' + E.fmtPct(isMissing ? null : r.qtyShare) + '</td>' +
        '<td title="' + (isMissing || r.storeTotalAmount === null ? '' : '本店同期总业绩 ' + E.fmtMoney(r.storeTotalAmount) + ' 元') + '">' + E.fmtPct(isMissing ? null : r.amountShare) + '</td>' +
        '<td>' + (isMissing || r.avgPrice === null ? '<span class="zero">—</span>' : E.fmtPrice(r.avgPrice)) + '</td>' +
        '<td>' + (r.avgQty === null ? '—' : E.fmtMoney(r.avgQty)) + '</td>' +
        '<td>' + diffHtml + '</td>' +
        '</tr>');
    });
    tbody.innerHTML = html.join('');

    // 表头排序指示（个别表头可能无 .arrow 标记，做保护）
    document.querySelectorAll('#rankTable thead th.sortable').forEach(function (th) {
      var arrow = th.querySelector('.arrow');
      if (!arrow) return;
      if (th.getAttribute('data-key') === state.tableSort.key) {
        th.setAttribute('aria-sort', state.tableSort.dir === 'asc' ? 'ascending' : 'descending');
        arrow.textContent = state.tableSort.dir === 'asc' ? '▲' : '▼';
      } else {
        th.removeAttribute('aria-sort');
        arrow.textContent = '▼';
      }
    });
  }

  function renderTableMeta(m) {
    $('tableMeta').innerHTML = '共 <b>' + m.includedStoreCount + '</b> 家门店纳入统计 · <b>' + m.soldStoreCount + '</b> 家有销售 · 零销售 ' + m.zeroStoreCount + ' 家 · 数据缺失 ' + m.missingStoreCount + ' 家 · ' +
      (state.method === 'competition' ? '竞赛排名（并列同名次）' : '顺序排名（名次不重复）');
    $('tableFootnote').innerHTML =
      '① 贡献率与门店自身做比较：金额贡献率（业绩贡献率）= 该门店该 SKU 销售金额 ÷ 该门店同期全部 SKU 销售金额合计 × 100%（例：龙胆在南昌路店 9 月卖 ¥1,898.42，南昌路店 9 月全店总业绩 ¥140,570.60，则贡献率 = 1.35%）；数量贡献率按销量同口径计算，两者独立。<br>' +
      '② 平均销量 = 纳入统计且本期有数据的 ' + m.storeCount + ' 家门店销量均值（数据缺失门店不计入分母）；与平均差值 = 门店销量 − 平均销量。<br>' +
      '③ 排名与贡献率基于当前筛选实时计算：销售为 0 仍参与排名（列于有销售门店之后），数据缺失门店不参与排名；本店总量为 0 或数据缺失时贡献率显示「—」。点击表头可切换排序。';
  }

  /* ---------------- 分析结论 ---------------- */

  function renderAnalysis(m, ctx) {
    var list = E.buildInsights(m, ctx);
    // 结论正文由引擎生成、含 <b> 强调标签：先整体转义防止数据内容注入，再放行白名单标签
    var safeText = function (t) { return esc(t).replace(/&lt;(\/?b)&gt;/g, '<$1>'); };
    $('analysisList').innerHTML = list.map(function (it) {
      return '<li class="insight"><span class="insight-tag ' + it.cls + '">' + esc(it.tag) + '</span><span>' + safeText(it.text) + '</span></li>';
    }).join('');
  }

  /* ---------------- 口径与说明 ---------------- */

  function renderNotes(m, ctx, query) {
    var ds = state.dataset;

    /* 统计口径 */
    var caliber = [];
    caliber.push('<h4>统计口径（当前生效）</h4><ul>' +
      '<li>时间过滤：按「销售日期」过滤，<span class="formula">' + ctx.startDate + ' 00:00:00 ~ ' + ctx.endDate + ' 23:59:59</span>（含起止两日）。</li>' +
      '<li>汇总规则：同一「门店 + SKU」在时间段内的全部记录逐笔累加（含同一天多笔订单），不重复计数、不覆盖。</li>');
    if (ds.hasCancelData) {
      caliber.push('<li>取消/退款：' + (query.excludeCancelled
        ? '已剔除订单状态为「' + esc(ds.cancelValues.join('、')) + '」的记录，本次筛选共剔除 ' + m.quality.cancelledExcluded + ' 笔（可在筛选区取消勾选）。'
        : '未剔除取消/退款状态订单（数据中存在状态值：' + esc(ds.cancelValues.join('、')) + '）。') + '</li>');
    } else {
      caliber.push('<li>取消/退款：数据未包含可识别的订单状态字段，全部记录按原始口径统计；如存在负值（退款冲抵）将按净额自动抵扣（负值/退款相关行 ' + ds.quality.negativeRows + ' 笔）。</li>');
    }
    if (ds.hasRefundColumns) {
      caliber.push('<li>退款列：检测到独立退款数量/金额列，采用净额口径：净销售 = 销售 − 退款。</li>');
    }
    if (ds.mapping.giftFlag !== null && ds.quality.giftRows > 0) {
      caliber.push('<li>赠品/小样：已剔除标记为赠品/小样的记录（本次筛选剔除 ' + m.quality.giftExcluded + ' 笔，数据集共 ' + ds.quality.giftRows + ' 笔）。此类记录成交金额为 0，计入会扭曲销量排名与均价；标记列「' + esc(String(ds.headers[ds.mapping.giftFlag] || '')) + '」中的其他取值（如活动）仍按原始记录统计。</li>');
    }
    caliber.push(
      '<li>数据状态判定：「本期无销售」= 门店在本时间段内有任何营业记录但该 SKU 销量为 0（计 0 并参与排名）；「数据缺失」= 门店在本时间段内无任何上报数据（不参与排名与均值，避免把缺失当零销量）。</li>' +
      '<li>平均销量：总销量 ÷ 本期有数据门店数（' + m.storeCount + ' 家）；数据缺失门店不计入分母。</li>' +
      '<li>排名方式：' + ctx.methodLabel + (state.method === 'competition' ? '（并列门店同名次，如 1、2、2、4）' : '（名次连续不重复，如 1、2、3、4）') + '；数量排名与金额排名独立计算。</li>' +
      '<li>所有排名、贡献率、均价均基于当前筛选条件实时重算，不使用原始表中的任何固定排名。</li></ul>');
    caliber.push('<h4>指标定义</h4><ul>' +
      '<li>销售数量排名：时间段内该 SKU 各门店销量从高到低的名次。</li>' +
      '<li>数量贡献率 = 该门店该 SKU 销量 ÷ 该门店同期全部 SKU 销量合计 × 100%（与门店自身比较）。</li>' +
      '<li>金额贡献率（即「业绩贡献率」）= 该门店该 SKU 销售金额 ÷ 该门店同期全部 SKU 销售金额合计 × 100%（与门店自身比较，例：龙胆南昌路店 9 月 ¥1,898.42 ÷ 南昌路店 9 月全店总业绩 ¥140,570.60 = 1.35%）。</li>' +
      '<li>贡献率分母口径：与本表统计口径一致（同时间段、剔除取消单与赠品/小样、退款按净额），分子分母可比；分母不受门店范围筛选影响。</li>' +
      '<li>销售均价 = 门店金额 ÷ 门店销量（销量为 0 时显示「—」）。</li>' +
      '<li>与平均差值 = 门店销量 − 平均销量。</li>' +
      '<li>本店同期总量为 0 时贡献率显示「—」；金额千分位显示，百分比保留两位小数，均价保留两位小数。</li></ul>');
    $('notesCaliber').innerHTML = caliber.join('');

    /* 字段映射 */
    var mapRows = E.FIELD_DEFS.map(function (def) {
      var col = ds.mapping[def.key];
      var colName = col === null || col === undefined ? '<i style="color:var(--page-text-disabled)">（未识别 / 数据中不存在）</i>' : esc(String(ds.headers[col]));
      var req = def.required === true ? ' <b style="color:var(--danger)">*</b>' : (def.required === 'soft' ? ' ◦' : '');
      return '<tr><td>' + esc(def.label) + req + '</td><td class="cur">' + colName + '</td></tr>';
    }).join('');
    $('notesMapping').innerHTML =
      '<h4>数据源</h4><ul>' +
      '<li>来源：' + esc(ds.sourceName) + (ds.isDemo ? '（系统生成的演示数据，非真实业务数据）' : '（仅在本地浏览器解析）') + '</li>' +
      '<li>原始记录 ' + ds.quality.totalRows.toLocaleString('zh-CN') + ' 行，有效解析 ' + ds.rows.length.toLocaleString('zh-CN') + ' 行；时间范围：' +
      (ds.dateMinKey ? keyToStr(ds.dateMinKey) + ' ~ ' + keyToStr(ds.dateMaxKey) : '无有效日期') + '。</li>' +
      '<li>识别到 ' + ds.skus.length + ' 个 SKU、' + ds.stores.length + ' 家门店。同名不同规格的商品按「SKU编码」或「名称+规格」组合区分，不会错误合并。</li>' +
      (ds.storePrefixStripped ? '<li>门店名展示：全部门店均以统一前缀「' + esc(ds.storePrefixStripped) + '」开头，已自动省略（如「' + esc(ds.storePrefixStripped) + '上海南昌路店」显示为「上海南昌路店」）；筛选、排名、图表与导出均使用省略后的店名。</li>' : '') + '</ul>' +
      '<h4>字段映射（自动识别结果）</h4>' +
      '<table><tr><th>看板字段</th><th>源数据列</th></tr>' + mapRows + '</table>' +
      '<p style="margin-top:8px;color:var(--page-text-muted)">* 为必需字段；◦ 为商品标识字段（商品名称或 SKU 编码至少需其一）。如映射有误，请在上传弹窗中手动校正后重新载入。</p>';

    /* 数据质量 */
    var q = ds.quality, mq = m.quality;
    $('notesQuality').innerHTML =
      '<h4>整体数据质量（载入时）</h4><ul>' +
      '<li>原始行数：' + q.totalRows.toLocaleString('zh-CN') + '；因缺少门店名跳过：' + q.skippedNoStore + ' 行；因缺少商品标识跳过：' + q.skippedNoSkuId + ' 行。</li>' +
      '<li>销售日期无法解析：' + q.dateInvalid + ' 行（已排除，不参与统计）。</li>' +
      '<li>销售数量无法解析：' + q.qtyInvalid + ' 行（按 0 计）；销售金额无法解析：' + q.amountInvalid + ' 行（按 0 计）。</li>' +
      '<li>含负值或退款标记的记录：' + q.negativeRows + ' 行（负值按净额抵扣，详见统计口径）。</li></ul>' +
      '<h4>当前筛选下的统计过程</h4><ul>' +
      '<li>时间段内总记录：' + mq.rowsInPeriod.toLocaleString('zh-CN') + ' 笔；其中该 SKU 记录：' + mq.rowsForSku.toLocaleString('zh-CN') + ' 笔。</li>' +
      (ds.hasCancelData ? '<li>按当前口径剔除取消/退款订单：' + mq.cancelledExcluded + ' 笔。</li>' : '') +
      (ds.hasRefundColumns ? '<li>按净额口径抵扣退款：' + mq.refundNetted + ' 笔（含贡献率分母中的其他 SKU 行）。</li>' : '') +
      '<li>纳入排名门店 ' + m.storeCount + ' 家；零销售 ' + m.zeroStoreCount + ' 家；数据缺失 ' + m.missingStoreCount + ' 家。</li></ul>';
  }

  /* ---------------- 筛选控件 ---------------- */

  function syncControls() {
    var ds = state.dataset;
    var sku = ds.skus.find(function (s) { return s.key === state.skuKey; });
    $('skuComboTxt').textContent = sku ? sku.label : '请选择 SKU';
    $('dateStart').value = state.startDate;
    $('dateEnd').value = state.endDate;
    syncStoreLabel();
    syncSegs();
    renderSkuList('');
    syncPresetChips();
  }

  function syncSegs() {
    [['basisSeg', 'basis', state.basis], ['chartBasisSeg', 'basis', state.basis], ['methodSeg', 'method', state.method]].forEach(function (cfg) {
      $(cfg[0]).querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-' + cfg[1]) === cfg[2]);
      });
    });
  }

  function renderSkuList(filter) {
    var ds = state.dataset;
    if (!ds) return;
    var f = (filter || '').trim().toLowerCase();
    var items = ds.skus.filter(function (s) {
      return !f || s.searchText.indexOf(f) >= 0 || s.label.toLowerCase().indexOf(f) >= 0;
    });
    $('skuList').innerHTML = items.length ? items.map(function (s) {
      var st = state.skuPeriodStats.get(s.key);
      var sub = st ? '本期 ' + E.fmtInt(st.qty) + ' 件' : '本期无数据';
      return '<div class="combo-item' + (s.key === state.skuKey ? ' on' : '') + '" data-key="' + esc(s.key) + '" title="' + esc(s.label) + '">' +
        '<span class="name">' + esc(s.label) + '</span><span class="sub">' + sub + '</span></div>';
    }).join('') : '<div class="panel-tip">没有匹配「' + esc(filter) + '」的商品，可尝试 SKU 编码或规格</div>';

    $('skuList').querySelectorAll('.combo-item').forEach(function (el) {
      el.addEventListener('click', function () {
        state.skuKey = el.getAttribute('data-key');
        closeCombo('skuCombo');
        syncControls();
        applyAndRender();
      });
    });
  }

  function renderStoreList() {
    var ds = state.dataset;
    if (!ds) return;
    var html = ds.stores.map(function (name) {
      var checked = !state.storeSelection || state.storeSelection.has(name);
      return '<label class="check-item"><input type="checkbox" data-store="' + esc(name) + '"' + (checked ? ' checked' : '') + '><span class="name" title="' + esc(name) + '">' + esc(name) + '</span></label>';
    }).join('');
    $('storeList').innerHTML = html;
    $('storeList').querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var name = cb.getAttribute('data-store');
        if (!state.storeSelection) state.storeSelection = new Set(state.dataset.stores);
        if (cb.checked) state.storeSelection.add(name); else state.storeSelection.delete(name);
        syncStoreLabel();
        applyAndRender();
      });
    });
  }

  function syncStoreLabel() {
    var ds = state.dataset;
    var total = ds ? ds.stores.length : 0;
    if (!state.storeSelection || state.storeSelection.size === total) {
      $('storeComboTxt').textContent = '全部门店（' + total + '家）';
    } else {
      $('storeComboTxt').textContent = '已选 ' + state.storeSelection.size + ' / ' + total + ' 家门店';
    }
  }

  function syncPresetChips() {
    $('presetChips').querySelectorAll('.chip').forEach(function (chip) {
      chip.classList.remove('on');
    });
  }

  function markPreset(name) {
    syncPresetChips();
    if (name) {
      var chip = $('presetChips').querySelector('[data-preset="' + name + '"]');
      if (chip) chip.classList.add('on');
    }
  }

  function applyPreset(name) {
    var ds = state.dataset;
    var t = todayStr();
    if (name === 'all') {
      if (ds.dateMinKey && ds.dateMaxKey) {
        state.startDate = keyToStr(ds.dateMinKey);
        state.endDate = keyToStr(ds.dateMaxKey);
      }
    } else if (name === 'thisMonth') {
      state.startDate = t.slice(0, 8) + '01';
      state.endDate = t;
    } else if (name === 'lastMonth') {
      var d = new Date();
      var lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      var lmEnd = new Date(d.getFullYear(), d.getMonth(), 0);
      state.startDate = lm.getFullYear() + '-' + String(lm.getMonth() + 1).padStart(2, '0') + '-01';
      state.endDate = lmEnd.getFullYear() + '-' + String(lmEnd.getMonth() + 1).padStart(2, '0') + '-' + String(lmEnd.getDate()).padStart(2, '0');
    } else if (name === 'thisQuarter') {
      var d2 = new Date();
      var qm = Math.floor(d2.getMonth() / 3) * 3 + 1;
      state.startDate = d2.getFullYear() + '-' + String(qm).padStart(2, '0') + '-01';
      state.endDate = t;
    } else if (name === 'last30') {
      state.startDate = shiftDays(t, -29);
      state.endDate = t;
    }
    $('dateStart').value = state.startDate;
    $('dateEnd').value = state.endDate;
    markPreset(name);
    applyAndRender();
  }

  /* ---------------- 组合下拉开关 ---------------- */

  function closeCombo(id) { $(id).classList.remove('open'); }
  function toggleCombo(id) {
    var el = $(id);
    var willOpen = !el.classList.contains('open');
    closeCombo('skuCombo'); closeCombo('storeCombo');
    if (willOpen) {
      el.classList.add('open');
      var input = el.querySelector('.combo-search');
      if (input) { input.value = ''; if (id === 'skuCombo') renderSkuList(''); }
    }
  }

  /* ---------------- 导出 Excel ---------------- */

  function exportExcel() {
    if (!state.dataset || !global.XLSX) { alert('导出组件未就绪或未载入数据'); return; }
    var startKey = strToKey(state.startDate), endKey = strToKey(state.endDate);
    if (startKey === null || endKey === null) { alert('请先选择有效的统计时间段'); return; }
    var query = {
      skuKey: state.skuKey,
      startKey: startKey, endKey: endKey,
      stores: state.storeSelection ? Array.from(state.storeSelection) : null,
      rankMethod: state.method,
      excludeCancelled: state.excludeCancelled && state.dataset.hasCancelData,
      netRefund: state.dataset.hasRefundColumns
    };
    var m = E.computeMetrics(state.dataset, query);
    var sku = state.dataset.skus.find(function (s) { return s.key === state.skuKey; });
    if (!m.rows.length) { alert('当前筛选条件下没有数据可导出'); return; }

    var statusText = { ok: '正常', zero: '本期无销售', missing: '数据缺失' };
    var aoa = [];
    aoa.push(['门店SKU销售排名报表']);
    aoa.push(['商品SKU：' + (sku ? sku.label : '—')]);
    aoa.push(['统计时间段：' + state.startDate + ' 至 ' + state.endDate]);
    aoa.push(['门店范围：' + (!state.storeSelection ? '全部门店' : '已选 ' + state.storeSelection.size + ' 家')]);
    aoa.push(['排名方式：' + (state.method === 'competition' ? '竞赛排名（并列同名次）' : '顺序排名（名次不重复）') + '；排名依据：' + (state.basis === 'qty' ? '销售数量' : '销售金额')]);
    aoa.push(['导出时间：' + new Date().toLocaleString('zh-CN')]);
    aoa.push([]);
    aoa.push(['门店名称', '数据状态', '销售数量(件)', '数量排名', '销售金额(元)', '金额排名', '数量贡献率(%)', '金额贡献率(%)', '本店同期总量(件)', '本店同期总业绩(元)', '销售均价(元)', '平均销量(件)', '与平均销量差值(件)']);
    sortRows(m.rows).forEach(function (r) {
      aoa.push([
        r.store, statusText[r.dataStatus],
        r.dataStatus === 'missing' ? null : r.qty,
        r.dataStatus === 'missing' ? null : r.qtyRank,
        r.dataStatus === 'missing' ? null : r.amount,
        r.dataStatus === 'missing' ? null : r.amountRank,
        (r.qtyShare === null) ? null : +(r.qtyShare * 100).toFixed(2),
        (r.amountShare === null) ? null : +(r.amountShare * 100).toFixed(2),
        r.dataStatus === 'missing' ? null : r.storeTotalQty,
        r.dataStatus === 'missing' ? null : r.storeTotalAmount,
        (r.avgPrice === null) ? null : +r.avgPrice.toFixed(2),
        r.avgQty === null ? null : +r.avgQty.toFixed(2),
        r.qtyDiff === null ? null : +r.qtyDiff.toFixed(2)
      ]);
    });
    aoa.push([]);
    aoa.push(['口径说明']);
    aoa.push(['1. 按销售日期过滤，含起止两日；同一门店+SKU 的记录逐笔累加。']);
    aoa.push(['2. 贡献率与门店自身做比较：金额贡献率（业绩贡献率）= 该门店该 SKU 销售金额 ÷ 该门店同期全部 SKU 销售金额合计 × 100%；数量贡献率同口径按销量计算。']);
    aoa.push(['3. 平均销量 = 总销量 ÷ 本期有数据门店数（' + m.storeCount + ' 家），数据缺失门店不参与排名与均值。']);
    aoa.push(['4. 「本期无销售」= 门店本期有营业记录但该SKU销量为0；「数据缺失」= 门店本期无任何上报数据。']);
    aoa.push(['5. 本报表由「门店 SKU 销售排名分析看板」基于用户上传/演示数据计算生成，未对业务数据做任何人工修改。']);
    if (state.dataset.storePrefixStripped) {
      aoa.push(['6. 门店名已自动省略全部门店统一的品牌前缀「' + state.dataset.storePrefixStripped + '」（原始数据如「' + state.dataset.storePrefixStripped + '上海南昌路店」，本表显示为「上海南昌路店」）。']);
    }

    var ws = global.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
    var wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, ws, '门店排名');
    var safeName = (sku ? sku.label : 'SKU').replace(/[\\/:*?"<>|（）]/g, '');
    global.XLSX.writeFile(wb, '门店SKU销售排名_' + safeName + '_' + state.startDate + '_' + state.endDate + '.xlsx');
  }

  function downloadTemplate() {
    if (!global.XLSX) { alert('导出组件未就绪'); return; }
    var aoa = [
      ['订单编号', '销售日期', '门店名称', 'SKU编码', '商品名称', '规格', '销售数量', '销售金额(元)', '订单状态'],
      ['SO10001', '2026-09-01', '南昌路店', 'CP001', '不知春香水', '30ml', 2, 718, '已完成'],
      ['SO10002', '2026-09-01', '万象城店', 'CP001', '不知春香水', '30ml', 1, 359, '已完成'],
      ['SO10003', '2026-09-02', '世纪汇店', 'CP001', '不知春香水', '30ml', 3, 1077, '已取消']
    ];
    var ws = global.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
    var wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, ws, '销售明细');
    global.XLSX.writeFile(wb, '销售明细模板.xlsx');
  }

  /* ---------------- 上传与字段映射 ---------------- */

  function openUpload() {
    $('uploadModal').classList.add('open');
    $('uploadError').classList.remove('show');
  }
  function closeUpload() {
    $('uploadModal').classList.remove('open');
  }

  function parseWorkbookFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = global.XLSX.read(e.target.result, { type: 'array', cellDates: true });
        var sheetName = wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        var arr = global.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        if (!arr || !arr.length) throw new Error('文件中没有可识别的表格数据');
        // 找到第一个非空行作为表头
        var headIdx = 0;
        for (var i = 0; i < Math.min(arr.length, 10); i++) {
          var nonEmpty = (arr[i] || []).filter(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; }).length;
          if (nonEmpty >= 2) { headIdx = i; break; }
        }
        var headers = (arr[headIdx] || []).map(function (c) { return c === null || c === undefined ? '' : String(c).trim(); });
        var rows = arr.slice(headIdx + 1).filter(function (r) {
          return r && r.some(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; });
        });
        if (!rows.length) throw new Error('表头下没有数据行');
        state.upload = {
          headers: headers, rows: rows, fileName: file.name, sheetName: sheetName,
          mapping: E.detectMapping(headers)
        };
        renderMappingUI();
      } catch (err) {
        showUploadError('文件解析失败：' + err.message + '。请确认这是有效的 Excel/CSV 文件（CSV 请使用 UTF-8 编码）。');
      }
    };
    reader.onerror = function () { showUploadError('读取文件失败，请重试。'); };
    reader.readAsArrayBuffer(file);
  }

  function showUploadError(msg) {
    var el = $('uploadError');
    el.textContent = msg;
    el.classList.add('show');
    $('mappingSection').hidden = true;
    $('btnConfirmLoad').disabled = true;
  }

  function renderMappingUI() {
    var u = state.upload;
    $('mappingSection').hidden = false;
    var html = ['<tr><th>看板字段</th><th>识别结果（可手动校正）</th></tr>'];
    E.FIELD_DEFS.forEach(function (def) {
      var req = def.required === true ? ' <b style="color:var(--danger)">*</b>' : (def.required === 'soft' ? ' ◦' : '');
      var opts = ['<option value="">（不使用该字段）</option>'].concat(u.headers.map(function (h, i) {
        if (h === '') return '';
        return '<option value="' + i + '"' + (u.mapping[def.key] === i ? ' selected' : '') + '>' + esc(h) + '</option>';
      })).join('');
      html.push('<tr' + (def.required === true && u.mapping[def.key] === null ? ' class="miss"' : '') + '><td>' + esc(def.label) + req + '</td><td><select data-field="' + def.key + '">' + opts + '</select></td></tr>');
    });
    $('mappingTable').innerHTML = html.join('');

    $('mappingTable').querySelectorAll('select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var f = sel.getAttribute('data-field');
        var v = sel.value === '' ? null : +sel.value;
        u.mapping[f] = v;
        validateUploadMapping();
      });
    });

    // 预览
    var prev = ['<table><tr>' + u.headers.map(function (h) { return '<th>' + esc(h || '（空列）') + '</th>'; }).join('') + '</tr>'];
    u.rows.slice(0, 5).forEach(function (r) {
      prev.push('<tr>' + u.headers.map(function (_, i) {
        var v = r[i];
        var shown = v;
        if (v instanceof Date) shown = v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
        return '<td>' + esc(shown === null || shown === undefined ? '' : String(shown)) + '</td>';
      }).join('') + '</tr>');
    });
    prev.push('</table>');
    $('previewWrap').innerHTML = prev.join('');

    // 摘要
    var datePreview = null;
    for (var i = 0; i < Math.min(u.rows.length, 50); i++) {
      var dv = E.parseDateValue(u.rows[i][u.mapping.date]);
      if (dv) { datePreview = dv; break; }
    }
    $('mappingSummary').innerHTML =
      '<span class="schip">文件：<b>' + esc(u.fileName) + '</b></span>' +
      '<span class="schip">工作表：<b>' + esc(u.sheetName) + '</b></span>' +
      '<span class="schip">数据行：<b>' + u.rows.length.toLocaleString('zh-CN') + '</b></span>' +
      '<span class="schip">列数：<b>' + u.headers.filter(function (h) { return h; }).length + '</b></span>' +
      (datePreview ? '<span class="schip">日期示例：<b>' + datePreview.y + '-' + datePreview.m + '-' + datePreview.d + '</b>（已识别）</span>' : '');

    validateUploadMapping();
  }

  function validateUploadMapping() {
    var u = state.upload;
    var missing = E.mappingMissingRequired(u.mapping);
    var ok = u.mapping.date !== null && E.parseDateValue(sampleDateValue(u)) !== null;
    var el = $('uploadError');
    if (missing.length) {
      el.innerHTML = '缺少必需字段：<b>' + missing.map(esc).join('、') + '</b>。请在上表中手动指定对应的数据列；若源数据确实没有这些字段，需在导出原始数据时补充。';
      el.classList.add('show');
      $('btnConfirmLoad').disabled = true;
      return;
    }
    if (!ok) {
      el.innerHTML = '「销售日期」列的值无法解析为日期（前 ' + Math.min(u.rows.length, 50) + ' 行中未发现有效日期）。请确认该列是日期格式（如 2026-09-01、2026/9/1 或 Excel 日期单元格）。';
      el.classList.add('show');
      $('btnConfirmLoad').disabled = true;
      return;
    }
    el.classList.remove('show');
    $('btnConfirmLoad').disabled = false;
  }

  function sampleDateValue(u) {
    for (var i = 0; i < Math.min(u.rows.length, 50); i++) {
      var v = u.rows[i][u.mapping.date];
      if (v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return '';
  }

  function confirmUploadLoad() {
    var u = state.upload;
    if (!u) return;
    var ds = E.buildDataset(u.headers, u.rows, u.mapping, { sourceName: u.fileName, isDemo: false });
    if (!ds.rows.length) {
      showUploadError('按当前映射没有解析出任何有效记录，请检查字段映射。');
      return;
    }
    closeUpload();
    state.upload = null;
    loadDataset(ds, null);
  }

  /* ---------------- 事件绑定 ---------------- */

  function wireEvents() {
    $('btnUpload').addEventListener('click', openUpload);
    $('bannerUpload').addEventListener('click', openUpload);
    $('btnDemo').addEventListener('click', loadDemo);
    $('btnCancelUpload').addEventListener('click', closeUpload);
    $('btnTemplate').addEventListener('click', downloadTemplate);
    $('btnConfirmLoad').addEventListener('click', confirmUploadLoad);
    $('uploadModal').addEventListener('click', function (e) { if (e.target === this) closeUpload(); });

    // 拖拽 / 点击上传
    var dz = $('dropZone'), fi = $('fileInput');
    dz.addEventListener('click', function () { fi.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    fi.addEventListener('change', function () { if (fi.files && fi.files[0]) parseWorkbookFile(fi.files[0]); fi.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) parseWorkbookFile(e.dataTransfer.files[0]);
    });

    // SKU 下拉
    $('skuComboBtn').addEventListener('click', function () { toggleCombo('skuCombo'); });
    $('skuSearch').addEventListener('input', function () { renderSkuList(this.value); });
    $('storeComboBtn').addEventListener('click', function () { toggleCombo('storeCombo'); });
    $('storeSearch').addEventListener('input', function () {
      var f = this.value.trim().toLowerCase();
      $('storeList').querySelectorAll('.check-item').forEach(function (item) {
        item.style.display = !f || item.textContent.toLowerCase().indexOf(f) >= 0 ? '' : 'none';
      });
    });
    $('storeSelectAll').addEventListener('click', function () {
      state.storeSelection = null;
      renderStoreList(); syncStoreLabel(); applyAndRender();
    });
    $('storeClear').addEventListener('click', function () {
      state.storeSelection = new Set();
      renderStoreList(); syncStoreLabel(); applyAndRender();
    });

    // 点击空白关闭下拉
    document.addEventListener('click', function (e) {
      if (!e.target.closest || (!e.target.closest('#skuCombo'))) closeCombo('skuCombo');
      if (!e.target.closest('#storeCombo')) closeCombo('storeCombo');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeCombo('skuCombo'); closeCombo('storeCombo'); closeUpload(); }
    });

    // 时间
    $('presetChips').querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () { applyPreset(chip.getAttribute('data-preset')); });
    });
    $('dateStart').addEventListener('change', function () { state.startDate = this.value; markPreset(null); applyAndRender(); });
    $('dateEnd').addEventListener('change', function () { state.endDate = this.value; markPreset(null); applyAndRender(); });

    // 排名依据 / 方式 / 图表切换 / 口径
    $('basisSeg').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.basis = b.getAttribute('data-basis');
        state.tableSort = { key: state.basis === 'qty' ? 'qtyRank' : 'amountRank', dir: 'asc' };
        syncSegs(); applyAndRender();
      });
    });
    $('chartBasisSeg').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.basis = b.getAttribute('data-basis');
        state.tableSort = { key: state.basis === 'qty' ? 'qtyRank' : 'amountRank', dir: 'asc' };
        syncSegs(); applyAndRender();
      });
    });
    $('methodSeg').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.method = b.getAttribute('data-method');
        syncSegs(); applyAndRender();
      });
    });
    $('caliberExclude').addEventListener('change', function () {
      state.excludeCancelled = this.checked;
      applyAndRender();
    });
    $('contribViewAll').addEventListener('click', function () {
      state.contribViewAll = !state.contribViewAll;
      this.textContent = state.contribViewAll ? '只看 Top 10' : '查看全部门店';
      applyAndRender();
    });

    // 查询 / 重置 / 导出
    $('btnQuery').addEventListener('click', function () {
      state.startDate = $('dateStart').value;
      state.endDate = $('dateEnd').value;
      markPreset(null);
      applyAndRender();
    });
    $('btnReset').addEventListener('click', function () {
      var ds = state.dataset;
      state.basis = 'qty';
      state.method = 'competition';
      state.excludeCancelled = ds.hasCancelData;
      $('caliberExclude').checked = state.excludeCancelled;
      state.storeSelection = null;
      state.tableSort = { key: 'qtyRank', dir: 'asc' };
      state.contribViewAll = false;
      $('contribViewAll').textContent = '查看全部门店';
      var hero = ds.skus.find(function (s) { return s.key === 'code:CP001'; });
      state.skuKey = hero ? hero.key : (ds.skus.length ? ds.skus[0].key : null);
      if (ds.dateMinKey && ds.dateMaxKey) {
        state.startDate = keyToStr(ds.dateMinKey);
        state.endDate = keyToStr(ds.dateMaxKey);
      }
      renderStoreList();
      syncControls();
      markPreset(null);
      applyAndRender();
    });
    $('btnExport').addEventListener('click', exportExcel);

    // 表头排序
    document.querySelectorAll('#rankTable thead th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (state.tableSort.key === key) {
          state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.tableSort = { key: key, dir: (key === 'qtyRank' || key === 'amountRank') ? 'asc' : 'desc' };
        }
        applyAndRender();
      });
    });
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    if (!E) { document.body.insertAdjacentHTML('afterbegin', '<div class="banner">数据引擎加载失败，请检查 assets/engine.js 是否存在。</div>'); return; }
    if (!global.echarts || !C) {
      ['chartBarEmpty', 'chartContribEmpty', 'chartScatterEmpty'].forEach(function (id) {
        var el = $(id);
        el.innerHTML = '<span class="big">图表组件加载失败</span><span>请检查 _shared/js/echarts.min.js 是否存在</span>';
        el.classList.add('show');
      });
    } else {
      C.init();
    }
    wireEvents();
    loadDemo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
