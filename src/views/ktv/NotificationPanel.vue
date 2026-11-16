<template>
  <section v-loading="loading" class="notice-panel">
    <header class="notice-header">
      <div>
        <h2>接单通知</h2>
        <p>
          顾客接收订单进度，备货方接收新单与转派，商家接收付款下单、已接单、缺货及超时提醒。
        </p>
      </div>
      <el-button @click="load">刷新状态</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert
      v-if="!data.enabled"
      title="后台通知服务未启用，请联系维护人员。前台声音提醒仍可使用。"
      type="warning"
      :closable="false"
    />
    <h3>连接管理员微信</h3>
    <p>用自己的微信扫描下方小程序码，使用本电脑后台账号登录，再依次点击「连接微信提醒」和「授权接收微信提醒」。完成后点击刷新状态。</p>
    <el-button :loading="entryLoading" @click="loadEntry">{{ entryUrl ? '刷新管理员小程序码' : '显示管理员小程序码' }}</el-button>
    <div v-if="entryUrl" class="notice-entry"><img :src="entryUrl" alt="使用微信扫描，进入小程序管理员登录" width="200" height="200" /><p>每位管理员使用自己的后台账号与微信授权。扫码本身不会完成登录或授权。</p></div>
    <h3>接收人员与接单群</h3>
    <p>
      企业微信群可持续接收通知。请让对应备货人员加入群，并打开群消息提醒。机器人地址保存后不会回显。
    </p>
    <el-table :data="data.targets" stripe>
      <el-table-column prop="name" label="接收对象" />
      <el-table-column label="接单群"
        ><template #default="s">{{
          s.row.groupConfigured ? "已配置" : "未配置"
        }}</template></el-table-column
      >
      <el-table-column label="微信订阅"
        ><template #default="s">{{
          s.row.bound ? "已绑定，约剩 " + s.row.credits + " 次" : "未绑定"
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="300"
        ><template #default="s"
          ><el-button
            link
            @click="
              target = s.row.scope;
              webhook = '';
            "
            >配置接单群</el-button
          ><el-button
            v-if="s.row.groupConfigured"
            link
            type="danger"
            @click="removeGroup(s.row)"
            >停用群提醒</el-button
          ><el-button
            v-if="s.row.bound"
            link
            type="danger"
            @click="removeBinding(s.row)"
            >解除微信绑定</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-form
      v-if="target"
      label-position="top"
      class="notice-config"
      @submit.prevent="saveGroup"
    >
      <el-form-item label="群机器人地址"
        ><el-input
          v-model="webhook"
          type="password"
          autocomplete="off"
          placeholder="填写该接收对象的企业微信群机器人 Webhook 地址"
      /></el-form-item>
      <el-alert
        v-if="!data.encryptionReady"
        title="服务器尚未配置通知加密密钥，请联系维护人员完成安全配置。"
        type="warning"
        :closable="false"
      />
      <el-button
        type="primary"
        :disabled="!data.encryptionReady || !webhook.trim()"
        :loading="saving"
        @click="saveGroup"
        >保存接单群</el-button
      ><el-button
        @click="
          target = '';
          webhook = '';
        "
        >取消</el-button
      >
    </el-form>
    <h3>微信订阅提醒</h3>
    <p>
      商家及备货模板：{{ data.template?.title || "未配置" }}。顾客进度模板：{{ data.customerTemplate?.title || "未配置" }}。三端都需要本人在小程序授权；一次性订阅每授权一次只能发送一条。
    </p>
    <el-button @click="loadTemplates" :loading="templatesLoading"
      >选择或更新微信模板</el-button
    >
    <el-form
      v-if="templates !== null"
      :disabled="saving"
      label-position="top"
      class="notice-config"
    >
      <el-form-item label="模板用途"><el-radio-group v-model="templateScope" @change="resetTemplate"><el-radio-button value="template">商家与备货</el-radio-button><el-radio-button value="customer-template">顾客订单进度</el-radio-button></el-radio-group></el-form-item>
      <el-alert
        v-if="!templates.length"
        title="该小程序尚未添加订阅消息模板，请在微信公众平台添加合适的订单通知模板后刷新。"
        type="info"
        :closable="false"
      />
      <el-form-item label="订单通知模板"
        ><el-select
          v-model="templateId"
          placeholder="选择已添加的模板"
          @change="selectTemplate"
          ><el-option
            v-for="t in templates"
            :key="t.priTmplId"
            :label="t.title"
            :value="t.priTmplId" /></el-select
      ></el-form-item>
      <el-form-item
        v-for="field in templateFields"
        :key="field.key"
        :label="field.label"
        ><el-select v-model="fields[field.key]"
          ><el-option
            v-for="option in optionsFor(field.key)"
            :key="option.value"
            :label="option.label"
            :value="option.value" /></el-select
      ></el-form-item>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!templateId || !templateFields.length"
        @click="saveTemplate"
        >保存微信通知模板</el-button
      >
    </el-form>
    <h3>最近发送记录</h3>
    <p>
      “已发送”表示渠道已接收，不代表人员已阅读；以订单接单状态为准。发送结果不确定时不会自动重复发送。
    </p>
    <el-table :data="data.deliveries" stripe empty-text="暂无发送记录">
      <el-table-column prop="order_id" label="订单" width="90" />
      <el-table-column label="对象"
        ><template #default="s">{{
          targetName(s.row.scope)
        }}</template></el-table-column
      >
      <el-table-column label="提醒"
        ><template #default="s">{{
          kinds[s.row.kind] || s.row.kind
        }}</template></el-table-column
      >
      <el-table-column label="渠道" width="90"
        ><template #default="s">{{
          s.row.channel === "group" ? "接单群" : "微信订阅"
        }}</template></el-table-column
      >
      <el-table-column label="结果" min-width="200"
        ><template #default="s"
          ><el-tag
            :type="
              s.row.status === 'sent'
                ? 'success'
                : s.row.status === 'failed'
                  ? 'danger'
                  : 'info'
            "
            >{{ statuses[s.row.status] || s.row.status }}</el-tag
          >
          <div class="notice-reason">
            {{ reason(s.row.error_code) }}
          </div></template
        ></el-table-column
      >
      <el-table-column label="操作" width="90"
        ><template #default="s"
          ><el-button
            v-if="['failed', 'unknown', 'waiting'].includes(s.row.status)"
            link
            @click="retry(s.row)"
            >重试</el-button
          ></template
        ></el-table-column
      >
    </el-table>
  </section>
</template>
<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/request";
const data = reactive({
    targets: [],
    deliveries: [],
    template: {},
    enabled: true,
  }),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  target = ref(""),
  webhook = ref("");
const templates = ref(null),
  templatesLoading = ref(false),
  templateId = ref(""),
  templateFields = ref([]),
  fields = reactive({});
const templateScope = ref("template"), entryUrl = ref(""), entryLoading = ref(false);
let alive = true, entrySequence = 0;
onUnmounted(() => { alive = false; entrySequence++; if (entryUrl.value) URL.revokeObjectURL(entryUrl.value); });
async function loadEntry() {
  const sequence = ++entrySequence; entryLoading.value = true; error.value = "";
  try {
    const blob = await request({ url: "/ktv-api/notifications/admin-entry", method: "get", responseType: "blob" });
    if (!alive || sequence !== entrySequence) return;
    if (!blob.type.startsWith("image/")) throw new Error("小程序码生成失败，请稍后重试");
    if (entryUrl.value) URL.revokeObjectURL(entryUrl.value);
    entryUrl.value = URL.createObjectURL(blob);
  } catch (e) { if (alive && sequence === entrySequence) error.value = e.message; }
  finally { if (alive && sequence === entrySequence) entryLoading.value = false; }
}
function resetTemplate() { templateId.value = ""; templateFields.value = []; Object.keys(fields).forEach(k => delete fields[k]); }
const api = (path, method = "get", body) =>
  request({ url: "/ktv-api/notifications" + path, method, data: body });
const statuses = {
  queued: "待发送",
  waiting: "等待配置或授权",
  retry: "稍后重试",
  sending: "发送中",
  sent: "已发送",
  failed: "发送失败",
  unknown: "结果不确定",
  cancelled: "订单已变化，取消提醒",
};
const kinds = {
  paid: "顾客付款下单", accepted: "备货已接单", delivering: "开始配送", completed: "已送达", refunded: "已退款",
  new_order: "待接单",
  reassigned: "订单转派",
  overdue: "超时未接单",
  stock_issue: "缺货待处理",
};
const reasons = {
  GROUP_NOT_CONFIGURED: "该对象未配置接单群",
  TEMPLATE_NOT_CONFIGURED: "未配置微信通知模板",
  NOT_BOUND: "接收人员未连接微信提醒",
  SUBSCRIPTION_REQUIRED: "需要在小程序重新授权订阅",
  ENCRYPTION_NOT_READY: "服务器通知安全配置未完成",
  ORDER_CHANGED: "订单已处理或已转派",
  INTERRUPTED: "发送中断，请核对是否已收到",
  DELIVERY_UNCONFIRMED: "渠道未返回明确结果，请核对是否已收到",
  WECHAT_40037: "模板失效，请更新微信模板",
  WECHAT_47003: "模板字段不匹配，请核对配置",
  WECHAT_41030: "小程序页面或版本不可用",
  WECHAT_40003: "微信绑定无效，请重新连接",
  WECHAT_93000: "机器人已停用或地址无效",
};
const reason = (code) =>
  code ? reasons[code] || "渠道返回 " + code + "，请检查通知配置" : "";
const targetName = (scope) =>
  scope === "customer" ? "订单顾客" : data.targets.find((t) => t.scope === scope)?.name || scope;
async function load() {
  loading.value = true;
  error.value = "";
  try {
    Object.assign(data, await api("/admin"));
  } catch (e) {
    error.value = e.message || "通知状态加载失败";
  } finally {
    loading.value = false;
  }
}
async function saveConfig(body) {
  saving.value = true;
  error.value = "";
  try {
    await api("/config", "post", body);
    webhook.value = "";
    target.value = "";
    ElMessage.success("通知配置已保存");
    await load();
  } catch (e) {
    error.value = e.message || "保存失败";
  } finally {
    saving.value = false;
  }
}
function saveGroup() {
  return saveConfig({ scope: target.value, webhook: webhook.value.trim() });
}
async function removeGroup(row) {
  try {
    await ElMessageBox.confirm(
      "停用后此接单群将不再收到该账号的订单提醒。",
      "停用群提醒",
    );
    await saveConfig({ scope: row.scope, remove: true });
  } catch (e) {
    if (e !== "cancel" && e !== "close") error.value = e.message;
  }
}
async function removeBinding(row) {
  try {
    await ElMessageBox.confirm(
      "解绑后该账号需在小程序重新连接微信，原微信将不再接收新提醒。",
      "解除微信绑定",
    );
    await saveConfig({ scope: row.scope, removeBinding: true });
  } catch (e) {
    if (e !== "cancel" && e !== "close") error.value = e.message;
  }
}
async function loadTemplates() {
  templatesLoading.value = true;
  try {
    templates.value = (await api("/templates")).data || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    templatesLoading.value = false;
  }
}
const allOptions = [
  { value: "room", label: "包厢" },
  { value: "order", label: "订单号" },
  { value: "summary", label: "餐品与数量" },
  { value: "time", label: "提醒时间" },
  { value: "status", label: "处理状态" },
  { value: "count", label: "总份数" },
  { value: "taskCount", label: "本次订单任务数（1）" },
  { value: "notice", label: "包厢与待办提示" },
];
function optionsFor(key) {
  const allowed = key.startsWith("time")
    ? ["time"]
    : key.startsWith("number")
      ? ["count", "taskCount", "order"]
      : key.startsWith("phrase")
        ? ["status"]
        : key.startsWith("character_string")
          ? ["order"]
          : ["room", "summary", "status", "order", "count", "notice"];
  return allOptions.filter((x) => allowed.includes(x.value));
}
function selectTemplate() {
  const t = templates.value.find((x) => x.priTmplId === templateId.value);
  Object.keys(fields).forEach((k) => delete fields[k]);
  templateFields.value = [
    ...(t?.content || "").matchAll(/([^\n]*?)\{\{(\w+)\.DATA}}/g),
  ].map((m) => ({
    label: m[1].replace(/[：:]\s*$/, "").trim() || m[2],
    key: m[2],
  }));
  for (const f of templateFields.value) {
    const options = optionsFor(f.key);
    fields[f.key] =
      /包厢|位置|地址/.test(f.label) && options.some((x) => x.value === "room")
        ? "room"
        : options[0]?.value;
  }
}
function saveTemplate() {
  return saveConfig({
    scope: templateScope.value,
    templateId: templateId.value,
    fields: { ...fields },
  });
}
async function retry(row) {
  try {
    await ElMessageBox.confirm(
      row.status === "unknown"
        ? "这条消息可能已经送达，重试可能重复提醒。确认重发？"
        : "请先确认接收账号和通知配置已恢复，再重试。",
      "重试通知",
    );
    await api("/" + row.id + "/retry", "post");
    await load();
  } catch (e) {
    if (e !== "cancel" && e !== "close") error.value = e.message;
  }
}
onMounted(load);
</script>
<style scoped>
.notice-panel {
  padding: 12px 0 28px;
}
.notice-entry { display: flex; gap: 24px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
.notice-entry img { display: block; flex: 0 0 auto; }
.notice-entry p { max-width: 42ch; }
.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}
.notice-panel h2 {
  font-size: 22px;
  margin: 0 0 8px;
}
.notice-panel h3 {
  font-size: 17px;
  margin: 30px 0 12px;
}
.notice-panel p {
  font-size: 14px;
  color: #667177;
  line-height: 1.7;
  max-width: 75ch;
}
.notice-config {
  max-width: 680px;
  padding: 20px 0;
}
.notice-config .el-select {
  width: 100%;
}
.notice-reason {
  font-size: 12px;
  color: #667177;
  line-height: 1.6;
  margin-top: 5px;
}
.notice-panel .el-alert {
  margin: 12px 0;
}
</style>
