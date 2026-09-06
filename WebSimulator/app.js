// LOB Terminal frontend.
// Replace MockMarketAdapter with your real adapter when your LOB engine is ready.

const state = {
  levels: 10,
  playing: false,
  timer: null,
  speed: 5,
  eventId: 1,
  lastPrice: 100.02,
  mid: 100.025,
  bestBid: 100.02,
  bestAsk: 100.03,
  bids: [],
  asks: [],
  trades: [],
  prices: [],
  flow: [],
  buyVolume: 12840,
  sellVolume: 10971,
  eventType: 'LIMIT_ADD',
  simSeconds: 34201.244,
  depth: 10,
  backend: 'mock'
};

class MockMarketAdapter {
  constructor() { this.reset(); }
  reset() {
    const bidBase = 100.02, askBase = 100.03;
    state.bids = Array.from({length: 20}, (_, i) => ({ price: +(bidBase - i*.01).toFixed(2), volume: Math.floor(130 + Math.random()*650), orders: Math.floor(2+Math.random()*14) }));
    state.asks = Array.from({length: 20}, (_, i) => ({ price: +(askBase + i*.01).toFixed(2), volume: Math.floor(130 + Math.random()*650), orders: Math.floor(2+Math.random()*14) }));
    state.bestBid = state.bids[0].price; state.bestAsk = state.asks[0].price; state.mid = +((state.bestBid+state.bestAsk)/2).toFixed(4); state.lastPrice = state.bestBid;
    state.trades = Array.from({length: 12}, () => this.randomTrade());
    state.prices = Array.from({length: 72}, (_, i) => +(100 + Math.sin(i/7)*.025 + (Math.random()-.5)*.022).toFixed(4));
    state.flow = Array.from({length: 42}, () => ({ buy: Math.random(), sell: Math.random() }));
  }
  randomTrade() {
    const buy = Math.random() > .48;
    const p = buy ? state.bestAsk : state.bestBid;
    return { time: formatTime(state.simSeconds), price: +p.toFixed(2), size: Math.floor(10+Math.random()*220), side: buy?'BUY':'SELL' };
  }
  next() {
    const side = Math.random()>.5?'bid':'ask';
    const book = side==='bid'?state.bids:state.asks;
    const idx = Math.floor(Math.random()*Math.min(7, book.length));
    const actionRoll = Math.random();
    let type, message;
    if (actionRoll < .52) {
      const delta = Math.floor(20+Math.random()*140);
      book[idx].volume += delta;
      book[idx].orders += 1;
      type='LIMIT_ADD';
      message = `${side==='bid'?'BUY':'SELL'} limit added: ${delta} @ ${book[idx].price.toFixed(2)}`;
    } else if (actionRoll < .76 && book[idx].volume>40) {
      const delta = Math.min(book[idx].volume-1, Math.floor(10+Math.random()*100));
      book[idx].volume -= delta;
      type='CANCEL';
      message = `${side==='bid'?'BUY':'SELL'} cancelled: ${delta} @ ${book[idx].price.toFixed(2)}`;
    } else {
      const trade = this.randomTrade();
      state.trades.unshift(trade); state.trades = state.trades.slice(0,14);
      const target = trade.side==='BUY' ? state.asks[0] : state.bids[0];
      target.volume = Math.max(0, target.volume-trade.size);
      if (trade.side==='BUY') state.buyVolume += trade.size; else state.sellVolume += trade.size;
      type='TRADE';
      message = `${trade.side} market trade: ${trade.size} @ ${trade.price.toFixed(2)}`;
    }
    // Small random micro-price movement, kept tick-aligned.
    if (Math.random()<.13) {
      const shift = Math.random()>.5 ? .01 : -.01;
      for (const b of state.bids) b.price = +(b.price+shift).toFixed(2);
      for (const a of state.asks) a.price = +(a.price+shift).toFixed(2);
      state.bestBid = state.bids[0].price; state.bestAsk = state.asks[0].price;
    }
    state.mid = +((state.bestBid+state.bestAsk)/2).toFixed(4);
    state.lastPrice = state.trades[0]?.price ?? state.bestBid;
    state.prices.push(+state.mid.toFixed(4)); state.prices = state.prices.slice(-110);
    state.flow.push({buy:Math.random(),sell:Math.random()}); state.flow = state.flow.slice(-42);
    state.eventType = type;
    return { type, message, event_id: state.eventId };
  }
}

const adapter = new MockMarketAdapter();

const $ = (id) => document.getElementById(id);

function pad(n, d=2) { return String(n).padStart(d,'0'); }
function formatTime(seconds) {
  const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60), s = seconds%60;
  const si = Math.floor(s), ms = Math.floor((s-si)*1000);
  return `${pad(h)}:${pad(m)}:${pad(si)}.${pad(ms,3)}`;
}
function fmt(n, dec=2) { return Number(n).toFixed(dec); }
function renderBook() {
  const bids = state.bids.slice(0,state.depth), asks = state.asks.slice(0,state.depth);
  const maxVol = Math.max(...bids.map(x=>x.volume), ...asks.map(x=>x.volume), 1);
  $('bidBook').innerHTML=''; $('askBook').innerHTML=''; $('priceBook').innerHTML='';
  const rows = Math.max(bids.length, asks.length);
  for(let i=0;i<rows;i++) {
    if (i<bids.length) $('bidBook').appendChild(bookRow(bids[i], maxVol, 'bid'));
    if (i<asks.length) $('askBook').appendChild(bookRow(asks[i], maxVol, 'ask'));
    const price = i<bids.length ? bids[i].price : (i<asks.length?asks[i].price:state.mid);
    const r=document.createElement('div'); r.className='price-row'+(i===0?' inside':''); r.textContent=fmt(price,2); $('priceBook').appendChild(r);
  }
  // Insert midline directly below the inside bid/ask level pair for professional visual convention.
  const midRow=document.createElement('div'); midRow.className='price-row mid'; midRow.innerHTML=`${fmt(state.mid,4)} <span class="mid-price-tag">MID</span>`;
  const priceRows = $('priceBook').children; if(priceRows[1]) $('priceBook').insertBefore(midRow, priceRows[1]); else $('priceBook').appendChild(midRow);
  const bid5=bids.slice(0,5).reduce((a,x)=>a+x.volume,0), ask5=asks.slice(0,5).reduce((a,x)=>a+x.volume,0);
  const total=bid5+ask5; const imb=total?((bid5-ask5)/total*100):0;
  const spread=state.bestAsk-state.bestBid;
  $('imbalance').textContent=`${imb>=0?'+':''}${imb.toFixed(1)}%`; $('imbalance').style.color=imb>=0?'var(--green)':'var(--red)';
  $('visibleDepth').textContent=(bid5+ask5).toLocaleString(); $('vwap').textContent=fmt((state.bestBid*bid5+state.bestAsk*ask5)/(bid5+ask5),4);
  $('bestBid').textContent=fmt(state.bestBid,4); $('bestAsk').textContent=fmt(state.bestAsk,4); $('midPrice').textContent=fmt(state.mid,4); $('spread').textContent=fmt(spread,4); $('lastTrade').textContent=fmt(state.lastPrice,4);
}
function bookRow(x,max,side) {
  const d=document.createElement('div'); d.className='book-row';
  const bar=document.createElement('div'); bar.className='bar'; bar.style.width=`${Math.max(7,x.volume/max*100)}%`;
  const vol=document.createElement('span'); vol.className='volume'; vol.textContent=x.volume.toLocaleString();
  const count=document.createElement('span'); count.className='count'; count.textContent=x.orders;
  if(side==='bid'){ d.appendChild(vol); d.appendChild(count); } else { d.appendChild(count); d.appendChild(vol); }
  d.appendChild(bar); return d;
}
function renderTape(){
  $('tapeBody').innerHTML=state.trades.map(t=>`<div class="tape-row"><span>${t.time}</span><span>${fmt(t.price,2)}</span><span>${t.size.toLocaleString()}</span><span class="tape-side ${t.side==='BUY'?'trade-up':'trade-down'}">${t.side}</span></div>`).join('');
  const t=state.trades[0]; if(t){ $('lastTradeSize').textContent=`${t.size} @ ${t.time}`; }
}
function renderFlow(){
  $('flowBars').innerHTML=state.flow.map((f)=>`<div class="flow-bar"><div class="buy-part flow-buy" style="height:${Math.max(2,f.buy*55)}%"></div><div class="sell-part flow-sell" style="height:${Math.max(2,f.sell*45)}%"></div></div>`).join('');
  $('buyVol').textContent=`BUY ${state.buyVolume.toLocaleString()}`; $('sellVol').textContent=`SELL ${state.sellVolume.toLocaleString()}`;
}
function renderChart(){
  const canvas=$('priceChart'), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1; canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); const w=rect.width,h=rect.height;
  ctx.clearRect(0,0,w,h); const p=state.prices; const min=Math.min(...p)-.008, max=Math.max(...p)+.008;
  const x=i=>8+(w-24)*i/(p.length-1||1), y=v=>8+(h-18)*(1-(v-min)/(max-min));
  ctx.beginPath(); p.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v))); ctx.lineWidth=1.4; ctx.strokeStyle='#d6dee9'; ctx.stroke();
  const last=p[p.length-1]; ctx.beginPath(); ctx.arc(x(p.length-1),y(last),3.2,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
  $('yLabels').innerHTML=[max,(max+min)/2,min].map(v=>`<span>${v.toFixed(4)}</span>`).join(''); $('chartLow').textContent=`LOW ${min.toFixed(4)}`; $('chartHigh').textContent=`HIGH ${max.toFixed(4)}`;
  const open=p[0]; const ch=(last-open)/open*100; $('chartChange').textContent=`${ch>=0?'+':''}${ch.toFixed(3)}%`; $('chartChange').style.color=ch>=0?'var(--green)':'var(--red)';
}
function renderState(result){
  $('eventCount').textContent=pad(state.eventId,6); $('eventId').textContent=`#${pad(state.eventId,6)}`; $('eventType').textContent=state.eventType; $('eventLabel').textContent=result?.type||state.eventType; $('eventMessage').textContent=result?.message||'Waiting for next market event…'; $('simTime').textContent=formatTime(state.simSeconds);
  renderBook(); renderTape(); renderFlow(); renderChart();
  $('contractPreview').textContent=JSON.stringify({event:{event_id:state.eventId,timestamp:formatTime(state.simSeconds),type:state.eventType,side:'BUY',price:state.bestBid,volume:100},order_book:{best_bid:state.bestBid,best_ask:state.bestAsk,bids:[[state.bestBid, state.bids[0]?.volume||0]],asks:[[state.bestAsk,state.asks[0]?.volume||0]]},last_trade:{price:state.lastPrice,size:state.trades[0]?.size||0,side:state.trades[0]?.side||'BUY'}},null,2);
}
function nextEvent(){ state.simSeconds += .027 + Math.random()*.21; const result=adapter.next(); state.eventId++; renderState(result); }
function reset(){ stop(); state.eventId=1; state.simSeconds=34201.244; state.buyVolume=12840; state.sellVolume=10971; adapter.reset(); state.eventType='RESET'; renderState({type:'RESET',message:'Simulation reset to initial state.'}); }
function play(){ if(state.playing)return; state.playing=true; $('playBtn').classList.add('primary'); schedule(); }
function schedule(){ if(!state.playing)return; nextEvent(); state.timer=setTimeout(schedule, Math.max(35, 950/state.speed)); }
function stop(){ state.playing=false; clearTimeout(state.timer); state.timer=null; $('playBtn').classList.remove('primary'); }

$('stepBtn').onclick=nextEvent; $('resetBtn').onclick=reset; $('playBtn').onclick=play; $('pauseBtn').onclick=stop;
$('speedRange').oninput=e=>{state.speed=Number(e.target.value);$('speedValue').textContent=`${state.speed}x`;};
$('themeToggle').onclick=()=>document.body.classList.toggle('light-mode');
$('connectBtn').onclick=()=>{
  state.backend=state.backend==='mock'?'external':'mock';
  $('backendStatus').textContent=state.backend==='external'?'EXTERNAL ADAPTER':'MOCK ENGINE';
  $('backendDot').style.background=state.backend==='external'?'var(--blue)':'var(--green)';
  $('connectBtn').textContent=state.backend==='external'?'DISCONNECT':'CONNECT BACKEND';
  $('eventMessage').textContent=state.backend==='external'?'External adapter selected. Wire app.js to your API/WebSocket.':'Mock engine restored.';
};

document.querySelectorAll('[data-depth]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-depth]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.depth=Number(btn.dataset.depth);renderBook();});
$('copyContract').onclick=()=>navigator.clipboard?.writeText($('contractPreview').textContent);
window.addEventListener('resize',renderChart);
renderState({type:'INIT',message:'Mock LOB engine ready. Press NEXT EVENT or PLAY.'});
