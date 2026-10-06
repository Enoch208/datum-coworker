export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];

export interface RgbaImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

type Homography = readonly number[];

const solveLinear = (matrix: number[][], values: number[]): number[] => {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index] ?? 0]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(rows[row]?.[pivot] ?? 0) > Math.abs(rows[best]?.[pivot] ?? 0)) best = row;
    }
    const swap = rows[pivot] ?? [];
    rows[pivot] = rows[best] ?? [];
    rows[best] = swap;
    const lead = rows[pivot] ?? [];
    for (let row = 0; row < size; row += 1) {
      const current = rows[row] ?? [];
      if (row === pivot) continue;
      const factor = (current[pivot] ?? 0) / (lead[pivot] ?? 1);
      for (let column = pivot; column <= size; column += 1) {
        current[column] = (current[column] ?? 0) - factor * (lead[column] ?? 0);
      }
    }
  }
  return rows.map((row, index) => (row[size] ?? 0) / (row[index] ?? 1));
};

const homography = (from: Quad, to: Quad): Homography => {
  const matrix: number[][] = [];
  const values: number[] = [];
  from.forEach(([x, y], index) => {
    const [u, v] = to[index] ?? [0, 0];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  });
  return [...solveLinear(matrix, values), 1];
};

const project = (h: Homography, x: number, y: number): Point => {
  const at = (index: number) => h[index] ?? 0;
  const w = at(6) * x + at(7) * y + at(8);
  return [(at(0) * x + at(1) * y + at(2)) / w, (at(3) * x + at(4) * y + at(5)) / w];
};

const corners = (width: number, height: number): Quad => [
  [0, 0],
  [width, 0],
  [width, height],
  [0, height],
];

export function warpPerspective(image: RgbaImage, target: Quad): RgbaImage {
  const { width, height, data } = image;
  const inverse = homography(target, corners(width, height));
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [sx, sy] = project(inverse, x + 0.5, y + 0.5);
      const column = Math.floor(sx);
      const row = Math.floor(sy);
      if (column < 0 || row < 0 || column >= width || row >= height) continue;
      data.copy(
        out,
        (y * width + x) * 4,
        (row * width + column) * 4,
        (row * width + column) * 4 + 4,
      );
    }
  }
  return { data: out, width, height };
}

export const tiltedQuad = (width: number, height: number, strength: number): Quad => [
  [width * strength, height * strength * 0.3],
  [width * (1 - strength * 0.4), 0],
  [width, height],
  [0, height * (1 - strength * 0.2)],
];
