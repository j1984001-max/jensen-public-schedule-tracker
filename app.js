const state = {
  events: [],
  latestSignals: [],
  signalErrors: [],
  signalGeneratedAt: "",
  signalLookbackDays: 30,
  sourceBacklog: [],
  informalStops: [],
  generatedAt: "",
  filters: {
    search: "",
    status: "all",
    year: "all",
    type: "all",
    category: "all"
  }
};

const els = {
  currentLocation: document.querySelector("#current-location"),
  currentSummary: document.querySelector("#current-summary"),
  metricEvents: document.querySelector("#metric-events"),
  metricCities: document.querySelector("#metric-cities"),
  metricCompanies: document.querySelector("#metric-companies"),
  metricConfirmed: document.querySelector("#metric-confirmed"),
  routeRange: document.querySelector("#route-range"),
  routeChain: document.querySelector("#route-chain"),
  routeUpdated: document.querySelector("#route-updated"),
  statsRange: document.querySelector("#stats-range"),
  statYears: document.querySelector("#stat-years"),
  statCountries: document.querySelector("#stat-countries"),
  statNamedExecs: document.querySelector("#stat-named-execs"),
  statAvgConfidence: document.querySelector("#stat-avg-confidence"),
  yearBars: document.querySelector("#year-bars"),
  cityRanking: document.querySelector("#city-ranking"),
  companyRanking: document.querySelector("#company-ranking"),
  monthHeatmap: document.querySelector("#month-heatmap"),
  industryRanking: document.querySelector("#industry-ranking"),
  mentionedRanking: document.querySelector("#mentioned-ranking"),
  sourceAuditSummary: document.querySelector("#source-audit-summary"),
  sourceOfficialCount: document.querySelector("#source-official-count"),
  sourceMediaCount: document.querySelector("#source-media-count"),
  sourceVideoCount: document.querySelector("#source-video-count"),
  sourceHighCount: document.querySelector("#source-high-count"),
  latestSignalSummary: document.querySelector("#latest-signal-summary"),
  latestSignalCount: document.querySelector("#latest-signal-count"),
  latestSignalList: document.querySelector("#latest-signal-list"),
  relationshipGraph: document.querySelector("#relationship-graph"),
  relationshipCount: document.querySelector("#relationship-count"),
  informalList: document.querySelector("#informal-list"),
  informalCount: document.querySelector("#informal-count"),
  companyDrawer: document.querySelector("#company-drawer"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerBody: document.querySelector("#drawer-body"),
  drawerCloseButton: document.querySelector("#drawer-close-button"),
  filterInsight: document.querySelector("#filter-insight"),
  routeMap: document.querySelector("#route-map"),
  eventList: document.querySelector("#event-list"),
  companyList: document.querySelector("#company-list"),
  sourceList: document.querySelector("#source-list"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  statusFilter: document.querySelector("#status-filter"),
  yearFilter: document.querySelector("#year-filter"),
  typeFilter: document.querySelector("#type-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  refreshButton: document.querySelector("#refresh-button"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  exportJsonButton: document.querySelector("#export-json-button"),
  copySummaryButton: document.querySelector("#copy-summary-button"),
  eventTemplate: document.querySelector("#event-card-template")
};

async function loadData() {
  const response = await fetch("./data/events.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Data load failed: ${response.status}`);
  }
  const data = await response.json();
  const signalData = await loadLatestSignals();
  state.events = [...data.events].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  state.latestSignals = signalData.signals || [];
  state.signalErrors = signalData.errors || [];
  state.signalGeneratedAt = signalData.generatedAt || "";
  state.signalLookbackDays = signalData.lookbackDays || 30;
  state.sourceBacklog = data.sourceBacklog || [];
  state.informalStops = [...(data.informalStops || [])].sort((a, b) => b.date.localeCompare(a.date));
  state.generatedAt = data.generatedAt || "";
  renderYearOptions();
  renderTypeOptions();
  renderCategoryOptions();
  render();
}

async function loadLatestSignals() {
  try {
    const response = await fetch("./data/latest_signals.json", { cache: "no-store" });
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}

function renderYearOptions() {
  const selected = els.yearFilter.value;
  const years = [...new Set(state.events.map((event) => event.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  els.yearFilter.innerHTML = '<option value="all">全部年份</option>';
  for (const year of years) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = `${year} 年`;
    els.yearFilter.append(option);
  }
  els.yearFilter.value = years.includes(selected) ? selected : "all";
}

function renderTypeOptions() {
  const selected = els.typeFilter.value;
  const types = [...new Set(state.events.map((event) => event.type))].sort();
  els.typeFilter.innerHTML = '<option value="all">全部類型</option>';
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    els.typeFilter.append(option);
  }
  els.typeFilter.value = types.includes(selected) ? selected : "all";
}

function renderCategoryOptions() {
  const selected = els.categoryFilter.value;
  const categories = [...new Set(state.events.map((event) => eventCategory(event)))].sort();
  els.categoryFilter.innerHTML = '<option value="all">全部細分類</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  }
  els.categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function getFilteredEvents() {
  const query = state.filters.search.trim().toLowerCase();
  return state.events.filter((event) => {
    const haystack = [
      event.headline,
      event.summary,
      event.city,
      event.country,
      event.venue,
      event.type,
      eventCategory(event),
      event.status,
      event.businessImpact,
      ...(event.industries || []),
      ...(event.watchlist || []),
      ...(event.mentionedCompanies || []),
      ...event.companies.flatMap((company) => [company.name, company.relationship, ...company.executives]),
      ...event.sources.flatMap((source) => [source.label, source.publisher, source.sourceType])
    ].join(" ").toLowerCase();

    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = state.filters.status === "all" || event.status === state.filters.status;
    const matchesYear = state.filters.year === "all" || event.date.startsWith(state.filters.year);
    const matchesType = state.filters.type === "all" || event.type === state.filters.type;
    const matchesCategory = state.filters.category === "all" || eventCategory(event) === state.filters.category;
    return matchesSearch && matchesStatus && matchesYear && matchesType && matchesCategory;
  });
}

function hasSpecificRoutePlace(event) {
  return Boolean(
    event?.city &&
    event?.country &&
    event.city !== "公開來源未明" &&
    event.country !== "公開來源"
  );
}

function render() {
  const filtered = getFilteredEvents();
  renderHero(filtered);
  renderMetrics();
  renderRouteOverview(filtered);
  renderStats(filtered);
  renderSourceAudit(filtered);
  renderLatestSignals();
  renderRouteMap(filtered);
  renderEvents(filtered);
  renderRelationshipGraph(filtered);
  renderInformalStops();
  renderCompanies(filtered);
  renderSources();
}

function renderHero(events = state.events) {
  const latestPublicEvent = events.find(hasSpecificRoutePlace) || events[0];
  if (!latestPublicEvent) {
    els.currentLocation.textContent = "目前沒有公開事件";
    els.currentSummary.textContent = "新增官方或媒體來源後，這裡會顯示最近一筆可公開確認的行程。";
    return;
  }

  els.currentLocation.textContent = `${latestPublicEvent.city}，${latestPublicEvent.country}`;
  els.currentSummary.textContent = `${latestPublicEvent.headline}。顯示的是公開來源中的最近事件，不代表即時位置。`;
}

function renderMetrics() {
  const companyNames = new Set(state.events.flatMap((event) => event.companies.map((company) => company.name)));
  const cityNames = new Set(state.events.filter(hasSpecificRoutePlace).map((event) => `${event.city}，${event.country}`));
  const reviewCount = state.events.filter((event) => event.status === "low-confidence" || event.status === "needs-review").length;
  els.metricEvents.textContent = state.events.length.toString();
  els.metricCities.textContent = cityNames.size.toString();
  els.metricCompanies.textContent = companyNames.size.toString();
  els.metricConfirmed.textContent = reviewCount.toString();
}

function renderRouteOverview(events) {
  els.routeChain.innerHTML = "";
  els.routeUpdated.textContent = formatGeneratedAt(state.generatedAt);
  els.filterInsight.textContent = events.length === state.events.length
    ? "目前顯示全部公開事件。"
    : `目前依篩選條件顯示 ${events.length} 筆公開事件。`;

  if (!events.length) {
    els.routeRange.textContent = "沒有符合條件的日期路線";
    els.routeChain.innerHTML = '<span class="muted-chip">無資料</span>';
    return;
  }

  const oldest = events[events.length - 1];
  const newest = events[0];
  els.routeRange.textContent = `${formatEventDate(oldest.date)} 到 ${formatEventDate(newest.date)}`;

  const cities = [];
  const seen = new Set();
  for (const event of [...events].reverse().filter(hasSpecificRoutePlace)) {
    const city = `${event.city}，${event.country}`;
    if (!seen.has(city)) {
      cities.push(city);
      seen.add(city);
    }
  }

  if (!cities.length) {
    els.routeChain.innerHTML = '<span class="muted-chip">此篩選沒有明確城市</span>';
    return;
  }

  for (const [index, city] of cities.entries()) {
    const chip = document.createElement("span");
    chip.className = "route-chip";
    chip.textContent = index === cities.length - 1 ? `${city}（最新）` : city;
    els.routeChain.append(chip);
  }
}

function renderStats(events) {
  const years = new Set(events.map((event) => event.date.slice(0, 4)));
  const countries = new Set(events.filter(hasSpecificRoutePlace).map((event) => event.country));
  const namedExecs = new Set(
    events.flatMap((event) =>
      event.companies.flatMap((company) =>
        company.executives.filter((executive) => executive !== "未指名高層" && executive !== "黃仁勳")
      )
    )
  );
  const avgConfidence = events.length
    ? Math.round(events.reduce((sum, event) => sum + event.confidence, 0) / events.length)
    : 0;

  els.statYears.textContent = years.size.toString();
  els.statCountries.textContent = countries.size.toString();
  els.statNamedExecs.textContent = namedExecs.size.toString();
  els.statAvgConfidence.textContent = `${avgConfidence}%`;
  els.statsRange.textContent = events.length
    ? `${formatEventDate(events[events.length - 1].date)} - ${formatEventDate(events[0].date)}`
    : "無資料";

  renderBars(els.yearBars, countBy(events, (event) => event.date.slice(0, 4)), "年");
  renderRanking(els.cityRanking, countBy(events.filter(hasSpecificRoutePlace), (event) => `${event.city}，${event.country}`));
  renderRanking(els.companyRanking, countBy(events.flatMap((event) => event.companies), (company) => company.name));
  renderMonthHeatmap(events);
  renderRanking(els.industryRanking, countBy(events.flatMap((event) => event.industries || []), (industry) => industry));
  renderRanking(els.mentionedRanking, countBy(events.flatMap((event) => event.mentionedCompanies || []), (company) => company));
}

function renderSourceAudit(events) {
  const profiles = events.map(sourceProfile);
  const officialCount = profiles.reduce((sum, profile) => sum + profile.official, 0);
  const mediaCount = profiles.reduce((sum, profile) => sum + profile.media, 0);
  const videoCount = profiles.reduce((sum, profile) => sum + profile.video, 0);
  const highCount = profiles.filter((profile) => profile.grade === "高可信").length;

  els.sourceOfficialCount.textContent = officialCount.toString();
  els.sourceMediaCount.textContent = mediaCount.toString();
  els.sourceVideoCount.textContent = videoCount.toString();
  els.sourceHighCount.textContent = highCount.toString();
  els.sourceAuditSummary.textContent = events.length
    ? `${events.length} 筆事件，最後查核 ${formatGeneratedAt(state.generatedAt)}`
    : "無資料";
}

function renderLatestSignals() {
  if (!els.latestSignalList) return;

  els.latestSignalList.innerHTML = "";
  const signals = state.latestSignals.slice(0, 8);
  const errorText = state.signalErrors.length ? `，${state.signalErrors.length} 個來源暫時抓取失敗` : "";
  els.latestSignalCount.textContent = `${state.latestSignals.length} 筆訊號`;
  els.latestSignalSummary.textContent = state.signalGeneratedAt
    ? `最後自動抓取 ${formatGeneratedAt(state.signalGeneratedAt)}，回看 ${state.signalLookbackDays} 天${errorText}`
    : "尚未產生自動抓取資料";

  if (!signals.length) {
    els.latestSignalList.innerHTML = '<div class="empty">目前沒有新的公開訊號。排程完成後會自動顯示在這裡。</div>';
    return;
  }

  for (const signal of signals) {
    const card = document.createElement("article");
    card.className = "latest-signal-card";
    const dates = signal.detectedDates?.length ? signal.detectedDates.join("、") : "未偵測到明確日期";
    const privacyFlags = signal.privacyReviewFlags || [];
    card.innerHTML = `
      <div class="event-topline">
        <span class="status">${escapeHtml(statusLabel(signal.status))}</span>
        <span class="category">${escapeHtml(signal.category || "公開訊號")}</span>
        <span class="confidence">可信度 ${escapeHtml(signal.confidence ?? "--")}%</span>
        ${privacyFlags.length ? '<span class="source-grade">隱私界線已標注</span>' : ""}
      </div>
      <h3><a href="${escapeAttribute(signal.url)}" target="_blank" rel="noreferrer">${escapeHtml(signal.title)}</a></h3>
      <p>${escapeHtml(signal.summary || "來源未提供摘要。")}</p>
      <div class="signal-meta">
        <span>${escapeHtml(signal.sourceName)} / ${escapeHtml(signal.sourceType)}</span>
        <span>發布 ${escapeHtml(formatSignalDate(signal.publishedAt))}</span>
        <span>偵測日期 ${escapeHtml(dates)}</span>
      </div>
      <div class="industries"></div>
      <div class="watchlist"></div>
    `;
    const reviewTags = [...(signal.matchedEventKeywords || [])];
    if (privacyFlags.length) {
      reviewTags.push(...privacyFlags.map((flag) => `標注: ${flag}`));
    }
    renderTags(card.querySelector(".industries"), "命中", signal.matchedKeywords || []);
    renderTags(card.querySelector(".watchlist"), "事件 / 標注", reviewTags);
    els.latestSignalList.append(card);
  }
}

function renderBars(container, counts, suffix) {
  container.innerHTML = "";
  const entries = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...entries.map((entry) => entry[1]));

  for (const [label, value] of entries) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${escapeHtml(label)}${suffix}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${(value / max) * 100}%"></div></div>
      <strong>${value}</strong>
    `;
    container.append(row);
  }

  if (!entries.length) {
    container.innerHTML = '<div class="empty compact">沒有統計資料。</div>';
  }
}

function renderRanking(container, counts) {
  container.innerHTML = "";
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);

  for (const [label, value] of entries) {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${value}</strong>`;
    container.append(row);
  }

  if (!entries.length) {
    container.innerHTML = '<div class="empty compact">沒有統計資料。</div>';
  }
}

function renderMonthHeatmap(events) {
  els.monthHeatmap.innerHTML = "";
  const counts = countBy(events, (event) => event.date.slice(5, 7));
  const max = Math.max(1, ...counts.values());

  for (let month = 1; month <= 12; month += 1) {
    const key = String(month).padStart(2, "0");
    const value = counts.get(key) || 0;
    const cell = document.createElement("div");
    cell.className = "heat-cell";
    cell.style.setProperty("--heat", String(value / max));
    cell.innerHTML = `<span>${month}月</span><strong>${value}</strong>`;
    els.monthHeatmap.append(cell);
  }
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function eventCategory(event) {
  if (event.type.includes("同台")) return "合作發布 / 同台";
  if (event.type.includes("線上")) return "線上演講";
  if (event.headline.includes("CES")) return "CES 主題演講";
  if (event.headline.includes("COMPUTEX") || event.headline.includes("GTC Taipei")) return "COMPUTEX / 台北";
  if (event.headline.includes("GTC")) return "GTC 主題演講";
  return event.type;
}

function sourceProfile(event) {
  const sources = event.sources || [];
  const official = sources.filter((source) => source.sourceType === "官方").length;
  const media = sources.filter((source) => source.sourceType === "媒體" || source.sourceType === "新聞彙整").length;
  const video = sources.filter((source) => /on-demand|youtube|youtu\.be|video|replay|livestream/i.test(`${source.url} ${source.label}`)).length;
  const score = Math.min(100, official * 40 + media * 18 + video * 10);
  let grade = "待查";
  if (official >= 2 || score >= 80) {
    grade = "高可信";
  } else if (official >= 1 || score >= 45) {
    grade = "可信";
  } else if (media >= 1) {
    grade = "媒體待核";
  }
  return { official, media, video, score, grade };
}

function renderEvents(events) {
  els.eventList.innerHTML = "";
  els.resultCount.textContent = `${events.length} 筆`;

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "沒有符合篩選條件的公開事件。";
    els.eventList.append(empty);
    return;
  }

  for (const event of events) {
    const card = els.eventTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".date").textContent = formatEventDate(event.date);
    card.querySelector(".time").textContent = event.time || "時間未公開";
    card.querySelector(".type").textContent = event.type;
    card.querySelector(".category").textContent = eventCategory(event);
    card.querySelector(".status").textContent = statusLabel(event.status);
    card.querySelector(".confidence").textContent = `可信度 ${event.confidence}%`;
    const profile = sourceProfile(event);
    card.querySelector(".source-grade").textContent = `${profile.grade} / 官方 ${profile.official} 媒體 ${profile.media}`;
    card.querySelector(".headline").textContent = event.headline;
    card.querySelector(".summary").textContent = event.summary;
    card.querySelector(".location").textContent = `${event.city}，${event.country}`;
    card.querySelector(".venue").textContent = event.venue;

    const companies = card.querySelector(".companies");
    for (const company of event.companies) {
      const pill = document.createElement("span");
      pill.className = "company-pill";
      pill.textContent = `${company.name}: ${company.executives.join(" / ")}`;
      companies.append(pill);
    }

    renderTags(card.querySelector(".mentioned-companies"), "演講提及", event.mentionedCompanies || []);

    card.querySelector(".business-impact").textContent = event.businessImpact || "尚未填寫商業意義。";
    renderTags(card.querySelector(".industries"), "產業", event.industries || []);
    renderTags(card.querySelector(".watchlist"), "觀察", event.watchlist || []);

    const sources = card.querySelector(".sources");
    for (const source of event.sources) {
      const link = document.createElement("a");
      link.className = "source-link";
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = `${source.publisher}: ${source.label}`;
      sources.append(link);
    }

    els.eventList.append(card);
  }
}

function renderInformalStops() {
  els.informalList.innerHTML = "";
  els.informalCount.textContent = `${state.informalStops.length} 筆公開足跡`;

  if (!state.informalStops.length) {
    els.informalList.innerHTML = '<div class="empty">目前沒有非正式公開足跡。</div>';
    return;
  }

  for (const stop of state.informalStops) {
    const card = document.createElement("article");
    card.className = "informal-card";
    card.innerHTML = `
      <div class="informal-date">
        <strong>${escapeHtml(formatEventDate(stop.date))}</strong>
        <span>${escapeHtml(stop.city)}，${escapeHtml(stop.country)}</span>
      </div>
      <div class="informal-body">
        <div class="event-topline">
          <span class="type">${escapeHtml(stop.activity)}</span>
          <span class="source-grade">${stop.privacy === "public-speech-mention" ? "公開演講提及" : "歷史公開報導"}</span>
        </div>
        <h3>${escapeHtml(stop.place)}</h3>
        <p>${escapeHtml(stop.note)}</p>
        <div class="industries"></div>
        <div class="watchlist"></div>
        <div class="sources">
          ${(stop.sources || []).map((source) => `
            <a class="source-link" href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)}: ${escapeHtml(source.label)}</a>
          `).join("")}
        </div>
      </div>
    `;
    renderTags(card.querySelector(".industries"), "吃 / 看", stop.food || []);
    renderTags(card.querySelector(".watchlist"), "同場", stop.companions || []);
    els.informalList.append(card);
  }
}

function renderRelationshipGraph(events) {
  els.relationshipGraph.innerHTML = "";
  const companies = new Map();
  const execs = new Map();

  for (const event of events) {
    for (const company of event.companies) {
      const companyNode = companies.get(company.name) || { name: company.name, count: 0, executives: new Set() };
      companyNode.count += 1;
      for (const executive of company.executives) {
        if (executive !== "黃仁勳" && executive !== "未指名高層") {
          companyNode.executives.add(executive);
          const execNode = execs.get(executive) || { name: executive, count: 0, companies: new Set() };
          execNode.count += 1;
          execNode.companies.add(company.name);
          execs.set(executive, execNode);
        }
      }
      companies.set(company.name, companyNode);
    }
  }

  const visibleCompanies = [...companies.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);
  const visibleExecs = [...execs.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);
  els.relationshipCount.textContent = `${visibleCompanies.length + visibleExecs.length + 1} 個節點`;

  const hub = document.createElement("div");
  hub.className = "graph-hub";
  hub.innerHTML = "<strong>黃仁勳</strong><span>NVIDIA</span>";
  els.relationshipGraph.append(hub);

  const companyWrap = document.createElement("div");
  companyWrap.className = "graph-column";
  companyWrap.innerHTML = "<h3>公司 / 主辦方</h3>";
  for (const company of visibleCompanies) {
    const node = document.createElement("article");
    node.className = "graph-node company-node";
    node.dataset.company = company.name;
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `查看 ${company.name} 詳情`);
    node.innerHTML = `
      <strong>${escapeHtml(company.name)}</strong>
      <span>${company.count} 次互動</span>
      <p>${escapeHtml([...company.executives].join("、") || "未指名高層 / 活動單位")}</p>
    `;
    companyWrap.append(node);
  }

  const execWrap = document.createElement("div");
  execWrap.className = "graph-column";
  execWrap.innerHTML = "<h3>具名外部高層</h3>";
  for (const executive of visibleExecs) {
    const node = document.createElement("article");
    node.className = "graph-node exec-node";
    node.innerHTML = `
      <strong>${escapeHtml(executive.name)}</strong>
      <span>${executive.count} 次公開同場</span>
      <p>${escapeHtml([...executive.companies].join("、"))}</p>
    `;
    execWrap.append(node);
  }

  if (!visibleExecs.length) {
    execWrap.innerHTML += '<div class="empty compact">目前沒有具名外部高層。</div>';
  }

  els.relationshipGraph.append(companyWrap, execWrap);
}

function renderTags(container, label, values) {
  container.innerHTML = "";
  if (!values.length) return;
  const lead = document.createElement("span");
  lead.className = "tag-label";
  lead.textContent = label;
  container.append(lead);
  for (const value of values) {
    const tag = document.createElement("span");
    tag.className = "info-tag";
    tag.textContent = value;
    container.append(tag);
  }
}

function renderRouteMap(events) {
  els.routeMap.innerHTML = "";

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "目前沒有可顯示的日期路線。";
    els.routeMap.append(empty);
    return;
  }

  for (const [index, event] of events.entries()) {
    const stop = document.createElement("article");
    stop.className = "route-stop";
    stop.innerHTML = `
      <div class="route-marker"><span>${index === 0 ? "最新" : index + 1}</span></div>
      <div class="route-content">
        <p class="route-date">${escapeHtml(formatEventDate(event.date))} ${escapeHtml(event.time || "時間未公開")}</p>
        <h3>${escapeHtml(event.city)}，${escapeHtml(event.country)}</h3>
        <p>${escapeHtml(event.headline)}</p>
        <div class="route-meta">
          <span>${escapeHtml(event.type)}</span>
          <span>${escapeHtml(statusLabel(event.status))}</span>
          <span>可信度 ${event.confidence}%</span>
        </div>
      </div>
    `;
    els.routeMap.append(stop);
  }
}

function renderCompanies(events) {
  els.companyList.innerHTML = "";
  const companies = new Map();

  for (const event of events) {
    for (const company of event.companies) {
      const current = companies.get(company.name) || {
        name: company.name,
        executives: new Set(),
        interactions: 0,
        cities: new Set()
      };
      company.executives.forEach((executive) => current.executives.add(executive));
      current.interactions += 1;
      current.cities.add(event.city);
      companies.set(company.name, current);
    }
  }

  if (!companies.size) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "目前沒有公司互動摘要。";
    els.companyList.append(empty);
    return;
  }

  for (const company of [...companies.values()].sort((a, b) => b.interactions - a.interactions)) {
    const card = document.createElement("article");
    card.className = "company-card";
    card.dataset.company = company.name;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看 ${company.name} 詳情`);
    card.innerHTML = `
      <h3>${escapeHtml(company.name)}</h3>
      <p>${company.interactions} 次公開互動，城市：${escapeHtml([...company.cities].join("、"))}</p>
      <div class="company-tags"></div>
    `;
    const tagWrap = card.querySelector(".company-tags");
    for (const executive of company.executives) {
      const tag = document.createElement("span");
      tag.className = "company-pill";
      tag.textContent = executive;
      tagWrap.append(tag);
    }
    els.companyList.append(card);
  }
}

function showCompanyDetail(companyName) {
  const events = getFilteredEvents().filter((event) =>
    event.companies.some((company) => company.name === companyName)
  );
  const executives = new Set();
  const industries = new Set();
  const sources = new Set();

  for (const event of events) {
    event.industries?.forEach((industry) => industries.add(industry));
    event.sources?.forEach((source) => sources.add(source.publisher));
    for (const company of event.companies) {
      if (company.name === companyName) {
        company.executives.forEach((executive) => executives.add(executive));
      }
    }
  }

  els.drawerTitle.textContent = companyName;
  els.drawerBody.innerHTML = `
    <div class="drawer-stats">
      <article><strong>${events.length}</strong><span>公開互動</span></article>
      <article><strong>${executives.size}</strong><span>相關高層</span></article>
      <article><strong>${industries.size}</strong><span>產業主題</span></article>
    </div>
    <div class="drawer-section">
      <h4>高層 / 角色</h4>
      <p>${escapeHtml([...executives].join("、") || "未指名高層 / 活動單位")}</p>
    </div>
    <div class="drawer-section">
      <h4>產業主題</h4>
      <p>${escapeHtml([...industries].join("、") || "無")}</p>
    </div>
    <div class="drawer-section">
      <h4>來源發布者</h4>
      <p>${escapeHtml([...sources].join("、") || "無")}</p>
    </div>
    <div class="drawer-section">
      <h4>相關事件</h4>
      <div class="drawer-events">
        ${events.map((event) => `
          <article>
            <strong>${escapeHtml(formatEventDate(event.date))}</strong>
            <span>${escapeHtml(event.headline)}</span>
            <p>${escapeHtml(event.businessImpact || event.summary)}</p>
          </article>
        `).join("")}
      </div>
    </div>
  `;
  els.companyDrawer.hidden = false;
}

function closeCompanyDetail() {
  els.companyDrawer.hidden = true;
}

function renderSources() {
  els.sourceList.innerHTML = "";
  for (const source of state.sourceBacklog) {
    const card = document.createElement("article");
    card.className = "source-card";
    card.innerHTML = `
      <h3>${escapeHtml(source.name)}</h3>
      <p>${escapeHtml(source.use)}</p>
      ${source.url ? `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.type)}來源</a>` : `<p>${escapeHtml(source.type)}來源</p>`}
    `;
    els.sourceList.append(card);
  }
}

function statusLabel(status) {
  const labels = {
    "needs-review": "待確認",
    "low-confidence": "低可信度",
    "source-only": "僅來源提及",
    "already-covered": "已收錄",
    confirmed: "已確認"
  };
  return labels[status] || status;
}

function formatGeneratedAt(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEventDate(value) {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

function formatSignalDate(value) {
  if (!value) return "未公開";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function exportFilteredJson() {
  const payload = {
    generatedAt: new Date().toISOString(),
    filters: state.filters,
    events: getFilteredEvents(),
    informalStops: state.informalStops,
    latestSignals: state.latestSignals
  };
  downloadFile("jensen-public-events.json", JSON.stringify(payload, null, 2), "application/json");
}

function exportFilteredCsv() {
  const rows = getFilteredEvents().map((event) => [
    event.date,
    event.time,
    event.city,
    event.country,
    eventCategory(event),
    event.type,
    event.headline,
    event.companies.map((company) => company.name).join(" / "),
    event.companies.flatMap((company) => company.executives).join(" / "),
    event.industries?.join(" / ") || "",
    event.watchlist?.join(" / ") || "",
    event.mentionedCompanies?.join(" / ") || "",
    sourceProfile(event).grade,
    event.confidence,
    event.sources.map((source) => source.url).join(" / ")
  ]);
  const header = ["日期", "時間", "城市", "國家", "細分類", "事件類型", "標題", "公司", "高層", "產業", "觀察名單", "演講提及公司", "來源等級", "可信度", "來源URL"];
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile("jensen-public-events.csv", csv, "text/csv;charset=utf-8");
}

function copyCurrentSummary() {
  const events = getFilteredEvents();
  const years = [...new Set(events.map((event) => event.date.slice(0, 4)))].sort().join("、") || "無";
  const topCompanies = [...countBy(events.flatMap((event) => event.companies), (company) => company.name).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} ${count} 次`)
    .join("、") || "無";
  const text = [
    "黃仁勳公開行程摘要",
    `事件數：${events.length}`,
    `年份：${years}`,
    `公司互動：${topCompanies}`,
    `資料更新：${formatGeneratedAt(state.generatedAt)}`,
    `最新公開訊號：${state.latestSignals.length} 筆，最後抓取 ${formatGeneratedAt(state.signalGeneratedAt)}`,
    "提醒：僅公開來源事件，不代表即時位置；觀察名單不是投資建議。"
  ].join("\n");

  navigator.clipboard?.writeText(text).catch(() => {
    window.prompt("複製摘要", text);
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

els.searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  state.filters.status = event.target.value;
  render();
});

els.yearFilter.addEventListener("change", (event) => {
  state.filters.year = event.target.value;
  render();
});

els.typeFilter.addEventListener("change", (event) => {
  state.filters.type = event.target.value;
  render();
});

els.categoryFilter.addEventListener("change", (event) => {
  state.filters.category = event.target.value;
  render();
});

els.refreshButton.addEventListener("click", () => {
  loadData().catch(showLoadError);
});

els.exportCsvButton.addEventListener("click", exportFilteredCsv);
els.exportJsonButton.addEventListener("click", exportFilteredJson);
els.copySummaryButton.addEventListener("click", copyCurrentSummary);
els.drawerCloseButton.addEventListener("click", closeCompanyDetail);

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-company]");
  if (target) {
    showCompanyDetail(target.dataset.company);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCompanyDetail();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-company]");
  if (target) {
    event.preventDefault();
    showCompanyDetail(target.dataset.company);
  }
});

function showLoadError(error) {
  els.currentLocation.textContent = "資料載入失敗";
  els.currentSummary.textContent = error.message;
  els.routeRange.textContent = "資料載入失敗";
  els.routeChain.innerHTML = '<span class="muted-chip">請檢查 data/events.json</span>';
  els.eventList.innerHTML = '<div class="empty">請確認 data/events.json 存在，並用本機伺服器開啟網站。</div>';
}

loadData().catch(showLoadError);
