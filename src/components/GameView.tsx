import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot,
  Check,
  Crown,
  Gift,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import prizeImg from '../assets/images/bingo_prize_trophy_1794726611841.jpg';
import type { PublicPlayerInfo, PublicRoomState } from '../shared/bingo.ts';
import { BingoBoardGrid } from './BingoBoardGrid.tsx';

interface GameViewProps {
  room: PublicRoomState;
  me: PublicPlayerInfo;
  muted: boolean;
  error: string | null;
  onToggleMute: () => void;
  onCallNumber: (num: number) => void;
  onDrawRandom: () => void;
  onNextRound: () => void;
  onSendChat: (text: string) => void;
}

const QUICK_REACTIONS = ['👏 짝짝짝!', '🔥 긴장돼요', '😭 앗 내 번호!', '🎉 가즈아!'];

export function GameView({
  room,
  me,
  muted,
  error,
  onToggleMute,
  onCallNumber,
  onDrawRandom,
  onNextRound,
  onSendChat,
}: GameViewProps) {
  const [manualNumber, setManualNumber] = useState('');
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);
  const [chatText, setChatText] = useState('');
  const [autoDraw, setAutoDraw] = useState(false);
  const [prizeImgErr, setPrizeImgErr] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const confettiFiredRef = useRef<number | null>(null);

  const { settings } = room;
  const isFinished = room.phase === 'FINISHED';
  const isTurnBased = settings.mode === 'TURN_BASED';
  const isMyTurn = isTurnBased
    ? room.currentTurnPlayerId === me.id && !isFinished
    : me.isHost && !isFinished;

  const currentTurnPlayer = room.players.find((p) => p.id === room.currentTurnPlayerId);
  const calledSet = new Set(room.calledNumbers);
  const winners = room.players.filter((p) => room.winnerIds.includes(p.id));

  // Clear pending selection whenever turn or called numbers change
  useEffect(() => {
    setPendingNumber(null);
    setManualNumber('');
  }, [room.currentTurnPlayerId, room.calledNumbers.length, room.phase]);

  // Fire confetti once per finished round when winners exist
  useEffect(() => {
    if (isFinished && winners.length > 0 && confettiFiredRef.current !== room.round) {
      confettiFiredRef.current = room.round;
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });
    }
  }, [isFinished, winners.length, room.round]);

  // Host auto-draw interval in HOST_DRAW mode
  useEffect(() => {
    if (!autoDraw || isFinished || isTurnBased || !me.isHost) {
      return;
    }
    const timer = setInterval(() => {
      onDrawRandom();
    }, 3000);
    return () => clearInterval(timer);
  }, [autoDraw, isFinished, isTurnBased, me.isHost, onDrawRandom]);

  useEffect(() => {
    if (isFinished) {
      setAutoDraw(false);
    }
  }, [isFinished]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.chatMessages.length]);

  const handleManualInputChange = (val: string) => {
    setManualNumber(val);
    const parsed = parseInt(val, 10);
    if (
      !Number.isNaN(parsed) &&
      parsed >= 1 &&
      parsed <= settings.maxNumber &&
      !calledSet.has(parsed)
    ) {
      setPendingNumber(parsed);
    } else if (val.trim() === '') {
      setPendingNumber(null);
    }
  };

  const handlePickRandomPending = () => {
    if (!isMyTurn) return;
    const available: number[] = [];
    for (let n = 1; n <= settings.maxNumber; n++) {
      if (!calledSet.has(n)) available.push(n);
    }
    if (available.length === 0) return;
    const picked = available[Math.floor(Math.random() * available.length)];
    setPendingNumber(picked);
    setManualNumber(String(picked));
  };

  const handleConfirmCall = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isMyTurn || pendingNumber === null) return;
    onCallNumber(pendingNumber);
    setPendingNumber(null);
    setManualNumber('');
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChat(chatText);
    setChatText('');
  };

  const allNumbers = Array.from({ length: settings.maxNumber }, (_, i) => i + 1);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Unobtrusive Top Game HUD Strip */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-[#1F2937] tabular-nums">{room.round}라운드</span>
          <span aria-hidden="true" className="text-[#D6D1C7]">·</span>
          <span className="font-medium text-[#B45309]">경품: {settings.prize}</span>
        </div>

        <div className="text-sm font-bold">
          {isFinished ? (
            <span className="text-[#059669]">
              {winners.length > 0
                ? `🏆 ${winners.map((w) => w.nickname).join(', ')}님 빙고 우승!`
                : '이번 라운드가 종료되었어요'}
            </span>
          ) : isTurnBased ? (
            isMyTurn ? (
              <span className="text-[#F43F5E]">지금은 내 차례예요! 번호를 골라주세요</span>
            ) : (
              <span className="text-[#374151]">
                {currentTurnPlayer?.nickname ?? '상대'}님이 번호를 고르고 있어요
              </span>
            )
          ) : me.isHost ? (
            <span className="text-[#F43F5E]">호스트님, 다음 행운의 볼을 뽑아주세요!</span>
          ) : (
            <span className="text-[#374151]">호스트가 다음 번호를 추첨하고 있어요</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-[#1F2937] tabular-nums">
            내 빙고 {me.completedLinesCount}/{settings.targetLines}줄
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#E5E1D8] bg-[#FAF9F6] px-2.5 text-xs font-medium text-[#374151] hover:bg-[#EFECE6] cursor-pointer"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{muted ? '음소거' : '효과음'}</span>
          </button>
        </div>
      </section>

      {/* Finished Winner Celebration Card */}
      {isFinished && (
        <section className="mt-5 rounded-3xl border border-[#FCD34D] bg-[#FFFBEB] p-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-4">
              {!prizeImgErr ? (
                <img
                  src={prizeImg}
                  alt="우승 경품 상자"
                  referrerPolicy="no-referrer"
                  onError={() => setPrizeImgErr(true)}
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706]">
                  <Trophy className="h-10 w-10" />
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-[#B45309]">
                  {room.round}라운드 내기 결과 발표
                </p>
                <h2 className="mt-1 font-display text-2xl text-[#1F2937] sm:text-3xl">
                  {winners.length > 0
                    ? `${winners.map((w) => w.nickname).join(', ')}님 우승!`
                    : '모든 숫자가 소진되어 무승부!'}
                </h2>
                <p className="mt-1 text-sm font-medium text-[#92400E]">
                  <Gift className="mr-1 inline-block h-4 w-4" />
                  우승 경품: <strong>{settings.prize}</strong>
                </p>
              </div>
            </div>

            {me.isHost ? (
              <button
                type="button"
                onClick={onNextRound}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border-b-4 border-[#BE123C] bg-[#F43F5E] px-6 py-3 font-display text-lg text-[#FFFFFF] transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-5 w-5" />
                <span>다음 라운드 준비하기</span>
              </button>
            ) : (
              <p className="text-sm font-medium text-[#92400E]">
                호스트가 다음 라운드를 열면 대기실로 이동합니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Main 2-Column Arena */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: My Bingo Board & Calling Controls */}
        <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5 sm:p-6 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-display text-2xl text-[#1F2937]">
              내 빙고판 ({settings.gridSize}×{settings.gridSize})
            </h1>
            <span className="text-xs font-medium text-[#6B7280] tabular-nums">
              목표 {settings.targetLines}줄 · 범위 1~{settings.maxNumber}
            </span>
          </div>

          <BingoBoardGrid
            board={me.board ?? []}
            gridSize={settings.gridSize}
            calledNumbers={room.calledNumbers}
            completedCells={me.completedCells}
            completedLineKeys={me.completedLineKeys}
            lastCalledNumber={room.lastCalledNumber}
            pendingNumber={isMyTurn ? pendingNumber : null}
            canCallFromBoard={isTurnBased && isMyTurn}
            onCellClick={(_idx, value) => {
              if (isTurnBased && isMyTurn) {
                setPendingNumber(value);
                setManualNumber(String(value));
              }
            }}
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-[#FEF2F2] px-4 py-2 text-xs font-medium text-[#B91C1C]">
              {error}
            </p>
          )}

          {/* Action Bar Under Board */}
          {!isFinished && (
            <div className="mt-4 space-y-3">
              {isTurnBased ? (
                <div
                  className={`rounded-2xl border p-4 transition-colors ${
                    isMyTurn
                      ? 'border-[#FECDD3] bg-[#FFF1F2]'
                      : 'border-[#E5E1D8] bg-[#FAF9F6] opacity-80'
                  }`}
                >
                  {isMyTurn ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#9F1239]">
                          {pendingNumber !== null
                            ? `선택한 번호: ${pendingNumber}번 — 확인을 누르면 모두에게 체크됩니다!`
                            : '빙고판에서 숫자를 고르거나 입력한 뒤 확인을 눌러주세요.'}
                        </p>
                        {pendingNumber !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setPendingNumber(null);
                              setManualNumber('');
                            }}
                            className="text-xs font-bold text-[#6B7280] hover:text-[#1F2937] underline cursor-pointer"
                          >
                            선택 취소
                          </button>
                        )}
                      </div>

                      <form onSubmit={handleConfirmCall} className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={settings.maxNumber}
                          value={manualNumber}
                          onChange={(e) => handleManualInputChange(e.target.value)}
                          placeholder={`1~${settings.maxNumber} 번호 입력`}
                          className="min-h-[44px] w-full max-w-[160px] rounded-xl border border-[#FDA4AF] bg-[#FFFFFF] px-3 text-sm font-bold text-[#1F2937] tabular-nums focus:border-[#F43F5E] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handlePickRandomPending}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#FDA4AF] bg-[#FFFFFF] px-3.5 text-sm font-bold text-[#BE123C] hover:bg-[#FFE4E6] whitespace-nowrap cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>랜덤 추천</span>
                        </button>
                        <button
                          type="submit"
                          disabled={pendingNumber === null}
                          className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-b-4 border-[#BE123C] bg-[#F43F5E] px-6 text-sm font-display text-[#FFFFFF] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap cursor-pointer"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          <span>{pendingNumber !== null ? `${pendingNumber}번 확인` : '확인'}</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-1 text-center text-sm font-medium text-[#6B7280]">
                      <Lock className="h-4 w-4 shrink-0" />
                      <span>
                        {currentTurnPlayer?.nickname ?? '상대방'}님의 차례예요. 내 차례가 될 때까지 버튼이 비활성화됩니다.
                      </span>
                    </div>
                  )}
                </div>
              ) : me.isHost ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onDrawRandom}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border-b-4 border-[#BE123C] bg-[#F43F5E] px-6 py-3 font-display text-lg text-[#FFFFFF] transition-transform active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>행운의 볼 뽑기!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoDraw((v) => !v)}
                    className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold whitespace-nowrap cursor-pointer ${
                      autoDraw
                        ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                        : 'border-[#D6D1C7] bg-[#FAF9F6] text-[#374151] hover:bg-[#EFECE6]'
                    }`}
                  >
                    {autoDraw ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span>{autoDraw ? '자동 추첨 중 (3초)' : '자동 추첨 켜기'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#FAF9F6] px-4 py-3 text-center text-sm text-[#6B7280]">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>호스트가 볼을 뽑을 때까지 대기 중입니다. 뽑힌 번호는 자동으로 체크돼요.</span>
                </div>
              )}
            </div>
          )}

          {/* Post-Game Opponents Board Reveal */}
          {isFinished && room.players.length > 1 && (
            <div className="mt-6 border-t border-[#EFECE6] pt-5">
              <h2 className="font-display text-lg text-[#1F2937]">다른 참가자 빙고판 공개</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {room.players
                  .filter((p) => p.id !== me.id && p.board)
                  .map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-2xl border border-[#EFECE6] bg-[#FAF9F6] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs font-bold">
                        <span className="inline-flex items-center gap-1 text-[#1F2937]">
                          {opp.isBot && <Bot className="h-3.5 w-3.5 text-[#F43F5E]" />}
                          <span>{opp.nickname}</span>
                        </span>
                        <span className="text-[#059669] tabular-nums">
                          {opp.completedLinesCount}줄 완성
                        </span>
                      </div>
                      <BingoBoardGrid
                        board={opp.board ?? []}
                        gridSize={settings.gridSize}
                        calledNumbers={room.calledNumbers}
                        completedCells={opp.completedCells}
                        completedLineKeys={opp.completedLineKeys}
                        lastCalledNumber={null}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Sidebar: Latest Ball, Called Numbers, Live Standings, Chat */}
        <aside className="space-y-5 lg:col-span-5">
          {/* Latest Ball + Full Called Numbers Board */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <div className="flex items-center gap-4">
              <div
                key={room.lastCalledNumber ?? 'none'}
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 font-display text-3xl tabular-nums ${
                  room.lastCalledNumber !== null
                    ? 'animate-ball-drop border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]'
                    : 'border-[#E5E1D8] bg-[#FAF9F6] text-[#9CA3AF]'
                }`}
              >
                {room.lastCalledNumber !== null ? room.lastCalledNumber : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#6B7280]">방금 불린 번호</p>
                <p className="mt-0.5 truncate font-display text-xl text-[#1F2937]">
                  {room.lastCalledNumber !== null
                    ? `${room.lastCalledNumber}번!`
                    : '아직 시작 전'}
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280] tabular-nums">
                  {room.lastCalledBy
                    ? `${room.lastCalledBy}님 호명 · 누적 ${room.calledNumbers.length}/${settings.maxNumber}`
                    : `총 ${settings.maxNumber}개 번호 중 첫 번호를 기다려요`}
                </p>
              </div>
            </div>

            {/* Compact Called Number Matrix */}
            <div className="mt-4 border-t border-[#EFECE6] pt-3">
              <p className="mb-2 text-xs font-medium text-[#6B7280]">전체 숫자 현황</p>
              <div className="grid grid-cols-10 gap-1">
                {allNumbers.map((num) => {
                  const isCalled = calledSet.has(num);
                  const isLatest = num === room.lastCalledNumber;
                  return (
                    <span
                      key={num}
                      className={`flex aspect-square items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${
                        isLatest
                          ? 'bg-[#F59E0B] text-[#FFFFFF]'
                          : isCalled
                            ? 'bg-[#F43F5E] text-[#FFFFFF]'
                            : 'bg-[#F3F1EB] text-[#6B7280]'
                      }`}
                    >
                      {num}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Live Player Progress */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <h2 className="font-display text-lg text-[#1F2937]">실시간 빙고 현황</h2>
            <ul className="mt-3 space-y-2.5">
              {room.players.map((p) => {
                const pct = Math.min(
                  100,
                  Math.round((p.completedLinesCount / settings.targetLines) * 100)
                );
                const isTurn = room.currentTurnPlayerId === p.id && !isFinished;
                const isWin = room.winnerIds.includes(p.id);
                return (
                  <li
                    key={p.id}
                    className={`rounded-2xl border p-3 ${
                      isWin
                        ? 'border-[#F59E0B] bg-[#FFFBEB]'
                        : isTurn
                          ? 'border-[#FDA4AF] bg-[#FFF1F2]'
                          : 'border-[#EFECE6] bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 font-bold text-[#1F2937]">
                        {p.isHost && <Crown className="h-3.5 w-3.5 text-[#D97706]" />}
                        {p.isBot && <Bot className="h-3.5 w-3.5 text-[#F43F5E]" />}
                        <span>{p.nickname}</span>
                        {isTurn && (
                          <span className="text-xs font-medium text-[#E11D48]">· 차례</span>
                        )}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#374151] tabular-nums">
                        {p.completedLinesCount} / {settings.targetLines}줄
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E1D8]">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all duration-200 ${
                          isWin ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                        }`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Real-time Mini Chat & Reactions */}
          <section className="rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-5">
            <h2 className="font-display text-lg text-[#1F2937]">응원 채팅</h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => onSendChat(reaction)}
                  className="rounded-xl border border-[#E5E1D8] bg-[#FAF9F6] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#EFECE6] whitespace-nowrap cursor-pointer"
                >
                  {reaction}
                </button>
              ))}
            </div>

            <div className="mt-3 h-40 overflow-y-auto rounded-2xl border border-[#EFECE6] bg-[#FAF9F6] p-3 space-y-1.5">
              {room.chatMessages.map((msg) => (
                <p
                  key={msg.id}
                  className={`text-xs leading-relaxed ${
                    msg.isSystem ? 'font-medium text-[#B45309]' : 'text-[#374151]'
                  }`}
                >
                  {!msg.isSystem && (
                    <strong className="mr-1.5 text-[#1F2937]">{msg.sender}:</strong>
                  )}
                  <span>{msg.text}</span>
                </p>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="mt-2.5 flex gap-2">
              <input
                type="text"
                maxLength={80}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="한마디 남기기..."
                className="min-h-[40px] flex-1 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-3 text-sm text-[#1F2937] focus:border-[#F43F5E] focus:bg-[#FFFFFF] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="메시지 보내기"
                className="flex min-h-[40px] w-11 items-center justify-center rounded-xl bg-[#1F2937] text-[#FFFFFF] hover:bg-[#374151] cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}
