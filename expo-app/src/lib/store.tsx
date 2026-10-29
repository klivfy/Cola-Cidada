import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { initialState, recoverStoredState, reduce, type Action } from './state';
import type { Alert, AppState, Politician, Prefs } from './types';

// Os dados ficam só no aparelho (LGPD), com a mesma chave e formato do PWA.
export const STORAGE_KEY = 'monitor-cidadao:v1';

interface Store {
  state: AppState;
  /** false até os dados salvos serem lidos; evita piscar a tela vazia */
  ready: boolean;
  storageError: 'read' | 'write' | null;
  retryStorage: () => Promise<boolean>;
  add: (p: Politician) => boolean;
  /** remove e devolve uma função que desfaz, na mesma posição */
  remove: (id: string) => () => void;
  /** guarda os alertas ainda desconhecidos e devolve quantos eram novos */
  addAlerts: (alerts: Alert[]) => number;
  setPref: (key: keyof Prefs, value: boolean) => void;
  purge: () => Promise<boolean>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<'read' | 'write' | null>(null);
  const stateRef = useRef(state);
  const readFailed = useRef(true);
  const pendingActions = useRef<Action[]>([]);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const writeVersion = useRef(0);
  useEffect(() => {
    stateRef.current = state;
  });

  const applyAction = useCallback((action: Action) => {
    if (readFailed.current) pendingActions.current.push(action);
    dispatch(action);
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        dispatch({ type: 'hydrate', state: recoverStoredState(raw, pendingActions.current) });
        pendingActions.current = [];
        readFailed.current = false;
      })
      .catch(() => {
        if (alive) {
          readFailed.current = true;
          setStorageError('read');
        }
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // grava a cada mudança, depois de lido o que já havia (senão apagaria os dados antes de carregá-los)
  useEffect(() => {
    if (!ready || readFailed.current) return;
    const version = ++writeVersion.current;
    const json = JSON.stringify(state);
    writeQueue.current = writeQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(STORAGE_KEY, json));
    writeQueue.current.then(
      () => { if (version === writeVersion.current) setStorageError(null); },
      () => { if (version === writeVersion.current) setStorageError('write'); },
    );
  }, [state, ready]);

  const retryStorage = useCallback(async () => {
    if (readFailed.current) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        dispatch({ type: 'hydrate', state: recoverStoredState(raw, pendingActions.current) });
        pendingActions.current = [];
        readFailed.current = false;
        setStorageError(null);
        return true;
      } catch {
        setStorageError('read');
        return false;
      }
    }
    try {
      await writeQueue.current.catch(() => {});
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      setStorageError(null);
      return true;
    } catch {
      setStorageError('write');
      return false;
    }
  }, []);

  const add = useCallback((p: Politician) => {
    if (stateRef.current.politicians.some((x) => x.id === p.id)) return false;
    applyAction({ type: 'add', politician: p });
    return true;
  }, [applyAction]);

  const remove = useCallback((id: string) => {
    const index = stateRef.current.politicians.findIndex((p) => p.id === id);
    const politician = stateRef.current.politicians[index];
    applyAction({ type: 'remove', id });
    return () => {
      if (politician) applyAction({ type: 'restore', politician, index });
    };
  }, [applyAction]);

  const addAlerts = useCallback((alerts: Alert[]) => {
    const known = new Set(stateRef.current.alerts.map((a) => a.id));
    const count = alerts.filter((a) => !known.has(a.id)).length;
    if (count) applyAction({ type: 'addAlerts', alerts });
    return count;
  }, [applyAction]);

  const setPref = useCallback((key: keyof Prefs, value: boolean) => applyAction({ type: 'setPref', key, value }), [applyAction]);

  const purge = useCallback(async () => {
    await writeQueue.current.catch(() => {});
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      readFailed.current = false;
      pendingActions.current = [];
      dispatch({ type: 'purge' });
      setStorageError(null);
      return true;
    } catch {
      setStorageError('write');
      return false;
    }
  }, []);

  const value = useMemo(() => ({ state, ready, storageError, retryStorage, add, remove, addAlerts, setPref, purge }), [state, ready, storageError, retryStorage, add, remove, addAlerts, setPref, purge]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore precisa estar dentro de <StoreProvider>');
  return s;
}
