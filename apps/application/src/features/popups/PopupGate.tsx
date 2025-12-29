import { createContext, useContext, useMemo, useRef, useState } from "react";

type PopupGateApi = {
  activeKey: string | null;
  tryAcquire: (key: string) => boolean;
  release: (key: string) => void;
};

const defaultApi: PopupGateApi = {
  activeKey: null,
  tryAcquire: () => true,
  release: () => {},
};

const PopupGateContext = createContext<PopupGateApi>(defaultApi);

export function PopupGateProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  // Keep ref in sync with state (state is for re-rendering; ref is for atomic reads/writes).
  if (activeKeyRef.current !== activeKey) {
    activeKeyRef.current = activeKey;
  }

  const api = useMemo<PopupGateApi>(() => {
    return {
      activeKey,
      tryAcquire: (key) => {
        const current = activeKeyRef.current;
        if (current === null || current === key) {
          activeKeyRef.current = key;
          setActiveKey(key);
          return true;
        }
        return false;
      },
      release: (key) => {
        if (activeKeyRef.current === key) {
          activeKeyRef.current = null;
          setActiveKey(null);
        }
      },
    };
  }, [activeKey]);

  return (
    <PopupGateContext.Provider value={api}>
      {children}
    </PopupGateContext.Provider>
  );
}

export function usePopupGate() {
  return useContext(PopupGateContext);
}
