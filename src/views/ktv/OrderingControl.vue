<template>
  <section class="ordering-control" aria-labelledby="ordering-control-title">
    <div class="ordering-description">
      <h2 id="ordering-control-title">小程序点餐服务</h2>
      <p>{{ settings?.enabled ? '已开放，顾客可查看餐品、下单并支付。' : '已关闭，点餐页面和入口已隐藏，顾客直接进入我的订单。' }}</p>
      <p class="ordering-help">已有订单、收款记录和备货配送继续保留。恢复营业前，请完成所需资质、服务类目及微信平台审核。</p>
    </div>
    <div class="ordering-action">
      <span class="ordering-status">{{ settings?.enabled ? '营业中' : '暂停营业' }}</span>
      <el-switch
        :model-value="settings?.enabled === true"
        :disabled="!settings || busy"
        :loading="busy"
        :before-change="toggle"
        aria-label="开放点餐"
        active-text="开启"
        inactive-text="关闭"
      />
    </div>
    <p v-if="error" class="ordering-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import request from '@/utils/request';
const props = defineProps({ settings: Object });
const emit = defineEmits(['saved', 'reload']);
const busy = ref(false), error = ref('');
async function toggle() {
  if (busy.value || !props.settings) return false;
  const previous = { ...props.settings }, enabled = !previous.enabled;
  busy.value = true; error.value = '';
  try {
    await ElMessageBox.confirm(
      enabled ? '确认已完成相关资质、服务类目及平台审核后，再开放点餐。开启后所有顾客均可查看餐品、下单和支付。' : '关闭后所有顾客统一隐藏点餐页面及入口，直接进入我的订单，停止新下单和发起支付。已有订单继续处理；已发起支付的结果仍会正常入账。',
      enabled ? '开启点餐服务' : '暂停点餐服务',
      { confirmButtonText: enabled ? '确认开启' : '确认关闭', cancelButtonText: '取消', type: 'warning' },
    );
    const result = await request({url: '/ktv-api/admin/ordering', method: 'put', data: { enabled, version: previous.version }, headers: { repeatSubmit: false }});
    emit('saved', result);
    ElMessage.success(enabled ? '点餐服务已开启' : '点餐服务已关闭');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') { error.value = e.message || '保存失败，请刷新状态后重试'; emit('reload'); }
  } finally { busy.value = false; }
  // The server response, rather than an optimistic switch value, is authoritative.
  return false;
}
</script>
<style scoped>
.ordering-control { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 32px; margin: 16px 0 24px; padding: 20px 24px; background: #faf9f6; border: 1px solid #e8e8e2; border-radius: 12px; }
.ordering-description { flex: 1; min-width: 260px; }
h2 { margin: 0 0 8px; font-size: 18px; color: #253a36; }
p { margin: 5px 0; line-height: 1.65; color: #52635d; }
.ordering-help { font-size: 13px; color: #75817b; }
.ordering-action { display: flex; align-items: center; gap: 18px; }
.ordering-status { font-weight: 600; color: #40594e; white-space: nowrap; }
.ordering-error { flex-basis: 100%; color: #b54431; font-size: 14px; }
</style>
