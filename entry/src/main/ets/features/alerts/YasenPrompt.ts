import notificationManager from '@ohos.notificationManager';
import vibrator from '@ohos.vibrator';
import {kvGetBool} from '../../infra/store/kv';

interface YasenCtx{
  ts:number;
  yesId:string;
  noId:string;
  containerName:string;
}

let lastTs =0;

export async function notifyYasenPrompt(ctx:YasenCtx):Promise<void>{
  if (ctx.ts - lastTs < 1000) return;
  lastTs = ctx.ts;

  const enabled = await kvGetBool('feature.yasenPrompt.enabled', true);
  if (!enabled) return;

  try {
    await notificationManager.publish({
      id: 0, // TODO:后续修改
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: {
          title: '夜战选择出现',
          text: '请选择：夜战突入 / 追撃せず',
          additionalText: `${ctx.containerName || ''} (${ctx.yesId} / ${ctx.noId})`
        }
      },
      // TODO：分类/分组/点击行为等，再结合 WantAgent 回跳
    });
  } catch (e) {
    console.error('[YASEN] publish notification failed:', e);
  }
  //TODO：提醒类型
  try {
  //  await vibrator.vibrate({ type: 'time', duration: 150 });
  } catch {}

  // TODO：toast?
  try {
    // showUiToast('夜战选择出现：夜战突入 / 追撃せず');
  } catch {}
}