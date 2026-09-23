import { useEffect, useRef } from 'react';
import markup from '../legacy/legacyMarkup.html?raw';

/** Transitional compatibility shell: preserves the existing Switchie DOM exactly while the UI is migrated component-by-component. */
export function LegacySwitchie() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    (async () => {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const { io } = await import('socket.io-client');
      if (disposed) return;
      window.io = io;
      window.__SWITCHIE_SOCKET_URL__ = socketUrl;
      window.__SWITCHIE_STATIC_DEMO__ = import.meta.env.VITE_STATIC_DEMO === 'true';
      await import('../legacy/layoutEditor.js');
      await import('../legacy/game.js');
    })();
    return () => { disposed = true; };
  }, []);
  return <div ref={root} dangerouslySetInnerHTML={{ __html: markup }} />;
}
