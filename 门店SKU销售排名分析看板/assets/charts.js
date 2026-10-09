/* 门店 SKU 销售排名分析看板 · 图表模块（ECharts，SVG 渲染）
 * 全部颜色来自 :root 的 --chart-* / --page-* 令牌，单一 Business Blue 图表色板。
 */
(function (global) {
  'use strict';

  var charts = {};
  var tokens = null;

  function readTokens() {
    var css = getComputedStyle(document.documentElement);
    function t(name) { return css.getPropertyValue(name).trim(); }
    tokens = {
      s1: t('--chart-series-1'),
      s2: t('--chart-series-2'),
      other: t('--chart-other'),
      accent2: t('--chart-accent-2'),
      grid: t('--chart-grid'),
      axis: t('--chart-axis'),
      label: t('--chart-label'),
      tooltipBg: t('--chart-tooltip-bg'),
      ink: t('--page-text'),
      muted: t('--page-text-muted'),
      border: t('--page-border'),
      brandText: t('--page-brand-text')
    };
  }

  function initChart(id) {
    var el = document.getElementById(id);
    if (!el || !global.echarts) return null;
    return global.echarts.init(el, null, { renderer: 'svg' });
  }

  function tooltipBase(extra) {
    var base = {
      appendToBody: true,
      backgroundColor: tokens.tooltipBg,
      borderColor: tokens.border,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow:0 6px 18px rgba(15,23,42,.14);border-radius:8px;'
    };
    for (var k in extra) base[k] = extra[k];
    return base;
  }

  function setEmpty(el, msg) {
    if (!el) return;
    if (msg) {
      el.innerHTML = '<span class="big">' + msg + '</span><span>调整筛选条件后此处将展示图表</span>';
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  var fmtInt = function (n) { return n === null || n === undefined || !isFinite(n) ? '—' : Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) .replace(/^/, n < 0 ? '-' : ''); };
  var fmtMoney = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    var s = Number.isInteger(abs) ? abs.toLocaleString('zh-CN') : abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + s;
  };
  var fmtPct = function (x) { return x === null || x === undefined || !isFinite(x) ? '—' : (x * 100).toFixed(2) + '%'; };
  var fmtPrice = function (n) { return n === null || n === undefined || !isFinite(n) ? '—' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  function rowTooltipHtml(r) {
    var lines = [];
    lines.push('<b>' + r.store + '</b>');
    lines.push('销售数量：' + fmtInt(r.qty) + ' 件（数量第 ' + (r.qtyRank || '—') + ' 名）');
    lines.push('销售金额：' + fmtMoney(r.amount) + ' 元（金额第 ' + (r.amountRank || '—') + ' 名）');
    lines.push('数量贡献率：' + fmtPct(r.qtyShare) + (r.storeTotalQty === null || r.storeTotalQty === undefined ? '' : '（本店同期总量 ' + fmtInt(r.storeTotalQty) + ' 件）'));
    lines.push('金额贡献率：' + fmtPct(r.amountShare) + (r.storeTotalAmount === null || r.storeTotalAmount === undefined ? '' : '（本店同期总业绩 ' + fmtMoney(r.storeTotalAmount) + ' 元）'));
    if (r.avgPrice !== null && r.avgPrice !== undefined) lines.push('销售均价：' + fmtPrice(r.avgPrice) + ' 元');
    return lines.join('<br>');
  }

  /* ---------- 1. 门店销售排名柱状图 ---------- */

  function renderBar(rows, basis, emptyMsg) {
    var chart = charts.bar;
    var emptyEl = document.getElementById('chartBarEmpty');
    if (!chart) { setEmpty(emptyEl, emptyMsg || '图表未初始化'); return; }
    var data = (rows || []).filter(function (r) { return r.dataStatus !== 'missing'; });
    if (!data.length || emptyMsg) {
      chart.clear();
      setEmpty(emptyEl, emptyMsg || '当前条件下没有可展示的数据');
      return;
    }
    setEmpty(emptyEl, null);
    data.sort(function (a, b) { return (basis === 'amount' ? b.amount - a.amount : b.qty - a.qty) || a.store.localeCompare(b.store); });
    var isAmount = basis === 'amount';
    var cats = data.map(function (r) { return r.store; });
    var vals = data.map(function (r) {
      return { value: isAmount ? r.amount : r.qty, row: r };
    });
    chart.setOption({
      animation: false,
      grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
      tooltip: tooltipBase({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31,41,55,0.06)' } },
        formatter: function (params) {
          var p = params && params[0];
          if (!p) return '';
          return rowTooltipHtml(p.data.row);
        }
      }),
      xAxis: {
        type: 'category',
        data: cats,
        axisLine: { lineStyle: { color: tokens.border } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.axis,
          fontSize: 11,
          interval: data.length > 12 ? 'auto' : 0,
          rotate: data.length > 8 ? 38 : 0,
          formatter: function (v) { return v.length > 8 ? v.slice(0, 7) + '…' : v; }
        }
      },
      yAxis: {
        type: 'value',
        name: isAmount ? '元' : '件',
        nameTextStyle: { color: tokens.label, fontSize: 11, padding: [0, 0, 0, 4] },
        splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
        axisLabel: { color: tokens.axis, fontSize: 11, formatter: function (v) { return v >= 10000 ? (v / 1000) + 'k' : v.toLocaleString('zh-CN'); } }
      },
      series: [{
        type: 'bar',
        data: vals,
        barMaxWidth: 34,
        itemStyle: { color: tokens.s1, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: tokens.accent2 } },
        label: {
          show: data.length <= 14,
          position: 'top',
          color: tokens.label,
          fontSize: 10.5,
          formatter: function (p) {
            var v = p.value;
            if (isAmount) return v >= 10000 ? (v / 10000).toFixed(1) + '万' : fmtMoney(v);
            return String(v);
          }
        }
      }]
    }, true);
  }

  /* ---------- 2. 门店业绩贡献图（该 SKU 占本店同期业绩比例，横向条形） ---------- */

  function renderContrib(rows, viewAll, emptyMsg) {
    var chart = charts.contrib;
    var emptyEl = document.getElementById('chartContribEmpty');
    if (!chart) { setEmpty(emptyEl, emptyMsg || '图表未初始化'); return; }
    var data = (rows || []).filter(function (r) {
      return r.dataStatus !== 'missing' && r.amountShare !== null && r.amountShare !== undefined && (r.amount > 0 || r.qty > 0);
    });
    if (!data.length || emptyMsg) {
      chart.clear();
      setEmpty(emptyEl, emptyMsg || '当前条件下没有可展示的数据');
      return;
    }
    setEmpty(emptyEl, null);
    data.sort(function (a, b) { return b.amountShare - a.amountShare; });
    var TOP_N = 10;
    var shown = !viewAll && data.length > TOP_N ? data.slice(0, TOP_N) : data;
    var rest = data.slice(shown.length);
    var cats = shown.map(function (r) { return r.store; }).reverse();
    var vals = shown.map(function (r) {
      return { value: +(r.amountShare * 100).toFixed(2), row: r };
    }).reverse();

    // 各店占比分母不同（本店自身业绩），跨店加总无意义，仅提示未展示门店数
    var footNote = rest.length ? '（其余 ' + rest.length + ' 家门店未在图中展示）' : '';

    chart.setOption({
      animation: false,
      grid: { left: 8, right: 52, top: 24, bottom: 4, containLabel: true },
      tooltip: tooltipBase({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31,41,55,0.06)' } },
        formatter: function (params) {
          var p = params && params[0];
          if (!p) return '';
          return rowTooltipHtml(p.data.row);
        }
      }),
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: tokens.axis, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: tokens.grid, width: 1 } }
      },
      yAxis: {
        type: 'category',
        data: cats,
        axisLine: { lineStyle: { color: tokens.border } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.axis,
          fontSize: 11,
          formatter: function (v) { return v.length > 7 ? v.slice(0, 6) + '…' : v; }
        }
      },
      series: [{
        type: 'bar',
        data: vals,
        barMaxWidth: 18,
        itemStyle: { color: tokens.s1, borderRadius: [0, 4, 4, 0] },
        emphasis: { itemStyle: { color: tokens.accent2 } },
        label: {
          show: true,
          position: 'right',
          color: tokens.label,
          fontSize: 11,
          formatter: function (p) { return p.value.toFixed(2) + '%'; }
        }
      }]
    }, true);
    return footNote;
  }

  /* ---------- 3. 销量排名 × 金额排名对比散点 ---------- */

  function renderScatter(rows, emptyMsg) {
    var chart = charts.scatter;
    var emptyEl = document.getElementById('chartScatterEmpty');
    if (!chart) { setEmpty(emptyEl, emptyMsg || '图表未初始化'); return; }
    var data = (rows || []).filter(function (r) {
      return r.dataStatus !== 'missing' && r.qtyRank !== null && r.amountRank !== null;
    });
    if (!data.length || emptyMsg) {
      chart.clear();
      setEmpty(emptyEl, emptyMsg || '当前条件下没有可展示的数据');
      return;
    }
    setEmpty(emptyEl, null);
    var maxRank = 1;
    data.forEach(function (r) {
      if (r.qtyRank > maxRank) maxRank = r.qtyRank;
      if (r.amountRank > maxRank) maxRank = r.amountRank;
    });
    var alignSeries = [], divergSeries = [];
    data.forEach(function (r, i) {
      // 并列排名会导致坐标重合，加微量确定性抖动便于识别
      var jx = ((i % 3) - 1) * 0.14;
      var jy = ((Math.floor(i / 3) % 3) - 1) * 0.14;
      var pt = [(r.qtyRank + jx), (r.amountRank + jy), r.store, r];
      if (Math.abs(r.qtyRank - r.amountRank) >= 3) divergSeries.push(pt);
      else alignSeries.push(pt);
    });

    function scatterSeries(name, arr, color) {
      return {
        name: name,
        type: 'scatter',
        data: arr,
        symbolSize: 13,
        itemStyle: { color: color, opacity: 0.88, borderColor: '#FFFFFF', borderWidth: 1.5 },
        emphasis: { scale: 1.25 },
        label: {
          show: data.length <= 24,
          position: 'top',
          distance: 6,
          fontSize: 10.5,
          color: tokens.label,
          formatter: function (p) { return p.value[2]; }
        },
        labelLayout: { hideOverlap: true },
        tooltip: tooltipBase({
          formatter: function (p) { return rowTooltipHtml(p.value[3]); }
        })
      };
    }

    chart.setOption({
      animation: false,
      legend: {
        top: 4,
        right: 8,
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        textStyle: { color: tokens.muted, fontSize: 11.5 },
        data: ['排名一致（相差<3名）', '排名背离（相差≥3名）']
      },
      grid: { left: 8, right: 20, top: 36, bottom: 6, containLabel: true },
      xAxis: {
        type: 'value',
        name: '数量排名 →',
        min: 0.4,
        max: maxRank + 0.6,
        interval: 1,
        nameLocation: 'end',
        nameTextStyle: { color: tokens.label, fontSize: 11 },
        axisLabel: { color: tokens.axis, fontSize: 11 },
        splitLine: { lineStyle: { color: tokens.grid, width: 1 } }
      },
      yAxis: {
        type: 'value',
        name: '↑ 金额排名',
        min: 0.4,
        max: maxRank + 0.6,
        interval: 1,
        nameTextStyle: { color: tokens.label, fontSize: 11 },
        axisLabel: { color: tokens.axis, fontSize: 11 },
        splitLine: { lineStyle: { color: tokens.grid, width: 1 } }
      },
      series: [
        scatterSeries('排名一致（相差<3名）', alignSeries, tokens.s1),
        scatterSeries('排名背离（相差≥3名）', divergSeries, tokens.accent2),
        {
          type: 'line',
          name: '排名一致参考线',
          silent: true,
          symbol: 'none',
          data: [[0.4, 0.4], [maxRank + 0.6, maxRank + 0.6]],
          lineStyle: { color: tokens.other, type: 'dashed', width: 1.5 },
          tooltip: { show: false }
        }
      ]
    }, true);
  }

  /* ---------- 生命周期 ---------- */

  function init() {
    readTokens();
    charts.bar = initChart('chartBar');
    charts.contrib = initChart('chartContrib');
    charts.scatter = initChart('chartScatter');
    window.addEventListener('resize', function () {
      for (var k in charts) {
        if (charts[k]) charts[k].resize();
      }
    });
  }

  global.RankCharts = {
    init: init,
    renderBar: renderBar,
    renderContrib: renderContrib,
    renderScatter: renderScatter,
    readTokens: readTokens
  };
})(typeof window !== 'undefined' ? window : globalThis);
