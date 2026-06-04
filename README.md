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

## 更新來源候選資料

`update_sources.py` 會讀取 `data/source_config.json`，抓公開來源頁面並輸出待審核候選資料。它不會自動改 `data/events.json`。

```bash
cd "/Users/wujohnson/Documents/New project/jensen-public-schedule-tracker"
python3 update_sources.py
```

輸出：

```text
data/candidate_events.json
```

候選資料人工確認後，才整理成正式事件。

## 安全規則

- 只收官方活動頁、NVIDIA/公司新聞稿、公開議程、公開媒體報導。
- 不收航班、住址、飯店、私人聚會、偷拍、即時定位、未公開會面推測。
- 非正式足跡只收已公開報導、已發生的歷史記錄；不得做即時追蹤。
- 「演講提及公司」只代表公開講話中被點名，不等於黃仁勳與該公司高層會面。
- UI 顯示「最近公開事件」，不要標成「現在位置」。
- 觀察名單只表示事件脈絡，不是投資建議或買賣建議。
- 低可信度資料先標 `needs-review`，人工確認後才改 `confirmed`。

## 下一步

1. 把 `candidate_events.json` 做成後台審核 UI。
2. 為候選事件加入日期、城市、公司、高層的半自動抽取。
3. 部署版加入人工審核流程，避免錯誤或侵犯隱私的資訊直接上線。
