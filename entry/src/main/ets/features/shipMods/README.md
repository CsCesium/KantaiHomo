# 立绘魔改

启动页“设置”下方的“立绘魔改”打开添加与管理页面；设置页提供独立开关和同一页面入口。默认关闭，开关持久化到 KV。导入、替换、删除或切换开关后，刷新游戏可更新已载入的纹理。

## 使用

1. 先进入游戏完成一次登录，应用会保存 `api_mst_ship` 主数据。
2. 在“添加图片”中按名称、图鉴编号或舰娘 master ID 搜索，选择对应改造形态、立绘类型及通常／中破状态。
3. 从相册或文件选择一张 PNG、JPG 或 WebP 图片。图片在本地转为 PNG，保留透明度和原尺寸；请准备与官方立绘尺寸一致的图片，避免错位。输入与生成文件均限制 32 MiB，解码尺寸最多 16,777,216 像素。
4. 在“管理魔改”中按舰娘展开，预览、替换、删除单张，或删除该舰娘全部魔改。已有同类型图片再次导入时会询问是否覆盖。
5. 在设置开启“立绘魔改”，刷新游戏。

支持 `banner`、`full`、`character_full`、`character_up`、`card`、`remodel`、`supply_character`、`album_status`、`banner_g`、`banner2_g`、`banner3_g`。图鉴状态只有通常资源，三个特殊横幅只有中破资源；其他类型分别管理通常与中破图片。

## 存储与请求

路径为 `filesDir/ship_mods/<masterId>/<资源目录>/<混淆文件名>.png`，例如 `ship_mods/1/full/0001_5865.png`。复用 `features/game/shipGraph.ts` 的现有算法，以 `ship_<资源目录>` 为混淆键。不同形态以 master ID 区分。

图片转换到同目录的临时文件，完成编码和同步后 rename 提交；失败保留旧图。启动时从磁盘恢复索引，不依赖相册临时授权或内存中的游戏状态。名称在页面中从本地主数据补全，主数据缺失时仍可按 ID 管理。

`GameWeb` 的资源处理顺序为：现有阻止规则 → 已启用的立绘魔改 → 已启用的普通资源缓存 → 官方网络资源。匹配官方 `/kcs2/resources/ship/...png` 路径，忽略版本 query。魔改响应使用 `image/png`、`no-store` 和跨域图片头，文件缺失、不可读或非 PNG 时回退。普通资源缓存的清理不会删除魔改文件。替换覆盖的是该路径的图片，包括同路径下的季节立绘版本。

图片选择与编码参考 OpenHarmony 官方文档：[文件选择](https://github.com/openharmony/docs/blob/master/en/application-dev/file-management/select-user-file.md)、[ImagePacker](https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-image-kit/arkts-apis-image-ImagePacker.md)。

## 验证

```powershell
node scripts/test-ship-mods.cjs 'D:/DevEco/DevEco Studio/tools/ohpm/node_modules/typescript'
```

脚本验证混淆文件名、路径隔离、重新初始化、读写失败、并发保护、删除范围和请求优先级。图片编码和文件接口在脚本中由测试替身提供，仍需真机验证相册／文件选择、透明 PNG 效果及刷新游戏后的实际立绘替换。
