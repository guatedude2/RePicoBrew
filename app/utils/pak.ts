// Pico Pak ID '1{DeviceSessionCount}{DeviceId}{RecipeId}'
const padded = (num: number | string, pad: number) => `${String('0').repeat(pad - `${num}`.length)}${num}`;
const reverse = (str: string) => str.split('').reverse().join('');

export const generatePakId = (deviceId: number, recipeId: number, sessionCount: number) => {
  // session count is used for padding
  const paddedSessionCount = padded(sessionCount, 6);
  const paddedDeviceId = padded(deviceId, 3);
  const paddedRecipeId = padded(recipeId, 6);
  const pakId = reverse(padded(Number(`1${paddedSessionCount}${paddedDeviceId}${paddedRecipeId}`).toString(16), 14));
  return pakId;
};

export const getPakIdData = (pakId: string) => {
  if (pakId.length !== 14) {
    return { deviceId: null, recipeId: null };
  }
  const num = parseInt(reverse(pakId), 16).toString();
  const deviceId = Number.parseInt(num.substring(7, 10));
  const recipeId = Number.parseInt(num.substring(11));
  return { deviceId, recipeId };
};
