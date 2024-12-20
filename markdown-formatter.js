const formatMarkdown = (events) => {
  return events.map(event => {
    // ヘッダー
    let markdown = `# ${event.title}\n\n`;
    
    // メタ情報
    markdown += [
      `- 開催地: ${event.location}`,
      `- 座標: \`${event.coordinates}\``,
      `- 開催日: ${event.date}`,
      ''
    ].join('\n');
    
    // 説明文の処理
    const description = event.description.trim();
    
    // 1. 空行で分割して段落を作る
    const paragraphs = description.split(/\n\s*\n/);
    
    // 2. 各段落内の改行を処理
    const formattedParagraphs = paragraphs.map(para => {
      // 箇条書きの場合は改行を維持
      if (para.includes('\n- ')) {
        return para;
      }
      // 通常の段落は1行にまとめる
      return para.replace(/\s*\n\s*/g, ' ').trim();
    });
    
    // 3. 段落間に空行を入れて結合
    markdown += formattedParagraphs.join('\n\n');
    
    // リンク情報
    if (event.website) {
      markdown += `\n\n- Webサイト: ${event.website}`;
    }
    if (event.recordings) {
      markdown += `\n- 録画一覧: ${event.recordings}`;
    }
    
    markdown += '\n\n---\n\n';
    return markdown;
  }).join('');
};

// 使用例
const sampleEvent = {
  title: 'スクラムフェス東京2024',
  location: '東京都',
  coordinates: '[139.7673068, 35.6809591]',
  date: '2024年1月15日(月)',
  description: `スクラムフェス東京はアジャイルコミュニティの祭典です。

このイベントでは以下のような特徴があります：
- 初心者からエキスパートまで参加可能
- 様々な立場の方との交流
- 実践的な知識の共有

私たちは、ソフトウェア開発における
技術的な側面だけでなく、
人とチームの成長にも
焦点を当てています。`,
  website: 'https://example.com/scrumfest-tokyo',
  recordings: 'https://example.com/recordings'
};

console.log(formatMarkdown([sampleEvent]));