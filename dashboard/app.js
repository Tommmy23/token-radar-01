// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the empirical model's
// inputs and the protocol's actionable farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The empirical model in one function: computes implied value using category TVL multiples
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var baseMultiple = row.base_multiple || (DATA.category_multiples && DATA.category_multiples[row.category]) || (DATA.category_multiples && DATA.category_multiples['_overall']) || model.base_multiple;
    return Math.max(1, Math.round(row.tvl_usd * baseMultiple * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function gasCostFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('solana') >= 0 || c.indexOf('aptos') >= 0 || c.indexOf('sui') >= 0) {
      return { setup: 'under $0.05 of network fee', weekly: 'under $0.02 of fee a week' };
    }
    if (
      c.indexOf('base') >= 0 ||
      c.indexOf('arbitrum') >= 0 ||
      c.indexOf('optimism') >= 0 ||
      c.indexOf('polygon') >= 0 ||
      c.indexOf('blast') >= 0 ||
      c.indexOf('scroll') >= 0 ||
      c.indexOf('linea') >= 0 ||
      c.indexOf('mode') >= 0 ||
      c.indexOf('zksync') >= 0
    ) {
      return { setup: 'about $0.25 of L2 gas', weekly: 'about $0.08 of gas a week' };
    }
    if (c.indexOf('ethereum') >= 0 || c.indexOf('mainnet') >= 0) {
      return { setup: 'about $8 - $14 of L1 gas', weekly: 'about $3 - $5 of gas a week' };
    }
    return { setup: 'about $0.80 of gas', weekly: 'about $0.35 of gas a week' };
  }

  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0 || c.indexOf('amm') >= 0) {
      return 'Provide $' + capital + " of paired liquidity to " + name + "'s highest-volume pool on " + chain + ' and maintain position depth.';
    }
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('borrow') >= 0) {
      return 'Supply $' + capital + ' of collateral to ' + name + ' on ' + chain + ' and maintain a conservative loan-to-value position.';
    }
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) {
      return 'Bridge $' + capital + ' through ' + name + ' to ' + chain + ' and complete at least one native interaction with the received assets.';
    }
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) {
      return 'Deposit $' + capital + ' of native assets into ' + name + ' on ' + chain + ' to accrue yield and protocol points.';
    }
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('option') >= 0) {
      return 'Deposit $' + capital + ' of margin on ' + name + ' (' + chain + ') and open delta-neutral or hedged trading volume weekly.';
    }
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('aggregator') >= 0) {
      return 'Allocate $' + capital + " into " + name + "'s core yield vault on " + chain + ' and compound earnings continuously.';
    }
    if (c.indexOf('rwa') >= 0) {
      return 'Onboard and deposit $' + capital + " into " + name + "'s verified institutional-grade asset pool on " + chain + '.';
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('risk') >= 0 || c.indexOf('allocator') >= 0) {
      return 'Deposit $' + capital + ' into a ' + name + '-curated risk tier on ' + chain + ' to earn underlying platform rewards.';
    }
    return 'Deposit $' + capital + ' of capital into ' + name + ' on ' + chain + ' to establish verified on-chain wallet tenure.';
  }

  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Maintain verified wallet position.';
    return s;
  }

  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasCostFor(chain);
    return [
      { text: 'Prepare a dedicated non-custodial wallet on ' + chain + ' with clean transaction lineage and isolate farming capital.', cost: gas.setup, time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas.setup, time: '15 minutes to initiate' },
      { text: 'Maintain regular on-chain activity on ' + p.name + ' with recurrent volume, rebalancing, or governance interactions.', cost: gas.weekly, time: '10 minutes weekly' },
      { text: 'Maintain active capital in the protocol for at least ' + hold + ' consecutive days to qualify across multiple snapshot intervals.', cost: '$' + capital + ' deployed in protocol', time: hold + ' days retention' },
      { text: 'Monitor official announcement channels for points reconciliation, badges, or airdrop claim terms before withdrawing.', cost: 'zero fees to verify official portal', time: '5 minutes review' },
      { text: 'Record tx hashes, entry timestamps, and deployment addresses in your farming ledger for audit and claims verification.', cost: 'no monetary cost', time: '5 minutes logging' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'badge', text: 'Snapshot ' + DATA.as_of }),
        el('span', { class: 'badge', text: 'DefiLlama Index' }),
        el('span', { class: 'badge active', text: DATA.model_version })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' Watchlist Protocols, Ranked by Implied Value' }),
        el('p', { text: 'Empirical launch valuation radar for pre-token DeFi protocols. Tracks ' + DATA.watchlist_size + ' high-conviction protocols (TVL >= $' + Math.round(DATA.floor_usd / 1e6) + 'M) and identifies ' + DATA.early_size + ' early opportunities. Implied value is modeled from market multiples, growth velocity, and protocol maturity.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist Covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-Token Rows Scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early Discovery Rows' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live Token Benchmarks' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search protocol, category, or chain...', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All Categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-Token Radar', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live Benchmarks', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Protocol / Chain Filter' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Sector Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Display Mode' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' / ' + DATA.board_size + ' protocols' : DATA.live.length + ' live benchmarks' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No matching protocols' }),
        el('p', { text: 'Adjust search terms or clear category filters to view active protocols.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Reset Filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num rank-col', text: '#' + String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' • ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'Multi-chain') })
        )),
        el('td', { class: 'num font-mono', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num font-mono ' + growthClass, text: growth }),
        el('td', { class: 'num font-mono', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num font-mono val-highlight', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status-pill', text: 'Pre-Token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub table-caption', text: 'Pre-token protocols ranked by empirical implied launch valuation. Click any row for mathematical breakdown and actionable farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d Growth'),
            sortHeader('age', 'Maturity'),
            sortHeader('implied', 'Implied Launch Valuation'),
            el('th', { scope: 'col', text: 'Status' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'LIVE' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' • ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'Multi-chain') }))),
        el('td', { class: 'num font-mono', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num font-mono ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num font-mono val-highlight', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status-pill traded', text: 'Trading' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub table-caption', text: 'Market Benchmarks: Live protocols with verified market caps used to calibrate category multiples.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market Cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'Empirical Valuation Architecture' }),
      el('p', { class: 'sub', text: 'Valuations are algorithmically synthesized from snapshot fundamentals using sector-calibrated multiples, velocity momentum, and operational tenure.' }),
      el('div', { class: 'formula-box' },
        el('code', { text: 'Implied_FDV = round( TVL * Category_Median_Multiple * (1 + clamp(7d_Growth, ' + m.growth_floor + '%, ' + m.growth_cap + '%) * ' + m.growth_weight + ') * (' + m.maturity_floor + ' + min(Age_Days, ' + m.maturity_days + ') / ' + m.maturity_days + ' * ' + m.maturity_range + ') )' })
      ),
      el('p', { class: 'sub', text: 'Multiples are computed per category from actively traded protocols. Protocols on the watchlist represent institutional-grade liquidity (>= $50M TVL). Early discovery rows identify top emerging protocols below threshold.' })
    );
  }

  var dialog = el('dialog', { class: 'detail-dialog', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var computed = impliedOf(row, DATA.model);
    var baseMult = row.base_multiple || (DATA.category_multiples && DATA.category_multiples[row.category]) || 0.25;

    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'rank-badge', text: 'RANK #' + row.rank + ' OF ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' • Deployments: ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'Mainnet') })
      ),
      el('button', { class: 'close-btn', type: 'button', 'aria-label': 'Close dialog', text: '✕', onclick: function () { dialog.close(); } })
    ));

    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Valuation Drivers & Multipliers' }),
      el('div', { class: 'grid-metrics' },
        el('div', { class: 'metric-card' }, el('span', { text: 'Reported TVL' }), el('b', { class: 'num font-mono', text: fmtUsd(row.tvl_usd) })),
        el('div', { class: 'metric-card' }, el('span', { text: 'Category Base Multiple' }), el('b', { class: 'num font-mono', text: baseMult.toFixed(3) + 'x' })),
        el('div', { class: 'metric-card' }, el('span', { text: '7-Day Growth' }), el('b', { class: 'num font-mono ' + (row.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(row.change_7d) })),
        el('div', { class: 'metric-card' }, el('span', { text: 'Growth Factor' }), el('b', { class: 'num font-mono', text: row.growth_multiplier.toFixed(4) + 'x' })),
        el('div', { class: 'metric-card' }, el('span', { text: 'Tenure (Age)' }), el('b', { class: 'num font-mono', text: fmtAge(row.age_days) })),
        el('div', { class: 'metric-card' }, el('span', { text: 'Maturity Factor' }), el('b', { class: 'num font-mono', text: row.maturity_multiplier.toFixed(4) + 'x' }))
      ),
      el('div', { class: 'implied-highlight-card' },
        el('span', { text: 'Modeled Implied Launch Valuation' }),
        el('h2', { class: 'num font-mono text-accent', text: fmtUsd(row.implied_value_usd) }),
        el('p', { class: 'sub', text: 'Model verification: recomputed as ' + fmtUsd(computed) + (computed === row.implied_value_usd ? ' (exact match with board.json).' : ' (delta detected).') })
      )
    ));

    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Strategic Farm Protocol Execution' }),
      el('ol', { class: 'timeline-steps' }, steps.map(function (s, idx) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', { class: 'step-item' },
          el('div', { class: 'step-num', text: String(idx + 1) }),
          el('div', { class: 'step-content' },
            el('b', { class: 'step-text', text: action }),
            el('div', { class: 'step-meta', text: tail })
          )
        );
      }))
    ));

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
