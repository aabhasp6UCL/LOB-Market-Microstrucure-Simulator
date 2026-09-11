const state={levels:14,playing:false,timer:null,speed:5,eventId:9000,lastPrice:null,mid:null,bestBid:null,bestAsk:null,bids:[],asks:[],prices:[],eventType:"READY",simSeconds:0,buyVolume:0,sellVolume:0};
let simulation=[];let currentEvent=0;
let previousBidLevels=new Map();let previousAskLevels=new Map();let hasRenderedBookOnce=false;
const $=id=>document.getElementById(id);
function pad(n,d=2){return String(n).padStart(d,"0");}
function formatTime(sec){const h=Math.floor(sec/3600);const m=Math.floor((sec%3600)/60);const s=sec%60;const si=Math.floor(s);const ms=Math.floor((s-si)*1000);return `${pad(h)}:${pad(m)}:${pad(si)}.${pad(ms,3)}`;}
function fmt(n,d=2){return Number(n).toFixed(d);}
async function loadSimulation(){
    try{
        const response=await fetch("Simulation.json?t="+Date.now());
        if(!response.ok)throw new Error("Could not load Simulation.json");
        simulation=await response.json();
        if(!Array.isArray(simulation))throw new Error("Simulation.json must contain an array");
        if(simulation.length===0)throw new Error("Simulation.json is empty");
        currentEvent=0;
        state.prices=[];
        const firstEvent=simulation[0];
        if(firstEvent.orderBook)updateOrderBook(firstEvent.orderBook);else updateOrderBook(firstEvent);
        state.eventId=firstEvent.eventId??9000;
        state.eventType="READY";
        if(firstEvent.timestamp!==undefined)state.simSeconds=Number(firstEvent.timestamp);
        renderState();
        console.log(`Loaded ${simulation.length} historical events`);
    }catch(error){console.error("Simulation loading error:",error);}
}
function updateOrderBook(data){
    if(!Array.isArray(data))return;
    state.bids=[];state.asks=[];
    data.forEach(row=>{
        if(row.bid_price!==undefined&&row.bid&&Number(row.bid.size)>0){
            state.bids.push({price:Number(row.bid_price),volume:Number(row.bid.size),orders:Number(row.bid.orders)});
        }
        if(row.ask_price!==undefined&&row.ask&&Number(row.ask.size)>0){
            state.asks.push({price:Number(row.ask_price),volume:Number(row.ask.size),orders:Number(row.ask.orders)});
        }
    });
    state.bids.sort((a,b)=>b.price-a.price);
    state.asks.sort((a,b)=>a.price-b.price);
    state.bestBid=state.bids.length?state.bids[0].price:null;
    state.bestAsk=state.asks.length?state.asks[0].price:null;
    if(state.bestBid!==null&&state.bestAsk!==null){
        state.mid=(state.bestBid+state.bestAsk)/2;
        pushPrice(state.mid);
    }
}
const MAX_CHART_POINTS=5000;
function pushPrice(mid){
    state.prices.push(mid);
    if(state.prices.length>MAX_CHART_POINTS)state.prices.shift();
}
function processNextHistoricalEvent(){
    if(currentEvent>=simulation.length){stopSimulation();return false;}
    const event=simulation[currentEvent];
    if(event.orderBook)updateOrderBook(event.orderBook);else updateOrderBook(event);
    if(event.eventId!==undefined)state.eventId=event.eventId;else state.eventId++;
    if(event.timestamp!==undefined)state.simSeconds=Number(event.timestamp);else state.simSeconds+=.001;
    state.eventType=event.type||"HISTORICAL";
    currentEvent++;
    renderState();
    return true;
}
function renderBook(){
    const bidBook=$("bidBook"),bidPriceBook=$("bidPriceBook"),marketColumn=$("marketColumn"),askPriceBook=$("askPriceBook"),askBook=$("askBook");
    if(!bidBook||!bidPriceBook||!marketColumn||!askPriceBook||!askBook)return;
    bidBook.innerHTML="";bidPriceBook.innerHTML="";askPriceBook.innerHTML="";askBook.innerHTML="";
    const bids=state.bids.slice(0,state.levels),asks=state.asks.slice(0,state.levels);
    const maxVolume=Math.max(...bids.map(x=>x.volume),...asks.map(x=>x.volume),1);
    const flashClass=(prevLevels,price,volume)=>{
        if(!hasRenderedBookOnce)return "";
        const prevVolume=prevLevels.get(price);
        if(prevVolume===undefined)return " flash-add";
        if(volume>prevVolume)return " flash-add";
        if(volume<prevVolume)return " flash-cancel";
        return "";
    };
    for(let i=0;i<state.levels;i++){
        const bid=bids[i],ask=asks[i];
        const bidFlash=bid?flashClass(previousBidLevels,bid.price,bid.volume):"";
        const askFlash=ask?flashClass(previousAskLevels,ask.price,ask.volume):"";
        const bidRow=document.createElement("div");
        bidRow.className="book-row"+bidFlash;
        if(bid){
            const width=bid.volume/maxVolume*100;
            bidRow.innerHTML=`<div class="bar" style="width:${width}%"></div><span class="volume">${bid.volume}</span><span class="count">${bid.orders}</span>`;
        }
        bidBook.appendChild(bidRow);
        const bidPriceRow=document.createElement("div");
        bidPriceRow.className="price-row"+(bid&&i===0?" best-bid":"")+bidFlash;
        bidPriceRow.textContent=bid?fmt(bid.price):"";
        bidPriceBook.appendChild(bidPriceRow);
        const askRow=document.createElement("div");
        askRow.className="book-row"+askFlash;
        if(ask){
            const width=ask.volume/maxVolume*100;
            askRow.innerHTML=`<span class="count">${ask.orders}</span><span class="volume">${ask.volume}</span><div class="bar" style="width:${width}%"></div>`;
        }
        askBook.appendChild(askRow);
        const askPriceRow=document.createElement("div");
        askPriceRow.className="price-row"+(ask&&i===0?" best-ask":"")+askFlash;
        askPriceRow.textContent=ask?fmt(ask.price):"";
        askPriceBook.appendChild(askPriceRow);
    }
    previousBidLevels=new Map(state.bids.map(x=>[x.price,x.volume]));
    previousAskLevels=new Map(state.asks.map(x=>[x.price,x.volume]));
    hasRenderedBookOnce=true;
    const bid5=bids.slice(0,5).reduce((sum,x)=>sum+x.volume,0);
    const ask5=asks.slice(0,5).reduce((sum,x)=>sum+x.volume,0);
    const total=bid5+ask5;
    const imbalance=total>0?(bid5-ask5)/total*100:0;
    const spread=state.bestBid!==null&&state.bestAsk!==null?state.bestAsk-state.bestBid:null;
    const vwap=total>0?(state.bestBid*bid5+state.bestAsk*ask5)/total:null;
    marketColumn.innerHTML=`<div class="market-mid"><span class="market-mid-label">MID</span><span class="market-mid-price">${state.mid!==null?fmt(state.mid):"--"}</span></div><div class="market-spread"><span class="market-spread-label">SPREAD</span><span class="market-spread-value">${spread!==null?fmt(spread):"--"}</span></div>`;
    if($("imbalance")){
        $("imbalance").textContent=`${fmt(imbalance,1)}%`;
        $("imbalance").style.color=imbalance>0?"var(--green-bright)":imbalance<0?"var(--red-bright)":"var(--text)";
    }
    if($("visibleDepth"))$("visibleDepth").textContent=`${bid5+ask5}`;
    if($("vwap"))$("vwap").textContent=vwap!==null?fmt(vwap):"--";
    if($("bestBid"))$("bestBid").textContent=state.bestBid!==null?fmt(state.bestBid):"--";
    if($("bestAsk"))$("bestAsk").textContent=state.bestAsk!==null?fmt(state.bestAsk):"--";
    if($("midPrice"))$("midPrice").textContent=state.mid!==null?fmt(state.mid):"--";
    if($("spread"))$("spread").textContent=spread!==null?fmt(spread):"--";
    if($("bookMid"))$("bookMid").textContent=state.mid!==null?fmt(state.mid):"--";
    if($("bidDepth"))$("bidDepth").textContent=bid5;
    if($("askDepth"))$("askDepth").textContent=ask5;
}
function renderChart(){
    const canvas=$("priceChart");
    if(!canvas)return;
    const cssWidth=canvas.clientWidth,cssHeight=canvas.clientHeight;
    if(cssWidth===0||cssHeight===0)return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=cssWidth*dpr;
    canvas.height=cssHeight*dpr;
    const ctx=canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssWidth,cssHeight);
    const prices=state.prices;
    if(prices.length===0){
        if($("chartLow"))$("chartLow").textContent="LOW --";
        if($("chartHigh"))$("chartHigh").textContent="HIGH --";
        if($("chartChange"))$("chartChange").textContent="--";
        if($("yLabels"))$("yLabels").innerHTML="";
        return;
    }
    const min=Math.min(...prices),max=Math.max(...prices);
    const range=(max-min)||Math.max(min*0.0005,0.01);
    const padTop=10,padBottom=10;
    const plotHeight=cssHeight-padTop-padBottom;
    const pointX=index=>prices.length>1?index/(prices.length-1)*cssWidth:cssWidth/2;
    const pointY=price=>padTop+plotHeight-(price-min)/range*plotHeight;
    const rising=prices[prices.length-1]>=prices[0];
    const lineColor=rising?"#38d996":"#ff5f6d";
    if(prices.length>1){
        const gradient=ctx.createLinearGradient(0,0,0,cssHeight);
        gradient.addColorStop(0,rising?"rgba(56,217,150,.28)":"rgba(255,95,109,.24)");
        gradient.addColorStop(1,rising?"rgba(56,217,150,0)":"rgba(255,95,109,0)");
        ctx.beginPath();
        prices.forEach((price,index)=>{
            const x=pointX(index),y=pointY(price);
            if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        });
        ctx.lineTo(cssWidth,cssHeight);
        ctx.lineTo(0,cssHeight);
        ctx.closePath();
        ctx.fillStyle=gradient;
        ctx.fill();
        ctx.beginPath();
        prices.forEach((price,index)=>{
            const x=pointX(index),y=pointY(price);
            if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        });
        ctx.strokeStyle=lineColor;
        ctx.lineWidth=1.75;
        ctx.lineJoin="round";
        ctx.lineCap="round";
        ctx.stroke();
    }
    const lastX=pointX(prices.length-1),lastY=pointY(prices[prices.length-1]);
    ctx.beginPath();
    ctx.arc(lastX,lastY,3.2,0,Math.PI*2);
    ctx.fillStyle=lineColor;
    ctx.fill();
    if($("chartLow"))$("chartLow").textContent="LOW "+fmt(min);
    if($("chartHigh"))$("chartHigh").textContent="HIGH "+fmt(max);
    if($("chartChange")){
        const change=prices.length>1?prices[prices.length-1]-prices[0]:0;
        const sign=change>0?"+":"";
        $("chartChange").textContent=sign+fmt(change);
        $("chartChange").style.color=change>0?"var(--green-bright)":change<0?"var(--red-bright)":"var(--muted)";
    }
    if($("yLabels")){
        const mid=(max+min)/2;
        $("yLabels").innerHTML=`<span>${fmt(max)}</span><span>${fmt(mid)}</span><span>${fmt(min)}</span>`;
    }
}
function renderState(){
    if($("eventId"))$("eventId").textContent=state.eventId;
    if($("bookEventId"))$("bookEventId").textContent=state.eventId;
    if($("simTime"))$("simTime").textContent=formatTime(state.simSeconds);
    if($("footerTime"))$("footerTime").textContent=formatTime(state.simSeconds);
    renderBook();
    renderChart();
}
function setOrderFormSide(side){
    const buyButton=$("buyOrderBtn"),sellButton=$("sellOrderBtn"),submitButton=$("submitOrderBtn");
    if(!buyButton||!sellButton||!submitButton)return;
    if(side==="BUY"){
        buyButton.classList.add("active");sellButton.classList.remove("active");
        submitButton.textContent="Place Buy Order";submitButton.classList.add("buy");submitButton.classList.remove("sell");
    }else{
        sellButton.classList.add("active");buyButton.classList.remove("active");
        submitButton.textContent="Place Sell Order";submitButton.classList.add("sell");submitButton.classList.remove("buy");
    }
}
function addUserOrder(){
    const priceInput=$("orderPrice"),sizeInput=$("orderSize");
    if(!priceInput||!sizeInput)return;
    const price=Number(priceInput.value),size=Number(sizeInput.value);
    if(!Number.isFinite(price)||price<=0)return;
    if(!Number.isInteger(size)||size<=0)return;
    const side=$("buyOrderBtn")&&$("buyOrderBtn").classList.contains("active")?"BUY":"SELL";
    if(side==="BUY"&&state.bestAsk!==null&&price>=state.bestAsk){alert("Buy price would cross the best ask.");return;}
    if(side==="SELL"&&state.bestBid!==null&&price<=state.bestBid){alert("Sell price would cross the best bid.");return;}
    if(side==="BUY"){
        const existing=state.bids.find(x=>x.price===price);
        if(existing){existing.volume+=size;existing.orders++;}else state.bids.push({price,volume:size,orders:1});
        state.bids.sort((a,b)=>b.price-a.price);
    }else{
        const existing=state.asks.find(x=>x.price===price);
        if(existing){existing.volume+=size;existing.orders++;}else state.asks.push({price,volume:size,orders:1});
        state.asks.sort((a,b)=>a.price-b.price);
    }
    state.eventId++;state.eventType="USER_LIMIT_ADD";
    if(state.bestBid!==null&&state.bestAsk!==null){
        state.mid=(state.bestBid+state.bestAsk)/2;
        pushPrice(state.mid);
    }
    renderState();
    if($("orderMessage"))$("orderMessage").textContent=`${side} order added successfully.`;
}
function startSimulation(){
    if(state.playing)return;
    state.playing=true;
    if($("playButton"))$("playButton").textContent="Pause";
    scheduleNextEvent();
}
function scheduleNextEvent(){
    if(!state.playing)return;
    if(currentEvent>=simulation.length){stopSimulation();return;}
    const delay=Math.max(200,2200/state.speed);
    state.timer=setTimeout(()=>{
        processNextHistoricalEvent();
        scheduleNextEvent();
    },delay);
}
function stopSimulation(){
    state.playing=false;
    if(state.timer){clearTimeout(state.timer);state.timer=null;}
    if($("playButton"))$("playButton").textContent="Play";
}
function resetSimulation(){
    stopSimulation();
    currentEvent=0;
    state.eventId=9000;
    state.eventType="READY";
    state.simSeconds=0;
    state.lastPrice=null;
    state.mid=null;
    state.bestBid=null;
    state.bestAsk=null;
    state.bids=[];
    state.asks=[];
    state.prices=[];
    state.buyVolume=0;
    state.sellVolume=0;
    previousBidLevels=new Map();
    previousAskLevels=new Map();
    hasRenderedBookOnce=false;
    loadSimulation();
}
function previousEvent(){
    if(currentEvent<=1)return;
    currentEvent-=2;
    processNextHistoricalEvent();
}
if($("nextEvent"))$("nextEvent").addEventListener("click",processNextHistoricalEvent);
if($("previousEvent"))$("previousEvent").addEventListener("click",previousEvent);
if($("playButton"))$("playButton").addEventListener("click",()=>{if(state.playing)stopSimulation();else startSimulation();});
if($("resetButton"))$("resetButton").addEventListener("click",resetSimulation);
if($("speedSlider"))$("speedSlider").addEventListener("input",event=>{state.speed=Number(event.target.value);if($("speedValue"))$("speedValue").textContent=state.speed.toFixed(2)+"x";});
if($("addOrderBtn"))$("addOrderBtn").addEventListener("click",()=>{const form=$("orderForm");if(form)form.style.display="block";});
if($("closeOrderForm"))$("closeOrderForm").addEventListener("click",()=>{const form=$("orderForm");if(form)form.style.display="none";});
if($("buyOrderBtn"))$("buyOrderBtn").addEventListener("click",()=>setOrderFormSide("BUY"));
if($("sellOrderBtn"))$("sellOrderBtn").addEventListener("click",()=>setOrderFormSide("SELL"));
if($("submitOrderBtn"))$("submitOrderBtn").addEventListener("click",addUserOrder);
window.addEventListener("resize",renderChart);
loadSimulation();