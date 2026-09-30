/**
 * Numerology and Zodiac Calculator for Birthdates
 */

export interface NumerologyResult {
  birthDateDigits: number[];
  talentNumber: number; // e.g. 33
  talentDigits: number[]; // e.g. [3, 3]
  lifeNumber: number; // 1-9 (命數)
  zodiac: string; // 星座
  zodiacNumber: number; // 星座數 1-9 (紫色)
  birthdayNumber: number; // 生日數 1-9 (出生日期相加至個位數，黃色)
  digitCounts: Record<number, number>; // 1-9 occurrence counts for 9-grid (先天數)
}

export function getZodiac(month: number, day: number): string {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return '牡羊座';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return '金牛座';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return '雙子座';
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return '巨蟹座';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return '獅子座';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return '處女座';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 23)) return '天秤座';
  if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) return '天蠍座';
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return '射手座';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return '摩羯座';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return '水瓶座';
  return '雙魚座';
}

export function getZodiacNumber(zodiac: string): number {
  switch (zodiac) {
    case '牡羊座': return 1;
    case '金牛座': return 2;
    case '雙子座': return 3;
    case '巨蟹座': return 4;
    case '獅子座': return 5;
    case '處女座': return 6;
    case '天秤座': return 7;
    case '天蠍座': return 8;
    case '射手座': return 9;
    case '摩羯座':
    case '魔羯座': return 1; // 10 -> 1+0=1
    case '水瓶座': return 2; // 11 -> 1+1=2
    case '雙魚座': return 3; // 12 -> 1+2=3
    default: return 1;
  }
}

export function calculateBirthdayNumber(day: number): number {
  let cur = day;
  while (cur >= 10) {
    const digits = String(cur).split('').map(Number);
    cur = digits.reduce((acc, d) => acc + d, 0);
  }
  return cur;
}

export function calculateNumerology(birthdayString: string): NumerologyResult | null {
  if (!birthdayString) return null;
  // expects YYYY-MM-DD or YYYY/MM/DD
  const clean = birthdayString.replace(/[^0-9]/g, '');
  if (clean.length !== 8) return null;

  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10);
  const day = parseInt(clean.substring(6, 8), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const birthDateDigits = clean.split('').map(Number);

  // Sum all 8 digits
  const sum1 = birthDateDigits.reduce((acc, d) => acc + d, 0);

  // If sum1 is 2 digits, talent number is sum1
  let talentNumber = sum1;
  let current = sum1;

  while (current >= 10) {
    const digits = String(current).split('').map(Number);
    current = digits.reduce((acc, d) => acc + d, 0);
  }

  const lifeNumber = current; // 1-9
  const talentDigits = String(talentNumber).split('').map(Number);

  // Count occurrences of each number 1-9 across birthdate digits (先天數)
  const digitCounts: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
  };

  birthDateDigits.forEach(d => {
    if (d >= 1 && d <= 9) digitCounts[d]++;
  });

  const zodiac = getZodiac(month, day);
  const zodiacNumber = getZodiacNumber(zodiac);
  const birthdayNumber = calculateBirthdayNumber(day);

  return {
    birthDateDigits,
    talentNumber,
    talentDigits,
    lifeNumber,
    zodiac,
    zodiacNumber,
    birthdayNumber,
    digitCounts
  };
}
