/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { GameView } from './components/GameView.tsx';
import { LandingView } from './components/LandingView.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { PublicRoomState, RoomSettings } from './shared/bingo.ts';
import { getOrCreateClientId, getStoredNickname, saveNickname } from './utils/clientIdentity.ts';
import { playClickSound, playLineSound, playStampSound, playWinSound } from './utils/sound.ts';

const ACTIVE_ROOM_KEY = 'bingo_party_active_room';

export default function App() {
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const initialUrlRoom = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
  }, []);

  const [nickname, setNickname] = useState<string>(() => getStoredNickname());
  const [ipLabel, setIpLabel] = useState<string>('');
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [connecting, setConnecting] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const mutedRef = useRef<boolean>(muted);
  const prevStateRef = useRef<{
    calledCount: number;
    myLines: number;
    phase: string;
  }>({ calledCount: 0, myLines: 0, phase: 'LOBBY' });

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const backendBaseUrl = useMemo(() => {
    const raw = (import.meta.env.VITE_SOCKET_URL as string | undefined) || '';
    return raw.trim().replace(/\/+$/, '');
  }, []);

  useEffect(() => {
    fetch(`${backendBaseUrl}/api/identity`)
      .then((res) => res.json())
      .then((data: { ipLabel?: string }) => {
        if (data.ipLabel) setIpLabel(data.ipLabel);
      })
      .catch(() => {});
  }, [backendBaseUrl]);

  useEffect(() => {
    const socket = io(backendBaseUrl || undefined, {
      auth: { clientId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnecting(false);
      const savedRoom = sessionStorage.getItem(ACTIVE_ROOM_KEY);
      if (savedRoom) {
        socket.emit(
          'room:join',
          { code: savedRoom, nickname: getStoredNickname() },
          (res: { ok: boolean }) => {
            if (!res?.ok) {
              sessionStorage.removeItem(ACTIVE_ROOM_KEY);
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      setConnecting(true);
    });

    socket.on('room:state', (nextRoom: PublicRoomState) => {
      sessionStorage.setItem(ACTIVE_ROOM_KEY, nextRoom.code);
      const meInNext = nextRoom.players.find((p) => p.id === clientId);
      const prev = prevStateRef.current;

      if (nextRoom.phase === 'PLAYING' || nextRoom.phase === 'FINISHED') {
        const myLines = meInNext?.completedLinesCount ?? 0;
        if (nextRoom.phase === 'FINISHED' && prev.phase !== 'FINISHED' && nextRoom.winnerIds.length > 0) {
          playWinSound(mutedRef.current);
        } else if (myLines > prev.myLines) {
          playLineSound(mutedRef.current);
        } else if (nextRoom.calledNumbers.length > prev.calledCount) {
          playStampSound(mutedRef.current);
        }
        prevStateRef.current = {
          calledCount: nextRoom.calledNumbers.length,
          myLines,
          phase: nextRoom.phase,
        };
      } else {
        prevStateRef.current = {
          calledCount: 0,
          myLines: 0,
          phase: nextRoom.phase,
        };
      }

      setRoom(nextRoom);
      setError(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clientId]);

  const handleNicknameChange = useCallback((value: string) => {
    setNickname(value);
    saveNickname(value);
  }, []);

  const handleCreateRoom = useCallback((name: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    setError(null);
    saveNickname(name);
    playClickSound(mutedRef.current);

    socket.emit(
      'room:create',
      { nickname: name },
      (res: { ok: boolean; code?: string; error?: string }) => {
        if (!res?.ok) {
          setError(res?.error || '방을 만들지 못했어요. 다시 시도해 주세요.');
        } else if (res.code) {
          sessionStorage.setItem(ACTIVE_ROOM_KEY, res.code);
        }
      }
    );
  }, []);

  const handleJoinRoom = useCallback((code: string, name: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    setError(null);
    saveNickname(name);
    playClickSound(mutedRef.current);

    socket.emit(
      'room:join',
      { code: code.trim(), nickname: name },
      (res: { ok: boolean; code?: string; error?: string }) => {
        if (!res?.ok) {
          setError(res?.error || '방 입장에 실패했어요.');
        } else if (res.code) {
          sessionStorage.setItem(ACTIVE_ROOM_KEY, res.code);
        }
      }
    );
  }, []);

  const handleLeaveRoom = useCallback(() => {
    const socket = socketRef.current;
    playClickSound(mutedRef.current);
    sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    if (window.location.search) {
      window.history.replaceState({}, '', '/');
    }
    socket?.emit('room:leave');
    setRoom(null);
    setError(null);
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<RoomSettings>) => {
    socketRef.current?.emit('room:updateSettings', { settings: partial });
  }, []);

  const handleUpdateBoard = useCallback((board: number[]) => {
    playClickSound(mutedRef.current);
    socketRef.current?.emit(
      'player:updateBoard',
      { board },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok && res?.error) {
          setError(res.error);
        }
      }
    );
  }, []);

  const handleRandomizeBoard = useCallback(() => {
    playClickSound(mutedRef.current);
    socketRef.current?.emit('player:randomizeBoard');
  }, []);

  const handleToggleReady = useCallback(() => {
    playClickSound(mutedRef.current);
    socketRef.current?.emit('player:toggleReady');
  }, []);

  const handleStartGame = useCallback(() => {
    playClickSound(mutedRef.current);
    setError(null);
    socketRef.current?.emit('game:start', (res: { ok: boolean; error?: string }) => {
      if (!res?.ok && res?.error) {
        setError(res.error);
      }
    });
  }, []);

  const handleCallNumber = useCallback((num: number) => {
    setError(null);
    socketRef.current?.emit(
      'game:callNumber',
      { number: num },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok && res?.error) {
          setError(res.error);
        }
      }
    );
  }, []);

  const handleDrawRandom = useCallback(() => {
    setError(null);
    socketRef.current?.emit('game:drawRandom', (res: { ok: boolean; error?: string }) => {
      if (!res?.ok && res?.error) {
        setError(res.error);
      }
    });
  }, []);

  const handleNextRound = useCallback(() => {
    playClickSound(mutedRef.current);
    setError(null);
    socketRef.current?.emit('game:nextRound');
  }, []);

  const handleSendChat = useCallback((text: string) => {
    socketRef.current?.emit('chat:send', { text });
  }, []);

  const handleAddBot = useCallback(() => {
    playClickSound(mutedRef.current);
    setError(null);
    socketRef.current?.emit('room:addBot', (res: { ok: boolean; error?: string }) => {
      if (!res?.ok && res?.error) {
        setError(res.error);
      }
    });
  }, []);

  const handleRemoveBot = useCallback((botId: string) => {
    playClickSound(mutedRef.current);
    socketRef.current?.emit('room:removeBot', { botId });
  }, []);

  const handleScrollToGuide = useCallback(() => {
    document.getElementById('bingo-guide')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const me = room?.players.find((p) => p.id === clientId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#1F2937]">
      <TopBar
        room={room}
        muted={muted}
        onToggleMute={() => setMuted((prev) => !prev)}
        onLeaveRoom={handleLeaveRoom}
        onScrollToGuide={handleScrollToGuide}
      />

      {!room || !me ? (
        <LandingView
          nickname={nickname}
          ipLabel={ipLabel}
          initialRoomCode={initialUrlRoom}
          connecting={connecting}
          error={error}
          onNicknameChange={handleNicknameChange}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      ) : room.phase === 'LOBBY' ? (
        <LobbyView
          room={room}
          me={me}
          muted={muted}
          error={error}
          onToggleMute={() => setMuted((prev) => !prev)}
          onUpdateSettings={handleUpdateSettings}
          onUpdateBoard={handleUpdateBoard}
          onRandomizeBoard={handleRandomizeBoard}
          onToggleReady={handleToggleReady}
          onStartGame={handleStartGame}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
        />
      ) : (
        <GameView
          room={room}
          me={me}
          muted={muted}
          error={error}
          onToggleMute={() => setMuted((prev) => !prev)}
          onCallNumber={handleCallNumber}
          onDrawRandom={handleDrawRandom}
          onNextRound={handleNextRound}
          onSendChat={handleSendChat}
        />
      )}
    </div>
  );
}
