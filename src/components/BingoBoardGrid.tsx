import { useState } from 'react';
import { Check, GripVertical, Star } from 'lucide-react';
import type { GridSize } from '../shared/bingo.ts';

interface BingoBoardGridProps {
  board: number[];
  gridSize: GridSize;
  calledNumbers: number[];
  completedCells: number[];
  completedLineKeys?: string[];
  lastCalledNumber: number | null;
  editable?: boolean;
  selectedIndex?: number | null;
  pendingNumber?: number | null;
  canCallFromBoard?: boolean;
  onCellClick?: (index: number, value: number) => void;
  onSwapCells?: (fromIndex: number, toIndex: number) => void;
}

function getCellCenterPct(index: number, gridSize: number): number {
  // Accounts for ~3.5% gap between tiles inside the relative grid wrapper
  const gapRatio = 0.035;
  const totalUnits = gridSize + (gridSize - 1) * gapRatio;
  const centerUnit = index * (1 + gapRatio) + 0.5;
  return (centerUnit / totalUnits) * 100;
}

function getLineCoordinates(
  lineKey: string,
  gridSize: GridSize
): { x1: number; y1: number; x2: number; y2: number } | null {
  const [type, idxStr] = lineKey.split('-');
  const idx = Number(idxStr);
  if (Number.isNaN(idx)) return null;

  const start = getCellCenterPct(0, gridSize);
  const end = getCellCenterPct(gridSize - 1, gridSize);

  if (type === 'row') {
    const y = getCellCenterPct(idx, gridSize);
    return { x1: start, y1: y, x2: end, y2: y };
  }
  if (type === 'col') {
    const x = getCellCenterPct(idx, gridSize);
    return { x1: x, y1: start, x2: x, y2: end };
  }
  if (type === 'diag' && idx === 0) {
    return { x1: start, y1: start, x2: end, y2: end };
  }
  if (type === 'diag' && idx === 1) {
    return { x1: end, y1: start, x2: start, y2: end };
  }
  return null;
}

export function BingoBoardGrid({
  board,
  gridSize,
  calledNumbers,
  completedCells,
  completedLineKeys = [],
  lastCalledNumber,
  editable = false,
  selectedIndex = null,
  pendingNumber = null,
  canCallFromBoard = false,
  onCellClick,
  onSwapCells,
}: BingoBoardGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const calledSet = new Set(calledNumbers);
  const completedCellSet = new Set(completedCells);

  const gridColsClass =
    gridSize === 3 ? 'grid-cols-3' : gridSize === 4 ? 'grid-cols-4' : 'grid-cols-5';

  const textSizeClass =
    gridSize === 3
      ? 'text-3xl sm:text-4xl'
      : gridSize === 4
        ? 'text-2xl sm:text-3xl'
        : 'text-xl sm:text-2xl';

  return (
    <div className="rounded-3xl border border-[#E5E1D8] bg-[#F3F1EB] p-3 sm:p-4">
      <div
        className={`relative grid ${gridColsClass} gap-2 sm:gap-2.5`}
        role="grid"
        aria-label={`${gridSize}x${gridSize} 빙고판`}
      >
        {board.map((num, idx) => {
          const isFree = num === 0;
          const isCalled = isFree || calledSet.has(num);
          const isLineCompleted = completedCellSet.has(idx);
          const isJustCalled = !isFree && num === lastCalledNumber;
          const isSelectedForSwap = editable && selectedIndex === idx;
          const isPendingChoice = !editable && !isFree && !isCalled && pendingNumber === num;
          const isDraggable = editable && !isFree;
          const isDragOver = editable && !isFree && dragOverIndex === idx && draggedIndex !== idx;
          const isBeingDragged = editable && draggedIndex === idx;
          const isClickable =
            (editable && !isFree) || (canCallFromBoard && !isFree && !isCalled);

          let cellStyle =
            'border-[#DED9CE] border-b-4 bg-[#FFFFFF] text-[#1F2937]';

          if (isDragOver) {
            cellStyle =
              'border-[#F43F5E] border-b-4 bg-[#FFE4E6] text-[#BE123C] ring-2 ring-[#F43F5E] scale-[1.03]';
          } else if (isSelectedForSwap) {
            cellStyle =
              'border-[#F59E0B] border-b-4 bg-[#FEF3C7] text-[#92400E] ring-2 ring-[#F59E0B]';
          } else if (isPendingChoice) {
            cellStyle =
              'border-[#D97706] border-b-4 bg-[#FEF3C7] text-[#92400E] ring-4 ring-[#F59E0B] -translate-y-0.5';
          } else if (isLineCompleted) {
            cellStyle =
              'border-[#059669] border-b-4 bg-[#10B981] text-[#FFFFFF] animate-stamp-pop';
          } else if (isCalled) {
            cellStyle =
              'border-[#BE123C] border-b-4 bg-[#F43F5E] text-[#FFFFFF] animate-stamp-pop';
          } else if (isClickable) {
            cellStyle =
              'border-[#DED9CE] border-b-4 bg-[#FFFFFF] text-[#1F2937] hover:border-[#F43F5E] hover:bg-[#FFF1F2] hover:-translate-y-0.5';
          } else if (!editable && !canCallFromBoard) {
            cellStyle =
              'border-[#E5E1D8] border-b-4 bg-[#FAF9F6] text-[#6B7280] opacity-85';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={!isClickable}
              draggable={isDraggable}
              onDragStart={(e) => {
                if (!isDraggable) return;
                setDraggedIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                if (!isDraggable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIndex !== idx) {
                  setDragOverIndex(idx);
                }
              }}
              onDragLeave={() => {
                if (dragOverIndex === idx) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                if (!isDraggable) return;
                e.preventDefault();
                const fromRaw = e.dataTransfer.getData('text/plain');
                const fromIndex =
                  draggedIndex !== null ? draggedIndex : parseInt(fromRaw, 10);
                setDraggedIndex(null);
                setDragOverIndex(null);
                if (
                  !Number.isNaN(fromIndex) &&
                  fromIndex !== idx &&
                  board[fromIndex] !== 0
                ) {
                  onSwapCells?.(fromIndex, idx);
                }
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onClick={() => onCellClick?.(idx, num)}
              aria-label={
                isFree
                  ? '무료 칸'
                  : isPendingChoice
                    ? `${num}번 선택됨`
                    : isCalled
                      ? `${num}번 체크됨`
                      : `${num}번`
              }
              className={`relative flex aspect-square min-h-[48px] w-full flex-col items-center justify-center rounded-2xl border font-display tabular-nums transition-all duration-150 select-none ${textSizeClass} ${cellStyle} ${
                isBeingDragged ? 'opacity-50 scale-95' : ''
              } ${
                isClickable
                  ? isDraggable
                    ? 'cursor-grab active:cursor-grabbing active:translate-y-0.5'
                    : 'cursor-pointer active:translate-y-0.5'
                  : 'cursor-not-allowed'
              } ${isJustCalled ? 'ring-4 ring-[#FCD34D]' : ''}`}
            >
              {isFree ? (
                <span className="flex flex-col items-center gap-0.5 text-sm sm:text-base">
                  <Star className="h-5 w-5 fill-current" />
                  <span>FREE</span>
                </span>
              ) : (
                <span>{num}</span>
              )}

              {isDraggable && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 text-[#9CA3AF]"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              )}

              {isPendingChoice && (
                <span className="absolute bottom-1 text-[10px] font-sans font-bold text-[#B45309]">
                  선택됨
                </span>
              )}

              {isCalled && !isFree && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/15"
                >
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}

        {/* Automatic SVG Bingo Lines Overlay */}
        {completedLineKeys.length > 0 && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          >
            {completedLineKeys.map((key) => {
              const coords = getLineCoordinates(key, gridSize);
              if (!coords) return null;
              return (
                <g key={key}>
                  <line
                    x1={coords.x1}
                    y1={coords.y1}
                    x2={coords.x2}
                    y2={coords.y2}
                    stroke="#FFFFFF"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    className="animate-bingo-line opacity-90"
                  />
                  <line
                    x1={coords.x1}
                    y1={coords.y1}
                    x2={coords.x2}
                    y2={coords.y2}
                    stroke="#FCD34D"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="animate-bingo-line"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
