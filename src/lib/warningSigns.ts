/**
 * 0～3 岁儿童心理行为发育问题预警征象（官方原文逐字照录，共 32 条）
 *
 * 依据：国家卫生健康委《儿童心理行为发育问题预警征象筛查表》。
 * 该表适用于 0～6 岁儿童，本手册仅收录 0～3 岁的 8 个节点。
 * 「领域」标签为本项目为便于筛选而添加的辅助标注，非原表内容。
 * 铁律：sign 字段为原文，任何改写都会导致筛查工具失真，不得润色。
 */
export type WarnDomain = 'language_social' | 'motor' | 'cognitive';

export type WarningSign = {
  age_month: number;
  seq: number;
  /** 官方原文，禁止改写 */
  sign: string;
  domain: WarnDomain;
};

export const WARN_DOMAIN_LABEL: Record<WarnDomain, string> = {
  language_social: '语言社会',
  motor: '运动',
  cognitive: '认知',
};

export const WARNING_SIGNS: readonly WarningSign[] = [
  { age_month: 3, seq: 1, sign: '对很大声音没有反应', domain: 'language_social' },
  { age_month: 3, seq: 2, sign: '逗引时不发音或不会微笑', domain: 'language_social' },
  { age_month: 3, seq: 3, sign: '不注视人脸，不追视移动人或物品', domain: 'cognitive' },
  { age_month: 3, seq: 4, sign: '俯卧时不会抬头', domain: 'motor' },

  { age_month: 6, seq: 1, sign: '发音少，不会笑出声', domain: 'language_social' },
  { age_month: 6, seq: 2, sign: '不会伸手抓物', domain: 'motor' },
  { age_month: 6, seq: 3, sign: '紧握拳松不开', domain: 'motor' },
  { age_month: 6, seq: 4, sign: '不能扶坐', domain: 'motor' },

  { age_month: 8, seq: 1, sign: '听到声音无应答', domain: 'language_social' },
  { age_month: 8, seq: 2, sign: '不会区分生人和熟人', domain: 'language_social' },
  { age_month: 8, seq: 3, sign: '双手间不会传递玩具', domain: 'cognitive' },
  { age_month: 8, seq: 4, sign: '不会独坐', domain: 'motor' },

  { age_month: 12, seq: 1, sign: '呼唤名字无反应', domain: 'language_social' },
  { age_month: 12, seq: 2, sign: '不会模仿「再见」或「欢迎」动作', domain: 'cognitive' },
  { age_month: 12, seq: 3, sign: '不会用拇食指对捏小物品', domain: 'motor' },
  { age_month: 12, seq: 4, sign: '不会扶物站立', domain: 'motor' },

  { age_month: 18, seq: 1, sign: '不会有意识叫「爸爸」或「妈妈」', domain: 'language_social' },
  { age_month: 18, seq: 2, sign: '不会按要求指人或物', domain: 'language_social' },
  { age_month: 18, seq: 3, sign: '与人无目光交流', domain: 'language_social' },
  { age_month: 18, seq: 4, sign: '不会独走', domain: 'motor' },

  { age_month: 24, seq: 1, sign: '不会说 3 个物品的名称', domain: 'language_social' },
  { age_month: 24, seq: 2, sign: '不会按吩咐做简单事情', domain: 'cognitive' },
  { age_month: 24, seq: 3, sign: '不会用勺吃饭', domain: 'motor' },
  { age_month: 24, seq: 4, sign: '不会扶栏上楼梯/台阶', domain: 'motor' },

  { age_month: 30, seq: 1, sign: '不会说 2—3 个字的短语', domain: 'language_social' },
  { age_month: 30, seq: 2, sign: '兴趣单一、刻板', domain: 'language_social' },
  { age_month: 30, seq: 3, sign: '不会示意大小便', domain: 'language_social' },
  { age_month: 30, seq: 4, sign: '不会跑', domain: 'motor' },

  { age_month: 36, seq: 1, sign: '不会说自己的名字', domain: 'language_social' },
  { age_month: 36, seq: 2, sign: '不会玩「拿棍当马骑」等假想游戏', domain: 'cognitive' },
  { age_month: 36, seq: 3, sign: '不会模仿画圆', domain: 'cognitive' },
  { age_month: 36, seq: 4, sign: '不会双脚跳', domain: 'motor' },
];

export function warningSignsAt(month: number): readonly WarningSign[] {
  return WARNING_SIGNS.filter((w) => w.age_month === month);
}

export const WARNING_SOURCE =
  '依据国家卫健委《儿童心理行为发育问题预警征象筛查表》，原文照录；领域标签为本项目辅助标注。';

export const REFERRAL_TEXT = '有任何一条符合，建议尽快咨询儿科医生或儿童保健机构进行评估。';
