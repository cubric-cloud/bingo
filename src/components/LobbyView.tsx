import { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Crown,
  Gift,
  Link2,
  ListOrdered,
  Minus,
  Play,
  Plus,
  Share2,
  Shuffle,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import prizeImg from '../assets/images/bingo_prize_trophy_1794726611841.jpg';
import {
  PRIZE_PRESETS,
  generateSequentialBoard,
  getMaxPossibleLines,
  getMinRequiredNumbers,
} from '../shared/bingo.ts';
import type {
  GameMode,
  GridSize,
  PublicPlayerInfo,
  PublicRoomState,
  RoomSettings,
} from '../shared/bingo.ts';
import { BingoBoardGrid } from './BingoBoardGrid.tsx';

interface LobbyViewProps {
  room: PublicRoomState;
  me: PublicPlayerInfo;
  muted: boolean;
  error: string | null;
  onToggleMute: () => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onUpdateBoard: (board: number[]) => void;
  onRandomizeBoard: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
}

export function LobbyView({
  room,
  me,
  muted,
  error,
  onToggleMute,
  onUpdateSettings,
  onUpdateBoard,
  onRandomizeBoard,
  onToggleReady,
  onStartGame,
  onAddBot,
  onRemoveBot,
}: LobbyViewProps) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [customCellValue, setCustomCellValue] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [prizeDraft, setPrizeDraft] = useState(room.settings.prize);
  const [maxNumDraft, setMaxNumDraft] = useState(String(room.settings.maxNumber));
  const [prizeImgErr, setPrizeImgErr] = useState(false);

  useEffect(() => {
    setPrizeDraft(room.settings.prize);
  }, [room.settings.prize]);

  useEffect(() => {
    setMaxNumDraft(String(room.settings.maxNumber));
  }, [room.settings.maxNumber]);

  useEffect(() => {
    setSelectedCell(null);
    setCustomCellValue('');
  }, [room.settings.gridSize, room.settings.maxNumber, room.settings.freeCenter]);

  const { settings } = room;
  const myBoard = me.board ?? [];
  const isBoardLocked = !me.isHost && me.ready;
  const minRequiredNums = getMinRequiredNumbers(settings.gridSize, settings.freeCenter);
  const maxPossibleLines = getMaxPossibleLines(settings.gridSize);

  const rangePresets = Array.from(
    new Set([minRequiredNums, minRequiredNums + 10, 35, 50, 75].filter((n) => n >= minRequiredNums && n <= 99))
  ).sort((a, b) => a - b);

  const humanGuests = room.players.filter((p) => !p.isHost && !p.isBot && p.connected);
  const readyHumanGuests = humanGuests.filter((g) => g.ready);
  const guests = room.players.filter((p) => !p.isHost && p.connected);
  const allGuestsReady = guests.every((g) => g.ready);
  const shareUrl = `${window.location.origin}/?room=${room.code}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleShareRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('초대 링크가 복사되었어요! 참여자에게 붙여넣기해서 보내주세요.');
    } catch {
      setShareMessage('아래 링크를 복사해 참여자에게 보내주세요.');
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: '두근두근 빙고 파티 초대',
          text: `방 코드 [${room.code}] 빙고 게임에 참여해 보세요!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled native share sheet; clipboard fallback already succeeded
      }
    }
    setTimeout(() => setShareMessage(null), 3500);
  };

  const handleSwapCells = (fromIndex: number, toIndex: number) => {
    if (isBoardLocked) return;
    if (fromIndex === toIndex) return;
    if (myBoard[fromIndex] === 0 || myBoard[toIndex] === 0) return;
    const next = [...myBoard];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    onUpdateBoard(next);
    setSelectedCell(null);
    setCustomCellValue('');
  };

  const handleCellClick = (idx: number, val: number) => {
    if (isBoardLocked) return;
    if (val === 0) return;
    if (selectedCell === null) {
      setSelectedCell(idx);
      setCustomCellValue(String(val));
      return;
    }
    if (selectedCell === idx) {
      setSelectedCell(null);
      setCustomCellValue('');
      return;
    }
    // Swap two cells
    const next = [...myBoard];
    const tmp = next[selectedCell];
    next[selectedCell] = next[idx];
    next[idx] = tmp;
    onUpdateBoard(next);
    setSelectedCell(null);
    setCustomCellValue('');
  };

  const handleApplyCustomNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCell === null) return;
    const parsed = parseInt(customCellValue, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > settings.maxNumber) return;

    const next = [...myBoard];
    const existingIdx = next.indexOf(parsed);
    if (existingIdx !== -1 && existingIdx !== selectedCell) {
      // Swap with the existing number
      next[existingIdx] = next[selectedCell];
    }
    next[selectedCell] = parsed;
    onUpdateBoard(next);
    setSelectedCell(null);
    setCustomCellValue('');
  };

  const handleSequentialFill = () => {
    setSelectedCell(null);
    onUpdateBoard(
      generateSequentialBoard(settings.gridSize, settings.maxNumber, settings.freeCenter)
    );
  };

  const handleCommitPrize = () => {
    const trimmed = prizeDraft.trim();
    if (trimmed && trimmed !== settings.prize) {
      onUpdateSettings({ prize: trimmed });
    }
  };

  const handleCommitMaxNumber = () => {
    const num = parseInt(maxNumDraft, 10);
    if (!Number.isNaN(num)) {
      const clamped = Math.max(minRequiredNums, Math.min(99, num));
      setMaxNumDraft(String(clamped));
      if (clamped !== settings.maxNumber) {
        onUpdateSettings({ maxNumber: clamped });
      }
    } else {
      setMaxNumDraft(String(settings.maxNumber));
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: My Bingo Board Editor */}
        <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5 sm:p-7 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl text-[#1F2937]">
                내 빙고판 미리 배치하기
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                {isBoardLocked
                  ? '세팅이 완료되어 준비 상태예요. 수정하려면 아래 준비 취소를 눌러주세요.'
                  : '숫자 칸을 드래그 앤 드랍으로 끌어다 놓거나 두 칸을 눌러 자리를 바꿀 수 있어요.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E1D8] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#EFECE6] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{muted ? '소리 꺼짐' : '소리 켜짐'}</span>
            </button>
          </div>

          <div className="mt-5">
            <BingoBoardGrid
              board={myBoard}
              gridSize={settings.gridSize}
              calledNumbers={[]}
              completedCells={[]}
              lastCalledNumber={null}
              editable={!isBoardLocked}
              selectedIndex={selectedCell}
              onCellClick={handleCellClick}
              onSwapCells={handleSwapCells}
            />
          </div>

          {/* Inline cell number editor when a tile is selected */}
          {!isBoardLocked && selectedCell !== null && (
            <form
              onSubmit={handleApplyCustomNumber}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3"
            >
              <span className="text-sm font-medium text-[#92400E]">
                다른 칸으로 드래그/클릭하거나 새 번호(1~{settings.maxNumber})를 입력하세요
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={settings.maxNumber}
                  value={customCellValue}
                  onChange={(e) => setCustomCellValue(e.target.value)}
                  className="min-h-[40px] w-20 rounded-xl border border-[#F59E0B] bg-[#FFFFFF] px-3 text-center font-mono font-bold text-[#1F2937] tabular-nums focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl bg-[#F59E0B] px-3.5 text-sm font-bold text-[#FFFFFF] hover:bg-[#D97706] whitespace-nowrap cursor-pointer"
                >
                  적용
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isBoardLocked}
              onClick={() => {
                setSelectedCell(null);
                onRandomizeBoard();
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-4 py-2 text-sm font-bold text-[#374151] hover:bg-[#EFECE6] transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <Shuffle className="h-4 w-4 text-[#F43F5E]" />
              <span>랜덤 섞기</span>
            </button>
            <button
              type="button"
              disabled={isBoardLocked}
              onClick={handleSequentialFill}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-4 py-2 text-sm font-bold text-[#374151] hover:bg-[#EFECE6] transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <ListOrdered className="h-4 w-4 text-[#F59E0B]" />
              <span>1부터 순서대로</span>
            </button>
          </div>
        </section>

        {/* Right Column: Room Code, Prize, Host Settings, Players */}
        <aside className="space-y-5 lg:col-span-5">
          {/* Room Code & Share Link Card */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#6B7280]">참여자 초대 방 코드</p>
                <p className="mt-0.5 font-mono text-3xl font-bold tracking-widest text-[#1F2937] tabular-nums">
                  {room.code}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-3 py-2 text-xs font-bold text-[#374151] hover:bg-[#EFECE6] whitespace-nowrap cursor-pointer"
                >
                  {copiedCode ? (
                    <Check className="h-3.5 w-3.5 text-[#10B981]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareRoomLink}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1F2937] px-3.5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#374151] whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>방 링크 공유</span>
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] px-3 py-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="방 초대 링크"
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full bg-transparent font-mono text-xs text-[#4B5563] focus:outline-none"
              />
            </div>

            {shareMessage && (
              <p className="mt-2 text-xs font-medium text-[#059669]">{shareMessage}</p>
            )}
          </section>

          {/* Prize Bet Card */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <div className="flex items-center gap-3.5">
              {!prizeImgErr ? (
                <img
                  src={prizeImg}
                  alt="이번 라운드 경품 선물 상자"
                  referrerPolicy="no-referrer"
                  onError={() => setPrizeImgErr(true)}
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706]">
                  <Gift className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#B45309]">
                  {room.round}라운드 한판 내기 경품
                </p>
                <p className="mt-0.5 truncate font-display text-xl text-[#1F2937]">
                  {settings.prize}
                </p>
              </div>
            </div>

            {me.isHost && (
              <div className="mt-4 space-y-2.5 border-t border-[#EFECE6] pt-4">
                <label htmlFor="prize-input" className="block text-xs font-medium text-[#4B5563]">
                  경품 직접 정하기 (호스트 전용)
                </label>
                <div className="flex gap-2">
                  <input
                    id="prize-input"
                    type="text"
                    maxLength={40}
                    value={prizeDraft}
                    onChange={(e) => setPrizeDraft(e.target.value)}
                    onBlur={handleCommitPrize}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCommitPrize();
                      }
                    }}
                    placeholder="예: ☕ 아메리카노 1잔 쏘기"
                    className="min-h-[40px] flex-1 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-3 text-sm text-[#1F2937] focus:border-[#F59E0B] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCommitPrize}
                    className="min-h-[40px] rounded-xl bg-[#F59E0B] px-3.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#D97706] whitespace-nowrap cursor-pointer"
                  >
                    변경
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRIZE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setPrizeDraft(preset);
                        onUpdateSettings({ prize: preset });
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        settings.prize === preset
                          ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]'
                          : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#4B5563] hover:bg-[#EFECE6]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Host Game Settings */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[#1F2937]">빙고판 규칙 설정</h2>
              <span className="text-xs font-medium text-[#6B7280]">
                {me.isHost ? '호스트 설정 가능' : '호스트가 설정한 규칙'}
              </span>
            </div>

            {me.isHost ? (
              <div className="mt-4 space-y-4">
                {/* Grid Size */}
                <div>
                  <span className="block text-xs font-medium text-[#4B5563]">빙고판 크기</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {([3, 4, 5] as GridSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onUpdateSettings({ gridSize: size })}
                        className={`min-h-[40px] rounded-xl border text-sm font-bold tabular-nums transition-colors cursor-pointer ${
                          settings.gridSize === size
                            ? 'border-[#F43F5E] bg-[#FFF1F2] text-[#BE123C]'
                            : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#4B5563] hover:bg-[#EFECE6]'
                        }`}
                      >
                        {size}×{size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Number Range */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#4B5563]">
                      전체 번호 범위 (1 ~ N)
                    </span>
                    <span className="text-xs text-[#6B7280] tabular-nums">
                      최소 {minRequiredNums} ~ 최대 99
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {rangePresets.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setMaxNumDraft(String(n));
                          onUpdateSettings({ maxNumber: n });
                        }}
                        className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                          settings.maxNumber === n
                            ? 'border-[#F43F5E] bg-[#FFF1F2] text-[#BE123C]'
                            : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#4B5563] hover:bg-[#EFECE6]'
                        }`}
                      >
                        1~{n}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-1.5">
                      <input
                        type="number"
                        min={minRequiredNums}
                        max={99}
                        value={maxNumDraft}
                        onChange={(e) => setMaxNumDraft(e.target.value)}
                        onBlur={handleCommitMaxNumber}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCommitMaxNumber();
                          }
                        }}
                        aria-label="전체 번호 최댓값"
                        className="min-h-[38px] w-16 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-2 text-center font-mono text-sm font-bold text-[#1F2937] tabular-nums focus:border-[#F43F5E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Target Bingo Lines */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-medium text-[#4B5563]">
                      승리 빙고 줄 수
                    </span>
                    <span className="text-xs text-[#6B7280] tabular-nums">
                      최대 {maxPossibleLines}줄 가능
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={settings.targetLines <= 1}
                      onClick={() =>
                        onUpdateSettings({ targetLines: Math.max(1, settings.targetLines - 1) })
                      }
                      aria-label="목표 줄 감소"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] text-[#374151] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center font-display text-xl text-[#1F2937] tabular-nums">
                      {settings.targetLines}줄
                    </span>
                    <button
                      type="button"
                      disabled={settings.targetLines >= maxPossibleLines}
                      onClick={() =>
                        onUpdateSettings({
                          targetLines: Math.min(maxPossibleLines, settings.targetLines + 1),
                        })
                      }
                      aria-label="목표 줄 증가"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] text-[#374151] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Max Players */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-medium text-[#4B5563]">
                        참여 인원수 설정
                      </span>
                      <span className="text-xs text-[#6B7280] tabular-nums">
                        현재 {room.players.length}명 · 최대 12명
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={settings.maxPlayers <= Math.max(2, room.players.length)}
                        onClick={() =>
                          onUpdateSettings({
                            maxPlayers: Math.max(
                              Math.max(2, room.players.length),
                              settings.maxPlayers - 1
                            ),
                          })
                        }
                        aria-label="최대 인원 감소"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] text-[#374151] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center font-display text-xl text-[#1F2937] tabular-nums">
                        {settings.maxPlayers}명
                      </span>
                      <button
                        type="button"
                        disabled={settings.maxPlayers >= 12}
                        onClick={() =>
                          onUpdateSettings({ maxPlayers: Math.min(12, settings.maxPlayers + 1) })
                        }
                        aria-label="최대 인원 증가"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] text-[#374151] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[2, 4, 6, 8, 12].map((count) => {
                      const disabled = count < room.players.length;
                      return (
                        <button
                          key={count}
                          type="button"
                          disabled={disabled}
                          onClick={() => onUpdateSettings({ maxPlayers: count })}
                          className={`min-h-[34px] rounded-xl border px-3 text-xs font-bold tabular-nums transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            settings.maxPlayers === count
                              ? 'border-[#F43F5E] bg-[#FFF1F2] text-[#BE123C]'
                              : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#4B5563] hover:bg-[#EFECE6]'
                          }`}
                        >
                          {count}명
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Game Mode */}
                <div>
                  <span className="block text-xs font-medium text-[#4B5563]">번호 부르기 방식</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'TURN_BASED', label: '돌아가며 부르기' },
                        { id: 'HOST_DRAW', label: '호스트 볼 추첨' },
                      ] as { id: GameMode; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onUpdateSettings({ mode: m.id })}
                        className={`min-h-[40px] rounded-xl border px-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          settings.mode === m.id
                            ? 'border-[#F43F5E] bg-[#FFF1F2] text-[#BE123C]'
                            : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#4B5563] hover:bg-[#EFECE6]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional FREE center for odd grids */}
                {settings.gridSize % 2 === 1 && (
                  <label className="flex items-center justify-between rounded-xl border border-[#EFECE6] bg-[#FAF9F6] px-3.5 py-2.5 cursor-pointer">
                    <span className="text-xs font-medium text-[#374151]">
                      가운데 무료(FREE) 칸 넣기
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.freeCenter}
                      onChange={(e) => onUpdateSettings({ freeCenter: e.target.checked })}
                      className="h-4 w-4 accent-[#F43F5E] cursor-pointer"
                    />
                  </label>
                )}
              </div>
            ) : (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">빙고판 크기</dt>
                  <dd className="font-bold text-[#1F2937] tabular-nums">
                    {settings.gridSize}×{settings.gridSize}
                    {settings.freeCenter ? ' (가운데 FREE)' : ''}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">전체 번호 범위</dt>
                  <dd className="font-bold text-[#1F2937] tabular-nums">1 ~ {settings.maxNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">승리 목표</dt>
                  <dd className="font-bold text-[#1F2937] tabular-nums">
                    {settings.targetLines}줄 완성
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">참여 정원</dt>
                  <dd className="font-bold text-[#1F2937] tabular-nums">
                    최대 {settings.maxPlayers}명
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">진행 방식</dt>
                  <dd className="font-bold text-[#1F2937]">
                    {settings.mode === 'TURN_BASED' ? '참가자 돌아가며 부르기' : '호스트 랜덤 추첨'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {/* Players List */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 font-display text-lg text-[#1F2937] tabular-nums">
                <Users className="h-4 w-4 text-[#F43F5E]" />
                <span>
                  참가자 ({room.players.length}/{settings.maxPlayers})
                </span>
              </h2>

              {me.isHost && (
                <button
                  type="button"
                  disabled={room.players.length >= settings.maxPlayers}
                  onClick={onAddBot}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-3 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#EFECE6] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5 text-[#F43F5E]" />
                  <span>컴퓨터 AI 추가</span>
                </button>
              )}
            </div>

            <ul className="mt-3 divide-y divide-[#F3F1EB]">
              {room.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      style={{ backgroundColor: p.avatarColor }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm text-[#FFFFFF]"
                    >
                      {p.isBot ? <Bot className="h-4 w-4" /> : p.nickname.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1F2937]">
                        {p.nickname}
                        {p.id === me.id && (
                          <span className="ml-1.5 text-xs font-normal text-[#6B7280]">(나)</span>
                        )}
                      </p>
                      <p className="text-xs text-[#6B7280] font-mono tabular-nums">{p.ipLabel}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs font-bold">
                    {p.isHost ? (
                      <span className="inline-flex items-center gap-1 text-[#D97706]">
                        <Crown className="h-3.5 w-3.5" />
                        <span>호스트</span>
                      </span>
                    ) : p.isBot ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[#059669]">
                          <Bot className="h-3.5 w-3.5" />
                          <span>AI 준비 완료</span>
                        </span>
                        {me.isHost && (
                          <button
                            type="button"
                            onClick={() => onRemoveBot(p.id)}
                            aria-label={`${p.nickname} 내보내기`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E5E1D8] bg-[#FAF9F6] text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#B91C1C] cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : p.ready ? (
                      <span className="inline-flex items-center gap-1 text-[#059669]">
                        <Check className="h-3.5 w-3.5" />
                        <span>준비 완료</span>
                      </span>
                    ) : (
                      <span className="text-[#6B7280]">대기 중</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-[#FEF2F2] px-3.5 py-2 text-xs font-medium text-[#B91C1C]">
                {error}
              </p>
            )}

            <div className="mt-4 space-y-2.5">
              {me.isHost ? (
                <>
                  <p className="text-center text-xs font-medium text-[#4B5563] tabular-nums">
                    {humanGuests.length === 0
                      ? '바로 시작하거나 초대 링크로 친구·AI를 함께 초대할 수 있어요.'
                      : allGuestsReady
                        ? `참여자 ${readyHumanGuests.length}/${humanGuests.length}명 준비 완료! 게임을 시작할 수 있어요.`
                        : `참여자 준비 현황: ${readyHumanGuests.length}/${humanGuests.length}명 준비 완료`}
                  </p>
                  <button
                    type="button"
                    disabled={!allGuestsReady}
                    onClick={onStartGame}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#BE123C] bg-[#F43F5E] px-6 py-3 font-display text-lg text-[#FFFFFF] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>
                      {allGuestsReady ? '빙고 게임 시작하기' : '참여자 준비를 기다리는 중'}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    onToggleReady();
                  }}
                  className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-b-4 px-6 py-3 font-display text-lg text-[#FFFFFF] transition-transform active:translate-y-0.5 cursor-pointer ${
                    me.ready
                      ? 'border-[#4B5563] bg-[#6B7280]'
                      : 'border-[#059669] bg-[#10B981]'
                  }`}
                >
                  <Check className="h-5 w-5" />
                  <span>{me.ready ? '준비 취소' : '준비'}</span>
                </button>
              )}
            </div>
          </section>

          {/* Past Round History */}
          {room.history.length > 0 && (
            <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
              <h2 className="font-display text-base text-[#1F2937]">이전 라운드 경품 기록</h2>
              <ul className="mt-2.5 space-y-2 text-xs">
                {room.history.slice(0, 5).map((rec) => (
                  <li
                    key={rec.round}
                    className="flex items-center justify-between gap-2 border-b border-[#F3F1EB] pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="font-medium text-[#4B5563] tabular-nums">
                      {rec.round}라운드 · {rec.prize}
                    </span>
                    <span className="font-bold text-[#1F2937]">
                      {rec.winners.map((w) => w.nickname).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
