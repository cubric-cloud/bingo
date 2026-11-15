import { CUTE_NICKNAMES } from '../shared/bingo.ts';

const CLIENT_ID_KEY = 'bingo_party_client_id';
const NICKNAME_KEY = 'bingo_party_nickname';

export function getOrCreateClientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `guest-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getStoredNickname(): string {
  const saved = localStorage.getItem(NICKNAME_KEY);
  if (saved && saved.trim().length > 0) return saved.trim();
  const fallback = CUTE_NICKNAMES[Math.floor(Math.random() * CUTE_NICKNAMES.length)];
  localStorage.setItem(NICKNAME_KEY, fallback);
  return fallback;
}

export function saveNickname(nickname: string): void {
  const clean = nickname.trim().slice(0, 14);
  if (clean.length > 0) {
    localStorage.setItem(NICKNAME_KEY, clean);
  }
}
