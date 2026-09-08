const state={levels:14,playing:false,timer:null,speed:5,eventId:1,lastPrice:null,mid:null,bestBid:null,bestAsk:null,bids:[],asks:[],trades:[],prices:[],eventType:'READY',simSeconds:0,buyVolume:0,sellVolume:0};
const $=id=>document.getElementById(id);
function pad(n,d=2){return String(n).padStart(d,'0')}
function formatTime(sec){const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60,si=Math.floor(s),ms=Math.floor((s-si)*1000);return`${pad(h)}:${pad(m)}:${pad(si)}.${pad(ms,3)}`}
function fmt(n,d=2){return Number(n).toFixed(d)}

async function loadOrderBook(){
    try{
        const response=await fetch("OrderBook.json");
        if(!response.ok)throw new Error("Could not load OrderBook.json");
        const data=await response.json();

        state.bids=data.map(row=>({
            price:Number(row.bid_price),
            volume:Number(row.bid.size),
            orders:Number(row.bid.orders)
        })).filter(x=>Number.isFinite(x.price)&&x.volume>0);

        state.asks=data.map(row=>({
            price:Number(row.ask_price),
            volume:Number(row.ask.size),
            orders:Number(row.ask.orders)
        })).filter(x=>Number.isFinite(x.price)&&x.volume>0);

        state.bids.sort((a,b)=>b.price-a.price);
        state.asks.sort((a,b)=>a.price-b.price);

        state.bestBid=state.bids.length?state.bids[0].price:null;
        state.bestAsk=state.asks.length?state.asks[0].price:null;
        state.mid=state.bestBid!==null&&state.bestAsk!==null?(state.bestBid+state.bestAsk)/2:null;
        state.lastPrice=state.mid;

        if(state.mid!==null){
            state.prices.push(state.mid);
            state.prices=state.prices.slice(-110);
        }

        state.eventType='READY';
        renderState();

        console.log("Order book loaded from C++ JSON");
    }catch(error){
        console.error("Failed to load OrderBook.json:",error);
    }
}

function renderBook(){
    const bids=state.bids.slice(0,state.levels);
    const asks=state.asks.slice(0,state.levels);
    const maxVol=Math.max(...bids.map(x=>x.volume),...asks.map(x=>x.volume),1);

    $('bidBook').innerHTML='';
    $('bidPriceBook').innerHTML='';
    $('askPriceBook').innerHTML='';
    $('askBook').innerHTML='';

    for(let i=0;i<Math.max(bids.length,asks.length);i++){
        if(i<bids.length){
            const bid=bids[i];

            const bidRow=document.createElement('div');
            bidRow.className='book-row';

            const bidBar=document.createElement('div');
            bidBar.className='bar';
            bidBar.style.width=`${Math.max(8,bid.volume/maxVol*100)}%`;

            const bidVolume=document.createElement('span');
            bidVolume.className='volume';
            bidVolume.textContent=bid.volume.toLocaleString();

            const bidCount=document.createElement('span');
            bidCount.className='count';
            bidCount.textContent=bid.orders;

            bidRow.append(bidVolume,bidCount,bidBar);
            $('bidBook').appendChild(bidRow);

            const bidPriceRow=document.createElement('div');
            bidPriceRow.className='price-row'+(i===0?' inside':'');
            bidPriceRow.textContent=fmt(bid.price);
            $('bidPriceBook').appendChild(bidPriceRow);
        }

        if(i<asks.length){
            const ask=asks[i];

            const askRow=document.createElement('div');
            askRow.className='book-row';

            const askBar=document.createElement('div');
            askBar.className='bar';
            askBar.style.width=`${Math.max(8,ask.volume/maxVol*100)}%`;

            const askCount=document.createElement('span');
            askCount.className='count';
            askCount.textContent=ask.orders;

            const askVolume=document.createElement('span');
            askVolume.className='volume';
            askVolume.textContent=ask.volume.toLocaleString();

            askRow.append(askCount,askVolume,askBar);
            $('askBook').appendChild(askRow);

            const askPriceRow=document.createElement('div');
            askPriceRow.className='price-row'+(i===0?' inside':'');
            askPriceRow.textContent=fmt(ask.price);
            $('askPriceBook').appendChild(askPriceRow);
        }
    }

    const bid5=bids.slice(0,5).reduce((a,x)=>a+x.volume,0);
    const ask5=asks.slice(0,5).reduce((a,x)=>a+x.volume,0);
    const total=bid5+ask5;
    const imbalance=total?(bid5-ask5)/total*100:0;
    const spread=state.bestBid!==null&&state.bestAsk!==null?state.bestAsk-state.bestBid:0;
    const vwap=total?(state.bestBid*bid5+state.bestAsk*ask5)/total:0;

    $('imbalance').textContent=`${imbalance>=0?'+':''}${imbalance.toFixed(1)}%`;
    $('imbalance').style.color=imbalance>=0?'var(--green)':'var(--red)';
    $('visibleDepth').textContent=total.toLocaleString();
    $('vwap').textContent=fmt(vwap,4);
    $('bestBid').textContent=state.bestBid!==null?fmt(state.bestBid,4):'--';
    $('bestAsk').textContent=state.bestAsk!==null?fmt(state.bestAsk,4):'--';
    $('midPrice').textContent=state.mid!==null?fmt(state.mid,4):'--';
    $('spread').textContent=state.bestBid!==null?fmt(spread,4):'--';
    $('lastTrade').textContent=state.lastPrice!==null?fmt(state.lastPrice,4):'--';
    $('bookMid').textContent=state.mid!==null?fmt(state.mid,4):'--';
    $('bidDepth').textContent=bid5.toLocaleString();
    $('askDepth').textContent=ask5.toLocaleString();
}

function renderTape(){
    $('tapeBody').innerHTML=state.trades.map(t=>`<div class="tape-row"><span>${t.time}</span><span>${fmt(t.price)}</span><span>${t.size.toLocaleString()}</span><span class="tape-side ${t.side==='BUY'?'trade-up':'trade-down'}">${t.side}</span></div>`).join('');
    const t=state.trades[0];
    $('lastTradeSize').textContent=t?`${t.size} @ ${t.time}`:'--';
}

function renderChart(){
    const canvas=$('priceChart');
    const rect=canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(1,rect.width*dpr);
    canvas.height=Math.max(1,rect.height*dpr);
    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const w=rect.width;
    const h=rect.height;
    const p=state.prices.length?state.prices:[state.mid??0];
    const min=Math.min(...p)-.008;
    const max=Math.max(...p)+.008;
    const x=i=>8+(w-24)*i/(p.length-1||1);
    const y=v=>8+(h-18)*(1-(v-min)/(max-min||1));

    ctx.clearRect(0,0,w,h);
    ctx.beginPath();
    p.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));
    ctx.lineWidth=1.5;
    ctx.strokeStyle='#d6dee9';
    ctx.stroke();

    const last=p[p.length-1];
    ctx.beginPath();
    ctx.arc(x(p.length-1),y(last),3.2,0,Math.PI*2);
    ctx.fillStyle='#fff';
    ctx.fill();

    $('yLabels').innerHTML=[max,(max+min)/2,min].map(v=>`<span>${v.toFixed(4)}</span>`).join('');
    $('chartLow').textContent=`LOW ${min.toFixed(4)}`;
    $('chartHigh').textContent=`HIGH ${max.toFixed(4)}`;

    const ch=p.length>1?(last-p[0])/p[0]*100:0;
    $('chartChange').textContent=`${ch>=0?'+':''}${ch.toFixed(3)}%`;
    $('chartChange').style.color=ch>=0?'var(--green)':'var(--red)';
}

function setOrderFormSide(side){
    $('buyOrderBtn').classList.toggle('active',side==='bid');
    $('sellOrderBtn').classList.toggle('active',side==='ask');

    const submit=$('submitOrderBtn');
    submit.classList.toggle('buy',side==='bid');
    submit.classList.toggle('sell',side==='ask');
    submit.textContent=side==='bid'?'PLACE BUY ORDER':'PLACE SELL ORDER';
}

function addUserOrder(){
    const side=$('buyOrderBtn').classList.contains('active')?'bid':'ask';
    const price=Number($('orderPrice').value);
    const size=Number($('orderSize').value);
    const message=$('orderFormMessage');

    if(!Number.isFinite(price)||price<=0){
        message.textContent='Enter a valid price.';
        message.className='order-form-message error';
        return;
    }

    if(!Number.isInteger(size)||size<=0){
        message.textContent='Enter a valid integer size.';
        message.className='order-form-message error';
        return;
    }

    const roundedPrice=+price.toFixed(2);

    if(side==='bid'&&state.bestAsk!==null&&roundedPrice>=state.bestAsk){
        message.textContent=`BUY price must be below best ask ${fmt(state.bestAsk,4)}.`;
        message.className='order-form-message error';
        return;
    }

    if(side==='ask'&&state.bestBid!==null&&roundedPrice<=state.bestBid){
        message.textContent=`SELL price must be above best bid ${fmt(state.bestBid,4)}.`;
        message.className='order-form-message error';
        return;
    }

    const book=side==='bid'?state.bids:state.asks;
    const level=book.find(x=>x.price===roundedPrice);

    if(level){
        level.volume+=size;
        level.orders+=1;
    }else{
        book.push({price:roundedPrice,volume:size,orders:1});
    }

    if(side==='bid')book.sort((a,b)=>b.price-a.price);
    else book.sort((a,b)=>a.price-b.price);

    state.bestBid=state.bids.length?state.bids[0].price:null;
    state.bestAsk=state.asks.length?state.asks[0].price:null;
    state.mid=state.bestBid!==null&&state.bestAsk!==null?(state.bestBid+state.bestAsk)/2:null;
    state.lastPrice=state.lastPrice;
    state.eventId++;
    state.eventType='USER_LIMIT_ADD';

    if(state.mid!==null){
        state.prices.push(state.mid);
        state.prices=state.prices.slice(-110);
    }

    renderState();

    message.textContent=`${side==='bid'?'BUY':'SELL'} order added: ${size.toLocaleString()} @ ${roundedPrice.toFixed(2)}`;
    message.className='order-form-message success';
    $('orderPrice').value='';
    $('orderSize').value='';
}

function renderState(){
    $('eventId').textContent=pad(state.eventId,6);
    $('simTime').textContent=formatTime(state.simSeconds);
    $('footerTime').textContent=formatTime(state.simSeconds);
    renderBook();
    renderTape();
    renderChart();
}

async function nextEvent(){
    await loadOrderBook();
    state.eventId++;
    state.simSeconds+=.001;
    renderState();
}

function stop(){
    if(state.timer){
        clearInterval(state.timer);
        state.timer=null;
    }
    state.playing=false;
    $('playButton').textContent='▶ PLAY';
}

function start(){
    stop();
    state.playing=true;
    $('playButton').textContent='❚❚ PAUSE';
    const delay=Math.max(35,700/state.speed);
    state.timer=setInterval(nextEvent,delay);
}

async function reset(){
    stop();
    state.eventId=1;
    state.simSeconds=0;
    state.prices=[];
    await loadOrderBook();
    state.eventType='RESET';
    renderState();
}

$('nextEvent').addEventListener('click',nextEvent);
$('previousEvent').addEventListener('click',()=>{});
$('playButton').addEventListener('click',()=>state.playing?stop():start());
$('resetButton').addEventListener('click',reset);

$('speedSlider').addEventListener('input',e=>{
    state.speed=Number(e.target.value);
    $('speedValue').textContent=`${state.speed.toFixed(2).replace(/0$/,'')}x`;
    if(state.playing)start();
});

$('addOrderBtn').addEventListener('click',()=>{
    $('orderForm').classList.toggle('hidden');
    $('orderFormMessage').textContent='';
});

$('closeOrderForm').addEventListener('click',()=>{
    $('orderForm').classList.add('hidden');
});

$('buyOrderBtn').addEventListener('click',()=>setOrderFormSide('bid'));
$('sellOrderBtn').addEventListener('click',()=>setOrderFormSide('ask'));
$('submitOrderBtn').addEventListener('click',addUserOrder);
window.addEventListener('resize',renderChart);

loadOrderBook();