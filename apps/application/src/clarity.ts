import Clarity from "@microsoft/clarity";

declare global {
  interface Window {
    clarity?: (command: string, ...args: unknown[]) => void;
  }
}

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID || "u0u0jy5vvw";
const enabled = import.meta.env.PROD || !!import.meta.env.VITE_CLARITY_PROJECT_ID;

if (enabled) {
  Clarity.init(projectId);
}

const call = (cmd: string, ...args: unknown[]) => {
  if (!enabled) return;
  window.clarity?.(cmd, ...args);
};

export const clarity = {
  event: (name: string, data?: Record<string, string | number | boolean | null>) =>
    call("event", name, data),
  identify: (userId: string, props?: Record<string, string | number | boolean>) =>
    call("identify", userId, props),
  set: (key: string, value: string | number | boolean) => call("set", key, value),
  page: (name: string) => call("event", "page_view", { page: name }),
  consent: (granted: boolean) => call("consent", granted),
};