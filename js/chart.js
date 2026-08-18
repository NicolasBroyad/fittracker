import { activeTab, chartRange, phases, currentGoal, showPhases, showGoalLine } from './state.js';
import { fromISO, fmtShort, rangeCutoffISO, todayISO, PHASE_LABELS } from './utils.js';
import { weeklyAverages, dailyWithMovingAvg, linreg } from './derived.js';

function svgEl(tag, attrs){
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function niceTicks(min, max, count){
  const range = max-min || 1;
  const step = Math.ceil((range/count)*10)/10 || 0.5;
  const ticks = [];
  let start = Math.floor(min/step)*step;
  for(let v=start; v<=max+step*0.5; v+=step) ticks.push(Math.round(v*100)/100);
  return ticks;
}

const PHASE_COLORS = { volumen: 'var(--accent)', definicion: 'var(--loss)', mantenimiento: 'var(--brass)' };

// ancho medido de cada contenedor, cacheado por id: una vez medido con un valor VÁLIDO (>0), todos
// los re-renders posteriores (togglear fases/meta, cambiar de tab, cambiar el rango) reusan ese
// mismo valor en vez de volver a medir — así el gráfico nunca "salta" de tamaño. El primer render
// de la pantalla de Peso pasa mientras esa pantalla todavía está oculta (Home es la pantalla por
// defecto), así que clientWidth da 0 en ese momento — un 0 nunca se cachea, se sigue midiendo en
// cada llamada hasta que el contenedor esté realmente visible y dé un valor real, que ahí sí queda
// fijo. invalidateChartWidthCache() se llama solo ante un window.resize real.
const widthCache = {};
export function invalidateChartWidthCache(){
  Object.keys(widthCache).forEach(k => delete widthCache[k]);
}
function measuredWidth(containerId, container, fallback){
  if(widthCache[containerId] != null) return widthCache[containerId];
  const real = container.parentElement.clientWidth;
  if(!real) return fallback; // contenedor todavía oculto: no cachear un valor inválido
  widthCache[containerId] = real;
  return real;
}

// agrupa puntos consecutivos (por índice) que caen dentro de la misma fase, para poder
// dibujar un solo rectángulo de fondo por tramo en vez de uno por punto
function phaseSegments(points){
  if(!showPhases || phases.length === 0) return [];
  const today = todayISO();
  const segs = [];
  let cur = null;
  points.forEach((p, i) => {
    const match = phases.find(ph => p.date >= ph.start_date && p.date <= (ph.end_date || today));
    const key = match ? match.phase : null;
    if(cur && cur.key === key){ cur.end = i; }
    else { if(cur) segs.push(cur); cur = { key, start: i, end: i }; }
  });
  if(cur) segs.push(cur);
  return segs.filter(s => s.key);
}

// dibuja las bandas de fondo de fase + la línea punteada de meta de peso; se llama antes de
// dibujar la data para que ambas queden detrás. Devuelve qué se dibujó, para armar la leyenda.
function drawBackgroundLayers(svg, points, xFor, yFor, padL, padR, padT, padB, width, rowH, targetWeight){
  const drawn = { phaseKeys: new Set(), target: false };
  const segs = phaseSegments(points);
  if(segs.length > 0){
    const halfStep = points.length > 1 ? (xFor(1)-xFor(0))/2 : 14;
    segs.forEach(seg => {
      const x1 = Math.max(padL, xFor(seg.start)-halfStep);
      const x2 = Math.min(width-padR, xFor(seg.end)+halfStep);
      if(x2 <= x1) return;
      svg.appendChild(svgEl('rect', {
        x:x1, y:padT, width:x2-x1, height:rowH-padT-padB,
        fill:PHASE_COLORS[seg.key] || 'var(--ink-faint)', opacity:0.13,
      }));
      drawn.phaseKeys.add(seg.key);
    });
  }
  if(targetWeight != null){
    const y = yFor(targetWeight);
    svg.appendChild(svgEl('line', {x1:padL, x2:width-padR, y1:y, y2:y, stroke:'var(--ink-soft)', 'stroke-width':1.4, 'stroke-dasharray':'6,4'}));
    drawn.target = true;
  }
  return drawn;
}

// "1 ago – 7 ago · 78.40 kg" -- rango de la semana (lunes a domingo) + promedio de esa semana
function weekTooltipLabel(w){
  const start = fromISO(w.date);
  const end = new Date(start); end.setDate(end.getDate()+6);
  return fmtShort(start)+' – '+fmtShort(end)+' · '+w.avg.toFixed(2)+' kg';
}

function phaseLegendHtml(phaseKeys){
  return Array.from(phaseKeys).map(k =>
    `<div class="k"><span class="swatch" style="background:${PHASE_COLORS[k]}; opacity:0.5;"></span>${PHASE_LABELS[k]}</div>`
  ).join('');
}

// tooltip que muestra a qué fecha corresponde un punto al pasar el mouse o tocarlo (mobile).
// se cuelga directo de <body> con position:fixed (no del contenedor del gráfico) para que no lo
// corte el overflow-x:auto de .chart-scroll cuando el punto está pegado al borde del panel; las
// coordenadas que recibe show() son locales al SVG (1:1 en px, ver renderChart) y se convierten
// a coordenadas de pantalla con getBoundingClientRect() del propio SVG.
function setupTooltip(svg, container){
  const tooltipId = (container.id || 'chart') + '-tooltip';
  let tooltip = document.getElementById(tooltipId);
  if(!tooltip){
    tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }
  const show = (localX, localY, text) => {
    const rect = svg.getBoundingClientRect();
    const x = rect.left + localX, y = rect.top + localY;
    tooltip.textContent = text;
    tooltip.style.left = x+'px';
    tooltip.style.top = y+'px';
    tooltip.style.transform = 'translate(-50%,-135%)';
    tooltip.classList.add('visible');
    // si se sale de la pantalla (puntos pegados al borde izq/der), lo corre para adentro
    requestAnimationFrame(()=>{
      const tr = tooltip.getBoundingClientRect();
      let shiftX = 0;
      if(tr.left < 4) shiftX = 4 - tr.left;
      else if(tr.right > window.innerWidth - 4) shiftX = (window.innerWidth - 4) - tr.right;
      if(shiftX !== 0) tooltip.style.transform = `translate(calc(-50% + ${shiftX}px),-135%)`;
    });
  };
  const hide = () => tooltip.classList.remove('visible');
  svg.addEventListener('pointerdown', hide); // tocar/clickear afuera de un punto lo oculta
  return { show, hide };
}

// círculo invisible más grande encima de un punto, para que sea fácil de tocar en mobile sin
// agrandar el punto visible; muestra el tooltip al pasar el mouse o al tocarlo
function addPointHitArea(svg, cx, cy, label, showTip, hideTip){
  const hit = svgEl('circle', {cx, cy, r:10, fill:'transparent'});
  hit.style.cursor = 'pointer';
  hit.style.pointerEvents = 'all';
  hit.addEventListener('pointerenter', ()=>showTip(cx, cy, label));
  hit.addEventListener('pointerleave', hideTip);
  hit.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); showTip(cx, cy, label); });
  svg.appendChild(hit);
}

export function renderChart(containerId, legendId, opts){
  opts = opts || {};
  containerId = containerId || 'chart-container';
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const legend = document.getElementById(legendId || 'chart-legend');
  legend.innerHTML = '';

  const padL=42, padR=16, padT=18, padB=34;
  const rowH = opts.rowH || 260;

  const targetWeight = showGoalLine && currentGoal && currentGoal.target_weight != null ? Number(currentGoal.target_weight) : null;

  if(activeTab === 'weekly'){
    const weeks = weeklyAverages(rangeCutoffISO(chartRange));
    if(weeks.length===0){ container.innerHTML = '<div class="empty-state">No hay datos en el período seleccionado.</div>'; return; }
    const width = measuredWidth(containerId, container, 480);
    const innerW = width-padL-padR;
    const vals = weeks.map(w=>w.avg).concat(targetWeight != null ? [targetWeight] : []);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const yTicks = niceTicks(minV-0.3, maxV+0.3, 5);
    const yMin = yTicks[0], yMax = yTicks[yTicks.length-1];
    const xFor = i => padL + (weeks.length===1 ? innerW/2 : innerW * i/(weeks.length-1));
    const yFor = v => padT + (rowH-padT-padB) * (1 - (v-yMin)/(yMax-yMin));

    const svg = svgEl('svg', {viewBox:`0 0 ${width} ${rowH}`, width:'100%', height:rowH});

    const bgDrawn = drawBackgroundLayers(svg, weeks, xFor, yFor, padL, padR, padT, padB, width, rowH, targetWeight);

    // gridlines + y labels
    yTicks.forEach(t=>{
      const y = yFor(t);
      svg.appendChild(svgEl('line', {x1:padL, x2:width-padR, y1:y, y2:y, stroke:'var(--line)', 'stroke-width':1}));
      const lab = svgEl('text', {x:padL-8, y:y+3, 'text-anchor':'end', 'font-size':10, fill:'var(--ink-faint)', 'font-family':'JetBrains Mono, monospace'});
      lab.textContent = t.toFixed(1);
      svg.appendChild(lab);
    });

    // trend line (linear regression)
    const reg = linreg(weeks.map((w,i)=>({x:i,y:w.avg})));
    if(reg){
      const x1=0, x2=weeks.length-1;
      const y1 = reg.slope*x1+reg.intercept, y2 = reg.slope*x2+reg.intercept;
      svg.appendChild(svgEl('line', {x1:xFor(x1), y1:yFor(y1), x2:xFor(x2), y2:yFor(y2), stroke:'var(--brass)', 'stroke-width':1.6, 'stroke-dasharray':'4,4'}));
    }

    // main line
    const pathD = weeks.map((w,i)=> (i===0?'M':'L')+xFor(i)+','+yFor(w.avg)).join(' ');
    svg.appendChild(svgEl('path', {d:pathD, fill:'none', stroke:'var(--accent)', 'stroke-width':2, 'stroke-linejoin':'round'}));

    // points + value labels
    const { show: showTip, hide: hideTip } = setupTooltip(svg, container);
    weeks.forEach((w,i)=>{
      const cx = xFor(i), cy = yFor(w.avg);
      svg.appendChild(svgEl('circle', {cx, cy, r:3, fill:'var(--accent)'}));
      addPointHitArea(svg, cx, cy, weekTooltipLabel(w), showTip, hideTip);
      const showLabel = weeks.length<=20 || i%2===0 || i===weeks.length-1;
      if(showLabel){
        const lab = svgEl('text', {x:cx, y:cy-8, 'text-anchor':'middle', 'font-size':9, fill:'var(--ink-soft)', 'font-family':'JetBrains Mono, monospace'});
        lab.textContent = w.avg.toFixed(2);
        svg.appendChild(lab);
      }
    });

    // x labels
    const xLabelEvery = Math.ceil(weeks.length/10);
    weeks.forEach((w,i)=>{
      if(i%xLabelEvery!==0 && i!==weeks.length-1) return;
      const lab = svgEl('text', {x:xFor(i), y:rowH-14, 'text-anchor':'middle', 'font-size':9, fill:'var(--ink-faint)', 'font-family':'JetBrains Mono, monospace'});
      lab.textContent = fmtShort(fromISO(w.date));
      svg.appendChild(lab);
    });

    container.appendChild(svg);
    legend.innerHTML = `
      <div class="k"><span class="swatch" style="background:var(--accent)"></span>promedio semanal</div>
      <div class="k"><span class="swatch" style="background:var(--brass); border-top:2px dashed var(--brass); background:none;"></span>tendencia lineal</div>
      ${bgDrawn.target ? '<div class="k"><span class="swatch" style="border-top:2px dashed var(--ink-soft); background:none;"></span>meta de peso</div>' : ''}
      ${phaseLegendHtml(bgDrawn.phaseKeys)}`;
  }

  if(activeTab === 'daily'){
    const daily = dailyWithMovingAvg();
    if(daily.length===0){ container.innerHTML = '<div class="empty-state">Todavía no hay datos suficientes.</div>'; return; }
    const spacing = opts.spacing || 20;
    const width = Math.max(measuredWidth(containerId, container, 480), padL+padR+spacing*(daily.length-1)+20);
    const innerW = width-padL-padR;
    const vals = daily.map(d=>d.weight).concat(targetWeight != null ? [targetWeight] : []);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const yTicks = niceTicks(minV-0.3, maxV+0.3, 5);
    const yMin = yTicks[0], yMax = yTicks[yTicks.length-1];
    const xFor = i => padL + (daily.length===1 ? innerW/2 : innerW * i/(daily.length-1));
    const yFor = v => padT + (rowH-padT-padB) * (1 - (v-yMin)/(yMax-yMin));

    const svg = svgEl('svg', {viewBox:`0 0 ${width} ${rowH}`, width:width, height:rowH});

    const bgDrawn = drawBackgroundLayers(svg, daily, xFor, yFor, padL, padR, padT, padB, width, rowH, targetWeight);

    yTicks.forEach(t=>{
      const y = yFor(t);
      svg.appendChild(svgEl('line', {x1:padL, x2:width-padR, y1:y, y2:y, stroke:'var(--line)', 'stroke-width':1}));
      const lab = svgEl('text', {x:padL-8, y:y+3, 'text-anchor':'end', 'font-size':10, fill:'var(--ink-faint)', 'font-family':'JetBrains Mono, monospace'});
      lab.textContent = t.toFixed(1);
      svg.appendChild(lab);
    });

    // daily thin line + dots (faint)
    const dPath = daily.map((d,i)=> (i===0?'M':'L')+xFor(i)+','+yFor(d.weight)).join(' ');
    svg.appendChild(svgEl('path', {d:dPath, fill:'none', stroke:'var(--line-strong)', 'stroke-width':1.2}));
    daily.forEach((d,i)=>{
      svg.appendChild(svgEl('circle', {cx:xFor(i), cy:yFor(d.weight), r:2, fill:'var(--line-strong)'}));
    });

    // moving average bold line
    const maPath = daily.map((d,i)=> (i===0?'M':'L')+xFor(i)+','+yFor(d.ma)).join(' ');
    svg.appendChild(svgEl('path', {d:maPath, fill:'none', stroke:'var(--brass)', 'stroke-width':2.2, 'stroke-linejoin':'round'}));

    // x labels sparse
    const xLabelEvery = Math.max(1, Math.ceil(daily.length/14));
    daily.forEach((d,i)=>{
      if(i%xLabelEvery!==0 && i!==daily.length-1) return;
      const lab = svgEl('text', {x:xFor(i), y:rowH-14, 'text-anchor':'middle', 'font-size':9, fill:'var(--ink-faint)', 'font-family':'JetBrains Mono, monospace'});
      lab.textContent = fmtShort(fromISO(d.date));
      svg.appendChild(lab);
    });

    container.appendChild(svg);
    legend.innerHTML = `
      <div class="k"><span class="swatch" style="background:var(--line-strong)"></span>peso diario</div>
      <div class="k"><span class="swatch" style="background:var(--brass)"></span>promedio móvil 7d</div>
      ${bgDrawn.target ? '<div class="k"><span class="swatch" style="border-top:2px dashed var(--ink-soft); background:none;"></span>meta de peso</div>' : ''}
      ${phaseLegendHtml(bgDrawn.phaseKeys)}`;
  }
}
