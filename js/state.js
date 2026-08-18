// "YYYY-MM-DD" -> {weight, note}
export let entries = {};
export function setEntries(v){ entries = v; }

export let viewMonth = new Date();
viewMonth.setDate(1);
viewMonth.setHours(0,0,0,0);

export let activeTab = 'weekly';
export function setActiveTabState(v){ activeTab = v; }

export let selectedDateStr = null;
export function setSelectedDateStr(v){ selectedDateStr = v; }

export let chartModalOpen = false;
export function setChartModalOpen(v){ chartModalOpen = v; }

// '1m' | '3m' | '6m' | '1y' | 'all'
export let chartRange = 'all';
export function setChartRangeState(v){ chartRange = v; }

// { target_weight, created_at } | null
export let currentGoal = null;
export function setCurrentGoal(v){ currentGoal = v; }

// fases (períodos): [{ id, phase, start_date, end_date }], end_date null = en curso. Orden: start_date desc
export let phases = [];
export function setPhases(v){ phases = v; }

// toggles del gráfico de Evolución: mostrar bandas de fase / línea de meta de peso
export let showPhases = true;
export function setShowPhases(v){ showPhases = v; }
export let showGoalLine = true;
export function setShowGoalLine(v){ showGoalLine = v; }
