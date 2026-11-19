<template>
  <section class="staff-portal-control" aria-labelledby="staff-portal-control-title">
    <div class="staff-portal-description">
      <h2 id="staff-portal-control-title">小程序工作人员入口</h2>
      <p>{{ settings?.enabled ? '已开放，小程序显示商家管理、食堂接单及工作人员登录页面。' : '已关闭，小程序统一隐藏工作人员入口，直接打开相关页面会返回服务首页。' }}</p>
      <p class="staff-portal-help">关闭后请在电脑后台处理已有订单；顾客仍可查询订单。</p>
    </div>
    <div class="staff-portal-action">
      <span class="staff-portal-status">{{ settings?.enabled ? '已开放' : '已关闭' }}</span>
      <el-switch
        :model-value="settings?.enabled === true"
        :disabled="!settings || busy"
        :loading="busy"
        :before-change="toggle"
        aria-label="开放工作人员入口"
        active-text="开启"
        inactive-text="关闭"
      />
    </div>
    <p v-if="error" class="staff-portal-error" role="alert">{{ error }}</p>
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
      enabled ? '开启后，所有用户均可看到工作人员入口；工作人员使用分配的账号登录。' : '关闭后，小程序的商家管理、食堂接单页面及登录入口统一停用，已登录人员也不能继续操作。请通过电脑后台处理已有订单。',
      enabled ? '开放工作人员入口' : '关闭工作人员入口',
      { confirmButtonText: enabled ? '确认开启' : '确认关闭', cancelButtonText: '取消', type: 'warning' },
    );
    const result = await request({url: '/ktv-api/admin/staff-portal', method: 'put', data: { enabled, version: previous.version }, headers: { repeatSubmit: false }});
    emit('saved', result);
    ElMessage.success(enabled ? '工作人员入口已开放' : '工作人员入口已关闭');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') { error.value = e.message || '保存失败，请刷新状态后重试'; emit('reload'); }
  } finally { busy.value = false; }
  // The server response, rather than an optimistic switch value, is authoritative.
  return false;
}
</script>
<style scoped>
.staff-portal-control { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 32px; margin: 16px 0 24px; padding: 20px 24px; background: #faf9f6; border: 1px solid #e8e8e2; border-radius: 12px; }
.staff-portal-description { flex: 1; min-width: 260px; }
h2 { margin: 0 0 8px; font-size: 18px; color: #253a36; }
p { margin: 5px 0; line-height: 1.65; color: #52635d; }
.staff-portal-help { font-size: 13px; color: #75817b; }
.staff-portal-action { display: flex; align-items: center; gap: 18px; }
.staff-portal-status { font-weight: 600; color: #40594e; white-space: nowrap; }
.staff-portal-error { flex-basis: 100%; color: #b54431; font-size: 14px; }
</style>
