/**
 * 两级状态：资料整理 ≠ 专业复核
 * - 资料整理（compiled）：编辑把公开指南拆成条目、标注来源与日期，今天就已完成；
 * - 专业复核（clinical）：具备儿科 / 儿童保健背景的人对照原文逐条核对，目前多数条目还没有。
 * 页面上的文案必须把两者分开写，不能用一个「复核日期」暗示已经过医学复核。
 */
export type ClinicalStatus = 'pending' | 'done';

export type MedicalReview = {
  status?: string;
  reviewer?: string;
  date?: string;
};

export type ReviewInfo = {
  /** 资料整理日期（frontmatter: last_reviewed） */
  compiledOn: string;
  compiledBy: string;
  clinical: ClinicalStatus;
  /** 「已专业复核」/「待专业复核」 */
  clinicalLabel: string;
  clinicalBy: string;
  clinicalOn: string;
};

export function reviewInfo(
  lastReviewed: string | undefined,
  reviewer: string | undefined,
  medicalReview?: MedicalReview
): ReviewInfo {
  const clinical: ClinicalStatus = medicalReview?.status === 'done' ? 'done' : 'pending';
  return {
    compiledOn: lastReviewed ?? '',
    compiledBy: reviewer?.trim() || '内容组',
    clinical,
    clinicalLabel: clinical === 'done' ? '已完成' : '待完成',
    clinicalBy: clinical === 'done' ? medicalReview?.reviewer ?? '' : '',
    clinicalOn: clinical === 'done' ? medicalReview?.date ?? '' : '',
  };
}

export function formatDate(iso: string): string {
  return iso ? iso.replace(/-/g, '.') : '—';
}
