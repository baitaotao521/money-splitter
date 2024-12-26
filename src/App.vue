<template>
  <div class="container" :class="{ 'dark-mode': isDarkMode }">
    <div class="theme-switch">
      <el-switch
        v-model="isDarkMode"
        active-text="暗色"
        inactive-text="亮色"
      />
    </div>
    <h1 class="title">金额分配计算器</h1>
    
    <el-form :model="form" label-width="120px" class="form-container">
      <el-form-item label="总金额">
        <el-input-number 
          v-model="form.totalAmount" 
          :min="0" 
          :precision="2"
          :step="100"
          @change="calculateAll"
          class="total-amount-input"
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
              <el-input-number 
                v-model="split.percentage" 
                :min="0" 
                :max="remainingPercentage + split.percentage"
                @change="calculateAll"
              >
                <template #suffix>%</template>
              </el-input-number>
              
              <el-input 
                v-model="split.amount" 
                disabled 
                class="amount-input"
              >
                <template #prefix>¥</template>
              </el-input>
              
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
              <span>分配比例图表</span>
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
        </div>
      </template>
      <div class="summary-content">
        <p>剩余金额：¥{{ remainingAmount.toFixed(2) }}</p>
        <p>剩余比例：{{ remainingPercentage.toFixed(2) }}%</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessageBox, ElMessage, ElIcon } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { useLocalStorage } from './composables/useLocalStorage'
import * as echarts from 'echarts'

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
      formatter: '{b}: {c}%'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{c}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
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
  
  &.dark-mode {
    background-color: #1a1a1a;
    color: #ffffff;
    
    .el-card {
      background-color: #2c2c2c;
      border: 1px solid #3f3f3f;
      color: #ffffff;
    }
    
    .title, .section-title {
      color: #ffffff;
    }
  }
  
  @media (max-width: 768px) {
    padding: 10px;
  }
}

.theme-switch {
  position: fixed;
  top: 20px;
  right: 20px;
}

.title {
  text-align: center;
  color: #409EFF;
  font-size: 2.5em;
  margin-bottom: 1.5em;
  font-weight: 600;
}

.form-container {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.total-amount-input {
  width: 200px;
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

.amount-input, .note-input, .name-input {
  flex: 1;
}

.summary-card {
  margin-top: 20px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.summary-content {
  font-size: 16px;
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
  margin: 20px 0;
  
  @media (min-width: 1200px) {
    grid-template-columns: 1fr 400px;
  }
}
</style> 