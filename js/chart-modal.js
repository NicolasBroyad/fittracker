import { chartModalOpen, setChartModalOpen, setActiveTabState } from './state.js';
import { renderChart } from './chart.js';

const BIG_OPTS = { rowH: 460, spacing: 30 };

export function setActiveTab(tab){
  setActiveTabState(tab);
  document.getElementById('tab-weekly').classList.toggle('active', tab==='weekly');
  document.getElementById('tab-daily').classList.toggle('active', tab==='daily');
  document.getElementById('tab-weekly-big').classList.toggle('active', tab==='weekly');
  document.getElementById('tab-daily-big').classList.toggle('active', tab==='daily');
  renderChart('chart-container', 'chart-legend');
  if(chartModalOpen){
    renderChart('chart-container-big', 'chart-legend-big', BIG_OPTS);
  }
}

export function openChartModal(){
  setChartModalOpen(true);
  document.getElementById('chart-modal-overlay').classList.remove('hidden');
  renderChart('chart-container-big', 'chart-legend-big', BIG_OPTS);
}
export function closeChartModal(){
  setChartModalOpen(false);
  document.getElementById('chart-modal-overlay').classList.add('hidden');
}
export function rerenderIfOpen(){
  renderChart('chart-container', 'chart-legend');
  if(chartModalOpen){
    renderChart('chart-container-big', 'chart-legend-big', BIG_OPTS);
  }
}
