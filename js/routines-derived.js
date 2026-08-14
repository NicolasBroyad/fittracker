// logs: [{ session_date, set_number, weight, reps }] ordenados por fecha desc, set_number asc
export function groupLogsBySession(logs){
  const byDate = new Map();
  logs.forEach(l => {
    if(!byDate.has(l.session_date)) byDate.set(l.session_date, []);
    byDate.get(l.session_date).push(l);
  });
  return Array.from(byDate.entries()).map(([date, sets]) => ({ date, sets }));
}

// sets: [{ weight, reps }] en orden de ejecución -> "85kg x 6, 80kg x 8-7-6"
export function formatSessionSets(sets){
  const groups = [];
  sets.forEach(s => {
    const last = groups[groups.length-1];
    if(last && last.weight === s.weight){ last.reps.push(s.reps); }
    else groups.push({ weight: s.weight, reps: [s.reps] });
  });
  return groups.map(g => (g.weight != null ? Number(g.weight)+'kg' : '—') + ' x ' + g.reps.join('-')).join(', ');
}

// logs: [{ session_date, set_number, weight, reps }] (todo el historial de un ejercicio, cualquier orden)
// -> { date, sets } de la sesión más reciente, o null si no hay registros
export function computeLatestSession(logs){
  if(logs.length === 0) return null;
  let latestDate = null;
  logs.forEach(l => { if(latestDate === null || l.session_date > latestDate) latestDate = l.session_date; });
  const sets = logs.filter(l => l.session_date === latestDate).sort((a,b) => a.set_number - b.set_number);
  return { date: latestDate, sets };
}

// mejor marca: el peso máximo levantado alguna vez; entre los días que lo tocaron, el que tiene
// más repeticiones a ese peso; en empate, el día más reciente. Devuelve la sesión completa de ese día.
export function computeBestSession(logs){
  const withWeight = logs.filter(l => l.weight != null);
  if(withWeight.length === 0) return null;
  const maxWeight = Math.max(...withWeight.map(l => Number(l.weight)));

  const bestRepsByDate = new Map();
  withWeight.forEach(l => {
    if(Number(l.weight) !== maxWeight) return;
    const reps = l.reps || 0;
    const cur = bestRepsByDate.get(l.session_date);
    if(cur === undefined || reps > cur) bestRepsByDate.set(l.session_date, reps);
  });

  let bestDate = null, bestReps = -1;
  bestRepsByDate.forEach((reps, date) => {
    if(reps > bestReps || (reps === bestReps && date > bestDate)){ bestReps = reps; bestDate = date; }
  });

  const sets = logs.filter(l => l.session_date === bestDate).sort((a,b) => a.set_number - b.set_number);
  return { date: bestDate, sets };
}

// agrupa los ejercicios de un día en slots por order_index, ordenados; cada slot trae sus variantes ordenadas
export function groupIntoSlots(exercises){
  const map = new Map();
  exercises.forEach(ex => {
    if(!map.has(ex.order_index)) map.set(ex.order_index, []);
    map.get(ex.order_index).push(ex);
  });
  const slots = Array.from(map.entries()).map(([orderIndex, items]) => ({
    orderIndex, items: items.slice().sort((a,b) => a.variant - b.variant),
  }));
  slots.sort((a,b) => a.orderIndex - b.orderIndex);
  return slots;
}
