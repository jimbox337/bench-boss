import { prisma } from './prisma';
import { decryptCredential, encryptCredential } from './espnCredentials';
import { refreshTokens, yahooConfig, type YahooTokens } from './yahooFantasy';

export async function saveYahooTokens(userId: string, tokens: YahooTokens) {
  const data = {
    accessToken: encryptCredential(tokens.accessToken),
    refreshToken: encryptCredential(tokens.refreshToken) as string,
    expiresAt: tokens.expiresAt,
  };
  await prisma.yahooConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** A valid access token for the user, refreshing (and persisting) it when expired. Null if not connected. */
export async function yahooAccessToken(userId: string): Promise<string | null> {
  const config = yahooConfig();
  if (!config) return null;
  const connection = await prisma.yahooConnection.findUnique({ where: { userId } });
  if (!connection) return null;
  const access = decryptCredential(connection.accessToken);
  if (access && connection.expiresAt && connection.expiresAt.getTime() > Date.now()) return access;
  const refresh = decryptCredential(connection.refreshToken);
  if (!refresh) return null;
  const tokens = await refreshTokens(config, refresh);
  await saveYahooTokens(userId, tokens);
  return tokens.accessToken;
}

export async function deleteYahooConnection(userId: string) {
  await prisma.yahooConnection.deleteMany({ where: { userId } });
}
