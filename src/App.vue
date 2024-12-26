<template>
  <div class="container" :class="{ 'dark-mode': isDarkMode }">
    <div class="header">
      <div class="title-wrapper">
        <h1 class="title">金额分配计算器</h1>
        <div class="subtitle">简单高效的资金分配工具</div>
      </div>
      <div class="theme-switch">
        <el-switch
          v-model="isDarkMode"
          active-text="暗色"
          inactive-text="亮色"
          class="theme-switch-button"
        />
      </div>
    </div>
    
    <el-form :model="form" label-width="120px" class="form-container">
      <div class="template-controls">
        <el-select 
          v-model="currentTemplate" 
          placeholder="选择已保存的模板"
          class="template-select"
          filterable
          :popper-class="isDarkMode ? 'dark-select' : ''"
        >
          <el-option
            v-for="temp in templates"
            :key="temp.id"
            :label="temp.name"
            :value="temp.id"
          />
        </el-select>
        <el-button 
          type="danger" 
          @click="deleteTemplate" 
          :disabled="!currentTemplate"
          class="template-action-btn"
        >
          <el-icon><Delete /></el-icon> 删除模板
        </el-button>
        <el-button type="primary" @click="showSaveDialog">
          <el-icon><DocumentAdd /></el-icon> 保存为模板
        </el-button>
      </div>

      <el-form-item label="总金额" class="total-amount-wrapper">
        <el-input-number 
          v-model="form.totalAmount" 
          :min="0" 
          :precision="2"
          :step="100"
          @change="calculateAll"
          class="total-amount-input"
          controls-position="right"
        />
        <el-button type="warning" @click="clearAll" class="clear-btn" :class="{ 'shake-animation': showShake }">
          <el-icon><Delete /></el-icon> 清空所有
        </el-button>
      </el-form-item>
    </el-form>

    <div class="main-content">
      <div class="splits-container">
        <div class="splits-header">
          <h3 class="section-title">分配明细</h3>
          <el-button type="primary" @click="addSplit" class="add-btn">
            <el-icon><Plus /></el-icon> 添加分配项
          </el-button>
        </div>

        <TransitionGroup name="list">
          <el-card v-for="(split, index) in form.splits" 
            :key="index" 
            class="split-item"
            :class="{ 'highlight': isNewItem === index }"
          >
            <div class="split-content">
              <el-input 
                v-model="split.name" 
                placeholder="项目名称"
                class="name-input"
              />
              <div class="percentage-amount-group">
                <el-input-number 
                  v-model="split.percentage" 
                  :min="0" 
                  :max="remainingPercentage + split.percentage"
                  @change="(val) => handlePercentageChange(val, index)"
                  class="percentage-input"
                >
                  <template #suffix>%</template>
                </el-input-number>
                
                <el-input-number
                  v-model="split.amount"
                  :min="0"
                  :max="form.totalAmount"
                  :precision="2"
                  @change="(val) => handleAmountChange(val, index)"
                  class="amount-input"
                >
                  <template #prefix>¥</template>
                </el-input-number>
              </div>
              
              <el-input 
                v-model="split.note" 
                placeholder="备注"
                class="note-input"
              />
              
              <el-button type="danger" @click="removeSplit(index)">删除</el-button>
            </div>
          </el-card>
        </TransitionGroup>
      </div>

      <div class="chart-container">
        <el-card>
          <template #header>
            <div class="chart-header">
              <div class="chart-title">
                <span>分配比例图表</span>
                <span class="total-amount">总金额: ¥{{ form.totalAmount.toFixed(2) }}</span>
              </div>
            </div>
          </template>
          <div ref="chartRef" class="pie-chart"></div>
        </el-card>
      </div>
    </div>

    <el-card class="summary-card">
      <template #header>
        <div class="summary-header">
          <span>汇总信息</span>
          <el-button 
            type="success" 
            @click="exportToExcel"
            :disabled="form.splits.length === 0"
          >
            <el-icon><Document /></el-icon> 导出Excel
          </el-button>
        </div>
      </template>
      <div class="summary-content">
        <p>剩余金额：¥{{ remainingAmount.toFixed(2) }}</p>
        <p>剩余比例：{{ remainingPercentage.toFixed(2) }}%</p>
      </div>
    </el-card>
  </div>

  <el-dialog
    v-model="saveDialogVisible"
    title="保存模板"
    width="30%"
  >
    <el-form :model="templateForm" label-width="80px">
      <el-form-item label="模板名称">
        <el-input v-model="templateForm.name" placeholder="请输入模板名称" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessageBox, ElMessage, ElIcon } from 'element-plus'
import { Delete, Plus, DocumentAdd, Document } from '@element-plus/icons-vue'
import { useLocalStorage } from './composables/useLocalStorage'
import * as echarts from 'echarts'
import * as XLSX from 'xlsx'

const chartRef = ref(null)
let chart = null

const { state: form, setState: setForm } = useLocalStorage('splitter-form', {
  totalAmount: 0,
  splits: []
})

const remainingPercentage = computed(() => {
  return 100 - form.value.splits.reduce((sum, split) => sum + split.percentage, 0)
})

const remainingAmount = computed(() => {
  const allocatedAmount = form.value.splits.reduce((sum, split) => sum + split.amount, 0)
  return form.value.totalAmount - allocatedAmount
})

const isDarkMode = ref(false)
const showShake = ref(false)
const isNewItem = ref(null)

const addSplit = () => {
  form.value.splits.push({
    name: '',
    percentage: 0,
    amount: 0,
    note: ''
  })
  isNewItem.value = form.value.splits.length - 1
  setTimeout(() => {
    isNewItem.value = null
  }, 1000)
}

const removeSplit = (index) => {
  form.value.splits.splice(index, 1)
  calculateAll()
}

const calculateAll = () => {
  form.value.splits.forEach(split => {
    split.amount = (form.value.totalAmount * split.percentage / 100)
  })
}

const handlePercentageChange = (value, index) => {
  const split = form.value.splits[index]
  split.percentage = value
  split.amount = (form.value.totalAmount * value / 100)
}

const handleAmountChange = (value, index) => {
  const split = form.value.splits[index]
  split.amount = value
  if (form.value.totalAmount > 0) {
    split.percentage = (value / form.value.totalAmount * 100)
  } else {
    split.percentage = 0
  }
}

const clearAll = () => {
  showShake.value = true
  setTimeout(() => {
    showShake.value = false
  }, 1000)
  ElMessageBox.confirm('确定要清空所有数据吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    form.value.totalAmount = 0
    form.value.splits = []
    ElMessage.success('已清空所有数据')
  }).catch(() => {})
}

const updateChart = () => {
  if (!chart) return
  
  const data = form.value.splits.map(split => ({
    value: split.percentage,
    name: split.name || '未命名项目'
  }))
  
  if (remainingPercentage.value > 0) {
    data.push({
      value: remainingPercentage.value,
      name: '未分配',
      itemStyle: {
        color: '#909399'
      }
    })
  }

  const options = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const amount = (params.value * form.value.totalAmount / 100).toFixed(2)
        return `${params.name}<br/>金额：¥${amount}<br/>占比：${params.value}%`
      }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [
      {
        type: 'pie',
        radius: '75%',
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params) => {
            if (params.percent < 5) return ''
            return `${params.value}%`
          },
          position: 'inside',
          fontSize: 14,
          color: '#fff'
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            formatter: (params) => {
              return `${params.name}\n${params.value}%`
            }
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }

  chart.setOption(options)
}

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    updateChart()

    window.addEventListener('resize', () => {
      chart.resize()
    })
  }
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    window.removeEventListener('resize', () => {
      chart.resize()
    })
  }
})

// 监听数据变化更新图表
watch(
  [() => form.value.splits, remainingPercentage],
  () => {
    updateChart()
  },
  { deep: true }
)

// 监听暗色模式变化
watch(isDarkMode, (newValue) => {
  if (chart) {
    chart.dispose()
    chart = echarts.init(chartRef.value, newValue ? 'dark' : null)
    updateChart()
  }
})

// 模板相关的状态
const saveDialogVisible = ref(false)
const templateForm = ref({ name: '' })
const currentTemplate = ref('')
const { state: templates } = useLocalStorage('splitter-templates', [])

// 保存模板
const showSaveDialog = () => {
  if (form.value.splits.length === 0) {
    ElMessage.warning('请先添加分配项')
    return
  }
  saveDialogVisible.value = true
}

const saveTemplate = () => {
  if (!templateForm.value.name) {
    ElMessage.warning('请输入模板名称')
    return
  }

  const template = {
    id: Date.now().toString(),
    name: templateForm.value.name,
    splits: form.value.splits.map(split => ({
      name: split.name,
      percentage: split.percentage,
      note: split.note
    }))
  }

  templates.value.push(template)
  saveDialogVisible.value = false
  templateForm.value.name = ''
  ElMessage.success('模板保存成功')
}

// 加载模板
watch(currentTemplate, (newValue) => {
  if (!newValue) return

  const template = templates.value.find(t => t.id === newValue)
  if (template) {
    ElMessageBox.confirm('加载模板将覆盖当前数据，是否继续？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      form.value.splits = template.splits.map(split => ({
        ...split,
        amount: (form.value.totalAmount * split.percentage / 100)
      }))
      calculateAll()
      ElMessage.success('模板加载成功')
    }).catch(() => {
      currentTemplate.value = ''
    })
  }
})

const deleteTemplate = () => {
  if (!currentTemplate.value) return

  const template = templates.value.find(t => t.id === currentTemplate.value)
  if (!template) return

  ElMessageBox.confirm(
    `确定要删除模板"${template.name}"吗？此操作不可恢复。`, 
    '警告', 
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = templates.value.findIndex(t => t.id === currentTemplate.value)
    if (index > -1) {
      templates.value.splice(index, 1)
      currentTemplate.value = ''
      ElMessage.success('模板删除成功')
    }
  }).catch(() => {})
}

const exportToExcel = () => {
  // 准备导出数据
  const exportData = form.value.splits.map((split, index) => ({
    '序号': index + 1,
    '项目名称': split.name || '未命名项目',
    '金额': split.amount.toFixed(2),
    '占比': split.percentage.toFixed(2) + '%',
    '备注': split.note || ''
  }))

  // 添加汇总行
  exportData.push({
    '序号': '',
    '项目名称': '未分配',
    '金额': remainingAmount.value.toFixed(2),
    '占比': remainingPercentage.value.toFixed(2) + '%',
    '备注': ''
  })

  exportData.push({
    '序号': '',
    '项目名称': '总计',
    '金额': form.value.totalAmount.toFixed(2),
    '占比': '100%',
    '备注': ''
  })

  // 创建工作簿和工作表
  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '分配明细')

  // 设置列宽
  const colWidths = [
    { wch: 8 },  // 序号
    { wch: 20 }, // 项目名称
    { wch: 15 }, // 金额
    { wch: 10 }, // 占比
    { wch: 30 }  // 备注
  ]
  ws['!cols'] = colWidths

  // 生成文件名
  const fileName = `金额分配明细_${new Date().toLocaleDateString()}.xlsx`

  // 导出文件
  XLSX.writeFile(wb, fileName)
  ElMessage.success('导出成功')
}
</script>

<style scoped lang="scss">
.clear-btn {
  margin-left: 10px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--el-bg-color);
  
  &.dark-mode {
    background-color: #141414;
    color: #ffffff;
    
    .el-card {
      background-color: #2c2c2c;
      border: 1px solid #3f3f3f;
      color: #ffffff;
    }
    
    .title, .section-title {
      color: #ffffff;
    }
    
    .subtitle {
      color: rgba(255, 255, 255, 0.7);
    }
  }
  
  @media (max-width: 768px) {
    padding: 10px;
  }
}

.title-wrapper {
  text-align: center;
  
  .subtitle {
    color: var(--el-text-color-secondary);
    margin-top: 8px;
    font-size: 1.1em;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 20px;
}

.title {
  color: #409EFF;
  font-size: 2.5em;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(45deg, #409EFF, #36cfc9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.form-container {
  background: var(--el-bg-color-overlay);
  padding: 20px;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
  border: 1px solid var(--el-border-color-light);
}

.total-amount-wrapper {
  margin-bottom: 0;
}

.total-amount-input {
  width: 200px;
  :deep(.el-input-number__decrease),
  :deep(.el-input-number__increase) {
    border-radius: 0;
  }
}

.clear-btn.shake-animation {
  animation: shake 0.82s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.highlight {
  animation: highlight 1s ease;
}

@keyframes highlight {
  0% { background-color: rgba(64, 158, 255, 0.1); }
  100% { background-color: transparent; }
}

.splits-container {
  min-width: 0;
}

.splits-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.split-item {
  margin-bottom: 10px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow);
  }
}

.split-content {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.percentage-amount-group {
  display: flex;
  gap: 10px;
  flex: 2;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
  
  .percentage-input,
  .amount-input {
    flex: 1;
  }
}

.amount-input, .note-input, .name-input {
  flex: 1;
}

.summary-card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-content {
  font-size: 16px;
  
  p {
    margin: 10px 0;
  }
}

.add-btn {
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
  }
}

.chart-container {
  min-width: 0;
  
  .pie-chart {
    height: 400px;
    width: 100%;
  }
}

.main-content {
  display: grid;
  gap: 20px;
  
  @media (min-width: 1200px) {
    grid-template-columns: 1fr 400px;
  }
}

.template-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  
  .template-select {
    width: 200px;
    flex: 1;
  }
  
  .template-action-btn {
    white-space: nowrap;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    
    .template-select {
      width: 100%;
    }
    
    .template-action-btn {
      width: 100%;
    }
  }
}

.template-action-btn {
  margin-left: 10px;
}

.chart-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .total-amount {
    color: var(--el-color-success);
    font-weight: 500;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .title {
    font-size: 2em;
  }

  .form-container {
    padding: 15px;
  }
}

.theme-switch-button {
  :deep(.el-switch__label) {
    color: var(--el-text-color-regular);
  }
}

:deep(.dark-select) {
  background-color: #2c2c2c;
  border-color: #3f3f3f;
  
  .el-select-dropdown__item {
    color: #ffffff;
    
    &.selected {
      color: var(--el-color-primary);
    }
    
    &:hover {
      background-color: #363636;
    }
  }
}
</style> 