export enum SlotItemMajorType {
  Unknown = 0,              // 未知/兜底
  Gun = 1,                  // 砲
  Torpedo = 2,              // 魚雷
  CarrierAircraft = 3,      // 艦載機
  AntiAirStuff = 4,         // 機銃・特殊弾
  ReconRadar = 5,           // 偵察機・電探
  Upgrade = 6,              // 強化
  ASW = 7,                  // 対潜装備
  LandingSearchlight = 8,   // 大発動艇・探照灯
  SimpleTransportMaterial = 9, // 簡易輸送部材
  RepairFacility = 10,      // 艦艇修理施設
  Flare = 11,               // 照明弾
  CommandFacility = 12,     // 司令部施設
  AviationPersonnel = 13,   // 航空要員
  AADevice = 14,            // 高射装置
  AntiGround = 15,          // 対地装備
  SurfaceShipPersonnel = 16,// 水上艦要員
  LargeFlyingBoat = 17,     // 大型飛行艇
  Ration = 18,              // 戦闘糧食
  Supply = 19,              // 補給物資
  SpecialAmphibious = 20,   // 特型内火艇
  LandAttacker = 21,        // 陸上攻撃機
  Interceptor = 22,         // 局地戦闘機
  TransportMaterial = 23,   // 輸送機材
  SubmarineEquipment = 24,  // 潜水艦装備
  LandRecon = 25,           // 陸上偵察機
  HeavyBomber = 26,         // 大型陸上機
}
export enum SlotItemBookCategory {
  Unknown = 0,              // Default
  PrimaryArmament = 1,      // 主砲
  SecondaryArmament = 2,    // 副砲
  Torpedo = 3,              // 魚雷
  MidgetSubmarine = 4,      // 特殊潜航艇
  CarrierBasedAircraft = 5, // 艦上機（舰载机）
  AAGun = 6,                // 対空機銃
  Reconnaissance = 7,       // 偵察機
  Radar = 8,                // 電探
  Upgrades = 9,             // 強化
  Sonar = 10,               // ソナー

  Daihatsu = 14,            // 上陸用舟艇
  Autogyro = 15,            // オートジャイロ
  AntiSubPatrol = 16,       // 対潜哨戒機
  ExtensionArmor = 17,      // 追加装甲
  Searchlight = 18,         // 探照灯
  Kann = 19,            // 简易输送部材
  MachineTools = 20,        // 艦艇修理施設
  Flare = 21,               // 照明弾
  FleetCommand = 22,        // 司令部施設
  MaintenanceTeam = 23,     // 航空要員/修理要员类
  AADirector = 24,          // 高射装置
  APShell = 25,             // 対艦強化弾
  RocketArtillery = 26,     // 対地装備
  PicketCrew = 27,          // 水上艦要員
  AAShell = 28,             // 対空強化弾
  AARocket = 29,            // 対空ロケット
  DamageControl = 30,       // 応急修理要員
  EngineUpgrades = 31,      // 機関部強化
  DepthCharge = 32,         // 爆雷
  FlyingBoat = 33,          // 大型飛行艇
  Ration = 34,              // 戦闘糧食
  Supply = 35,            // 補給物資
  MultipurposeSeaplane36 = 36, // 多用途水上机/水上战斗机
  AmphibiousVehicle = 37,   // 特型内火艇
  LandAttacker = 38,        // 陸上攻撃機
  Interceptor = 39,         // 局地戦闘機
  JetFighterBomber = 40,    // 噴式戦闘爆撃機
  TransportMaterials = 41,  // 輸送機材
  SubmarineEquipment = 42,  // 潜水艦装備
  MultipurposeSeaplane43 = 43, // 多用途水上机/水上爆击机
  Helicopter = 44,          // ヘリコプター
  DDTank = 45,              // DD戦車
  HeavyBomber = 46,         // 大型陸上機
}

export enum SlotItemEquipType {
  Unknown = 0,              // Default
  SmallCaliberMainGun = 1,  // 小口径主砲
  MediumCaliberMainGun = 2, // 中口径主砲
  LargeCaliberMainGun = 3,  // 大口径主砲
  SecondaryGun = 4,         // 副砲
  Torpedo = 5,              // 魚雷

  CarrierFighter = 6,       // 艦上戦闘機
  CarrierDiveBomber = 7,    // 艦上爆撃機
  CarrierTorpedoBomber = 8, // 艦上攻撃機
  CarrierRecon = 9,         // 艦上偵察機
  SeaplaneRecon = 10,       // 水上偵察機
  SeaplaneBomber = 11,      // 水上爆撃機

  SmallRadar = 12,          // 小型電探
  LargeRadar = 13,          // 大型電探
  Sonar = 14,               // ソナー
  DepthCharge = 15,         // 爆雷

  ExtraArmor = 16,          // 追加装甲
  EngineImprovement = 17,   // 機関部強化
  AAShell = 18,             // 対空強化弾
  APShell = 19,             // 対艦強化弾
  VT_Fuze = 20,             // VT信管
  AAGun = 21,               // 対空機銃

  MidgetSubmarine = 22,     // 特殊潜航艇
  DamageControl = 23,       // 応急修理要員
  LandingCraft = 24,        // 上陸用舟艇
  Autogyro = 25,            // オートジャイロ
  AntiSubPatrol = 26,       // 対潜哨戒機

  MediumArmor = 27,         // 追加装甲(中型)
  LargeArmor = 28,          // 追加装甲(大型)
  Searchlight = 29,         // 探照灯
  SimpleTransportMaterial = 30, // 簡易輸送部材
  RepairFacility = 31,      // 艦艇修理施設

  SubmarineTorpedo = 32,    // 潜水艦魚雷
  Flare = 33,               // 照明弾
  CommandFacility = 34,     // 司令部施設
  AviationPersonnel = 35,   // 航空要員
  AADirector = 36,          // 高射装置
  AntiGround = 37,          // 対地装備

  LargeCaliberMainGunII = 38, // 大口径主砲(II)
  SurfaceShipPersonnel = 39,  // 水上艦要員
  LargeSonar = 40,            // 大型ソナー
  LargeFlyingBoat = 41,       // 大型飛行艇
  LargeSearchlight = 42,      // 大型探照灯
  Ration = 43,                // 戦闘糧食
  Supply = 44,                // 補給物資

  SeaplaneFighter = 45,       // 水上戦闘機
  SpecialAmphibious = 46,     // 特型内火艇
  LandAttacker = 47,          // 陸上攻撃機
  Interceptor = 48,           // 局地戦闘機
  LandRecon = 49,             // 陸上偵察機
  TransportMaterial = 50,     // 輸送機材
  SubmarineEquipment = 51,    // 潜水艦装備

  HeavyBomber = 53,           // 大型陸上機
  JetFighter = 56,            // 噴式戦闘機
  JetFighterBomber = 57,      // 噴式戦闘爆撃機
  JetAttacker = 58,           // 噴式攻撃機
  JetRecon = 59,              // 噴式偵察機

  LargeRadarII = 93,          // 大型電探(II)
  CarrierReconII = 94,        // 艦上偵察機(II)
}
export enum SlotItemIconId {
  Unknown = 0,              // default
  SmallMainGun = 1,         // 小口径主砲
  MediumMainGun = 2,        // 中口径主砲
  LargeMainGun = 3,         // 大口径主砲
  SecondaryGun = 4,         // 副砲
  Torpedo = 5,              // 魚雷

  CarrierFighter = 6,       // 艦上戦闘機
  CarrierDiveBomber = 7,    // 艦上爆撃機
  CarrierTorpedoBomber = 8, // 艦上攻撃機
  CarrierRecon = 9,         // 艦上偵察機
  Seaplane = 10,            // 水上機
  Radar = 11,               // 電探

  AAShell = 12,             // 対空強化弾
  APShell = 13,             // 対艦強化弾
  DamageControl = 14,       // 応急修理要員
  AAGun = 15,               // 対空機銃
  HighAngleGun = 16,        // 高角砲
  DepthCharge = 17,         // 爆雷
  Sonar = 18,               // ソナー
  EngineImprovement = 19,   // 機関部強化

  LandingCraft = 20,        // 上陸用舟艇
  Autogyro = 21,            // オートジャイロ
  AntiSubPatrol = 22,       // 対潜哨戒機
  ExtraArmor = 23,          // 追加装甲
  Searchlight = 24,         // 探照灯
  SimpleTransportMaterial = 25, // 簡易輸送部材
  RepairFacility = 26,      // 艦艇修理施設
  Flare = 27,               // 照明弾
  CommandFacility = 28,     // 司令部施設
  AviationPersonnel = 29,   // 航空要員
  AADirector = 30,          // 高射装置
  AntiGround = 31,          // 対地装備
  SurfaceShipPersonnel = 32,// 水上艦要員

  LargeFlyingBoat = 33,     // 大型飛行艇
  Ration = 34,              // 戦闘糧食
  Supply = 35,              // 補給物資
  SpecialAmphibious = 36,   // 特型内火艇
  LandAttacker = 37,        // 陸上攻撃機
  Interceptor = 38,         // 局地戦闘機

  JetKeiunKai = 39,         // 噴式戦闘爆撃機（噴式景雲改）
  JetKikkaKai = 40,         // 噴式戦闘爆撃機（橘花改）

  TransportMaterial = 41,   // 輸送機材
  SubmarineEquipment = 42,  // 潜水艦装備
  SeaplaneFighter = 43,     // 水上戦闘機
  ArmyFighter = 44,         // 陸軍戦闘機
  NightFighter = 45,        // 夜間戦闘機
  NightAttacker = 46,       // 夜間攻撃機
  LandASWPatrol = 47,       // 陸上対潜哨戒機
  HeavyBomber = 49,         // 大型陸上機
}

export enum SlotItemAircraftCategory {
  NonAircraft = 0,               // 非航空机

  CarrierAttackOrRecon = 1,      // 艦上攻撃機/艦上偵察機
  SeaplaneReconOrBomber = 2,     // 水上偵察機/水上爆撃機
  SeaplaneFighter = 3,           // 水上戦闘機
  LandAttacker = 4,              // 陸上攻撃機

  ZeroEarly = 11,                // 零戦前期型
  ZeroLate = 12,                 // 零戦後期型
  Reppu = 13,                    // 烈風
  Foreign = 14,                  // 海外機

  Type99DiveBomber = 15,         // 九九式艦爆
  Suisei = 16,                   // 彗星
  Ryuusei = 17,                  // 流星
  Interceptor = 18,              // 局地戦闘機（航空细分）
  LargeFlyingBoat = 19,          // 大型飛行艇
  ShindenKai = 20,               // 震電改
  USCarrier = 21,                // 米艦載機
  JetKeiunKai = 22,              // 噴式景雲改
  JetKikkaKai = 23,              // 橘花改
  Prototype = 24,                // 試作機
  ItalianSeaplane = 25,          // 伊水上機
  KyofuKai = 26,                 // 強風改
  Type1Fighter = 27,             // 一式戦
  BritishAttacker = 28,          // 英攻撃機
  BritishFighter = 29,           // 英戦闘機
  LandASWPatrol = 30,            // 陸上対潜哨戒機
  LandRecon = 31,                // 陸上偵察機
  Zuiun = 32,                    // 瑞雲
  Ryuusei2 = 33,                 // 流星（另一个细分段位，按原表保留）
  ReppuImproved = 34,            // 烈風改良型
  Shusui = 35,                   // 試製秋水
  HighAltitudeInterceptor = 36,  // 高高度局地戦闘機
  Fw190 = 37,                    // Fw190
  XF5U = 38,                     // XF5U
  TBM_3W_3S = 39,                // TBM-3W+3S
  Type99DiveBomberImproved = 40, // 九九式艦爆改良型
  HeavyBomber = 41,              // 大型陸上機
}

export interface SlotItemTypeInfo {
  major: SlotItemMajorType;        // api_type[0]
  book: SlotItemBookCategory;      // api_type[1]
  equipType: SlotItemEquipType;    // api_type[2]
  iconId: SlotItemIconId;          // api_type[3]
  aircraft: SlotItemAircraftCategory; // api_type[4]
}

export interface SlotItemMasterStats {
  hp: number;        // api_taik（大多为 0）
  armor: number;     // api_souk
  firepower: number; // api_houg
  torpedo: number;   // api_raig
  speed: number;     // api_soku（大多为 0）
  bomb: number;      // api_baku
  aa: number;        // api_tyku
  asw: number;       // api_tais
  hit: number;       // api_houm（或对爆）
  evasion: number;   // api_houk（或迎击）
  los: number;       // api_saku
  luck: number;      // api_luck（大多为 0）
}

export interface SlotItemMaster {
  id: number;           // api_id（= masterId）
  sortNo: number;       // api_sortno
  name: string;         // api_name
  type: SlotItemTypeInfo; // api_type

  rarity: number;       // api_rare
  range: number;        // api_leng

  stats: SlotItemMasterStats;

  /** 废弃资源 api_broken，一般是 [fuel, ammo, steel, bauxite] */
  broken: number[];

  /** 航空机才有 */
  cost?: number;        // api_cost
  distance?: number;    // api_distance

  useBull?: number;     // api_usebull（如果有）
  gfxVersion?: number;  // api_version（如果有）

  updatedAt: number;
  extras?: Record<string, unknown>;
}

export function isAircraftMaster(m: SlotItemMaster): boolean {
  return m.type.aircraft !== SlotItemAircraftCategory.NonAircraft;
}

export type SlotItemType3No = SlotItemIconId;

/*-------------------SlotItem Instance---------------------*/
export interface SlotItem {
  uid: number;
  masterId: number;
  locked: boolean;
  level?: number;
  alv?: number;
  updatedAt: number;
  extras?: Record<string, unknown>;
}

export interface UnsetSlot {
  byType3No: Record<number, number[]>;
  updatedAt: number;
}