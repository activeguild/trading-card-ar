// components/cardEffect/edgeMap.ts
// 画像のアルファチャンネルから距離マップ（SDF）を生成する

/**
 * 画像のアルファ境界からの距離マップを生成
 * 不透明部分の輪郭からの距離を0〜1で正規化したグレースケール画像を返す
 * 境界=0（白）、遠い=1（黒）
 */
export function generateEdgeMap(
  image: HTMLImageElement,
  width: number,
  height: number,
  maxDistance: number = 40,
): ImageData {
  // 画像をCanvasに描画してピクセルデータを取得
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(image, 0, 0, width, height);
  const srcData = srcCtx.getImageData(0, 0, width, height);

  // アルファチャンネルのバイナリマスク（不透明=true）
  const opaque = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    opaque[i] = srcData.data[i * 4 + 3] > 128 ? 1 : 0;
  }

  // 境界ピクセルを検出（不透明で隣接に透明があるピクセル）
  const isBorder = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!opaque[idx]) continue;
      // 4近傍をチェック
      if (
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        !opaque[idx - 1] || !opaque[idx + 1] ||
        !opaque[idx - width] || !opaque[idx + width]
      ) {
        isBorder[idx] = 1;
      }
    }
  }

  // BFS（幅優先探索）で各ピクセルから最寄りの境界までの距離を計算
  const dist = new Float32Array(width * height).fill(Infinity);
  const queue: number[] = [];

  for (let i = 0; i < width * height; i++) {
    if (isBorder[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  // BFSで近似距離を計算（高速化のためマンハッタン距離ベース）
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    const d = dist[idx];

    if (d >= maxDistance) continue;

    const neighbors = [
      // 4近傍
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
    ];

    for (const nIdx of neighbors) {
      if (nIdx >= 0 && dist[nIdx] > d + 1) {
        dist[nIdx] = d + 1;
        queue.push(nIdx);
      }
    }
  }

  // 距離を0〜1に正規化してImageDataに変換
  // 境界に近い=値が高い（白）、遠い=値が低い（黒）
  const output = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const normalized = Math.max(0, 1 - dist[i] / maxDistance);
    const v = Math.round(normalized * 255);
    output.data[i * 4] = v;
    output.data[i * 4 + 1] = v;
    output.data[i * 4 + 2] = v;
    output.data[i * 4 + 3] = 255;
  }

  return output;
}
