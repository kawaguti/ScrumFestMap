# スクラムフェスマップ マークダウン仕様書

## 1. ファイル構造

### 1.1 ファイルヘッダー
```markdown
---
# イベント一覧

作成日時: YYYY年MM月DD日 HH:mm

---
```

- ヘッダーは3つのハイフン(`---`)で囲む
- 作成日時は `YYYY年MM月DD日 HH:mm` 形式で記載
- 作成日時の後に空行を入れ、再度3つのハイフンで区切る

### 1.2 イベントエントリー
各イベントは以下の形式で記載：

```markdown
## [イベント名]

- 開催地: [都道府県名]
- 座標: `[経度, 緯度]` (Leaflet形式)
- 開催日: YYYY年MM月DD日(曜日)
- 説明:
  [イベントの説明文]
- Webサイト: [URL]
- 録画一覧: [URL] (オプション)

---
```

## 2. フィールド仕様

### 2.1 必須フィールド
- イベント名 (##で始まる見出し)
- 開催地 (都道府県名)
- 座標 (Leaflet形式の座標)
- 開催日
- 説明文
- Webサイト

### 2.2 オプションフィールド
- 録画一覧 (YouTubeプレイリストなど)

### 2.3 フィールド詳細

#### イベント名
- 2階層の見出し(`##`)で記載
- 日本語名と英語名がある場合は `|` または `/` で区切る
```markdown
## スクラムフェス東京 | Scrum Fest Tokyo 2024
```

#### 開催地
- 都道府県名のみを記載
- 「県」「府」「都」を含める
```markdown
- 開催地: 東京都
```

#### 座標
- Leaflet形式の座標を使用
- バッククォート(`)で囲む
- 配列形式で`[経度, 緯度]`の順
```markdown
- 座標: `[139.691706, 35.689488]` (Leaflet形式)
```

#### 開催日
- YYYY年MM月DD日(曜日)形式
- 曜日は漢字1文字
```markdown
- 開催日: 2024年01月08日(水)
```

#### 説明文
- 複数行の場合はインデントして記載
- 空行を含む場合も全体をインデント
```markdown
- 説明:
  1行目の説明文
  
  2行目の説明文
```

#### Webサイト・録画一覧
- 完全なURL（https://を含む）
```markdown
- Webサイト: https://example.com/
- 録画一覧: https://www.youtube.com/playlist?list=xxx
```

## 3. フォーマットルール

### 3.1 区切り線
- 各イベントエントリーの末尾に区切り線(`---`)を入れる
- 最後のエントリーにも区切り線を入れる

### 3.2 インデント
- 説明文の複数行は2スペースでインデント
- リストの項目は半角ハイフン(`-`)の後にスペースを入れる

### 3.3 空行
- イベント名と最初のフィールドの間に空行を入れない
- イベントエントリー間には区切り線を入れる
- 説明文の段落間には空行を入れる

## 4. 実装例

```markdown
---
# イベント一覧

作成日時: 2024年12月20日 14:30

---

## Regional Scrum Gathering Tokyo 2025

- 開催地: 東京都
- 座標: `[139.691706, 35.689488]` (Leaflet形式)
- 開催日: 2025年01月08日(水)
- 説明:
  Regional Scrum Gathering Tokyo 2025は、東京で行われるRegional Gatheringとして14回目になります。運営母体である一般社団法人スクラムギャザリング東京実行委員会は、スクラムを実践する人が集い垣根を超えて語り合う場を提供するという目的によりコミットしています。

  Regional Scrum Gathering Tokyo 2024 is a 13th annual Regional Gathering held in Tokyo, organized by a non profit organization "Scrum Tokyo". Our purpose is to provide a "Ba" (place) where practitioners share ideas among Scrum practitioners having a great diversity.
- Webサイト: https://2025.scrumgatheringtokyo.org/

---

## スクラムフェス沖縄 | Scrum Fest Okinawa 2024

- 開催地: 沖縄県
- 座標: `[127.680932, 26.212401]` (Leaflet形式)
- 開催日: 2024年12月13日(金)
- 説明:
  スクラムフェス沖縄はアジャイルコミュニティの祭典です。

  ・アジャイル開発をこれから始めようという人
  ・とりあえずやっているけど、これで良いのか悩んでいる人
  ・より良いソフトウェア開発・運用のやり方を探している人
  ・チームや組織の人間関係を良くしたいと思っている人
  ・アジャイル開発に取り組む仲間が欲しい人

  立場の異なる様々な人々が集まり、交流を通してアジャイルについての学びや気づきを得られる場です。
- Webサイト: https://www.scrumfestokinawa.org/
- 録画一覧: https://www.youtube.com/playlist?list=PL-bvtmk0kdw7TR2Ok5t8-uKU_jp1Wyovq

---
```
