const DAY_MS = 24 * 60 * 60 * 1000;
const BIRTH_YEAR = 2002;
const BIRTH_MONTH = 6; // July, zero-based like Date.UTC.
const BIRTH_DAY = 29;

export function getHomeLevel(now: Date): { level: number; elapsedDays: number; yearDays: number; progress: number } {
  // Beijing is UTC+8. UTC getters keep the visitor's timezone and DST out of the calculation.
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const today = Date.UTC(year, beijing.getUTCMonth(), beijing.getUTCDate());
  const birthdayYear = today < Date.UTC(year, BIRTH_MONTH, BIRTH_DAY) ? year - 1 : year;
  const lastBirthday = Date.UTC(birthdayYear, BIRTH_MONTH, BIRTH_DAY);
  const nextBirthday = Date.UTC(birthdayYear + 1, BIRTH_MONTH, BIRTH_DAY);
  const elapsedDays = (today - lastBirthday) / DAY_MS;
  const yearDays = (nextBirthday - lastBirthday) / DAY_MS;
  return { level: birthdayYear - BIRTH_YEAR, elapsedDays, yearDays, progress: elapsedDays / yearDays };
}
