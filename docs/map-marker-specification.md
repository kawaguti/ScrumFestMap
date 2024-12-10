# マーカーとポップアップの詳細仕様書

## 1. マーカーの基本仕様

### 1.1 マーカーコンテナ
```css
.marker-container {
  position: relative;
  /* マーカーの基準点を設定 - アニメーションの中心点 */
  transform-origin: center bottom;
  /* クリック領域の最適化 */
  cursor: pointer;
  /* z-indexの管理 - マーカーを他の要素より前面に */
  z-index: 1000;  /* 通常のマーカー */
  z-index: 1100;  /* ホバー時 */
  z-index: 1200;  /* アクティブ時 */
  /* マーカーのサイズを保持 */
  width: 30px;
  height: 42px;
  /* マーカーの位置を微調整 */
  margin-left: -15px;  /* width/2 でセンタリング */
  margin-top: -42px;   /* height でオフセット */
}
```

### 1.2 実装におけるHTML構造
```html
<div class="marker-container">
  <div class="marker-pin-google">
    <div class="marker-head"></div>
    <div class="marker-tail"></div>
  </div>
</div>
```

### 1.2 Googleマップ型マーカー
```css
.marker-pin-google {
  width: 30px;      /* マーカー全体の幅 */
  height: 42px;     /* マーカー全体の高さ */
  position: relative;
  transform-origin: bottom;  /* アニメーションの基準点 */
}

/* マーカーヘッド（円形部分） */
.marker-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;      /* 円形部分の直径 */
  height: 20px;     /* 円形部分の直径 */
  border-radius: 50%;
  /* 影の追加による立体感 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* マーカーテール（三角形部分） */
.marker-tail {
  position: absolute;
  top: 15px;        /* ヘッドとの位置調整 */
  left: 50%;
  transform: translateX(-50%);
  width: 12px;      /* 三角形の基底幅 */
  height: 27px;     /* 三角形の高さ */
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  /* 影の追加による立体感 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### 1.3 イベント状態による色分け
```css
/* 未来のイベント */
.future-event .marker-head,
.future-event .marker-tail {
  background-color: hsl(var(--primary));
  /* アクティブな状態を示す明るい色 */
}

/* 過去のイベント */
.past-event .marker-head,
.past-event .marker-tail {
  background-color: hsl(var(--muted));
  /* 非アクティブな状態を示す暗い色 */
}
```

### 1.4 ホバー・アクティブ状態とアニメーション
```css
/* アニメーションの基本設定 */
.marker-pin-google {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;  /* パフォーマンス最適化 */
}

/* ホバー時のアニメーション */
.marker-pin-google:hover {
  transform: scale(1.1) translateY(-2px);  /* 少し上に浮かせる */
  transition: all 0.2s ease-out;
}

/* クリック時のアニメーション */
.marker-pin-google:active {
  transform: scale(0.95) translateY(1px);  /* 少し下げる */
  transition: all 0.1s ease-out;
}

/* マーカーのドロップシャドウアニメーション */
.marker-head,
.marker-tail {
  transition: box-shadow 0.2s ease-out;
}

.marker-pin-google:hover .marker-head {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.25);
}

.marker-pin-google:hover .marker-tail {
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.15);
}
```

## 2. ポップアップの表示仕様

### 2.1 基本位置
- マーカーの上部に表示
- マーカーの中心から12px上部にオフセット
- 最小幅: 200px
- 最大幅: 300px

### 2.2 ポップアップのスタイル
```css
.leaflet-popup-content-wrapper {
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  background: white;
}

.leaflet-popup-tip {
  /* 吹き出しの矢印部分 */
  width: 12px;
  height: 12px;
  margin-top: -6px;  /* マーカーとの位置調整 */
}
```

### 2.3 レスポンシブ対応
- モバイル表示時（画面幅768px以下）:
  - ポップアップ最大幅: 250px
  - フォントサイズ: 14px
- デスクトップ表示時:
  - ポップアップ最大幅: 300px
  - フォントサイズ: 16px

### 2.4 表示優先順位
- 複数マーカーが重なった場合:
  1. アクティブ（クリックされた）マーカーのポップアップ
  2. 未来のイベントのポップアップ
  3. 過去のイベントのポップアップ

## 3. クラスタリング時の表示

### 3.1 クラスターマーカー
```css
.marker-cluster {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(
    45deg,
    hsl(var(--primary)) 0%,
    hsl(var(--primary-foreground)) 100%
  );
  color: white;
  text-align: center;
  line-height: 40px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* イベント数が多い場合のスタイル */
.marker-cluster-large {
  width: 50px;
  height: 50px;
  line-height: 50px;
  font-size: 16px;
}
```

### 3.2 クラスター展開時のアニメーション
```css
.marker-cluster {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.marker-cluster-expanding {
  animation: cluster-expand 0.3s ease-out forwards;
}

@keyframes cluster-expand {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
```

### 3.3 アクセシビリティ対応
- スクリーンリーダー用のARIAラベル
```html
<div 
  role="button" 
  aria-label="イベントクラスター: この地域に5件のイベントがあります"
  class="marker-cluster"
>
  5
</div>
```

### 3.4 レスポンシブ対応
```css
/* モバイル（〜767px） */
@media (max-width: 767px) {
  .marker-container {
    transform-origin: center bottom;
  }
  
  .marker-cluster {
    width: 36px;
    height: 36px;
    line-height: 36px;
    font-size: 13px;
  }
}

/* タブレット（768px〜1023px） */
@media (min-width: 768px) and (max-width: 1023px) {
  .marker-cluster {
    width: 38px;
    height: 38px;
    line-height: 38px;
  }
}

/* デスクトップ（1024px〜） */
@media (min-width: 1024px) {
  .marker-cluster {
    width: 40px;
    height: 40px;
    line-height: 40px;
  }
}
```