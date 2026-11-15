export type GridSize = 3 | 4 | 5;
export type GameMode = 'TURN_BASED' | 'HOST_DRAW';
export type RoomPhase = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface RoomSettings {
  gridSize: GridSize;
  maxNumber: number;
  targetLines: number;
  maxPlayers: number;
  mode: GameMode;
  prize: string;
  freeCenter: boolean;
}

export interface BingoLine {
  key: string;
  type: 'row' | 'col' | 'diag';
  index: number;
  cells: number[];
}

export interface PublicPlayerInfo {
  id: string;
  ipLabel: string;
  nickname: string;
  avatarColor: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  board: number[] | null;
  completedLinesCount: number;
  completedLineKeys: string[];
  completedCells: number[];
}

export interface RoundWinnerRecord {
  round: number;
  prize: string;
  winners: { id: string; nickname: string; lines: number }[];
  finishedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean;
  timestamp: number;
}

export interface PublicRoomState {
  code: string;
  hostId: string;
  phase: RoomPhase;
  round: number;
  settings: RoomSettings;
  players: PublicPlayerInfo[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  lastCalledBy: string | null;
  currentTurnPlayerId: string | null;
  winnerIds: string[];
  history: RoundWinnerRecord[];
  chatMessages: ChatMessage[];
}

export const PRIZE_PRESETS: string[] = [
  '☕ 아이스 아메리카노 1잔',
  '🍗 치킨 한 마리 쏘기',
  '🍰 달콤한 조각 케이크',
  '🧹 오늘 설거지 면제권',
  '🍦 편의점 아이스크림',
  '👑 왕의 소원 들어주기',
];

export const AVATAR_COLORS: string[] = [
  '#F43F5E',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export const CUTE_NICKNAMES: string[] = [
  '행운의 토끼',
  '반짝이는 시바',
  '꿀잠자는 판다',
  '용감한 쿼카',
  '딸기맛 고양이',
  '포근한 알파카',
  '총총이 햄스터',
  '럭키 오리',
  '달콤한 곰돌이',
  '별빛 여우',
];

export const BOT_NICKNAMES: string[] = [
  '알파빙고 봇',
  '똑똑이 봇',
  '럭키칩 봇',
  '꼬마로봇 코코',
  '빙고마스터 봇',
  '포포 AI',
  '삐삐 AI',
  '별별 AI',
];

export function getMaxPossibleLines(gridSize: GridSize): number {
  return gridSize * 2 + 2;
}

export function getMinRequiredNumbers(gridSize: GridSize, freeCenter: boolean): number {
  const totalCells = gridSize * gridSize;
  const hasFree = freeCenter && gridSize % 2 === 1;
  return hasFree ? totalCells - 1 : totalCells;
}

export function getDefaultSettings(): RoomSettings {
  return {
    gridSize: 5,
    maxNumber: 25,
    targetLines: 3,
    maxPlayers: 6,
    mode: 'TURN_BASED',
    prize: '☕ 아이스 아메리카노 1잔',
    freeCenter: false,
  };
}

export function clampSettings(
  input: Partial<RoomSettings>,
  prev: RoomSettings,
  minPlayersAllowed = 2
): RoomSettings {
  const gridSize: GridSize =
    input.gridSize === 3 || input.gridSize === 4 || input.gridSize === 5 ? input.gridSize : prev.gridSize;
  const freeCenter = gridSize % 2 === 1 ? Boolean(input.freeCenter ?? prev.freeCenter) : false;
  const minNums = getMinRequiredNumbers(gridSize, freeCenter);
  const rawMax = typeof input.maxNumber === 'number' && Number.isFinite(input.maxNumber)
    ? Math.floor(input.maxNumber)
    : prev.maxNumber;
  const maxNumber = Math.max(minNums, Math.min(99, rawMax));
  const maxLines = getMaxPossibleLines(gridSize);
  const rawTarget = typeof input.targetLines === 'number' && Number.isFinite(input.targetLines)
    ? Math.floor(input.targetLines)
    : prev.targetLines;
  const targetLines = Math.max(1, Math.min(maxLines, rawTarget));
  const rawMaxPlayers = typeof input.maxPlayers === 'number' && Number.isFinite(input.maxPlayers)
    ? Math.floor(input.maxPlayers)
    : prev.maxPlayers;
  const maxPlayers = Math.max(Math.max(2, minPlayersAllowed), Math.min(12, rawMaxPlayers));
  const mode: GameMode =
    input.mode === 'TURN_BASED' || input.mode === 'HOST_DRAW' ? input.mode : prev.mode;
  const rawPrize = typeof input.prize === 'string' ? input.prize.trim().slice(0, 40) : prev.prize;
  const prize = rawPrize.length > 0 ? rawPrize : '🎁 행운의 1등 경품';

  return {
    gridSize,
    maxNumber,
    targetLines,
    maxPlayers,
    mode,
    prize,
    freeCenter,
  };
}

export function generateRandomBoard(
  gridSize: GridSize,
  maxNumber: number,
  freeCenter: boolean
): number[] {
  const totalCells = gridSize * gridSize;
  const hasFree = freeCenter && gridSize % 2 === 1;
  const centerIndex = hasFree ? Math.floor(totalCells / 2) : -1;
  const safeMax = Math.max(getMinRequiredNumbers(gridSize, freeCenter), Math.min(99, maxNumber));

  const pool: number[] = [];
  for (let n = 1; n <= safeMax; n++) {
    pool.push(n);
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const board: number[] = [];
  let cursor = 0;
  for (let idx = 0; idx < totalCells; idx++) {
    if (idx === centerIndex) {
      board.push(0);
    } else {
      board.push(pool[cursor++]);
    }
  }
  return board;
}

export function generateSequentialBoard(
  gridSize: GridSize,
  maxNumber: number,
  freeCenter: boolean
): number[] {
  const totalCells = gridSize * gridSize;
  const hasFree = freeCenter && gridSize % 2 === 1;
  const centerIndex = hasFree ? Math.floor(totalCells / 2) : -1;
  const safeMax = Math.max(getMinRequiredNumbers(gridSize, freeCenter), maxNumber);

  const board: number[] = [];
  let current = 1;
  for (let idx = 0; idx < totalCells; idx++) {
    if (idx === centerIndex) {
      board.push(0);
    } else {
      board.push(Math.min(safeMax, current++));
    }
  }
  return board;
}

export function validateBoard(
  board: unknown,
  gridSize: GridSize,
  maxNumber: number,
  freeCenter: boolean
): board is number[] {
  if (!Array.isArray(board)) return false;
  const totalCells = gridSize * gridSize;
  if (board.length !== totalCells) return false;

  const hasFree = freeCenter && gridSize % 2 === 1;
  const centerIndex = hasFree ? Math.floor(totalCells / 2) : -1;
  const seen = new Set<number>();

  for (let i = 0; i < totalCells; i++) {
    const val = board[i];
    if (typeof val !== 'number' || !Number.isInteger(val)) return false;
    if (i === centerIndex) {
      if (val !== 0) return false;
      continue;
    }
    if (val < 1 || val > maxNumber) return false;
    if (seen.has(val)) return false;
    seen.add(val);
  }
  return true;
}

export function evaluateBoard(
  board: number[],
  calledSet: Set<number>,
  gridSize: GridSize,
  freeCenter: boolean
): {
  completedLines: BingoLine[];
  lineKeys: string[];
  completedCells: number[];
} {
  const totalCells = gridSize * gridSize;
  if (board.length !== totalCells) {
    return { completedLines: [], lineKeys: [], completedCells: [] };
  }

  const hasFree = freeCenter && gridSize % 2 === 1;
  const centerIndex = hasFree ? Math.floor(totalCells / 2) : -1;

  const isMarked = (idx: number): boolean => {
    if (idx === centerIndex) return true;
    return calledSet.has(board[idx]);
  };

  const lines: BingoLine[] = [];

  // Rows
  for (let r = 0; r < gridSize; r++) {
    const cells: number[] = [];
    let allMarked = true;
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      cells.push(idx);
      if (!isMarked(idx)) allMarked = false;
    }
    if (allMarked) {
      lines.push({ key: `row-${r}`, type: 'row', index: r, cells });
    }
  }

  // Columns
  for (let c = 0; c < gridSize; c++) {
    const cells: number[] = [];
    let allMarked = true;
    for (let r = 0; r < gridSize; r++) {
      const idx = r * gridSize + c;
      cells.push(idx);
      if (!isMarked(idx)) allMarked = false;
    }
    if (allMarked) {
      lines.push({ key: `col-${c}`, type: 'col', index: c, cells });
    }
  }

  // Main diagonal
  const diag1: number[] = [];
  let diag1Marked = true;
  for (let i = 0; i < gridSize; i++) {
    const idx = i * gridSize + i;
    diag1.push(idx);
    if (!isMarked(idx)) diag1Marked = false;
  }
  if (diag1Marked) {
    lines.push({ key: 'diag-0', type: 'diag', index: 0, cells: diag1 });
  }

  // Anti-diagonal
  const diag2: number[] = [];
  let diag2Marked = true;
  for (let i = 0; i < gridSize; i++) {
    const idx = i * gridSize + (gridSize - 1 - i);
    diag2.push(idx);
    if (!isMarked(idx)) diag2Marked = false;
  }
  if (diag2Marked) {
    lines.push({ key: 'diag-1', type: 'diag', index: 1, cells: diag2 });
  }

  const completedCellSet = new Set<number>();
  for (const line of lines) {
    for (const cellIdx of line.cells) {
      completedCellSet.add(cellIdx);
    }
  }

  return {
    completedLines: lines,
    lineKeys: lines.map((l) => l.key),
    completedCells: Array.from(completedCellSet),
  };
}

export function chooseSmartBotNumber(
  board: number[],
  calledNumbers: number[],
  gridSize: GridSize,
  maxNumber: number,
  freeCenter: boolean
): number | null {
  const calledSet = new Set(calledNumbers);
  const totalCells = gridSize * gridSize;
  const hasFree = freeCenter && gridSize % 2 === 1;
  const centerIndex = hasFree ? Math.floor(totalCells / 2) : -1;

  const lineIndexGroups: number[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: number[] = [];
    for (let c = 0; c < gridSize; c++) row.push(r * gridSize + c);
    lineIndexGroups.push(row);
  }
  for (let c = 0; c < gridSize; c++) {
    const col: number[] = [];
    for (let r = 0; r < gridSize; r++) col.push(r * gridSize + c);
    lineIndexGroups.push(col);
  }
  const d1: number[] = [];
  const d2: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    d1.push(i * gridSize + i);
    d2.push(i * gridSize + (gridSize - 1 - i));
  }
  lineIndexGroups.push(d1, d2);

  const cellScores = new Map<number, number>();
  for (const group of lineIndexGroups) {
    const uncalledInLine = group.filter((idx) => {
      if (idx === centerIndex) return false;
      const val = board[idx];
      return val > 0 && !calledSet.has(val);
    });
    if (uncalledInLine.length === 0) continue;
    const weight = uncalledInLine.length === 1 ? 100 : 10 / (uncalledInLine.length * uncalledInLine.length);
    for (const idx of uncalledInLine) {
      cellScores.set(idx, (cellScores.get(idx) ?? 0) + weight);
    }
  }

  let bestScore = -1;
  let bestNumbers: number[] = [];
  for (const [idx, score] of cellScores.entries()) {
    const val = board[idx];
    if (score > bestScore) {
      bestScore = score;
      bestNumbers = [val];
    } else if (score === bestScore) {
      bestNumbers.push(val);
    }
  }

  if (bestNumbers.length > 0) {
    return bestNumbers[Math.floor(Math.random() * bestNumbers.length)];
  }

  // Fallback if all numbers on bot board are somehow already called
  for (let n = 1; n <= maxNumber; n++) {
    if (!calledSet.has(n)) return n;
  }
  return null;
}
