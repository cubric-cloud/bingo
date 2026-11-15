import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import {
  AVATAR_COLORS,
  BOT_NICKNAMES,
  CUTE_NICKNAMES,
  chooseSmartBotNumber,
  clampSettings,
  evaluateBoard,
  generateRandomBoard,
  getDefaultSettings,
  validateBoard,
} from './src/shared/bingo.ts';
import type {
  ChatMessage,
  PublicPlayerInfo,
  PublicRoomState,
  RoomPhase,
  RoomSettings,
  RoundWinnerRecord,
} from './src/shared/bingo.ts';

interface ServerPlayer {
  id: string;
  socketId: string | null;
  ipLabel: string;
  nickname: string;
  avatarColor: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  board: number[];
  completedLinesCount: number;
  completedLineKeys: string[];
  completedCells: number[];
}

interface ServerRoom {
  code: string;
  hostId: string;
  phase: RoomPhase;
  round: number;
  settings: RoomSettings;
  players: Map<string, ServerPlayer>;
  playerOrder: string[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  lastCalledBy: string | null;
  currentTurnPlayerId: string | null;
  winnerIds: string[];
  history: RoundWinnerRecord[];
  chatMessages: ChatMessage[];
  autoDrawTimer: ReturnType<typeof setInterval> | null;
  botTurnTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, ServerRoom>();
const socketToSession = new Map<string, { clientId: string; roomCode: string | null }>();

function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string
): string {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : remoteAddress || '127.0.0.1';
  const cleaned = raw.trim().replace(/^::ffff:/, '');
  return cleaned || '127.0.0.1';
}

function makeIpLabel(ip: string): string {
  if (ip === '::1' || ip === '127.0.0.1') {
    return 'IP·로컬';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `IP·${parts[0]}.${parts[1]}.*`;
  }
  const digest = crypto.createHash('sha1').update(ip).digest('hex').slice(0, 4).toUpperCase();
  return `IP·${digest}`;
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 30; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const code = String(num);
    if (!rooms.has(code)) return code;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeNickname(raw: unknown, fallbackIndex: number): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 14);
    if (trimmed.length > 0) return trimmed;
  }
  return CUTE_NICKNAMES[fallbackIndex % CUTE_NICKNAMES.length];
}

function addSystemChat(room: ServerRoom, text: string): void {
  room.chatMessages.push({
    id: crypto.randomUUID(),
    sender: '알림',
    text,
    isSystem: true,
    timestamp: Date.now(),
  });
  if (room.chatMessages.length > 50) {
    room.chatMessages.shift();
  }
}

function serializeRoomForPlayer(room: ServerRoom, viewerId: string): PublicRoomState {
  const players: PublicPlayerInfo[] = [];
  for (const pid of room.playerOrder) {
    const p = room.players.get(pid);
    if (!p) continue;
    const canSeeBoard = pid === viewerId || room.phase === 'FINISHED';
    players.push({
      id: p.id,
      ipLabel: p.ipLabel,
      nickname: p.nickname,
      avatarColor: p.avatarColor,
      isHost: p.isHost,
      isBot: p.isBot,
      connected: p.connected,
      ready: p.ready,
      board: canSeeBoard ? p.board : null,
      completedLinesCount: p.completedLinesCount,
      completedLineKeys: p.completedLineKeys,
      completedCells: p.completedCells,
    });
  }

  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    settings: room.settings,
    players,
    calledNumbers: room.calledNumbers,
    lastCalledNumber: room.lastCalledNumber,
    lastCalledBy: room.lastCalledBy,
    currentTurnPlayerId: room.currentTurnPlayerId,
    winnerIds: room.winnerIds,
    history: room.history,
    chatMessages: room.chatMessages,
  };
}

function broadcastRoomState(io: SocketIOServer, room: ServerRoom): void {
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('room:state', serializeRoomForPlayer(room, player.id));
    }
  }
}

function stopAutoDraw(room: ServerRoom): void {
  if (room.autoDrawTimer) {
    clearInterval(room.autoDrawTimer);
    room.autoDrawTimer = null;
  }
}

function stopBotTurn(room: ServerRoom): void {
  if (room.botTurnTimer) {
    clearTimeout(room.botTurnTimer);
    room.botTurnTimer = null;
  }
}

function scheduleBotTurnIfNeeded(io: SocketIOServer, room: ServerRoom): void {
  stopBotTurn(room);
  if (room.phase !== 'PLAYING' || room.settings.mode !== 'TURN_BASED') return;
  const turnId = room.currentTurnPlayerId;
  if (!turnId) return;
  const turnPlayer = room.players.get(turnId);
  if (!turnPlayer || !turnPlayer.isBot) return;

  room.botTurnTimer = setTimeout(() => {
    room.botTurnTimer = null;
    if (room.phase !== 'PLAYING' || room.currentTurnPlayerId !== turnPlayer.id) return;
    const chosen = chooseSmartBotNumber(
      turnPlayer.board,
      room.calledNumbers,
      room.settings.gridSize,
      room.settings.maxNumber,
      room.settings.freeCenter
    );
    if (chosen !== null) {
      processCalledNumber(io, room, chosen, turnPlayer.nickname, turnPlayer.id);
    }
  }, 850);
}

function scheduleCleanupIfEmpty(room: ServerRoom): void {
  const hasConnectedHuman = Array.from(room.players.values()).some(
    (p) => !p.isBot && p.connected
  );
  if (hasConnectedHuman) {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    return;
  }
  stopAutoDraw(room);
  stopBotTurn(room);
  if (!room.cleanupTimer) {
    room.cleanupTimer = setTimeout(() => {
      const stillEmpty = Array.from(room.players.values()).every((p) => p.isBot || !p.connected);
      if (stillEmpty) {
        rooms.delete(room.code);
      }
    }, 1000 * 60 * 10);
  }
}

function recalculateAllPlayers(room: ServerRoom): string[] {
  const calledSet = new Set<number>(room.calledNumbers);
  const winners: string[] = [];

  for (const pid of room.playerOrder) {
    const p = room.players.get(pid);
    if (!p) continue;
    const evalResult = evaluateBoard(
      p.board,
      calledSet,
      room.settings.gridSize,
      room.settings.freeCenter
    );
    p.completedLinesCount = evalResult.completedLines.length;
    p.completedLineKeys = evalResult.lineKeys;
    p.completedCells = evalResult.completedCells;
    if (p.completedLinesCount >= room.settings.targetLines) {
      winners.push(p.id);
    }
  }
  return winners;
}

function findNextTurnPlayer(room: ServerRoom, afterId: string | null): string | null {
  const connectedIds = room.playerOrder.filter((pid) => room.players.get(pid)?.connected);
  if (connectedIds.length === 0) return null;
  if (!afterId) return connectedIds[0];
  const idx = connectedIds.indexOf(afterId);
  if (idx === -1) return connectedIds[0];
  return connectedIds[(idx + 1) % connectedIds.length];
}

function processCalledNumber(
  io: SocketIOServer,
  room: ServerRoom,
  num: number,
  callerNickname: string,
  callerId: string | null
): { ok: boolean; error?: string } {
  if (room.phase !== 'PLAYING') {
    return { ok: false, error: '게임 진행 중에만 번호를 부를 수 있어요.' };
  }
  if (!Number.isInteger(num) || num < 1 || num > room.settings.maxNumber) {
    return { ok: false, error: `1부터 ${room.settings.maxNumber} 사이의 번호만 부를 수 있어요.` };
  }
  if (room.calledNumbers.includes(num)) {
    return { ok: false, error: `${num}번은 이미 불린 숫자예요.` };
  }

  room.calledNumbers.push(num);
  room.lastCalledNumber = num;
  room.lastCalledBy = callerNickname;

  const winners = recalculateAllPlayers(room);
  if (winners.length > 0) {
    stopAutoDraw(room);
    stopBotTurn(room);
    room.phase = 'FINISHED';
    room.winnerIds = winners;
    room.currentTurnPlayerId = null;

    const winnerRecords = winners
      .map((wid) => room.players.get(wid))
      .filter((p): p is ServerPlayer => Boolean(p))
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        lines: p.completedLinesCount,
      }));

    room.history.unshift({
      round: room.round,
      prize: room.settings.prize,
      winners: winnerRecords,
      finishedAt: Date.now(),
    });

    const winnerNames = winnerRecords.map((w) => w.nickname).join(', ');
    addSystemChat(
      room,
      `🎉 ${room.round}라운드 빙고 완성! ${winnerNames}님이 [${room.settings.prize}] 경품을 획득했어요!`
    );
    broadcastRoomState(io, room);
    io.to(room.code).emit('game:won', {
      round: room.round,
      prize: room.settings.prize,
      winners: winnerRecords,
    });
    return { ok: true };
  }

  if (room.settings.mode === 'TURN_BASED') {
    room.currentTurnPlayerId = findNextTurnPlayer(room, callerId ?? room.currentTurnPlayerId);
  }

  // Check if all possible numbers are exhausted
  if (room.calledNumbers.length >= room.settings.maxNumber) {
    stopAutoDraw(room);
    stopBotTurn(room);
    room.phase = 'FINISHED';
    room.winnerIds = [];
    room.currentTurnPlayerId = null;
    addSystemChat(room, '모든 번호가 다 불렸어요! 아쉽게도 목표 줄에 도달한 플레이어가 없습니다.');
    broadcastRoomState(io, room);
    return { ok: true };
  }

  broadcastRoomState(io, room);
  scheduleBotTurnIfNeeded(io, room);
  return { ok: true };
}

function leaveCurrentRoom(io: SocketIOServer, socket: Socket): void {
  const session = socketToSession.get(socket.id);
  if (!session || !session.roomCode) return;

  const room = rooms.get(session.roomCode);
  socket.leave(session.roomCode);
  session.roomCode = null;
  if (!room) return;

  const player = room.players.get(session.clientId);
  if (!player) return;

  player.connected = false;
  player.socketId = null;

  if (room.phase === 'LOBBY') {
    room.players.delete(player.id);
    room.playerOrder = room.playerOrder.filter((id) => id !== player.id);
    addSystemChat(room, `${player.nickname}님이 방을 나갔어요.`);
  } else {
    addSystemChat(room, `${player.nickname}님의 연결이 잠시 끊어졌어요.`);
  }

  if (player.isHost) {
    player.isHost = false;
    const nextHost = room.playerOrder
      .map((id) => room.players.get(id))
      .find((p): p is ServerPlayer => Boolean(p && !p.isBot && p.connected));
    if (nextHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.id;
      addSystemChat(room, `👑 ${nextHost.nickname}님이 새로운 호스트가 되었어요.`);
    }
  }

  if (room.phase === 'PLAYING' && room.currentTurnPlayerId === player.id) {
    room.currentTurnPlayerId = findNextTurnPlayer(room, player.id);
    scheduleBotTurnIfNeeded(io, room);
  }

  scheduleCleanupIfEmpty(room);
  broadcastRoomState(io, room);
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/identity', (req, res) => {
    const ip = extractClientIp(req.headers, req.socket.remoteAddress);
    res.json({
      ipLabel: makeIpLabel(ip),
      suggestedNickname: CUTE_NICKNAMES[Math.floor(Math.random() * CUTE_NICKNAMES.length)],
    });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    const auth = (socket.handshake.auth || {}) as { clientId?: unknown };
    const rawClientId = typeof auth.clientId === 'string' && auth.clientId.trim().length > 0
      ? auth.clientId.trim().slice(0, 64)
      : crypto.randomUUID();
    const ip = extractClientIp(socket.handshake.headers, socket.handshake.address);
    const ipLabel = makeIpLabel(ip);

    socketToSession.set(socket.id, { clientId: rawClientId, roomCode: null });

    socket.on(
      'room:create',
      (
        payload: { nickname?: string; settings?: Partial<RoomSettings> },
        callback?: (res: { ok: boolean; code?: string; error?: string }) => void
      ) => {
        leaveCurrentRoom(io, socket);
        const code = generateRoomCode();
        const settings = clampSettings(payload?.settings ?? {}, getDefaultSettings());
        const nickname = sanitizeNickname(payload?.nickname, Math.floor(Math.random() * 10));

        const hostPlayer: ServerPlayer = {
          id: rawClientId,
          socketId: socket.id,
          ipLabel,
          nickname,
          avatarColor: AVATAR_COLORS[0],
          isHost: true,
          isBot: false,
          connected: true,
          ready: true,
          board: generateRandomBoard(settings.gridSize, settings.maxNumber, settings.freeCenter),
          completedLinesCount: 0,
          completedLineKeys: [],
          completedCells: [],
        };

        const room: ServerRoom = {
          code,
          hostId: rawClientId,
          phase: 'LOBBY',
          round: 1,
          settings,
          players: new Map([[rawClientId, hostPlayer]]),
          playerOrder: [rawClientId],
          calledNumbers: [],
          lastCalledNumber: null,
          lastCalledBy: null,
          currentTurnPlayerId: null,
          winnerIds: [],
          history: [],
          chatMessages: [],
          autoDrawTimer: null,
          botTurnTimer: null,
          cleanupTimer: null,
        };

        addSystemChat(room, `${nickname}님이 빙고 방(${code})을 만들었어요!`);
        rooms.set(code, room);
        socket.join(code);
        socketToSession.set(socket.id, { clientId: rawClientId, roomCode: code });

        callback?.({ ok: true, code });
        broadcastRoomState(io, room);
      }
    );

    socket.on(
      'room:join',
      (
        payload: { code?: string; nickname?: string },
        callback?: (res: { ok: boolean; code?: string; error?: string }) => void
      ) => {
        const cleanCode = String(payload?.code ?? '').trim().replace(/\s+/g, '');
        const room = rooms.get(cleanCode);
        if (!room) {
          callback?.({ ok: false, error: '해당 방 코드 번호를 찾을 수 없어요. 다시 확인해 주세요!' });
          return;
        }

        const existingSession = socketToSession.get(socket.id);
        if (existingSession?.roomCode && existingSession.roomCode !== cleanCode) {
          leaveCurrentRoom(io, socket);
        }

        let player = room.players.get(rawClientId);
        if (player) {
          player.socketId = socket.id;
          player.connected = true;
          player.ipLabel = ipLabel;
          if (payload?.nickname && payload.nickname.trim().length > 0) {
            player.nickname = sanitizeNickname(payload.nickname, room.playerOrder.length);
          }
          addSystemChat(room, `${player.nickname}님이 다시 입장했어요.`);
        } else {
          if (room.phase !== 'LOBBY') {
            callback?.({
              ok: false,
              error: '이미 게임이 진행 중인 방이에요. 다음 라운드 대기 시 입장할 수 있어요.',
            });
            return;
          }
          if (room.players.size >= room.settings.maxPlayers) {
            callback?.({
              ok: false,
              error: `방 정원(${room.settings.maxPlayers}명)이 가득 찼어요.`,
            });
            return;
          }
          const idx = room.playerOrder.length;
          const nickname = sanitizeNickname(payload?.nickname, idx);
          player = {
            id: rawClientId,
            socketId: socket.id,
            ipLabel,
            nickname,
            avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            isHost: false,
            isBot: false,
            connected: true,
            ready: false,
            board: generateRandomBoard(
              room.settings.gridSize,
              room.settings.maxNumber,
              room.settings.freeCenter
            ),
            completedLinesCount: 0,
            completedLineKeys: [],
            completedCells: [],
          };
          room.players.set(rawClientId, player);
          room.playerOrder.push(rawClientId);
          addSystemChat(room, `${nickname}님이 입장했어요!`);
        }

        if (room.cleanupTimer) {
          clearTimeout(room.cleanupTimer);
          room.cleanupTimer = null;
        }

        socket.join(cleanCode);
        socketToSession.set(socket.id, { clientId: rawClientId, roomCode: cleanCode });
        callback?.({ ok: true, code: cleanCode });
        broadcastRoomState(io, room);
      }
    );

    socket.on('room:leave', () => {
      leaveCurrentRoom(io, socket);
    });

    socket.on('room:updateSettings', (payload: { settings?: Partial<RoomSettings> }) => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room || room.hostId !== rawClientId || room.phase !== 'LOBBY') return;

      const prev = room.settings;
      const next = clampSettings(payload?.settings ?? {}, prev, room.players.size);
      const boardStructureChanged =
        prev.gridSize !== next.gridSize ||
        prev.maxNumber !== next.maxNumber ||
        prev.freeCenter !== next.freeCenter;

      room.settings = next;

      if (boardStructureChanged) {
        for (const p of room.players.values()) {
          p.board = generateRandomBoard(next.gridSize, next.maxNumber, next.freeCenter);
          p.completedLinesCount = 0;
          p.completedLineKeys = [];
          p.completedCells = [];
          if (!p.isHost && !p.isBot) p.ready = false;
        }
      }

      broadcastRoomState(io, room);
    });

    socket.on(
      'room:addBot',
      (callback?: (res: { ok: boolean; error?: string }) => void) => {
        const session = socketToSession.get(socket.id);
        if (!session?.roomCode) return;
        const room = rooms.get(session.roomCode);
        if (!room || room.hostId !== rawClientId || room.phase !== 'LOBBY') return;

        if (room.players.size >= room.settings.maxPlayers) {
          callback?.({
            ok: false,
            error: `설정된 최대 인원(${room.settings.maxPlayers}명)에 도달했어요. 인원수를 늘려주세요!`,
          });
          return;
        }

        const existingNames = new Set(Array.from(room.players.values()).map((p) => p.nickname));
        const availableBotName =
          BOT_NICKNAMES.find((name) => !existingNames.has(name)) ??
          `컴퓨터 AI ${room.players.size}`;
        const botId = `bot-${crypto.randomUUID()}`;
        const idx = room.playerOrder.length;

        const botPlayer: ServerPlayer = {
          id: botId,
          socketId: null,
          ipLabel: 'AI·컴퓨터',
          nickname: availableBotName,
          avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          isHost: false,
          isBot: true,
          connected: true,
          ready: true,
          board: generateRandomBoard(
            room.settings.gridSize,
            room.settings.maxNumber,
            room.settings.freeCenter
          ),
          completedLinesCount: 0,
          completedLineKeys: [],
          completedCells: [],
        };

        room.players.set(botId, botPlayer);
        room.playerOrder.push(botId);
        addSystemChat(room, `🤖 ${availableBotName}님이 게임에 합류했어요!`);
        callback?.({ ok: true });
        broadcastRoomState(io, room);
      }
    );

    socket.on('room:removeBot', (payload: { botId?: string }) => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room || room.hostId !== rawClientId || room.phase !== 'LOBBY') return;

      const botId = payload?.botId;
      if (!botId) return;
      const bot = room.players.get(botId);
      if (!bot || !bot.isBot) return;

      room.players.delete(botId);
      room.playerOrder = room.playerOrder.filter((id) => id !== botId);
      addSystemChat(room, `${bot.nickname}님이 대기실에서 나갔어요.`);
      broadcastRoomState(io, room);
    });

    socket.on(
      'player:updateBoard',
      (
        payload: { board?: number[] },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const session = socketToSession.get(socket.id);
        if (!session?.roomCode) return;
        const room = rooms.get(session.roomCode);
        if (!room || room.phase !== 'LOBBY') return;
        const player = room.players.get(rawClientId);
        if (!player) return;

        if (
          !validateBoard(
            payload?.board,
            room.settings.gridSize,
            room.settings.maxNumber,
            room.settings.freeCenter
          )
        ) {
          callback?.({
            ok: false,
            error: `1부터 ${room.settings.maxNumber}까지 중복 없는 번호로 채워주세요.`,
          });
          return;
        }

        player.board = payload.board;
        callback?.({ ok: true });
        broadcastRoomState(io, room);
      }
    );

    socket.on('player:randomizeBoard', () => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      const player = room.players.get(rawClientId);
      if (!player) return;

      player.board = generateRandomBoard(
        room.settings.gridSize,
        room.settings.maxNumber,
        room.settings.freeCenter
      );
      broadcastRoomState(io, room);
    });

    socket.on('player:toggleReady', () => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      const player = room.players.get(rawClientId);
      if (!player || player.isHost) return;

      player.ready = !player.ready;
      broadcastRoomState(io, room);
    });

    socket.on(
      'game:start',
      (callback?: (res: { ok: boolean; error?: string }) => void) => {
        const session = socketToSession.get(socket.id);
        if (!session?.roomCode) return;
        const room = rooms.get(session.roomCode);
        if (!room || room.hostId !== rawClientId || room.phase !== 'LOBBY') return;

        const guests = Array.from(room.players.values()).filter((p) => !p.isHost && p.connected);
        const notReady = guests.filter((g) => !g.ready);
        if (notReady.length > 0) {
          callback?.({
            ok: false,
            error: `${notReady.map((g) => g.nickname).join(', ')}님이 아직 준비 중이에요!`,
          });
          return;
        }

        stopAutoDraw(room);
        stopBotTurn(room);
        room.phase = 'PLAYING';
        room.calledNumbers = [];
        room.lastCalledNumber = null;
        room.lastCalledBy = null;
        room.winnerIds = [];
        room.currentTurnPlayerId =
          room.settings.mode === 'TURN_BASED' ? findNextTurnPlayer(room, null) : null;

        recalculateAllPlayers(room);
        addSystemChat(
          room,
          `🎲 ${room.round}라운드 시작! (${room.settings.gridSize}×${room.settings.gridSize} · ${room.settings.targetLines}줄 빙고 · 경품: ${room.settings.prize})`
        );

        callback?.({ ok: true });
        broadcastRoomState(io, room);
        scheduleBotTurnIfNeeded(io, room);
      }
    );

    socket.on(
      'game:callNumber',
      (
        payload: { number?: number },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const session = socketToSession.get(socket.id);
        if (!session?.roomCode) return;
        const room = rooms.get(session.roomCode);
        if (!room || room.phase !== 'PLAYING') return;
        const player = room.players.get(rawClientId);
        if (!player) return;

        if (room.settings.mode === 'TURN_BASED') {
          if (room.currentTurnPlayerId !== rawClientId) {
            callback?.({ ok: false, error: '아직 내 차례가 아니에요!' });
            return;
          }
        } else if (room.hostId !== rawClientId) {
          callback?.({ ok: false, error: '호스트만 번호를 부를 수 있어요!' });
          return;
        }

        const num = Number(payload?.number);
        const result = processCalledNumber(io, room, num, player.nickname, player.id);
        callback?.(result);
      }
    );

    socket.on(
      'game:drawRandom',
      (callback?: (res: { ok: boolean; number?: number; error?: string }) => void) => {
        const session = socketToSession.get(socket.id);
        if (!session?.roomCode) return;
        const room = rooms.get(session.roomCode);
        if (!room || room.phase !== 'PLAYING') return;
        const player = room.players.get(rawClientId);
        if (!player) return;

        if (room.settings.mode === 'HOST_DRAW' && room.hostId !== rawClientId) {
          callback?.({ ok: false, error: '호스트만 볼을 추첨할 수 있어요!' });
          return;
        }
        if (room.settings.mode === 'TURN_BASED' && room.currentTurnPlayerId !== rawClientId) {
          callback?.({ ok: false, error: '내 차례일 때만 랜덤 번호를 부를 수 있어요!' });
          return;
        }

        const available: number[] = [];
        for (let n = 1; n <= room.settings.maxNumber; n++) {
          if (!room.calledNumbers.includes(n)) available.push(n);
        }
        if (available.length === 0) {
          callback?.({ ok: false, error: '더 이상 뽑을 번호가 없어요.' });
          return;
        }
        const picked = available[Math.floor(Math.random() * available.length)];
        const result = processCalledNumber(io, room, picked, player.nickname, player.id);
        callback?.({ ...result, number: picked });
      }
    );

    socket.on('game:nextRound', () => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room || room.hostId !== rawClientId || room.phase !== 'FINISHED') return;

      stopAutoDraw(room);
      stopBotTurn(room);
      room.phase = 'LOBBY';
      room.round += 1;
      room.calledNumbers = [];
      room.lastCalledNumber = null;
      room.lastCalledBy = null;
      room.currentTurnPlayerId = null;
      room.winnerIds = [];

      for (const p of room.players.values()) {
        p.board = generateRandomBoard(
          room.settings.gridSize,
          room.settings.maxNumber,
          room.settings.freeCenter
        );
        p.completedLinesCount = 0;
        p.completedLineKeys = [];
        p.completedCells = [];
        p.ready = p.isHost || p.isBot;
      }

      addSystemChat(
        room,
        `✨ ${room.round}라운드 대기실이 열렸어요! 새로운 판과 경품을 설정해 보세요.`
      );
      broadcastRoomState(io, room);
    });

    socket.on('chat:send', (payload: { text?: string }) => {
      const session = socketToSession.get(socket.id);
      if (!session?.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room) return;
      const player = room.players.get(rawClientId);
      if (!player) return;

      const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 80) : '';
      if (!text) return;

      room.chatMessages.push({
        id: crypto.randomUUID(),
        sender: player.nickname,
        text,
        timestamp: Date.now(),
      });
      if (room.chatMessages.length > 50) {
        room.chatMessages.shift();
      }
      broadcastRoomState(io, room);
    });

    socket.on('disconnect', () => {
      const session = socketToSession.get(socket.id);
      if (session?.roomCode) {
        const room = rooms.get(session.roomCode);
        if (room) {
          const player = room.players.get(session.clientId);
          if (player && player.socketId === socket.id) {
            player.connected = false;
            player.socketId = null;

            if (room.phase === 'LOBBY') {
              room.players.delete(player.id);
              room.playerOrder = room.playerOrder.filter((id) => id !== player.id);
              addSystemChat(room, `${player.nickname}님이 퇴장했어요.`);
            } else {
              addSystemChat(room, `${player.nickname}님의 연결이 끊어졌어요.`);
            }

            if (player.isHost) {
              player.isHost = false;
              const nextHost = room.playerOrder
                .map((id) => room.players.get(id))
                .find((p): p is ServerPlayer => Boolean(p && !p.isBot && p.connected));
              if (nextHost) {
                nextHost.isHost = true;
                room.hostId = nextHost.id;
                addSystemChat(room, `👑 ${nextHost.nickname}님이 새로운 호스트가 되었어요.`);
              }
            }

            if (room.phase === 'PLAYING' && room.currentTurnPlayerId === player.id) {
              room.currentTurnPlayerId = findNextTurnPlayer(room, player.id);
              scheduleBotTurnIfNeeded(io, room);
            }

            scheduleCleanupIfEmpty(room);
            broadcastRoomState(io, room);
          }
        }
      }
      socketToSession.delete(socket.id);
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Bingo server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Bingo server:', err);
  process.exit(1);
});
