/**
 * 月龄计算：日历月差，不做「天数 ÷ 30」。
 * 家长与儿保医生都用日历月说话，除法会累积偏差。
 */
export type AgeInfo = {
  /** 用于阶段映射的月龄（早产儿已矫正） */
  months: number;
  /** 实际月龄 */
  rawMonths: number;
  /** 是否采用了矫正月龄 */
  corrected: boolean;
  /** 实际天数 */
  days: number;
  /** 矫正月龄的余天（仅 corrected 时有意义，用于「3 个月 15 天」的表达） */
  correctedExtraDays: number;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function wholeMonths(a: Date, b: Date): number {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1; // 未到当月同日，不进位
  return Math.max(0, m);
}

export function calcAge(birth: Date, today: Date = new Date(), gestationalWeeks = 40): AgeInfo {
  const rawMonths = wholeMonths(birth, today);
  const days = Math.floor(
    (startOfDay(today).getTime() - startOfDay(birth).getTime()) / 86400000
  );

  // 早产儿：胎龄 < 37 周，矫正至实际月龄 24 个月为止
  const isPreterm = gestationalWeeks < 37;
  const correctionMonths = isPreterm ? (40 - gestationalWeeks) / 4.345 : 0;
  const corrected = isPreterm && rawMonths < 24 && correctionMonths > 0;

  const rawDays = Math.max(0, days);
  const correctionDays = Math.round(correctionMonths * 30.4375);
  const correctedDays = corrected ? Math.max(0, rawDays - correctionDays) : rawDays;

  const months = corrected ? Math.floor(correctedDays / 30.4375) : rawMonths;

  return {
    months: Math.max(0, months),
    rawMonths,
    corrected,
    days,
    correctedExtraDays: corrected ? correctedDays - Math.floor(correctedDays / 30.4375) * 30.4375 : 0,
  };
}

/** 解析 localStorage 中的字符串日期为本地 Date，非法返回 null */
export function parseBirthDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > startOfDay(new Date()).getTime()) return null;
  return date;
}

export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
