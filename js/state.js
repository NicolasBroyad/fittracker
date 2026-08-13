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

// { target_weight, phase, created_at } | null
export let currentGoal = null;
export function setCurrentGoal(v){ currentGoal = v; }
