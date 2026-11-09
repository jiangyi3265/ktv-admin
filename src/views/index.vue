<template>
  <main class="ktv-console" v-loading="loading">
    <header>
      <div>
        <p class="eyebrow">KTV · 门店运营</p>
        <h1>包厢餐食工作台</h1>
        <p>管理餐品、包厢和食堂，跟进每一笔订单。</p>
      </div>
      <el-button :loading="loading" @click="refresh">刷新数据</el-button>
    </header>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <template v-if="ready">
      <section class="metrics">
        <article>
          <span>待接单</span
          ><strong>{{ data.orderCounts.pending || 0 }}</strong>
        </article>
        <article>
          <span>制作与配送</span
          ><strong>{{
            (data.orderCounts.preparing || 0) +
            (data.orderCounts.delivering || 0)
          }}</strong>
        </article>
        <article>
          <span>上架餐品</span
          ><strong>{{ data.products.filter((p) => p.onSale).length }}</strong>
        </article>
        <article>
          <span>启用包厢</span
          ><strong>{{ data.rooms.filter((r) => r.bound).length }}</strong>
        </article>
      </section>
      <el-tabs v-model="tab" @tab-change="onTab">
        <el-tab-pane label="订单" name="orders">
          <div class="toolbar">
            <el-button
              :disabled="orderPage === 1"
              @click="
                orderPage--;
                detailId = '';
                refresh();
              "
              >上一页</el-button
            ><span>第 {{ orderPage }} 页 · 全部历史订单</span
            ><el-button
              :disabled="!data.hasMore"
              @click="
                orderPage++;
                detailId = '';
                refresh();
              "
              >下一页</el-button
            ><el-input
              v-model="search"
              placeholder="搜索订单号或包厢"
              clearable
            /><el-select v-model="status" placeholder="全部状态" clearable
              ><el-option
                v-for="(label, key) in labels"
                :key="key"
                :label="label"
                :value="key"
            /></el-select>
          </div>
          <el-table :data="orders" stripe empty-text="暂无订单"
            ><el-table-column prop="id" label="订单号" /><el-table-column
              prop="room"
              label="包厢"
            /><el-table-column label="状态"
              ><template #default="s"
                ><el-tag>{{ labels[s.row.status] }}</el-tag><el-tag v-if="s.row.assignmentRequired" type="danger">待分配食堂</el-tag></template
              ></el-table-column
            ><el-table-column label="金额"
              ><template #default="s"
                >¥{{ money(s.row.totalCents) }}</template
              ></el-table-column
            ><el-table-column
              prop="supplierId"
              label="食堂账号"
            /><el-table-column label="下单时间" min-width="170"
              ><template #default="s">{{
                s.row.createdAt?.replace("T", " ").slice(0, 19)
              }}</template></el-table-column
            ><el-table-column label="操作"
              ><template #default="s"
                ><el-button link type="primary" @click="detailId = s.row.id"
                  >查看与处理</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </el-tab-pane>
        <el-tab-pane label="餐品" name="products"
          ><div class="toolbar">
            <el-button type="primary" @click="edit('product')"
              >新增餐品</el-button
            >
          </div>
          <el-table :data="data.products" stripe
            ><el-table-column prop="name" label="餐品" /><el-table-column
              prop="category"
              label="分类"
            /><el-table-column
              prop="price"
              label="售价（元）"
            /><el-table-column label="状态"
              ><template #default="s">{{
                s.row.onSale ? "上架中" : "已下架"
              }}</template></el-table-column
            ><el-table-column label="操作"
              ><template #default="s"
                ><el-button link type="primary" @click="edit('product', s.row)"
                  >编辑</el-button
                ><el-button
                  link
                  @click="
                    write('/products/' + s.row.id, 'PUT', {
                      ...s.row,
                      onSale: !s.row.onSale,
                    })
                  "
                  >{{ s.row.onSale ? "下架" : "上架" }}</el-button
                ></template
              ></el-table-column
            ></el-table
          ></el-tab-pane
        >
        <el-tab-pane label="包厢与点餐码" name="rooms"
          ><div class="toolbar">
            <el-button type="primary" @click="edit('room')">新增包厢</el-button>
          </div>
          <el-table :data="data.rooms" stripe
            ><el-table-column prop="id" label="包厢" /><el-table-column
              label="状态"
              ><template #default="s">{{
                s.row.bound ? "已启用" : "已停用"
              }}</template></el-table-column
            ><el-table-column label="操作" min-width="280"
              ><template #default="s"
                ><el-button link @click="edit('room', s.row)">编辑</el-button
                ><el-button
                  link
                  :disabled="!s.row.bound"
                  @click="qr(s.row, 'h5')"
                  >网页码</el-button
                ><el-button
                  link
                  :disabled="!s.row.bound"
                  @click="qr(s.row, 'mini')"
                  >小程序码</el-button
                ><el-button
                  link
                  type="danger"
                  :disabled="!s.row.bound"
                  @click="rotateQr(s.row)"
                  >换码</el-button
                ></template
              ></el-table-column
            ></el-table
          ></el-tab-pane
        >
        <el-tab-pane label="食堂与权限" name="accounts"
          ><div class="toolbar">
            <el-button type="primary" @click="edit('account')"
              >新增食堂账号</el-button
            ><span>有进行中订单时，请先完成或转派再停用。</span>
          </div>
          <el-table :data="data.accounts" stripe
            ><el-table-column prop="id" label="登录账号" /><el-table-column
              prop="name"
              label="名称"
            /><el-table-column label="权限"
              ><template #default="s"
                >{{ s.row.enabled ? "已启用" : "已停用" }} ·
                {{ s.row.process ? "可接单" : "不可接单" }} ·
                {{ s.row.deliver ? "可确认送达" : "不可确认送达" }}</template
              ></el-table-column
            ><el-table-column label="操作"
              ><template #default="s"
                ><el-button link @click="edit('account', s.row)"
                  >编辑权限与密码</el-button
                ></template
              ></el-table-column
            ></el-table
          ></el-tab-pane
        >
        <el-tab-pane label="支付接入" name="payment"
          ><el-descriptions :column="1" border
            ><el-descriptions-item label="微信登录">{{
              config.wechatLogin ? "已配置" : "未配置"
            }}</el-descriptions-item
            ><el-descriptions-item label="微信支付">{{
              config.wechatPayment ? "已配置，需完成真机与退款验收" : "未配置"
            }}</el-descriptions-item
            ><el-descriptions-item label="演示支付">{{
              data.demoPayment ? "已开启（禁止用于正式营业）" : "关闭"
            }}</el-descriptions-item></el-descriptions
          >
          <p>
            商户密钥在服务器环境变量中配置。页面不保存或回显密钥。支付状态由微信验签通知及主动查单确认，退款在订单详情中发起。
          </p></el-tab-pane
        >
        <el-tab-pane label="操作日志" name="audit"
          ><el-table :data="audits" stripe
            ><el-table-column
              prop="created_at"
              label="时间"
              min-width="170" /><el-table-column
              prop="actor"
              label="操作人" /><el-table-column
              prop="action"
              label="操作" /><el-table-column
              prop="target"
              label="对象" /><el-table-column
              prop="detail"
              label="记录"
              min-width="260"
              show-overflow-tooltip
          /></el-table>
          <div class="toolbar">
            <el-button
              :disabled="auditPage === 1"
              @click="
                auditPage--;
                loadAudit();
              "
              >上一页</el-button
            ><span>第 {{ auditPage }} 页</span
            ><el-button
              :disabled="audits.length < 50"
              @click="
                auditPage++;
                loadAudit();
              "
              >下一页</el-button
            >
          </div></el-tab-pane
        >
      </el-tabs>
    </template>
    <el-dialog
      v-model="editing"
      :title="
        { product: '餐品信息', room: '包厢信息', account: '食堂账号' }[kind]
      "
      width="480px"
      :close-on-click-modal="false"
      ><el-form label-position="top" @submit.prevent="save">
        <template v-if="kind === 'product'"
          ><el-form-item label="餐品名称"
            ><el-input v-model="form.name" maxlength="60" /></el-form-item
          ><el-form-item label="分类"
            ><el-select v-model="form.category"
              ><el-option label="主食" value="主食" /><el-option
                label="小吃"
                value="小吃" /></el-select></el-form-item
          ><el-form-item label="售价（元）"
            ><el-input-number
              v-model="form.price"
              :min="0.01"
              :max="9999"
              :precision="2" /></el-form-item
          ><el-form-item label="描述"
            ><el-input
              v-model="form.description"
              maxlength="300" /></el-form-item
          ><el-form-item label="餐品图片"
            ><img
              v-if="form.customImage"
              :src="asset(form.customImage)"
              class="food-preview" /><input
              type="file"
              accept="image/png,image/jpeg"
              @change="upload" /></el-form-item
          ><el-switch v-model="form.onSale" active-text="上架"
        /></template>
        <template v-else-if="kind === 'room'"
          ><el-form-item label="包厢编号"
            ><el-input v-model="form.id" maxlength="12" /></el-form-item
          ><el-switch v-model="form.bound" active-text="启用包厢"
        /></template>
        <template v-else
          ><el-form-item label="食堂名称"
            ><el-input v-model="form.name" maxlength="60" /></el-form-item
          ><el-form-item :label="form.id ? '新密码（留空不修改）' : '初始密码'"
            ><el-input
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              show-password
            /><small>至少12个字符，UTF-8编码不超过72字节</small></el-form-item
          ><el-switch v-model="form.enabled" active-text="启用" /><el-checkbox
            v-model="form.process"
            >接单与制作</el-checkbox
          ><el-checkbox v-model="form.deliver">确认送达</el-checkbox></template
        >
        <p v-if="formError" class="error">{{ formError }}</p></el-form
      ><template #footer
        ><el-button @click="editing = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="save"
          >保存</el-button
        ></template
      ></el-dialog
    >
    <el-drawer
      :model-value="!!detailId"
      title="订单详情"
      size="560px"
      @close="detailId = ''"
    >
      <template v-if="detail"
        ><h2>{{ detail.room }} 包厢 · #{{ detail.id }}</h2>
        <p>
          {{ labels[detail.status] }} · ¥{{ money(detail.totalCents) }} ·
          {{
            detail.paymentMode === "demo"
              ? "演示支付"
              : detail.paid
                ? "微信支付"
                : "未付款"
          }}
        </p>
        <el-table :data="detail.items"
          ><el-table-column prop="name" label="餐品" /><el-table-column
            prop="quantity"
            label="份数" /><el-table-column
            prop="price"
            label="单价" /></el-table
        ><el-timeline class="timeline"
          ><el-timeline-item
            v-for="(event, i) in detail.events"
            :key="i"
            :timestamp="event.at"
            >{{ event.label }}</el-timeline-item
          ></el-timeline
        >
        <div class="actions">
          <el-button
            v-if="detail.status === 'unpaid'"
            :disabled="busy"
            @click="cancel(detail)"
            >取消订单</el-button
          ><el-button
            v-if="
              ['pending', 'preparing', 'delivering'].includes(detail.status)
            "
            :disabled="busy"
            @click="transfer(detail)"
            >转派食堂</el-button
          ><el-button
            v-if="
              detail.paymentMode === 'wechat' && detail.status !== 'refunded'
            "
            :disabled="busy"
            type="danger"
            @click="refund(detail)"
            >{{
              detail.status === "refunding" ? "查询或重试退款" : "全额退款"
            }}</el-button
          ><el-button
            v-if="detail.paymentMode !== 'demo'"
            :disabled="busy"
            @click="write('/orders/' + detail.id + '/payment-query', 'POST')"
            >核对付款</el-button
          >
        </div></template
      >
    </el-drawer>
    <el-dialog v-model="qrOpen" title="包厢点餐码" width="480px"
      ><img :src="qrData.image" class="qr" />
      <p>{{ qrData.room }} 包厢</p>
      <a :href="qrData.image" :download="qrData.room + '-qrcode.png'"
        >保存二维码图片</a
      >
      <p v-if="qrData.url">{{ qrData.url }}</p></el-dialog
    >
  </main>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/request";
const data = reactive({
    orders: [],
    products: [],
    rooms: [],
    accounts: [],
    orderCounts: {},
  }),
  config = reactive({});
const orderPage = ref(1);
const loading = ref(false),
  ready = ref(false),
  error = ref(""),
  busy = ref(false),
  tab = ref("orders"),
  search = ref(""),
  status = ref(""),
  detailId = ref("");
const labels = {
  unpaid: "待付款",
  pending: "待接单",
  preparing: "制作中",
  delivering: "配送中",
  completed: "已完成",
  cancelled: "已取消",
  refunding: "退款中",
  refunded: "已退款",
};
const orders = computed(() => data.orders);
const detail = computed(
  () =>
    data.orders.find((o) => o.id === detailId.value) ||
    (data.orderDetail?.id === detailId.value ? data.orderDetail : null),
);
const money = (c) => (Number(c) / 100).toFixed(2);
const api = (url, method = "GET", body) =>
  request({
    url: "/ktv-api" + url,
    method,
    data: body,
    headers: { repeatSubmit: false },
  });
let timer,
  filterTimer,
  stopped = false,
  readVersion = 0;
async function refresh(silent = false) {
  const version = ++readVersion;
  if (!silent) loading.value = true;
  try {
    const state = await api(
      "/state?page=" +
        orderPage.value +
        "&filter=" +
        encodeURIComponent(status.value) +
        "&search=" +
        encodeURIComponent(search.value) +
        "&orderId=" +
        encodeURIComponent(detailId.value),
    );
    if (version !== readVersion) return;
    if (!Array.isArray(state.orders)) throw Error("门店数据格式无效");
    Object.assign(data, state);
    ready.value = true;
    error.value = "";
  } catch (e) {
    if (version !== readVersion) return;
    error.value = e.message || "门店数据加载失败";
    if ([401, 403].includes(e.status || e.response?.status)) stopped = true;
  } finally {
    if (version === readVersion) loading.value = false;
  }
}
watch([search, status], () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    orderPage.value = 1;
    refresh();
  }, 250);
});
async function poll() {
  if (stopped) return;
  if (!document.hidden) await refresh(true);
  if (!stopped) timer = setTimeout(poll, 5000);
}
onMounted(async () => {
  await refresh();
  if (ready.value)
    api("/readiness")
      .then((r) => Object.assign(config, r))
      .catch(() => {});
  timer = setTimeout(poll, 5000);
});
onUnmounted(() => {
  stopped = true;
  clearTimeout(timer);
  clearTimeout(filterTimer);
});
async function write(path, method, body) {
  if (busy.value) throw Error("正在保存，请稍候");
  busy.value = true;
  try {
    const result = await api(path, method, body);
    await refresh(true);
    ElMessage.success("操作已保存");
    return result;
  } finally {
    busy.value = false;
  }
}
const editing = ref(false),
  kind = ref(""),
  form = reactive({}),
  formError = ref("");
let originalId = "";
function edit(type, row) {
  kind.value = type;
  originalId = row?.id || "";
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(
    form,
    type === "product"
      ? {
          id: "food-" + crypto.randomUUID(),
          name: "",
          category: "主食",
          price: 0.01,
          description: "",
          image: "chicken",
          customImage: "",
          onSale: true,
          version: 0,
        }
      : type === "room"
        ? { id: "", bound: true, version: 0 }
        : {
            name: "",
            password: "",
            enabled: true,
            process: true,
            deliver: true,
          },
    row || {},
  );
  formError.value = "";
  editing.value = true;
}
async function save() {
  formError.value = "";
  try {
    if (kind.value !== "room" && !form.name?.trim()) throw Error("请填写名称");
    const path =
      kind.value === "product"
        ? "/products/" + form.id
        : kind.value === "room"
          ? "/rooms/" + encodeURIComponent(originalId || form.id)
          : "/accounts" + (form.id ? "/" + form.id : "");
    await write(path, kind.value === "account" && !form.id ? "POST" : "PUT", {
      ...form,
    });
    editing.value = false;
  } catch (e) {
    formError.value = e.message;
  }
}
const asset = (url) => import.meta.env.VITE_APP_BASE_API + url;
async function upload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    formError.value = "图片不能超过2 MB";
    return;
  }
  const body = new FormData();
  body.append("file", file);
  try {
    const result = await request({
      url: "/ktv-api/images",
      method: "POST",
      data: body,
      headers: { "Content-Type": "multipart/form-data", repeatSubmit: false },
    });
    form.customImage = result.url;
  } catch (e) {
    formError.value = e.message;
  }
}
const qrOpen = ref(false),
  qrData = reactive({});
async function qr(room, type, rotate = false) {
  try {
    Object.assign(
      qrData,
      await api(
        "/rooms/" +
          encodeURIComponent(room.id) +
          "/qr?type=" +
          type +
          "&rotate=" +
          rotate,
        "POST",
      ),
    );
    qrOpen.value = true;
  } catch (e) {
    error.value = e.message;
  }
}
async function rotateQr(room) {
  try {
    await ElMessageBox.confirm(
      "原包厢码会失效，需要重新打印张贴。确认换码？",
      "重新生成二维码",
    );
    await qr(room, "mini", true);
  } catch {}
}
async function cancel(order) {
  try {
    await ElMessageBox.confirm("确认取消未付款订单？", "取消订单");
    await write("/orders/" + order.id + "/cancel", "POST");
  } catch (e) {
    if (e?.message) error.value = e.message;
  }
}
async function transfer(order) {
  try {
    const options = data.accounts.filter(
      (a) => a.enabled && a.process && a.deliver && a.id !== order.supplierId,
    );
    if (!options.length) throw Error("没有其他可接单食堂");
    const target = await ElMessageBox.prompt(
      "可选食堂：" + options.map((a) => a.id + " " + a.name).join("；"),
      "填写目标食堂账号",
      {
        inputValidator: (v) =>
          options.some((a) => a.id === v) || "请选择列表中的账号",
      },
    );
    const reason = await ElMessageBox.prompt("填写转派原因", "转派订单", {
      inputValidator: (v) => !!v?.trim() || "请填写原因",
    });
    await write("/orders/" + order.id + "/reassign", "POST", {
      supplierId: target.value,
      reason: reason.value,
      version: order.version,
    });
  } catch (e) {
    if (e?.message) error.value = e.message;
  }
}
async function refund(order) {
  try {
    const result = await ElMessageBox.prompt(
      "将全额原路退回 ¥" + money(order.totalCents) + "，请填写原因。",
      "确认退款",
      { inputValidator: (v) => !!v?.trim() || "请填写原因" },
    );
    await write("/orders/" + order.id + "/refund", "POST", {
      reason: result.value,
      version: order.version,
    });
  } catch (e) {
    if (e?.message) error.value = e.message;
  }
}
const audits = ref([]),
  auditPage = ref(1);
async function loadAudit() {
  try {
    audits.value = await api("/audit?page=" + auditPage.value);
  } catch (e) {
    error.value = e.message;
  }
}
function onTab(name) {
  if (name === "audit") loadAudit();
}
</script>
<style scoped>
.ktv-console {
  max-width: 1450px;
  margin: auto;
  padding: 32px;
  color: #182326;
}
.ktv-console header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.ktv-console h1 {
  font-size: 28px;
  margin: 8px 0;
}
.ktv-console p {
  color: #66716d;
  line-height: 1.6;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 2px;
  color: #be5428 !important;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 24px 0;
}
.metrics article {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #faf9f6;
  border: 1px solid #ece9e3;
  border-radius: 14px;
  padding: 24px;
}
.metrics span {
  color: #68736f;
}
.metrics strong {
  font-size: 32px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 18px 0;
}
.toolbar .el-input {
  max-width: 300px;
}
.toolbar .el-select {
  width: 180px;
}
.toolbar span {
  font-size: 13px;
  color: #66716d;
}
.qr {
  width: 100%;
  max-width: 360px;
  display: block;
  margin: auto;
}
.food-preview {
  width: 80px;
  height: 80px;
  object-fit: cover;
  margin-right: 16px;
  border-radius: 8px;
}
.timeline {
  margin: 30px 0;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.error {
  color: #c0392b !important;
}
.ktv-console :deep(.el-tabs__item.is-active) {
  color: #d46832;
}
.ktv-console :deep(.el-tabs__active-bar) {
  background: #d46832;
}
@media (max-width: 800px) {
  .ktv-console {
    padding: 16px;
  }
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .ktv-console header {
    align-items: start;
    gap: 16px;
  }
  .toolbar {
    flex-wrap: wrap;
  }
}
</style>
