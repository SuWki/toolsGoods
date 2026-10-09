/* 门店 SKU 销售排名分析看板 · 数据引擎（纯函数，可在 Node 中测试）
 * 职责：字段自动识别 → 数据规范化 → 门店+SKU+时间段汇总 → 排名/贡献率/均价 → 分析结论
 * 不依赖任何 DOM / 库。
 */
(function (global) {
  'use strict';

  /* ---------------- 通用工具 ---------------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isBlank(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  function stripStr(v) {
    if (typeof v !== 'string') return v;
    return v.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }

  /* 数值解析：兼容 "1,200"、"¥1,200"、"(120)"、"-120"、"120.5元" */
  function parseNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    var s = stripStr(v);
    if (s === '') return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[¥￥$,%\s元]/g, '');
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  /* 日期解析 → {key: y*10000+m*100+d, y, m, d}；失败返回 null
   * 支持：Date 对象、Excel 序列号、2026-09-01 / 2026/9/1 / 2026.9.1 / 2026年9月1日 / 20260901（可带时间）
   */
  function parseDateValue(v) {
    if (isBlank(v)) return null;
    if (v instanceof Date && !isNaN(v.getTime())) {
      return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate(), key: v.getFullYear() * 10000 + (v.getMonth() + 1) * 100 + v.getDate() };
    }
    if (typeof v === 'number' && isFinite(v)) {
      // Excel 序列号：1900-12-30 起算；仅接受合理范围（1954-2100），避免把普通数值误判为日期
      if (v < 20000 || v > 80000) return null;
      var ms = Math.round((v - 25569) * 86400000);
      var dt = new Date(ms);
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), key: dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate() };
    }
    var s = stripStr(String(v));
    var m;
    // 2026-09-01 10:23 / 2026/9/1 / 2026.9.1 / 2026年9月1日
    m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?([ T]\d{1,2}:\d{2}(:\d{2})?)?/);
    if (m) return makeDay(+m[1], +m[2], +m[3]);
    // 20260901
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return makeDay(+m[1], +m[2], +m[3]);
    // ISO 8601
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (m) return makeDay(+m[1], +m[2], +m[3]);
    // 9/1/2026 或 01-09-2026（M/D/Y，弱优先级兜底）
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) {
      var a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) return makeDay(+m[3], b, a); // D/M/Y
      return makeDay(+m[3], a, b); // M/D/Y
    }
    return null;
  }

  function makeDay(y, m, d) {
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y: y, m: m, d: d, key: y * 10000 + m * 100 + d };
  }

  function dayKeyToString(key) {
    var y = Math.floor(key / 10000), m = Math.floor((key % 10000) / 100), d = key % 100;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* ---------------- 格式化 ---------------- */

  function fmtInt(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var neg = n < 0;
    var s = Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    return (neg ? '-' : '') + s;
  }

  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    var opts = Number.isInteger(abs) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return (n < 0 ? '-' : '') + abs.toLocaleString('zh-CN', opts);
  }

  function fmtPrice(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(x) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return (x * 100).toFixed(2) + '%';
  }

  function fmtSigned(n, digits) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var s = Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: digits === undefined ? 2 : digits });
    return (n > 0 ? '+' : n < 0 ? '-' : '') + s;
  }

  /* ---------------- 字段自动识别 ---------------- */

  var FIELD_DEFS = [
    { key: 'store',      label: '门店名称', required: true,
      patterns: [/^门店(名称)?$/, /^(门店|店铺|店名|分店|门市|售点|网点|柜台)$/, /^(店铺|门店)名称$/, /store|shop|outlet/i, /门店|店铺|店名/] },
    { key: 'skuCode',    label: 'SKU编码', required: false,
      patterns: [/^sku(编码|代码|号|id)?$/i, /^(商品|货品|产品)(编码|代码|货号|条码|编号)$/, /货号|条形码|条码/, /(item|product|article)[\s_.-]?code|sku[\s_.-]?id|sku[\s_.-]?no/i] },
    { key: 'productName', label: '商品名称', required: 'soft',
      patterns: [/^(商品|货品|产品)(名称|名)?$/, /^品名$/, /^商品$/, /^(item|product)[\s_.-]?name/i, /商品名称|产品名称|品名/] },
    { key: 'spec',       label: '规格', required: false,
      patterns: [/^规格(型号|大小)?$/, /规格|容量|净含量|型号/, /^spec$|^size$|volume/i] },
    { key: 'date',       label: '销售日期', required: true,
      patterns: [/^(销售|下单|交易|成交|订单|出货|签单|支付|结算)?日期$/, /^(销售|下单|交易|成交|订单|支付)?时间$/, /^(销售|下单|交易|成交)?日$/, /^date([\s_.-]?time)?$/i, /日期|时间/] },
    { key: 'qty',        label: '销售数量', required: true, exclude: /退款|退货|退单|赠品|赠送/,
      patterns: [/^(销售|净销售|成交)?数量(([（(]件[)）])|件)?$/, /^销量$/, /^(销售|成交)(件数|个数)$/, /^(qty|quantity|sales[\s_.-]?qty)$/i, /数量|件数|销量/] },
    { key: 'amount',     label: '销售金额', required: true, exclude: /退款|退货|退单|优惠|折扣|成本/,
      patterns: [/^(销售|实收|实付|成交|订单)?金额(([（(]元[)）])|元)?$/, /^销售额?$/, /^(实收|实付|净销售|成交)金额$/, /实际(成交|支付)?金额/, /^(实收|实付|成交)$/, /^gmv$|^revenue$|^amount$|sales[\s_.-]?amount/i, /金额|销售额/] },
    { key: 'refundQty',  label: '退款数量', required: false,
      patterns: [/退款(数量|件数|数量|件)/, /(退货|退款).*(数量|件)/] },
    { key: 'refundAmount', label: '退款金额', required: false,
      patterns: [/退款(金额|价款)/, /(退货|退款).*(金额|价款)/] },
    { key: 'orderId',    label: '订单编号', required: false,
      patterns: [/^(订单|交易|销售)?(编号|单号|号)$/, /order([_\s-]?(no|id|num))?/i, /单号|流水|订单号/] },
    { key: 'status',     label: '订单状态', required: false,
      patterns: [/^(订单|交易|支付)?状态$/, /^status$/i, /状态/] },
    { key: 'giftFlag',   label: '赠品/小样标记', required: false,
      patterns: [/^(小样[\/／]?赠品|赠品[\/／]?小样)$/, /^是否(赠品|小样|试用装)$/, /(赠品|小样|试用装)(标记|标识|类型)?$/, /gift|sample/i] }
  ];

  var CANCEL_RE = /已?取?消|已?退款|已?退货|已?关闭|作废|无效|失效|cancelled|canceled|refunded|closed|void/i;
  /* 行级赠品/小样标记值：命中则该行不计入销售统计（金额通常为 0，计入会扭曲销量排名与均价） */
  var GIFT_RE = /^(赠品|小样|试用[装品])$/i;

  function detectMapping(headers) {
    var mapping = {};
    var used = {};
    FIELD_DEFS.forEach(function (def) {
      mapping[def.key] = null;
      for (var i = 0; i < def.patterns.length; i++) {
        for (var c = 0; c < headers.length; c++) {
          if (used[c]) continue;
          var name = stripStr(String(headers[c] || ''));
          if (name === '') continue;
          if (def.exclude && def.exclude.test(name)) continue;
          if (def.patterns[i].test(name)) { mapping[def.key] = c; used[c] = true; return; }
        }
      }
    });
    return mapping;
  }

  function mappingMissingRequired(mapping) {
    var missing = [];
    FIELD_DEFS.forEach(function (def) {
      if (def.required === true && mapping[def.key] === null) missing.push(def.label);
    });
    // 商品名称 与 SKU编码 至少要有其一，才能标识商品
    if (mapping.productName === null && mapping.skuCode === null) {
      missing.push('商品名称 或 SKU编码（至少其一）');
    }
    return missing;
  }

  /* ---------------- 数据集构建 ---------------- */

  function cellVal(row, idx) { return idx === null || idx === undefined || idx < 0 ? null : row[idx]; }

  function skuKeyOf(code, name, spec) {
    if (!isBlank(code)) return 'code:' + stripStr(String(code)).toUpperCase();
    return 'n:' + stripStr(String(name || '')) + '|' + stripStr(String(spec || ''));
  }

  function buildDataset(headers, rows, mapping, options) {
    options = options || {};
    var norm = [];      // 规范行
    var quality = {
      totalRows: rows.length,
      skippedNoStore: 0, skippedNoSkuId: 0, dateInvalid: 0,
      qtyInvalid: 0, amountInvalid: 0, negativeRows: 0, refundRows: 0, giftRows: 0
    };
    var skuMap = new Map();
    var storeSet = new Map();
    var statusValues = new Map();
    var minKey = Infinity, maxKey = -Infinity;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var store = stripStr(String(cellVal(row, mapping.store) !== null ? cellVal(row, mapping.store) : ''));
      if (store === '' || store === 'null' || store === 'undefined') { quality.skippedNoStore++; continue; }
      var code = cellVal(row, mapping.skuCode);
      var name = cellVal(row, mapping.productName);
      var spec = cellVal(row, mapping.spec);
      var codeS = isBlank(code) ? '' : stripStr(String(code));
      var nameS = isBlank(name) ? '' : stripStr(String(name));
      var specS = isBlank(spec) ? '' : stripStr(String(spec));
      if (codeS === '' && nameS === '') { quality.skippedNoSkuId++; continue; }

      var dv = parseDateValue(cellVal(row, mapping.date));
      if (!dv) { quality.dateInvalid++; continue; }
      if (dv.key < minKey) minKey = dv.key;
      if (dv.key > maxKey) maxKey = dv.key;

      var qty = parseNumber(cellVal(row, mapping.qty));
      var amount = parseNumber(cellVal(row, mapping.amount));
      var refundQty = mapping.refundQty !== null ? parseNumber(cellVal(row, mapping.refundQty)) : null;
      var refundAmount = mapping.refundAmount !== null ? parseNumber(cellVal(row, mapping.refundAmount)) : null;

      if (qty === null) { quality.qtyInvalid++; qty = 0; }
      if (amount === null) { quality.amountInvalid++; amount = 0; }
      if (qty < 0 || amount < 0 || (refundQty !== null && refundQty > 0) || (refundAmount !== null && refundAmount > 0)) quality.negativeRows++;

      var status = '';
      if (mapping.status !== null) {
        status = stripStr(String(cellVal(row, mapping.status) || ''));
        if (status !== '') {
          statusValues.set(status, (statusValues.get(status) || 0) + 1);
        }
      }

      var isGift = false;
      if (mapping.giftFlag !== null) {
        var giftV = stripStr(String(cellVal(row, mapping.giftFlag) !== null ? cellVal(row, mapping.giftFlag) : ''));
        if (GIFT_RE.test(giftV)) { isGift = true; quality.giftRows++; }
      }

      var sKey = skuKeyOf(codeS, nameS, specS);
      if (!skuMap.has(sKey)) {
        skuMap.set(sKey, { key: sKey, code: codeS, name: nameS, spec: specS });
      }
      storeSet.set(store, (storeSet.get(store) || 0) + 1);

      norm.push({
        store: store,
        skuKey: sKey,
        code: codeS,
        name: nameS,
        spec: specS,
        dateKey: dv.key,
        qty: qty,
        amount: amount,
        refundQty: refundQty,
        refundAmount: refundAmount,
        status: status,
        isGift: isGift,
        orderId: mapping.orderId !== null ? String(cellVal(row, mapping.orderId) !== null ? cellVal(row, mapping.orderId) : '') : ''
      });
    }

    // 商品编码对应多个规格（如同一编码同时用于 30ml 与 50ml）时，
    // 改用「编码|规格」复合键，避免不同规格被错误合并为同一 SKU（规格大小写视为同一）
    if (mapping.skuCode !== null) {
      var codeSpecSets = new Map();
      norm.forEach(function (n) {
        if (n.code) {
          var cu = n.code.toUpperCase();
          var set = codeSpecSets.get(cu);
          if (!set) { set = new Set(); codeSpecSets.set(cu, set); }
          if (n.spec) set.add(n.spec.toLowerCase());
        }
      });
      var splitCodes = new Set();
      codeSpecSets.forEach(function (set, cu) { if (set.size > 1) splitCodes.add(cu); });
      if (splitCodes.size > 0) {
        var reKeyed = new Map();
        norm.forEach(function (n) {
          if (n.code && splitCodes.has(n.code.toUpperCase())) {
            n.skuKey = 'code:' + n.code.toUpperCase() + '|' + (n.spec ? n.spec.toLowerCase() : '');
          }
          if (!reKeyed.has(n.skuKey)) {
            reKeyed.set(n.skuKey, { key: n.skuKey, code: n.code, name: n.name, spec: n.spec });
          }
        });
        skuMap = reKeyed;
      }
    }

    // 门店名统一品牌前缀去除：全部门店均以同一「品牌-」开头时省略该前缀
    // （例：黑爪-上海南昌路店 → 上海南昌路店）；去除后出现空名或重名则保留原名
    var storePrefixStripped = null;
    (function () {
      var names = Array.from(storeSet.keys());
      if (names.length < 2) return; // 单店无法区分品牌前缀与店名本身
      var d1 = names[0].indexOf('-'), d2 = names[0].indexOf('－');
      var firstDash = d1 === -1 ? d2 : (d2 === -1 ? d1 : Math.min(d1, d2));
      if (firstDash < 2) return; // 前缀品牌名至少 2 个字符
      var prefix = names[0].slice(0, firstDash + 1);
      for (var i = 1; i < names.length; i++) {
        if (names[i].indexOf(prefix) !== 0) return;
      }
      var stripped = names.map(function (n) { return n.slice(prefix.length); });
      if (stripped.some(function (n) { return n === ''; })) return;
      var seen = new Set();
      for (var j = 0; j < stripped.length; j++) {
        if (seen.has(stripped[j])) return;
        seen.add(stripped[j]);
      }
      storePrefixStripped = prefix;
      var rename = new Map();
      names.forEach(function (n, k) { rename.set(n, stripped[k]); });
      norm.forEach(function (n) { n.store = rename.get(n.store); });
      var newSet = new Map();
      storeSet.forEach(function (cnt, n) {
        var s = rename.get(n);
        newSet.set(s, (newSet.get(s) || 0) + cnt);
      });
      storeSet = newSet;
    })();

    // 识别取消/退款类状态值
    var cancelValues = [];
    statusValues.forEach(function (cnt, val) {
      if (CANCEL_RE.test(val)) cancelValues.push(val);
    });

    // SKU 展示标签：名称 规格（编码）
    var skus = [];
    skuMap.forEach(function (s) {
      var label = s.name || ('SKU ' + s.code);
      if (s.spec) label += ' ' + s.spec;
      if (s.code) label += '（' + s.code + '）';
      s.label = label;
      s.searchText = (s.name + ' ' + s.spec + ' ' + s.code).toLowerCase();
      skus.push(s);
    });
    skus.sort(function (a, b) { return a.label.localeCompare(b.label, 'zh-CN'); });

    var stores = Array.from(storeSet.keys()).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });

    return {
      headers: headers,
      mapping: mapping,
      rows: norm,
      skus: skus,
      stores: stores,
      dateMinKey: minKey === Infinity ? null : minKey,
      dateMaxKey: maxKey === -Infinity ? null : maxKey,
      quality: quality,
      hasStatusColumn: mapping.status !== null,
      hasRefundColumns: mapping.refundQty !== null || mapping.refundAmount !== null,
      cancelValues: cancelValues,
      hasCancelData: cancelValues.length > 0,
      storePrefixStripped: storePrefixStripped,
      sourceName: options.sourceName || '未命名数据源',
      isDemo: !!options.isDemo
    };
  }

  /* ---------------- 汇总 + 排名 + 指标 ---------------- */

  function isCancelRow(row, cancelSet) {
    return cancelSet.size > 0 && row.status !== '' && cancelSet.has(row.status);
  }

  function computeMetrics(dataset, query) {
    // query: {skuKey, startKey, endKey, stores(null=全部)|array, rankMethod, excludeCancelled, netRefund}
    var cancelSet = new Set(dataset.cancelValues || []);
    var includeAll = query.stores === null || query.stores === undefined;
    var includeSet = includeAll ? null : new Set(query.stores);
    var startKey = query.startKey, endKey = query.endKey;

    var agg = new Map();        // store -> {qty, amount}  该 SKU 汇总（当前口径）
    var storeTotals = new Map();// store -> {qty, amount}  该店同期全 SKU 汇总（贡献率分母，同口径）
    var presence = new Set();   // 时间段内出现过任何记录（任何 SKU，含取消单/赠品行）的门店
    var quality = { cancelledExcluded: 0, giftExcluded: 0, rowsInPeriod: 0, rowsForSku: 0, refundNetted: 0 };

    for (var i = 0; i < dataset.rows.length; i++) {
      var row = dataset.rows[i];
      if (row.dateKey < startKey || row.dateKey > endKey) continue;
      if (includeSet && !includeSet.has(row.store)) continue;
      presence.add(row.store);
      quality.rowsInPeriod++;
      if (isCancelRow(row, cancelSet) && query.excludeCancelled) { quality.cancelledExcluded++; continue; }
      if (row.isGift) { quality.giftExcluded++; continue; }
      var qty = row.qty, amount = row.amount;
      if (query.netRefund) {
        if (row.refundQty !== null) qty -= row.refundQty;
        if (row.refundAmount !== null) amount -= row.refundAmount;
        if ((row.refundQty !== null && row.refundQty > 0) || (row.refundAmount !== null && row.refundAmount > 0)) quality.refundNetted++;
      }
      var tot = storeTotals.get(row.store);
      if (!tot) { tot = { qty: 0, amount: 0 }; storeTotals.set(row.store, tot); }
      tot.qty += qty;
      tot.amount += amount;
      if (row.skuKey !== query.skuKey) continue;
      quality.rowsForSku++;
      var cur = agg.get(row.store);
      if (!cur) { cur = { qty: 0, amount: 0 }; agg.set(row.store, cur); }
      cur.qty += qty;
      cur.amount += amount;
    }

    // 纳入统计的门店列表（默认全部门店目录；或用户选择的子集，过滤掉数据集中不存在的）
    var storeList = includeAll ? dataset.stores : query.stores.filter(function (s) { return dataset.stores.indexOf(s) >= 0; });

    var table = storeList.map(function (store) {
      var a = agg.get(store) || { qty: 0, amount: 0 };
      var hasPresence = presence.has(store);
      var status = !hasPresence ? 'missing' : (a.qty === 0 && a.amount === 0 ? 'zero' : 'ok');
      return {
        store: store,
        qty: hasPresence ? a.qty : null,
        amount: hasPresence ? a.amount : null,
        dataStatus: status
      };
    });

    // 参与排名/汇总的行：数据状态非 missing（数据缺失门店不参与排名，防止把缺失当零）
    var ranked = table.filter(function (r) { return r.dataStatus !== 'missing'; });

    var totalQty = 0, totalAmount = 0;
    ranked.forEach(function (r) { totalQty += r.qty; totalAmount += r.amount; });
    var storeCount = ranked.length;
    var avgQty = storeCount > 0 ? totalQty / storeCount : null;
    var overallAvgPrice = totalQty > 0 ? totalAmount / totalQty : null;

    assignRanks(ranked, 'qty', query.rankMethod);
    assignRanks(ranked, 'amount', query.rankMethod);

    ranked.forEach(function (r) {
      // 贡献率 = 该店该 SKU 指标 ÷ 该店同期全 SKU 指标（与自身比较，非跨门店合计）
      var tot = storeTotals.get(r.store) || { qty: 0, amount: 0 };
      r.storeTotalQty = tot.qty;
      r.storeTotalAmount = tot.amount;
      r.qtyShare = tot.qty > 0 ? r.qty / tot.qty : null;
      r.amountShare = tot.amount > 0 ? r.amount / tot.amount : null;
      r.avgPrice = r.qty > 0 ? r.amount / r.qty : null;
      r.avgQty = avgQty;
      r.qtyDiff = avgQty !== null ? r.qty - avgQty : null;
    });

    // 缺失门店字段置空
    table.forEach(function (r) {
      if (r.dataStatus === 'missing') {
        r.qtyRank = null; r.amountRank = null; r.qtyShare = null; r.amountShare = null;
        r.avgPrice = null; r.avgQty = avgQty; r.qtyDiff = null;
        r.storeTotalQty = null; r.storeTotalAmount = null;
      }
    });

    // 汇总补充：有销售门店数
    var soldStores = ranked.filter(function (r) { return r.qty > 0 || r.amount > 0; });

    return {
      rows: table,
      ranked: ranked,
      totalQty: totalQty,
      totalAmount: totalAmount,
      avgQty: avgQty,
      overallAvgPrice: overallAvgPrice,
      storeCount: storeCount,
      soldStoreCount: soldStores.length,
      zeroStoreCount: ranked.filter(function (r) { return r.dataStatus === 'zero'; }).length,
      missingStoreCount: table.filter(function (r) { return r.dataStatus === 'missing'; }).length,
      includedStoreCount: table.length,
      quality: quality
    };
  }

  /* 排名：competition = 1,2,2,4；sequential = 1,2,3,4；从高到低 */
  function assignRanks(rows, field, method) {
    var sorted = rows.slice().sort(function (a, b) { return b[field] - a[field]; });
    if (method === 'sequential') {
      sorted.forEach(function (r, i) { r[field + 'Rank'] = i + 1; });
      return;
    }
    var rank = 0, prev = null;
    sorted.forEach(function (r, i) {
      if (prev === null || r[field] !== prev) { rank = i + 1; prev = r[field]; }
      r[field + 'Rank'] = rank;
    });
  }

  /* ---------------- 分析结论 ---------------- */

  function buildInsights(m, ctx) {
    // ctx: {skuLabel, startDate, endDate, rankMethodLabel, datasetName}
    var out = [];
    var ranked = m.ranked || [];
    var byQty = ranked.slice().sort(function (a, b) { return a.qtyRank - b.qtyRank || a.store.localeCompare(b.store); });
    var byAmount = ranked.slice().sort(function (a, b) { return a.amountRank - b.amountRank || a.store.localeCompare(b.store); });
    var qTop = byQty[0], aTop = byAmount[0];
    var n = ranked.length;

    if (m.totalQty === 0 && m.totalAmount === 0) {
      var zeroList = ranked.filter(function (r) { return r.dataStatus === 'zero'; }).map(function (r) { return r.store; });
      var text = '当前筛选条件下（' + ctx.skuLabel + '，' + ctx.startDate + ' 至 ' + ctx.endDate + '）没有销售数据。';
      if (zeroList.length) text += '其中 ' + zeroList.length + ' 家门店本期有营业记录但该 SKU 无销售；其余门店可能本期未上报数据。';
      text += '建议核对统计时间段是否覆盖实际销售日期，或更换 SKU。';
      out.push({ tag: '无数据', cls: 't-note', text: text });
      return out;
    }

    if (n === 1) {
      out.push({ tag: '提示', cls: 't-note', text: '当前仅有 1 家门店纳入统计，排名不具备横向比较意义；贡献率为该 SKU 占本店同期业绩的比例，仍可单独解读。建议扩大门店范围或时间段。' });
    }

    // 领先门店
    if (qTop && qTop.qty > 0) {
      if (qTop.store === aTop.store) {
        out.push({
          tag: '双榜第一', cls: 't-lead',
          text: '<b>' + qTop.store + '</b>表现领先：销量 ' + fmtInt(qTop.qty) + ' 件（数量第1名）、销售金额 ' + fmtMoney(qTop.amount) + ' 元（金额第1名），占本店同期业绩 ' + fmtPct(qTop.amountShare) + '。'
        });
      } else {
        out.push({
          tag: '数量第一', cls: 't-lead',
          text: '<b>' + qTop.store + '</b>销量第一：' + fmtInt(qTop.qty) + ' 件（数量排名 1），但金额排名第一的是 <b>' + aTop.store + '</b>（' + fmtMoney(aTop.amount) + ' 元）。'
        });
      }
    }

    // 排名背离（销量与金额排名差 ≥ 3 名）
    var diverg = ranked.filter(function (r) {
      return r.qty > 0 && r.amount > 0 && Math.abs(r.qtyRank - r.amountRank) >= 3;
    }).sort(function (a, b) { return Math.abs(b.qtyRank - b.amountRank) - Math.abs(a.qtyRank - a.amountRank); }).slice(0, 3);

    diverg.forEach(function (r) {
      var gap = Math.abs(r.qtyRank - r.amountRank);
      if (r.amountRank > r.qtyRank) {
        var priceRatio = m.overallAvgPrice ? (1 - r.avgPrice / m.overallAvgPrice) : 0;
        out.push({
          tag: '均价偏低', cls: 't-price',
          text: '<b>' + r.store + '</b>销量排名第 ' + r.qtyRank + ' 名，但金额排名第 ' + r.amountRank + ' 名（相差 ' + gap + ' 名），销售均价 ' + fmtPrice(r.avgPrice) + ' 元' +
            (m.overallAvgPrice ? '，低于整体均价 ' + fmtPrice(m.overallAvgPrice) + ' 元约 ' + fmtPct(priceRatio) : '') + '，建议核查实际成交价格与折扣情况。'
        });
      } else {
        var ratio2 = m.overallAvgPrice ? (r.avgPrice / m.overallAvgPrice - 1) : 0;
        out.push({
          tag: '均价偏高', cls: 't-price',
          text: '<b>' + r.store + '</b>金额排名第 ' + r.amountRank + ' 名，高于其销量排名（第 ' + r.qtyRank + ' 名，相差 ' + gap + ' 名），销售均价 ' + fmtPrice(r.avgPrice) + ' 元' +
            (m.overallAvgPrice ? '，高于整体均价 ' + fmtPrice(m.overallAvgPrice) + ' 元约 ' + fmtPct(ratio2) : '') + '，成交价与客单结构值得关注。'
        });
      }
    });

    // 均价显著偏离但排名未背离的门店（≥20%）
    var divergSet = new Set(diverg.map(function (r) { return r.store; }));
    var priceOut = ranked.filter(function (r) {
      return r.avgPrice && m.overallAvgPrice && Math.abs(r.avgPrice / m.overallAvgPrice - 1) >= 0.2 && !divergSet.has(r.store);
    }).slice(0, 2);
    priceOut.forEach(function (r) {
      var hi = r.avgPrice > m.overallAvgPrice;
      out.push({
        tag: hi ? '均价偏高' : '均价偏低', cls: 't-price',
        text: '<b>' + r.store + '</b>销售均价 ' + fmtPrice(r.avgPrice) + ' 元，较整体均价（' + fmtPrice(m.overallAvgPrice) + ' 元）' + (hi ? '高' : '低') + ' ' + fmtPct(Math.abs(r.avgPrice / m.overallAvgPrice - 1)) + '，建议核对价格政策执行情况。'
      });
    });

    // 零销量门店
    var zeros = m.rows.filter(function (r) { return r.dataStatus === 'zero'; });
    if (zeros.length) {
      out.push({
        tag: '本期无销售', cls: 't-zero',
        text: '以下 ' + zeros.length + ' 家门店本期有营业数据但该 SKU 销量为 0（按 0 参与排名，排在有销售门店之后）：' + zeros.map(function (r) { return r.store; }).join('、') + '。建议关注陈列、备货与导购推荐情况。'
      });
    }

    // 数据缺失门店
    var missing = m.rows.filter(function (r) { return r.dataStatus === 'missing'; });
    if (missing.length) {
      out.push({
        tag: '数据缺失', cls: 't-missing',
        text: '以下 ' + missing.length + ' 家门店在所选时间段内没有任何上报数据，已标注为「数据缺失」且不参与排名与均值计算：' + missing.map(function (r) { return r.store; }).join('、') + '。请核实数据上报完整性，勿将缺失当作零销量解读。'
      });
    }

    // 单品依赖：该 SKU 占某店自身业绩比重过高（≥40%）
    var depStores = ranked.filter(function (r) { return r.amount > 0 && r.amountShare !== null && r.amountShare >= 0.4; })
      .sort(function (a, b) { return b.amountShare - a.amountShare; }).slice(0, 5);
    if (depStores.length) {
      var depText = depStores.map(function (r) { return '<b>' + r.store + '</b>（' + fmtPct(r.amountShare) + '，本店同期业绩 ' + fmtMoney(r.storeTotalAmount) + ' 元）'; }).join('、');
      out.push({
        tag: '单品依赖', cls: 't-risk',
        text: (depStores.length === 1 ? '门店' : depStores.length + ' 家门店') + '的业绩高度依赖该 SKU：' + depText + '。该商品在这些门店的动销波动将直接冲击整体业绩，建议关注备货深度与替代款培育。'
      });
    } else if (n >= 2) {
      var hi = ranked.filter(function (r) { return r.amountShare !== null; })
        .sort(function (a, b) { return b.amountShare - a.amountShare; })[0];
      if (hi && hi.amountShare !== null && hi.amountShare >= 0.2) {
        out.push({
          tag: '占比最高', cls: 't-note',
          text: '该 SKU 业绩占比最高的门店是 <b>' + hi.store + '</b>：占其本店同期业绩 ' + fmtPct(hi.amountShare) + '（本店同期业绩 ' + fmtMoney(hi.storeTotalAmount) + ' 元），可作为主推陈列的参照门店。'
        });
      }
    }

    // 净销量为负
    var negs = ranked.filter(function (r) { return r.qty < 0 || r.amount < 0; });
    if (negs.length) {
      out.push({
        tag: '净退货', cls: 't-missing',
        text: '<b>' + negs.map(function (r) { return r.store; }).join('、') + '</b>本期净销售为负（退货金额大于销售金额），建议核查该门店退货与订单记录口径。'
      });
    }

    // 均价差异最大的两家（销量Top内）总结性提示
    if (m.overallAvgPrice && n >= 2) {
      var top5 = byQty.slice(0, Math.min(5, n)).filter(function (r) { return r.qty > 0; });
      if (top5.length >= 2) {
        var maxP = top5[0], minP = top5[0];
        top5.forEach(function (r) {
          if (r.avgPrice !== null && (maxP.avgPrice === null || r.avgPrice > maxP.avgPrice)) maxP = r;
          if (r.avgPrice !== null && (minP.avgPrice === null || r.avgPrice < minP.avgPrice)) minP = r;
        });
        if (maxP !== minP && maxP.avgPrice && minP.avgPrice) {
          out.push({
            tag: '对比', cls: 't-note',
            text: '销量前 5 的门店中，<b>' + maxP.store + '</b>均价最高（' + fmtPrice(maxP.avgPrice) + ' 元），<b>' + minP.store + '</b>均价最低（' + fmtPrice(minP.avgPrice) + ' 元），两者相差 ' + fmtPct(maxP.avgPrice / minP.avgPrice - 1) + '，可作为折扣策略复盘的对照样本。'
          });
        }
      }
    }

    if (!out.length) {
      out.push({ tag: '说明', cls: 't-note', text: '当前数据未触发显著异常规则，各门店销量与金额排名基本一致，可结合贡献率与均价继续观察。' });
    }
    return out;
  }

  /* ---------------- 演示数据 ---------------- */

  var DEMO_STORES = [
    { name: '南昌路店', level: 1.6, price: 1.00 },
    { name: '万象城店', level: 1.4, price: 0.92 },
    { name: '世纪汇店', level: 1.2, price: 0.96 },
    { name: '环球港店', level: 1.3, price: 0.85 },
    { name: '恒隆广场店', level: 1.1, price: 1.00 },
    { name: '大悦城店', level: 1.0, price: 0.95 },
    { name: '来福士店', level: 0.9, price: 1.00 },
    { name: '龙湖天街店', level: 0.85, price: 0.97 },
    { name: '静安嘉里店', level: 1.15, price: 0.94 },
    { name: '国金中心店', level: 0.8, price: 1.02 },
    { name: '太古汇店', level: 0.95, price: 1.00 },
    { name: 'SKP店', level: 0.75, price: 1.06 },
    { name: '老佛爷百货店', level: 0.6, price: 1.00 },
    { name: '新天地店', level: 0.7, price: 0.98 },
    { name: '田子坊店', level: 0.65, price: 0.90 },
    { name: '徐家汇店', level: 0.9, price: 1.00 },
    { name: '五角场店', level: 0.8, price: 0.93 },
    { name: '机场T2店', level: 0.55, price: 1.05 }
  ];

  var DEMO_SKUS = [
    { code: 'CP001', name: '不知春香水', spec: '30ml', price: 359 },
    { code: 'CP002', name: '不知春香水', spec: '100ml', price: 899 },
    { code: 'CP003', name: '玫瑰木质调淡香水', spec: '50ml', price: 459 },
    { code: 'CP004', name: '海盐鼠尾草香水', spec: '75ml', price: 529 },
    { code: 'CP005', name: '白茶沐浴露', spec: '300ml', price: 129 },
    { code: 'CP006', name: '乳木果护手霜', spec: '75ml', price: 89 },
    { code: 'CP007', name: '雪松香薰蜡烛', spec: '220g', price: 259 },
    { code: 'CP008', name: '桂花乌龙香氛喷雾', spec: '45ml', price: 199 }
  ];

  var HERO_KEY = 'code:CP001';

  function generateDemoData() {
    var rnd = mulberry32(20260901);
    var headers = ['订单编号', '销售日期', '门店名称', 'SKU编码', '商品名称', '规格', '销售数量', '销售金额(元)', '订单状态'];
    var rows = [];
    var orderSeq = 100000;

    function addDay(y, m, d) { return y * 10000 + m * 100 + d; }

    var heroSeptStores = new Map(); // store -> 9月 hero SKU 净销量，用于事后制造并列

    // 用真实 Date 逐日推进：数字自增会在月末进位出 2026-08-32 之类无效日期
    var cur = new Date(2026, 7, 15);    // 2026-08-15
    var demoEnd = new Date(2026, 9, 8); // 2026-10-08
    while (cur.getTime() <= demoEnd.getTime()) {
      var y = cur.getFullYear(), mo = cur.getMonth() + 1, da = cur.getDate();
      var dk = addDay(y, mo, da);
      var dateStr = y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
      DEMO_STORES.forEach(function (st) {
        var si = DEMO_STORES.indexOf(st);
        // 机场T2店：9月1日起无任何数据（演示「数据缺失」）
        if (si === 17 && dk >= addDay(2026, 9, 1)) return;
        // 周末销量略高
        var weekend = cur.getDay() === 0 || cur.getDay() === 6;
        var nTx = Math.floor(rnd() * (weekend ? 3.2 : 2.4) * (st.level * 0.55 + 0.4));
        for (var t = 0; t < nTx; t++) {
          // SKU 分布：主力 SKU（护手霜/沐浴露/香水）概率更高
          var roll = rnd();
          var sku;
          if (roll < 0.22) sku = DEMO_SKUS[0];
          else if (roll < 0.32) sku = DEMO_SKUS[5];
          else if (roll < 0.42) sku = DEMO_SKUS[4];
          else if (roll < 0.55) sku = DEMO_SKUS[1];
          else if (roll < 0.68) sku = DEMO_SKUS[2];
          else if (roll < 0.80) sku = DEMO_SKUS[3];
          else if (roll < 0.88) sku = DEMO_SKUS[6];
          else if (roll < 0.95) sku = DEMO_SKUS[7];
          else sku = DEMO_SKUS[0];

          // 田子坊店、五角场店：9月不卖 hero SKU（演示「本期无销售=0」）
          if ((si === 14 || si === 16) && mo === 9 && sku.code === 'CP001') continue;
          // 新天地店 10 月起不卖 hero（换月后 zero 案例随筛选变化）
          if (si === 13 && mo === 10 && sku.code === 'CP001') continue;

          var qty = 1 + Math.floor(rnd() * (sku.price > 300 ? 3 : 5));
          var unit = Math.round(sku.price * st.price * (0.88 + rnd() * 0.14) * 10) / 10;
          var amount = Math.round(qty * unit * 10) / 10;
          var cancelled = rnd() < 0.02;
          orderSeq++;
          rows.push([
            'SO' + orderSeq, dateStr, st.name, sku.code, sku.name, sku.spec, qty, amount,
            cancelled ? '已取消' : '已完成'
          ]);
          if (sku.code === 'CP001' && mo === 9 && !cancelled) {
            heroSeptStores.set(st.name, (heroSeptStores.get(st.name) || 0) + qty);
          }
        }
      });
      cur.setDate(cur.getDate() + 1);
    }

    // 制造 9 月 hero SKU 数量并列：将「万象城店」补齐至与「静安嘉里店」相同
    var a = heroSeptStores.get('万象城店') || 0;
    var b = heroSeptStores.get('静安嘉里店') || 0;
    if (a > 0 && b > 0 && a !== b) {
      var target = Math.max(a, b), src = Math.min(a, b);
      var diff = target - src;
      var storeName = a < b ? '万象城店' : '静安嘉里店';
      rows.push(['SO900001', '2026-09-18', storeName, 'CP001', '不知春香水', '30ml', diff, Math.round(diff * 329.9 * 10) / 10, '已完成']);
    }

    // 补一笔明显低价成交（环球港店）与一笔高价成交（SKP店），丰富均价分析
    rows.push(['SO900002', '2026-09-12', '环球港店', 'CP001', '不知春香水', '30ml', 6, 1799.4, '已完成']);
    rows.push(['SO900003', '2026-09-25', 'SKP店', 'CP001', '不知春香水', '30ml', 3, 1139.9, '已完成']);

    return { headers: headers, rows: rows, heroKey: HERO_KEY, defaultStart: '2026-09-01', defaultEnd: '2026-09-30' };
  }

  /* ---------------- 导出 ---------------- */

  var API = {
    parseNumber: parseNumber,
    parseDateValue: parseDateValue,
    dayKeyToString: dayKeyToString,
    detectMapping: detectMapping,
    mappingMissingRequired: mappingMissingRequired,
    buildDataset: buildDataset,
    computeMetrics: computeMetrics,
    assignRanks: assignRanks,
    buildInsights: buildInsights,
    generateDemoData: generateDemoData,
    fmtInt: fmtInt,
    fmtMoney: fmtMoney,
    fmtPrice: fmtPrice,
    fmtPct: fmtPct,
    fmtSigned: fmtSigned,
    CANCEL_RE: CANCEL_RE,
    FIELD_DEFS: FIELD_DEFS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.SalesEngine = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
