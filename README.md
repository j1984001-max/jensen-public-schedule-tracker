# 黃仁勳公開行程追蹤

黃仁勳公開行程追蹤網站 MVP。這個版本刻意只追蹤「公開來源可驗證」的資訊，避免變成即時私人定位或未公開會面的推測工具。

目前資料從 2022 年開始整理，包含年度事件量、城市分布、公司互動、具名外部高層與平均可信度統計。

目前功能：

- 年份、狀態、事件類型與關鍵字篩選
- 細分類篩選、月份熱度、產業主題統計
- 年度事件量、熱門城市、公司互動統計
- 公司 / 高層關係圖與公司詳情抽屜
- 演講提及公司排行，與實際同台/會面分開
- 正式場合之外的觀光 / 吃飯公開足跡
- 自動抓取最新公開訊號，顯示新聞 / 官方來源
- 每筆公開事件的商業意義、產業標籤與觀察名單
- 來源可信度稽核、CSV / JSON 匯出、摘要複製

## 開啟

這是獨立網站，所有檔案都在本資料夾內，不掛在工作區根目錄的 `index.html` 或其他 dashboard 底下。

```bash
cd "/Users/wujohnson/Documents/New project/jensen-public-schedule-tracker"
python3 server.py
```

網址：

```text
http://127.0.0.1:8787
```

## 資料格式

資料在 `data/events.json`。每筆事件包含：

- `date`, `time`, `city`, `country`, `venue`
- `type`, `status`, `confidence`
- `headline`, `summary`
- `businessImpact`: 事件的商業意義觀察
- `industries`: 產業標籤
- `watchlist`: 事件脈絡觀察名單，不是投資建議
- `mentionedCompanies`: 公開講話、投影片或報導中被提及的公司；不等於會面
- `companies`: 只放公開來源明確提及的公司與高層
- `sources`: 至少一個官方、活動頁、公司新聞稿或可信媒體來源

頂層 `informalStops` 存放正式場合之外的公開足跡：

- 夜市、餐廳、校園餐廳、觀光等已公開報導且已發生的記錄
- 必須標 `privacy`，例如 `historical-public-report` 或 `public-speech-mention`
- 不得放即時位置、住處、航班、未公開私人行程

## 目前統計

- 14 筆公開事件
- 5 筆非正式公開足跡
- 涵蓋 2022-2026
- 4 個路線城市 / 區域：線上、台北、聖荷西、拉斯維加斯
- 8 個公司或活動主辦方
- 3 位具名外部高層：Michael Dell、Roland Busch、Antonio Neri

## 自動更新

GitHub Actions 會每天 06:00（台北時間）執行 `.github/workflows/update-public-sources.yml`：

1. 讀取 `data/source_config.json`
2. 抓取官方、主辦方與 Google News RSS 公開來源
3. 產生 `data/latest_signals.json`
4. 高可信公開行程自動寫入 `data/events.json`
5. 低可信公開行程也寫入 `data/events.json`，但狀態標成 `低可信度`
6. 若內容有變化，自動 commit 回 `main`
7. GitHub Pages 重新發布外網網站

網站上的「最新公開訊號」區塊會讀取 `data/latest_signals.json`。正式時間線會自動收錄公開行程：官方/主辦方高可信來源標為「已確認」，媒體或新聞彙整來源標為「低可信度」。

自動發布仍會排除航班、住處、飯店、即時定位等不適合追蹤的資料。夜市、餐廳、觀光等已公開報導的非正式足跡可以被抓到，但會降低可信度並標注。

可在 GitHub Actions 頁面手動按 `Run workflow` 立即更新。

## 手動更新公開訊號

`update_sources.py` 會讀取 `data/source_config.json`，抓公開來源頁面並輸出最新公開訊號；高可信資料會自動進正式時間線，低可信資料會標注。

```bash
cd "/Users/wujohnson/Documents/New project/jensen-public-schedule-tracker"
python3 update_sources.py
```

輸出：

```text
data/latest_signals.json
data/candidate_events.json
```

`data/candidate_events.json` 保留給除錯與追蹤來源命中狀況；正式網站主要讀 `data/events.json` 與 `data/latest_signals.json`。

## 安全規則

- 只收官方活動頁、NVIDIA/公司新聞稿、公開議程、公開媒體報導。
- 不收航班、住址、飯店、私人聚會、偷拍、即時定位、未公開會面推測。
- 非正式足跡只收已公開報導、已發生的歷史記錄；不得做即時追蹤。
- 「演講提及公司」只代表公開講話中被點名，不等於黃仁勳與該公司高層會面。
- UI 顯示「最近公開事件」，不要標成「現在位置」。
- 觀察名單只表示事件脈絡，不是投資建議或買賣建議。
- 高可信度公開來源直接標 `confirmed`；低可信度公開來源標 `low-confidence`。

## 下一步

1. 為自動事件加入更精準的城市、會場與公司高層抽取。
2. 增加來源去重與同一事件多來源合併。
3. 加上「只看高可信 / 包含低可信」的快速切換。
