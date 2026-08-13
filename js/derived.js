import { entries } from './state.js';
import { toISO, fromISO, mondayOf } from './utils.js';

export function sortedDates(){
  return Object.keys(entries).sort();
}
export function lastEntryDate(){
  const d = sortedDates();
  return d.length ? d[d.length-1] : null;
}

export function computeCurrent(){
  const d = lastEntryDate();
  if(!d) return null;
  return { date: d, weight: entries[d].weight };
}

export function computeWeeklyAverage(){
  const dates = sortedDates();
  if(dates.length === 0) return null;
  const last7 = dates.slice(-7);
  const avg = last7.reduce((s,d)=>s+entries[d].weight,0)/last7.length;
  return { avg, n: last7.length };
}

export function computeTrend(){
  const dates = sortedDates();
  if(dates.length < 2) return null;
  const last7 = dates.slice(-7);
  const rest = dates.slice(0, Math.max(0, dates.length-7));
  const prev7 = rest.slice(-7);
  if(prev7.length === 0) return null;
  const avg = arr => arr.reduce((s,d)=>s+entries[d].weight,0)/arr.length;
  const a1 = avg(last7), a0 = avg(prev7);
  const delta = a1 - a0;
  const pct = (delta/a0)*100;
  return { delta, pct, n1:last7.length, n0:prev7.length };
}

export function computeStreak(){
  const dates = sortedDates();
  if(dates.length===0) return {count:0, lastDate:null};
  let last = fromISO(dates[dates.length-1]);
  let count = 0;
  let cursor = new Date(last);
  const set = new Set(dates);
  while(set.has(toISO(cursor))){
    count++;
    cursor.setDate(cursor.getDate()-1);
  }
  return { count, lastDate: dates[dates.length-1] };
}

export function computeMinMax(){
  const dates = sortedDates();
  if(dates.length===0) return null;
  let min = {date:dates[0], weight:entries[dates[0]].weight};
  let max = {date:dates[0], weight:entries[dates[0]].weight};
  for(const d of dates){
    const w = entries[d].weight;
    if(w < min.weight) min = {date:d, weight:w};
    if(w > max.weight) max = {date:d, weight:w};
  }
  return {min, max};
}

export function weeklyAverages(sinceISO){
  const dates = sortedDates().filter(d => !sinceISO || d >= sinceISO);
  const buckets = {}; // mondayISO -> [weights]
  for(const d of dates){
    const mon = toISO(mondayOf(fromISO(d)));
    (buckets[mon] = buckets[mon]||[]).push(entries[d].weight);
  }
  return Object.keys(buckets).sort().map(mon=>{
    const arr = buckets[mon];
    return { date: mon, avg: arr.reduce((a,b)=>a+b,0)/arr.length };
  });
}

export function dailyWithMovingAvg(){
  const dates = sortedDates();
  const out = [];
  for(let i=0;i<dates.length;i++){
    const windowArr = dates.slice(Math.max(0,i-6), i+1).map(d=>entries[d].weight);
    const ma = windowArr.reduce((a,b)=>a+b,0)/windowArr.length;
    out.push({ date: dates[i], weight: entries[dates[i]].weight, ma });
  }
  return out;
}

export function linreg(points){
  // points: [{x,y}]
  const n = points.length;
  if(n<2) return null;
  let sx=0,sy=0,sxy=0,sxx=0;
  points.forEach(p=>{ sx+=p.x; sy+=p.y; sxy+=p.x*p.y; sxx+=p.x*p.x; });
  const denom = (n*sxx - sx*sx);
  if(denom===0) return null;
  const slope = (n*sxy - sx*sy)/denom;
  const intercept = (sy - slope*sx)/n;
  return { slope, intercept };
}

function monthEntryDates(year, month){
  return sortedDates().filter(d=>{
    const dt = fromISO(d);
    return dt.getFullYear()===year && dt.getMonth()===month;
  });
}

export function computeMonthlySummary(viewMonth){
  const year = viewMonth.getFullYear(), month = viewMonth.getMonth();
  const dates = monthEntryDates(year, month);
  if(dates.length===0) return null;

  const weights = dates.map(d=>entries[d].weight);
  const avg = weights.reduce((a,b)=>a+b,0)/weights.length;

  let min = { date: dates[0], weight: entries[dates[0]].weight };
  let max = { date: dates[0], weight: entries[dates[0]].weight };
  dates.forEach(d=>{
    const w = entries[d].weight;
    if(w < min.weight) min = { date: d, weight: w };
    if(w > max.weight) max = { date: d, weight: w };
  });

  const netChange = entries[dates[dates.length-1]].weight - entries[dates[0]].weight;

  let prevMonth = month-1, prevYear = year;
  if(prevMonth < 0){ prevMonth = 11; prevYear--; }
  const prevDates = monthEntryDates(prevYear, prevMonth);
  let prevAvg = null;
  if(prevDates.length > 0){
    const prevWeights = prevDates.map(d=>entries[d].weight);
    prevAvg = prevWeights.reduce((a,b)=>a+b,0)/prevWeights.length;
  }

  const daysInMonth = new Date(year, month+1, 0).getDate();

  return {
    count: dates.length,
    daysInMonth,
    avg, min, max, netChange,
    prevAvg,
    avgDelta: prevAvg!=null ? avg-prevAvg : null,
  };
}
