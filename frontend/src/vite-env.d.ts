/// <reference types="vite/client" />
declare global {
  interface Window {
    io: any;
    __SWITCHIE_SOCKET_URL__?: string;
    __SWITCHIE_STATIC_DEMO__?: boolean;
  }
}
export {};
