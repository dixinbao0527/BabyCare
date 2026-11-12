export const VENUE_LABEL: Record<string, string> = {
  city_park: '城市公园',
  forest_park: '森林公园',
  wetland: '湿地',
  riverside: '滨水步道',
  botanical: '植物园',
  zoo: '动物园',
  playground: '儿童乐园',
  scenic: '风景区',
  heritage: '历史名园',
};

export const FACILITY_LABEL: Record<string, string> = {
  yes: '有',
  partial: '部分',
  no: '无',
  unknown: '未核实',
};

export const TICKET_LABEL: Record<string, string> = {
  free: '免费',
  paid: '需购票',
  unknown: '票务未核实',
};

export const SEASON_LABEL: Record<string, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

/** 安全提示：只写「注意什么 + 站内哪里看」，不写处置步骤、不写药品 */
export const SAFETY_ITEMS: Record<
  string,
  { label: string; tip: string; acute?: string; dev?: string }
> = {
  water: {
    label: '开放水域',
    tip: '临水路段全程牵护，不让孩子单独靠近岸边；推车停稳后再抱孩子。',
    acute: 'head-injury',
    dev: 'playground-safety',
  },
  sun: {
    label: '日晒',
    tip: '出门前 15 分钟涂物理防晒，戴宽檐帽；夏季避开 10:00—16:00 的长时间户外停留。',
    acute: 'dehydration',
    dev: 'sun-mosquito',
  },
  mosquito: {
    label: '蚊虫',
    tip: '穿浅色长袖长裤，裸露部位使用适合年龄的驱蚊产品；回家后检查耳后、腋下与腿弯。',
    dev: 'sun-mosquito',
  },
  traffic: {
    label: '交通',
    tip: '停车场与园外道路先牵手再走；不把推车停在车道边整理物品。',
    dev: 'road-safety',
  },
  fall: {
    label: '跌落',
    tip: '台阶、假山、护栏缺口处抱行；不让孩子在硬质地面追逐。',
    acute: 'head-injury',
    dev: 'playground-safety',
  },
  choking: {
    label: '误吞',
    tip: '零食、果冻、整颗葡萄不边走边吃；随手捡起地面上的硬币、瓶盖与烟头。',
    acute: 'choking',
    dev: 'home-safety',
  },
  crowd: {
    label: '人流',
    tip: '节假日错峰；给孩子穿醒目颜色，衣服内侧放联系方式，约定走散后的集合点。',
    dev: 'road-safety',
  },
};

export const CRITERIA = [
  '户外为主或含明确的户外活动区域',
  '0～3 岁孩子可以进入',
  '有可公开核验的官方信息源',
  '公共空间优先，商业场所单独标注',
];
