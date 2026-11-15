import { Volume2, VolumeX, LogOut } from 'lucide-react';
import type { PublicRoomState } from '../shared/bingo.ts';

interface TopBarProps {
  room: PublicRoomState | null;
  muted: boolean;
  onToggleMute: () => void;
  onLeaveRoom: () => void;
  onScrollToGuide?: () => void;
}

export function TopBar({
  room,
  muted,
  onToggleMute,
  onLeaveRoom,
  onScrollToGuide,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E1D8] bg-[#FFFFFF]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            if (room) {
              e.preventDefault();
            }
          }}
          className="font-display text-xl tracking-tight text-[#1F2937] whitespace-nowrap shrink-0"
        >
          두근두근 빙고 파티
        </a>

        {/* Zone 2: Clean single-line links or quiet room metadata */}
        {room ? (
          <nav className="hidden md:flex items-center gap-3 text-sm text-[#4B5563] whitespace-nowrap">
            <span>
              방 코드 <strong className="font-mono tabular-nums text-[#1F2937]">{room.code}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{room.round}라운드</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              참가자 {room.players.length}/{room.settings.maxPlayers}명
            </span>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4B5563]">
            <button
              type="button"
              onClick={onScrollToGuide}
              className="hover:text-[#1F2937] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              게임 방법
            </button>
            <button
              type="button"
              onClick={onScrollToGuide}
              className="hover:text-[#1F2937] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              호스트 설정
            </button>
            <button
              type="button"
              onClick={onScrollToGuide}
              className="hover:text-[#1F2937] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              경품 내기
            </button>
          </nav>
        )}

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {room ? (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E1D8] bg-[#FAF9F6] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F1EFEA] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>방 나가기</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E1D8] bg-[#FAF9F6] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F1EFEA] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{muted ? '소리 꺼짐' : '소리 켜짐'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
