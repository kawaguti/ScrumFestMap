# マップマーカー実装仕様書

## 1. 概要
本ドキュメントでは、Leafletを使用したマップ上のマーカー実装について説明します。
マーカーは以下の特徴を持ちます：

- Google Maps風のドロップピンデザイン
- イベントの時期による色分け（未来/過去）
- マーカーのクラスタリング機能
- 詳細情報を表示するポップアップ

## 2. 視覚的な要素

### 2.1 マーカーデザイン
マーカーはSVGベースのカスタムアイコンを使用し、以下の要素で構成されています：
- ピンヘッド（円形の上部）
- ピンテール（下部の尖った部分）

### 2.2 色分け仕様
イベントの開催時期により、以下の色分けを実装：
- 未来のイベント: プライマリーカラー
- 過去のイベント: グレースケール

### 2.3 クラスタリング表示
- 近接したマーカーは自動的にグループ化
- クラスターの数値表示
- ズームレベルに応じた動的なグループ化

## 3. 技術的な実装

### 3.1 必要なパッケージ
```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "react-leaflet-markercluster": "^3.0.0-rc1"
  }
}
```

### 3.2 マーカーの基本実装
```typescript
const marker = (
  <Marker 
    position={coordinates}
    icon={L.divIcon({
      className: 'marker-container',
      html: `
        <div class="marker-pin-google ${isFutureEvent ? 'future-event' : 'past-event'}">
          <div class="marker-head"></div>
          <div class="marker-tail"></div>
        </div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    })}
  >
    <Popup>
      {/* ポップアップコンテンツ */}
    </Popup>
  </Marker>
);
```

### 3.3 CSS スタイリング
```css
.marker-container {
  position: relative;
}

.marker-pin-google {
  width: 30px;
  height: 42px;
  position: relative;
  transform-origin: bottom;
}

.marker-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.marker-tail {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 27px;
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

/* 時期による色分け */
.future-event .marker-head,
.future-event .marker-tail {
  background-color: hsl(var(--primary));
}

.past-event .marker-head,
.past-event .marker-tail {
  background-color: hsl(var(--muted));
}
```

### 3.4 クラスタリングの設定
```typescript
<MarkerClusterGroup
  chunkedLoading
  spiderfyOnMaxZoom
  animate
  maxClusterRadius={30}
>
  {/* マーカーコンポーネント */}
</MarkerClusterGroup>
```

### 3.5 座標管理
座標は[経度, 緯度]の形式でLeaflet形式で管理：
```typescript
type Coordinates = [number, number]; // [longitude, latitude]
```

## 4. インタラクション仕様

### 4.1 マーカークリック時
- ポップアップを表示
- イベント詳細情報の表示
- 外部リンク（Webサイト、YouTube）へのアクセス

### 4.2 クラスター展開
- ズームイン時に自動展開
- スパイダー表示（重なったマーカーの放射状展開）
- アニメーション付きの展開効果

### 4.3 ポップアップ表示内容
- イベント名
- 開催地
- 開催日
- 説明文（省略可能）
- 関連リンク（イベントサイト、録画）

## 5. パフォーマンス考慮事項

### 5.1 最適化設定
- チャンクローディングの有効化
- クラスターの最大半径設定
- アイコンのキャッシュ

### 5.2 推奨設定値
- maxClusterRadius: 30px
- スパイダー表示の有効化
- アニメーション有効

## 6. 注意事項
1. アイコンのサイズはretina対応を考慮して設定
2. クラスタリングは画面内のマーカー数に応じて調整
3. ポップアップの表示位置はアイコンの高さを考慮して調整
