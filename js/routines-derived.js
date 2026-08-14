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
