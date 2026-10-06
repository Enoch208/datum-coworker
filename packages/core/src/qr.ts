import type { QrPayload, SpotCode } from "./contract";

const spotCodePattern = /^[A-Z0-9]{1,4}$/;
const campaignIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const baseUrlPattern = /^https?:\/\/[^/?#\s]+(?:\/[^?#\s]*)?$/;

export const isSpotCode = (value: SpotCode): boolean => spotCodePattern.test(value);

export const isCampaignId = (value: string): boolean => campaignIdPattern.test(value);

export const compareSpotCodes = (left: SpotCode, right: SpotCode): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const spotRoutePrefix = (baseUrl: string): string => {
  if (!baseUrlPattern.test(baseUrl)) {
    throw new RangeError(`QR base URL must be absolute http(s) without query: ${baseUrl}`);
  }
  return `${baseUrl.replace(/\/+$/, "")}/c/`;
};

export const buildSpotQrUrl = (baseUrl: string, payload: QrPayload): string => {
  if (!isCampaignId(payload.campaignId)) {
    throw new RangeError(`Campaign id cannot appear in a QR path: ${payload.campaignId}`);
  }
  if (!isSpotCode(payload.spotCode)) {
    throw new RangeError(`Spot code must be 1-4 uppercase letters or digits: ${payload.spotCode}`);
  }
  return `${spotRoutePrefix(baseUrl)}${payload.campaignId}/${payload.spotCode}`;
};

export const parseSpotQrUrl = (baseUrl: string, decodedText: string): QrPayload | null => {
  const prefix = spotRoutePrefix(baseUrl);
  if (!decodedText.startsWith(prefix)) return null;
  const segments = decodedText.slice(prefix.length).split("/");
  const [campaignId, spotCode] = segments;
  if (segments.length !== 2 || campaignId === undefined || spotCode === undefined) return null;
  if (!isCampaignId(campaignId) || !isSpotCode(spotCode)) return null;
  return { campaignId, spotCode };
};
