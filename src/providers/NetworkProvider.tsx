/**
 * Connectivity state, and the trigger that drains the offline outbox the
 * moment the network comes back.
 */
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { pendingCount } from '../lib/offline/db';
import { flushOutbox } from '../lib/offline/sync';

interface NetworkContextValue {
  online: boolean;
  /** Number of edits waiting to reach the server. */
  queued: number;
  /** Force a flush — used by the manual "retry" affordance. */
  sync(): Promise<void>;
  refreshQueue(): Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  const refreshQueue = useCallback(async () => {
    setQueued(await pendingCount());
  }, []);

  const sync = useCallback(async () => {
    const result = await flushOutbox();
    await refreshQueue();
    if (result.synced > 0) {
      // Server state has moved; let every screen re-read it.
      await queryClient.invalidateQueries();
    }
  }, [queryClient, refreshQueue]);

  useEffect(() => {
    void refreshQueue();

    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while probing; treat that as connected
      // rather than flashing an offline banner on every network change.
      const connected = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setOnline(connected);

      if (connected && wasOffline.current) {
        void sync();
      }
      wasOffline.current = !connected;
    });

    return unsubscribe;
  }, [sync, refreshQueue]);

  const value = useMemo(
    () => ({ online, queued, sync, refreshQueue }),
    [online, queued, sync, refreshQueue],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used inside <NetworkProvider>');
  return ctx;
}
