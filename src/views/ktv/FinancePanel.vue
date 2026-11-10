<template>
  <section class="finance-panel" v-loading="loading">
    <div class="finance-heading"><div><h2>收支总账</h2><p>核对顾客付款与退款，按北京时间统计。金额不等同于微信可提现余额。</p></div><el-button :loading="exporting" @click="exportCsv">导出账单</el-button></div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <div class="finance-filters">
      <el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false" aria-label="账单日期范围" />
      <el-select v-model="kind" aria-label="账单类型" placeholder="全部收支"><el-option label="全部收支" value=""/><el-option label="顾客付款" value="receipt"/><el-option label="成功退款" value="refund"/></el-select>
      <el-input v-model="search" clearable placeholder="完整订单号、包厢或微信单号" aria-label="搜索账单" @keyup.enter="query" />
      <el-button type="primary" @click="query">查询账单</el-button><el-button @click="refresh">刷新</el-button>
    </div>
    <dl class="finance-summary" aria-label="当前筛选汇总"><div><dt>顾客实付</dt><dd>¥{{ money(data.receiptCents) }}</dd></div><div><dt>成功退款</dt><dd>¥{{ money(data.refundCents) }}</dd></div><div><dt>净收款</dt><dd>¥{{ money(data.netCents) }}</dd></div><div><dt>收支笔数</dt><dd>{{ data.total }}</dd></div></dl>
    <p class="finance-note">仅统计真实支付成功和退款成功的记录。未付款、取消及演示订单不计入；净收款未扣手续费及线下结算款。</p>
    <el-tabs v-model="view" @tab-change="changeView">
      <el-tab-pane label="收支明细" name="entries">
        <el-table :data="data.entries" stripe empty-text="该范围暂无实际收款或退款，调整日期后重试。">
          <el-table-column prop="occurredAt" label="发生时间" min-width="175"><template #default="s">{{ s.row.occurredAt.replace('T',' ').slice(0,19) }}<el-tag v-if="s.row.timeSource==='recorded'" size="small" type="info">补录时间</el-tag></template></el-table-column>
          <el-table-column label="类型" width="100"><template #default="s"><el-tag :type="s.row.kind==='receipt'?'success':'warning'">{{ s.row.kind==='receipt'?'顾客付款':'成功退款' }}</el-tag></template></el-table-column>
          <el-table-column prop="orderId" label="订单号" min-width="90"/><el-table-column prop="room" label="包厢" width="90"/><el-table-column prop="supplierId" label="当前食堂" min-width="100"/>
          <el-table-column label="收支金额" min-width="130" align="right"><template #default="s"><span :class="s.row.amountCents<0?'refund':'receipt'">{{ s.row.amountCents>0?'+':'' }}{{ money(s.row.amountCents) }}</span></template></el-table-column>
          <el-table-column prop="providerNo" label="微信交易 / 退款单号" min-width="260" show-overflow-tooltip/>
        </el-table>
        <div class="finance-pagination"><el-pagination v-model:current-page="page" :total="data.total" :page-size="50" layout="total, prev, pager, next" @current-change="refresh"/></div>
      </el-tab-pane>
      <el-tab-pane label="按日汇总" name="daily">
        <p class="finance-note">按所选日期汇总全部收款和退款，不使用类型、订单号筛选；单次最多一年。</p>
        <el-table :data="daily" stripe empty-text="该日期范围暂无实际收支。"><el-table-column prop="date" label="日期"/><el-table-column prop="count" label="收支笔数"/><el-table-column label="顾客实付"><template #default="s">¥{{ money(s.row.receiptCents) }}</template></el-table-column><el-table-column label="成功退款"><template #default="s">¥{{ money(s.row.refundCents) }}</template></el-table-column><el-table-column label="净收款"><template #default="s">¥{{ money(s.row.netCents) }}</template></el-table-column></el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>
<script setup>
import {ref,reactive,onMounted,onUnmounted} from 'vue';
import request from '@/utils/request';
import {ElMessage} from 'element-plus';
import {saveAs} from 'file-saver';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dates=ref([today.slice(0,7)+'-01',today]),kind=ref(''),search=ref(''),page=ref(1),view=ref('entries'),daily=ref([]),error=ref(''),loading=ref(false),exporting=ref(false);
const data=reactive({entries:[],total:0,receiptCents:0,refundCents:0,netCents:0});
const money=value=>(Number(value||0)/100).toFixed(2);
const params=()=>({from:dates.value?.[0]||'',to:dates.value?.[1]||'',kind:kind.value,search:search.value.trim(),page:page.value});
let sequence=0,timer;
async function refresh(){const epoch=++sequence;loading.value=true;error.value='';try{const result=await request({url:'/ktv-api/finance/ledger',params:params()});if(epoch!==sequence)return;Object.assign(data,result);if(view.value==='daily')await loadDaily();}catch(e){if(epoch===sequence){error.value=e.message||'账单加载失败，请重试';Object.assign(data,{entries:[],total:0,receiptCents:0,refundCents:0,netCents:0});}}finally{if(epoch===sequence)loading.value=false;}}
async function loadDaily(){daily.value=[];try{daily.value=await request({url:'/ktv-api/finance/daily',params:{from:dates.value[0],to:dates.value[1]}});}catch(e){error.value=e.message||'按日汇总加载失败';}}
function changeView(name){if(name==='daily')loadDaily();}
function query(){page.value=1;refresh();}
async function exportCsv(){exporting.value=true;try{const blob=await request({url:'/ktv-api/finance/export',params:params(),responseType:'blob'});if(blob.type.includes('json'))throw Error(JSON.parse(await blob.text()).message||'导出失败');saveAs(blob,'KTV收支账单-'+dates.value.join('_')+'.csv');ElMessage.success('账单已导出');}catch(e){error.value=e.message||'导出失败';}finally{exporting.value=false;}}
onMounted(()=>{refresh();timer=setInterval(()=>{if(!document.hidden&&!loading.value)refresh();},30000);});
onUnmounted(()=>{sequence++;clearInterval(timer);});
</script>
<style scoped>
.finance-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:12px 0 22px}.finance-heading h2{margin:0 0 8px;font-size:22px;color:var(--el-text-color-primary)}.finance-heading p,.finance-note{color:var(--el-text-color-secondary);font-size:13px;line-height:1.7;margin:0}.finance-filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0}.finance-filters .el-select{width:140px}.finance-filters .el-input{width:260px}.finance-filters :deep(.el-date-editor){max-width:360px}.finance-summary{display:flex;flex-wrap:wrap;gap:32px;padding:20px 0;border-top:1px solid var(--el-border-color-lighter);border-bottom:1px solid var(--el-border-color-lighter);margin:16px 0 10px}.finance-summary div{min-width:140px}.finance-summary dt{font-size:13px;color:var(--el-text-color-secondary);margin-bottom:8px}.finance-summary dd{margin:0;font-size:25px;font-weight:600;font-variant-numeric:tabular-nums}.finance-note{margin-bottom:18px}.finance-pagination{display:flex;justify-content:flex-end;margin-top:18px}.receipt{color:var(--el-color-success);font-variant-numeric:tabular-nums}.refund{color:var(--el-color-warning);font-variant-numeric:tabular-nums}@media(max-width:700px){.finance-heading{align-items:flex-start;flex-direction:column}.finance-filters>*{max-width:100%}.finance-summary{gap:20px}.finance-summary div{min-width:120px}.finance-pagination{overflow:auto;justify-content:flex-start}}
</style>
