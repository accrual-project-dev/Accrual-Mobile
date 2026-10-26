import { registerPlugin } from "@capacitor/core";

export interface OAuthSessionPlugin {
  startSession(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
}

export const OAuthSession = registerPlugin<OAuthSessionPlugin>("OAuthSession");
