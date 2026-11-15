import { useState } from 'react';
import { Dices, DoorOpen, PlusCircle } from 'lucide-react';
import mascotImg from '../assets/images/bingo_mascot_lobby_1794726611382.jpg';
import { CUTE_NICKNAMES } from '../shared/bingo.ts';

interface LandingViewProps {
  nickname: string;
  ipLabel: string;
  initialRoomCode: string;
  connecting: boolean;
  error: string | null;
  onNicknameChange: (value: string) => void;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
}

export function LandingView({
  nickname,
  ipLabel,
  initialRoomCode,
  connecting,
  error,
  onNicknameChange,
  onCreateRoom,
  onJoinRoom,
}: LandingViewProps) {
  const [tab, setTab] = useState<'create' | 'join'>(initialRoomCode ? 'join' : 'create');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [imgError, setImgError] = useState(false);

  const handleRandomNickname = () => {
    const candidates = CUTE_NICKNAMES.filter((n) => n !== nickname);
    const picked = candidates[Math.floor(Math.random() * candidates.length)] || CUTE_NICKNAMES[0];
    onNicknameChange(picked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'create') {
      onCreateRoom(nickname);
    } else {
      onJoinRoom(roomCode, nickname);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Left Column: Entry Card & IP Guest Identity */}
        <div className="flex flex-col justify-between rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 lg:col-span-7">
          <div>
            <p className="text-sm font-medium text-[#6B7280]">
              로그인 없이 바로 입장 <span aria-hidden="true">·</span>{' '}
              <span className="font-mono tabular-nums">{ipLabel || 'IP 확인 중'}</span>
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-[#1F2937] text-balance sm:text-4xl">
              방 코드만 나누면 바로 시작하는 우리만의 온라인 빙고
            </h1>
            <p className="mt-3 text-base leading-relaxed text-[#4B5563]">
              호스트가 빙고판 크기, 번호 범위, 목표 줄 수와 한판 경품을 정하면 친구들이 코드로 모여 실시간으로 승부를 겨룰 수 있어요.
            </p>

            {/* Segmented Mode Selector */}
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#F3F1EB] p-1.5">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  tab === 'create'
                    ? 'bg-[#FFFFFF] text-[#1F2937] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <PlusCircle className="h-4 w-4 text-[#F43F5E]" />
                <span>호스트 방 만들기</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  tab === 'join'
                    ? 'bg-[#FFFFFF] text-[#1F2937] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <DoorOpen className="h-4 w-4 text-[#F59E0B]" />
                <span>방 코드로 입장</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="nickname-input" className="block text-sm font-medium text-[#374151]">
                  사용할 닉네임
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="nickname-input"
                    type="text"
                    maxLength={14}
                    value={nickname}
                    onChange={(e) => onNicknameChange(e.target.value)}
                    placeholder="귀여운 닉네임을 입력하세요"
                    className="min-h-[44px] flex-1 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-4 text-base text-[#1F2937] focus:border-[#F43F5E] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRandomNickname}
                    title="랜덤 닉네임 뽑기"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-3.5 text-sm font-medium text-[#374151] hover:bg-[#EFECE6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Dices className="h-4 w-4 text-[#F43F5E]" />
                    <span>랜덤</span>
                  </button>
                </div>
              </div>

              {tab === 'join' && (
                <div>
                  <label htmlFor="room-code-input" className="block text-sm font-medium text-[#374151]">
                    방 코드 6자리
                  </label>
                  <input
                    id="room-code-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="예: 482910"
                    className="mt-1.5 min-h-[48px] w-full rounded-xl border border-[#D6D1C7] bg-[#FAF9F6] px-4 font-mono text-xl font-bold tracking-widest text-[#1F2937] tabular-nums focus:border-[#F43F5E] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl bg-[#FEF2F2] px-4 py-2.5 text-sm font-medium text-[#B91C1C]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={connecting || (tab === 'join' && roomCode.trim().length < 4)}
                className="w-full min-h-[48px] rounded-2xl border-b-4 border-[#BE123C] bg-[#F43F5E] px-6 py-3 font-display text-lg text-[#FFFFFF] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {connecting
                  ? '연결하는 중...'
                  : tab === 'create'
                    ? '새 빙고 방 만들기'
                    : '방 코드로 입장하기'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-xs text-[#6B7280]">
            회원가입 없이 접속 IP와 브라우저 세션으로 자동 식별되어 새로고침해도 방이 유지됩니다.
          </p>
        </div>

        {/* Right Column: Mascot Visual + Mini Sample Preview */}
        <div className="flex flex-col justify-between rounded-3xl border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 lg:col-span-5">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#FAF9F6] p-6">
            {!imgError ? (
              <img
                src={mascotImg}
                alt="왕관을 쓴 귀여운 빙고 볼 마스코트"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-56 w-56 rounded-2xl object-contain mix-blend-multiply sm:h-64 sm:w-64"
              />
            ) : (
              <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-[#FFF1F2] text-center">
                <span className="font-display text-5xl text-[#F43F5E]">27</span>
                <span className="mt-2 text-sm font-medium text-[#9F1239]">럭키 빙고 볼</span>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[#EFECE6] pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#4B5563]">지원 빙고판</span>
              <span className="font-bold text-[#1F2937] tabular-nums">3×3 · 4×4 · 5×5</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[#4B5563]">진행 방식</span>
              <span className="font-bold text-[#1F2937]">턴제 부르기 · 호스트 추첨</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[#4B5563]">한판 내기</span>
              <span className="font-bold text-[#D97706]">라운드별 경품 설정 가능</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Guide Section */}
      <section id="bingo-guide" className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <article className="rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] p-6">
          <h2 className="font-display text-lg text-[#1F2937]">01. 호스트 방 만들기</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            빙고판 크기(3×3~5×5), 전체 번호 범위(최대 99), 목표 빙고 줄 수를 원하는 규칙대로 자유롭게 설정하세요.
          </p>
        </article>
        <article className="rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] p-6">
          <h2 className="font-display text-lg text-[#1F2937]">02. 한판 내기 경품 걸기</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            아메리카노, 치킨, 설거지 면제권 등 라운드마다 걸린 경품을 직접 입력하고 라운드별 우승 기록을 남길 수 있어요.
          </p>
        </article>
        <article className="rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] p-6">
          <h2 className="font-display text-lg text-[#1F2937]">03. 실시간 빙고 승부</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            소켓 통신으로 모든 참가자의 도장과 빙고 줄 현황이 즉시 동기화되며, 목표 줄을 먼저 완성한 사람이 경품을 가져갑니다.
          </p>
        </article>
      </section>
    </main>
  );
}
