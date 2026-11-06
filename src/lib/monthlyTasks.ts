export type MonthlyTask = {
  /** 卡片上的短句，尽量直接来自对应条目的 summary */
  text: string;
  /** 对应发展性条目的 slug，用于跳到详情 */
  slug: string;
};

/**
 * 首页「本月 3 件事」。
 * 每条都能在对应阶段页找到来源条目；文案只做摘要，不新增医学结论。
 */
export const MONTHLY_TASKS: Record<string, MonthlyTask[]> = {
  '0-1m': [
    { text: '按需哺乳，不掐表', slug: 'newborn-feeding' },
    { text: '每次都仰卧入睡', slug: 'safe-sleep' },
    { text: '脐带保持干燥，不人为去扯', slug: 'umbilical-cord' },
  ],
  '1-3m': [
    { text: '白天拉开窗帘，夜里只开小灯', slug: 'day-night' },
    { text: '看尿布和体重，不只看奶瓶刻度', slug: 'enough-milk' },
    { text: '出浴 3 分钟内涂保湿', slug: 'eczema-care' },
  ],
  '4-6m': [
    { text: '看到三个辅食信号再加辅食', slug: 'complementary-feeding' },
    { text: '会翻身后，床边沙发尿布台不留人', slug: 'fall-prevention' },
    { text: '用冷藏牙胶或干净手指按摩牙龈', slug: 'teething' },
  ],
  '7-9m': [
    { text: '辅食从泥糊加到带颗粒', slug: 'texture-finger-food' },
    { text: '硬币、电池、磁力珠全部离地 1 米', slug: 'home-safety' },
    { text: '离开前说再见，睡前固定程序', slug: 'separation-anxiety' },
  ],
  '10-12m': [
    { text: '热水壶把手朝内，插座装保护盖', slug: 'burn-electric-safety' },
    { text: '不用学步车', slug: 'no-baby-walker' },
    { text: '一岁前不加盐糖，蜂蜜也不能吃', slug: 'no-salt-sugar' },
  ],
  '13-24m': [
    { text: '背景电视关掉，多和孩子对话', slug: 'language-burst' },
    { text: '游乐场不玩高于 1.5 米的攀爬架', slug: 'playground-safety' },
    { text: '出门前 15 分钟涂物理防晒', slug: 'sun-mosquito' },
  ],
  '25-36m': [
    { text: '看三个信号再开始如厕训练', slug: 'toilet-training' },
    { text: '出门约定牵手，衣服内侧放联系方式', slug: 'road-safety' },
    { text: '固定 3～4 步睡前程序，20 分钟内完成', slug: 'bedtime-night-terror' },
  ],
};
