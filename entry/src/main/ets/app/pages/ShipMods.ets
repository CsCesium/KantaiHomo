import router from '@ohos.router';
import promptAction from '@ohos.promptAction';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import picker from '@ohos.file.picker';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
import { listMasters } from '../../infra/storage/dao/ship';
import { ShipMasterRow } from '../../infra/storage/types';
import { getAppContext } from '../../infra/appContext';
import {
  APP_STORAGE_SHIP_MODS_ENABLED, SHIP_MOD_TYPES, ShipModRecord, ShipModTarget, ShipModType,
  shipModLabel, shipModResourcePath,
} from '../../features/shipMods/model';
import { deleteShipMod, deleteShipMods, importShipMod, listShipMods } from '../../features/shipMods/store';

interface ModGroup {
  masterId: number;
  name: string;
  images: ShipModRecord[];
}

@Entry
@Component
struct ShipMods {
  @StorageProp(APP_STORAGE_SHIP_MODS_ENABLED) private modsEnabled: boolean = false;
  @State private tab: number = 0;
  @State private ships: ShipMasterRow[] = [];
  @State private search: string = '';
  @State private visibleCount: number = 60;
  @State private selectedId: number = 0;
  @State private selectedName: string = '';
  @State private typeIndex: number = 0;
  @State private damaged: boolean = false;
  @State private groups: ModGroup[] = [];
  @State private expandedId: number = 0;
  @State private busy: boolean = false;
  @State private loading: boolean = true;
  @State private error: string = '';
  @State private preview: image.PixelMap | undefined = undefined;
  @State private previewLabel: string = '';
  private previewRequest: number = 0;
  private pageAlive: boolean = false;

  aboutToAppear(): void {
    this.pageAlive = true;
    void this.load();
  }

  aboutToDisappear(): void {
    this.pageAlive = false;
    this.clearPreview();
  }

  private clearPreview(): void {
    this.previewRequest++;
    const previous = this.preview;
    this.preview = undefined;
    this.previewLabel = '';
    if (previous) void previous.release();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.ships = (await listMasters()).filter((ship: ShipMasterRow) =>
        ship.id > 0 && ship.id < 1500 && ship.sortNo > 0 && ship.name.length > 0)
        .sort((a: ShipMasterRow, b: ShipMasterRow) => a.sortNo - b.sortNo || a.id - b.id);
    } catch (_) {
      this.error = '舰娘图鉴读取失败，请重试。';
    }
    try { this.refreshGroups(); } catch (_) {
      this.error = '本地魔改文件读取失败，请重试。';
    } finally { this.loading = false; }
  }

  private refreshGroups(): void {
    const byShip: Map<number, ModGroup> = new Map();
    for (const record of listShipMods()) {
      let group = byShip.get(record.masterId);
      if (!group) {
        const ship = this.ships.find((item: ShipMasterRow) => item.id === record.masterId);
        group = { masterId: record.masterId, name: ship?.name ?? `舰娘 #${record.masterId}`, images: [] };
        byShip.set(record.masterId, group);
      }
      group.images.push(record);
    }
    this.groups = Array.from(byShip.values());
  }

  private filteredShips(): ShipMasterRow[] {
    const query = this.search.trim().toLowerCase();
    return this.ships.filter((ship: ShipMasterRow) => !query ||
      ship.name.toLowerCase().includes(query) || `${ship.id}` === query || `${ship.sortNo}` === query);
  }

  private selectedTarget(): ShipModTarget {
    const spec = SHIP_MOD_TYPES[this.typeIndex];
    return {
      masterId: this.selectedId, type: spec.type,
      damaged: spec.damage === 'always' || (spec.damage === 'select' && this.damaged),
    };
  }

  private async confirm(message: string, action: string): Promise<boolean> {
    const result = await promptAction.showDialog({
      title: '立绘魔改', message,
      buttons: [{ text: '取消', color: '#8095A8' }, { text: action, color: '#E0AD7A' }],
    });
    return result.index === 1;
  }

  private async chooseImage(target: ShipModTarget, name: string, replace: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const exists = listShipMods().some((record: ShipModRecord) => record.resourcePath === shipModResourcePath(target));
      if (exists && !replace && !await this.confirm(`${name} 的${shipModLabel(target)}已有魔改，是否替换？`, '替换')) return;
      const choice = await promptAction.showDialog({
        title: replace || exists ? '选择替换图片' : '添加图片',
        message: `${name} · ${shipModLabel(target)}`,
        buttons: [{ text: '取消', color: '#8095A8' }, { text: '相册', color: '#8CB8D2' }, { text: '文件', color: '#8CB8D2' }],
      });
      let uri = '';
      if (choice.index === 1) {
        const options = new photoAccessHelper.PhotoSelectOptions();
        options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
        options.maxSelectNumber = 1;
        const result = await new photoAccessHelper.PhotoViewPicker().select(options);
        uri = result.photoUris[0] ?? '';
      } else if (choice.index === 2) {
        const options = new picker.DocumentSelectOptions();
        options.maxSelectNumber = 1;
        options.fileSuffixFilters = ['图片|.png,.jpg,.jpeg,.webp'];
        const result = await new picker.DocumentViewPicker(getAppContext()).select(options);
        uri = result[0] ?? '';
      }
      if (!uri || !this.pageAlive) return;
      await importShipMod(target, uri);
      if (!this.pageAlive) return;
      this.clearPreview();
      this.refreshGroups();
      this.expandedId = target.masterId;
      this.tab = 1;
      promptAction.showToast({ message: '图片已保存，刷新游戏后显示最新立绘', duration: 3000 });
    } catch (error) {
      promptAction.showToast({ message: `导入失败：${String(error)}`, duration: 3500 });
    } finally { this.busy = false; }
  }

  private async removeImage(record: ShipModRecord, name: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!await this.confirm(`删除 ${name} 的${shipModLabel(record)}？`, '删除')) return;
      deleteShipMod(record);
      this.clearPreview();
      this.refreshGroups();
      promptAction.showToast({ message: '已删除，刷新游戏后恢复原图' });
    } catch (_) { promptAction.showToast({ message: '删除失败，请重试' }); }
    finally { this.busy = false; }
  }

  private async removeGroup(group: ModGroup): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!await this.confirm(`删除 ${group.name} 的全部 ${group.images.length} 张魔改图片？`, '全部删除')) return;
      deleteShipMods(group.masterId);
      this.clearPreview();
      this.refreshGroups();
      promptAction.showToast({ message: '已删除，刷新游戏后恢复原图' });
    } catch (_) {
      this.refreshGroups();
      promptAction.showToast({ message: '部分文件删除失败，请重试' });
    } finally { this.busy = false; }
  }

  private async showPreview(record: ShipModRecord): Promise<void> {
    this.clearPreview();
    const request = this.previewRequest;
    let file: fs.File | undefined;
    let source: image.ImageSource | undefined;
    try {
      file = await fs.open(record.localPath, fs.OpenMode.READ_ONLY);
      source = image.createImageSource(file.fd);
      const info = await source.getImageInfo();
      const scale = Math.min(1, 960 / Math.max(info.size.width, info.size.height));
      const pixels = await source.createPixelMap({
        desiredSize: { width: Math.max(1, Math.round(info.size.width * scale)), height: Math.max(1, Math.round(info.size.height * scale)) },
      });
      if (request !== this.previewRequest || !this.pageAlive) { await pixels.release(); return; }
      this.preview = pixels;
      this.previewLabel = shipModLabel(record);
    } catch (_) { promptAction.showToast({ message: '预览读取失败，请尝试替换图片' }); }
    finally {
      try { if (source) await source.release(); } catch (_) {}
      try { if (file) fs.closeSync(file.fd); } catch (_) {}
    }
  }

  @Builder
  private AddPanel() {
    Column({ space: 12 }) {
      Text('1. 选择舰娘').fontSize(17).fontColor('#C8B99A')
      TextInput({ text: this.search, placeholder: '搜索名称、图鉴编号或舰娘 ID' })
        .onChange((value: string) => { this.search = value; this.visibleCount = 60; })
      if (this.ships.length === 0 && !this.loading) {
        Text('暂无舰娘图鉴。请先进入游戏完成一次登录，再返回此页刷新。').fontColor('#A8B9CC').fontSize(14)
        Button('刷新图鉴').onClick(() => { void this.load(); })
      } else {
        List({ space: 4 }) {
          ForEach(this.filteredShips().slice(0, this.visibleCount), (ship: ShipMasterRow) => {
            ListItem() {
              Row() {
                Text(ship.name).fontColor('#DBDFE5').layoutWeight(1)
                Text(`图鉴 ${ship.sortNo} · ID ${ship.id}`).fontSize(12).fontColor('#90A6BC')
              }
              .width('100%').padding(12).borderRadius(8)
              .backgroundColor(this.selectedId === ship.id ? '#25465E' : '#101A26')
              .onClick(() => { this.selectedId = ship.id; this.selectedName = ship.name; })
            }
          }, (ship: ShipMasterRow) => `${ship.id}`)
        }.height(230).width('100%')
        if (this.filteredShips().length === 0) {
          Text('没有匹配的舰娘').fontColor('#A8B9CC')
        }
        if (this.filteredShips().length > this.visibleCount) {
          Button('显示更多舰娘').onClick(() => { this.visibleCount += 60; })
        }
      }
      Text(this.selectedId > 0 ? `已选：${this.selectedName}（ID ${this.selectedId}）` : '请从图鉴选择一种舰娘形态')
        .fontColor('#8CB8D2').fontSize(14)
      Text('2. 选择立绘类型与状态').fontSize(17).fontColor('#C8B99A').margin({ top: 8 })
      Select(SHIP_MOD_TYPES.map((spec: ShipModType): SelectOption => ({ value: spec.label })))
        .selected(this.typeIndex).value(SHIP_MOD_TYPES[this.typeIndex].label)
        .onSelect((index: number) => { this.typeIndex = index; this.damaged = false; })
      if (SHIP_MOD_TYPES[this.typeIndex].damage === 'select') {
        Row({ space: 12 }) {
          Button('通常').backgroundColor(this.damaged ? '#243343' : '#386480').onClick(() => { this.damaged = false; })
          Button('中破').backgroundColor(this.damaged ? '#386480' : '#243343').onClick(() => { this.damaged = true; })
        }
      } else {
        Text(SHIP_MOD_TYPES[this.typeIndex].damage === 'always' ? '此类型仅有中破资源' : '此类型仅有通常资源')
          .fontColor('#A8B9CC').fontSize(13)
      }
      Text('建议使用与原图相同的尺寸和透明背景。支持 PNG / JPG / WebP，单张不超过 32 MB；导入时自动转为 PNG 并命名。')
        .fontColor('#A8B9CC').fontSize(13)
      Button(this.busy ? '正在处理…' : '选择图片并保存')
        .enabled(this.selectedId > 0 && !this.busy && !this.loading)
        .onClick(() => { void this.chooseImage(this.selectedTarget(), this.selectedName, false); })
    }.width('100%').alignItems(HorizontalAlign.Start).enabled(!this.busy)
  }

  @Builder
  private ManagePanel() {
    Column({ space: 12 }) {
      Text(`已添加 ${this.groups.length} 位舰娘`).fontSize(17).fontColor('#C8B99A')
      if (this.groups.length === 0) {
        Text('还没有魔改图片，请在“添加图片”中导入。').fontColor('#A8B9CC')
      }
      if (this.preview) {
        Column({ space: 8 }) {
          Text(this.previewLabel).fontColor('#C8B99A').fontSize(13)
          Image(this.preview).height(230).width('100%').objectFit(ImageFit.Contain).backgroundColor('#29323C')
          Button('关闭预览').onClick(() => { this.clearPreview(); })
        }.width('100%')
      }
      ForEach(this.groups, (group: ModGroup) => {
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            Text(`${group.name} · ID ${group.masterId}\n${group.images.length} 张图片`)
              .fontColor('#DBDFE5').layoutWeight(1).fontSize(15)
              .onClick(() => { this.expandedId = this.expandedId === group.masterId ? 0 : group.masterId; })
            Button(this.expandedId === group.masterId ? '收起' : '展开').fontSize(12)
              .onClick(() => { this.expandedId = this.expandedId === group.masterId ? 0 : group.masterId; })
            Button('删除全部').fontSize(12).backgroundColor('#713E42')
              .onClick(() => { void this.removeGroup(group); })
          }.width('100%')
          if (this.expandedId === group.masterId) {
            ForEach(group.images, (record: ShipModRecord) => {
              Column({ space: 8 }) {
                Text(shipModLabel(record)).fontColor('#C4D2E0').fontSize(14)
                Text(`${(record.size / 1024).toFixed(0)} KB`).fontColor('#90A6BC').fontSize(12)
                Row({ space: 10 }) {
                  Button('预览').fontSize(12).onClick(() => { void this.showPreview(record); })
                  Button('替换').fontSize(12).onClick(() => { void this.chooseImage(record, group.name, true); })
                  Button('删除').fontSize(12).backgroundColor('#713E42').onClick(() => { void this.removeImage(record, group.name); })
                }
              }.width('100%').padding(12).alignItems(HorizontalAlign.Start).backgroundColor('#080F19').borderRadius(8)
            }, (record: ShipModRecord) => `${record.resourcePath}:${record.modifiedAt}:${record.size}`)
          }
        }.width('100%').padding(12).backgroundColor('#101A26').borderRadius(10)
      }, (group: ModGroup) => `${group.masterId}`)
    }.width('100%').alignItems(HorizontalAlign.Start).enabled(!this.busy)
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        Button('返回').onClick(() => { router.back(); })
        Text('立绘魔改').fontSize(22).fontColor('#C8B99A').layoutWeight(1)
      }.width('100%').padding({ top: 16 })
      Text(this.modsEnabled ? '替换已开启 · 图片或开关变更后，请刷新游戏' : '替换未开启 · 添加后请前往设置开启“立绘魔改”')
        .fontColor(this.modsEnabled ? '#90CBB0' : '#D7B782').fontSize(13).width('100%')
      Row({ space: 12 }) {
        Button('添加图片').backgroundColor(this.tab === 0 ? '#386480' : '#243343').onClick(() => { this.tab = 0; })
        Button('管理魔改').backgroundColor(this.tab === 1 ? '#386480' : '#243343').onClick(() => { this.tab = 1; })
      }.width('100%').enabled(!this.busy)
      if (this.error) {
        Row({ space: 10 }) {
          Text(this.error).fontColor('#E7A5A5').layoutWeight(1)
          Button('重试').enabled(!this.loading && !this.busy).onClick(() => { void this.load(); })
        }
      }
      if (this.loading) { Text('正在读取…').fontColor('#A8B9CC') }
      Scroll() {
        Column() {
          if (this.tab === 0) { this.AddPanel() } else { this.ManagePanel() }
        }.width('100%').padding({ bottom: 28 })
      }.layoutWeight(1).width('100%')
    }.width('100%').height('100%').padding({ left: 16, right: 16 }).backgroundColor('#080E18')
  }
}
