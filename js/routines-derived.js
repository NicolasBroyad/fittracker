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

// perfil de un día: sus sets ordenados de "mejor" a "peor" (peso desc, luego reps desc)
function sessionProfile(logs, date){
  return logs
    .filter(l => l.session_date === date && l.weight != null)
    .map(l => ({ weight: Number(l.weight), reps: l.reps || 0 }))
    .sort((a,b) => (b.weight - a.weight) || (b.reps - a.reps));
}

// compara dos perfiles set por set (el mejor primero): weight y reps de cada posición, en orden;
// gana el que tenga un valor mayor en el primer punto donde difieren. positivo = a mejor que b.
function compareProfiles(a, b){
  const len = Math.min(a.length, b.length);
  for(let i=0; i<len; i++){
    if(a[i].weight !== b[i].weight) return a[i].weight - b[i].weight;
    if(a[i].reps !== b[i].reps) return a[i].reps - b[i].reps;
  }
  return a.length - b.length;
}

// mejor marca: el peso máximo levantado alguna vez. Entre los días que lo tocaron, si coinciden en
// peso y reps de esa mejor serie, se compara la siguiente serie de cada día (y así sucesivamente) para
// desempatar; si el empate persiste en todo, gana el día más reciente. Devuelve la sesión completa de ese día.
export function computeBestSession(logs){
  const withWeight = logs.filter(l => l.weight != null);
  if(withWeight.length === 0) return null;
  const maxWeight = Math.max(...withWeight.map(l => Number(l.weight)));
  const candidateDates = new Set(withWeight.filter(l => Number(l.weight) === maxWeight).map(l => l.session_date));

  let bestDate = null, bestProfile = null;
  candidateDates.forEach(date => {
    const profile = sessionProfile(logs, date);
    if(bestDate === null){ bestDate = date; bestProfile = profile; return; }
    const cmp = compareProfiles(profile, bestProfile);
    if(cmp > 0 || (cmp === 0 && date > bestDate)){ bestDate = date; bestProfile = profile; }
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
