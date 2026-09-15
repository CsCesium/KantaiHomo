/** Display only the local return clock time; scheduling still uses the full timestamp. */
export function formatExpeditionReturnTime(returnTime: number): string {
  const date = new Date(returnTime);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}
