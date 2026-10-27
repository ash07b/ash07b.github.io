(function(){
  var root=document.documentElement, btn=document.getElementById('themeBtn');
  function cur(){var t=root.getAttribute('data-theme');if(t)return t;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
  function paintBtn(){btn.textContent=cur()==='dark'?'☀':'☾';btn.setAttribute('aria-label',cur()==='dark'?'Switch to light theme':'Switch to dark theme')}
  try{var s=localStorage.getItem('ash-theme');if(s)root.setAttribute('data-theme',s)}catch(e){}
  paintBtn();
  btn.addEventListener('click',function(){var n=cur()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('ash-theme',n)}catch(e){}paintBtn();draw()});
  document.getElementById('yr').textContent=new Date().getFullYear();

  // Toy GPU scheduler: thread blocks from a queue of kernels fill SM slots.
  var cv=document.getElementById('sm'), ctx=cv.getContext('2d');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KERNELS=[
    {name:'matmul_tiled',color:'--cyan',blocks:180,min:40,max:80},
    {name:'softmax_fwd',color:'--gold',blocks:90,min:8,max:18,sync:true},
    {name:'all_reduce',color:'--dim',blocks:48,min:20,max:34,sync:true},
    {name:'layernorm',color:'--gold',blocks:64,min:10,max:20}
  ];
  var SLOTS_X=4, SLOTS_Y=2, cols, rows, sms=[], kIdx=0, left=0, done=0, rr=0;
  var el={occ:document.getElementById('occ'),fly:document.getElementById('fly'),kn:document.getElementById('kn'),dn:document.getElementById('dn')};
  function layout(){
    var w=cv.getBoundingClientRect().width;
    cols=w<520?8:w<820?10:14; rows=4;
    var n=cols*rows; while(sms.length<n)sms.push(new Array(SLOTS_X*SLOTS_Y).fill(null)); sms.length=n;
  }
  function inflight(){var n=0;for(var i=0;i<sms.length;i++)for(var j=0;j<sms[i].length;j++)if(sms[i][j])n++;return n}
  function launch(){kIdx=(kIdx+1)%KERNELS.length;left=KERNELS[kIdx].blocks}
  function tick(){
    for(var i=0;i<sms.length;i++)for(var j=0;j<sms[i].length;j++){var b=sms[i][j];if(b){b.t--;if(b.t<=0){sms[i][j]=null;done++}}}
    var budget=6;
    if(left<=0){var nk=KERNELS[(kIdx+1)%KERNELS.length];if(nk.sync&&inflight()>0)return;launch()}
    while(budget-->0){
      if(left<=0)break;
      var placed=false;
      for(var tries=0;tries<sms.length;tries++){
        var s=sms[rr];rr=(rr+1)%sms.length;
        var fr=[];for(var q=0;q<s.length;q++)if(!s[q])fr.push(q);var free=fr.length?fr[Math.floor(Math.random()*fr.length)]:-1;
        if(free>=0){var k=KERNELS[kIdx],d=k.min+Math.floor(Math.random()*(k.max-k.min));s[free]={k:kIdx,t:d,d:d};left--;placed=true;break}
      }
      if(!placed)break;
    }
  }
  function css(v){return getComputedStyle(root).getPropertyValue(v).trim()}
  function size(){var r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);layout()}
  function draw(){
    var r=cv.getBoundingClientRect(),W=r.width,H=r.height;ctx.clearRect(0,0,W,H);
    var line=css('--line'),cell=css('--cell'),muted=css('--muted');
    var cols_k=KERNELS.map(function(k){return css(k.color)});
    var memH=14,gap=6,gridH=H-memH-14;
    var sw=(W-gap*(cols-1))/cols, sh=(gridH-gap*(rows-1))/rows;
    var busy=0,total=0;
    for(var i=0;i<sms.length;i++){
      var cx=(i%cols)*(sw+gap), cy=Math.floor(i/cols)*(sh+gap);
      ctx.strokeStyle=line;ctx.lineWidth=1;ctx.strokeRect(cx+.5,cy+.5,sw-1,sh-1);
      var pad=4,cw=(sw-pad*2-(SLOTS_X-1)*2)/SLOTS_X,ch=(sh-pad*2-(SLOTS_Y-1)*2)/SLOTS_Y;
      for(var j=0;j<sms[i].length;j++){
        var x=cx+pad+(j%SLOTS_X)*(cw+2),y=cy+pad+Math.floor(j/SLOTS_X)*(ch+2),b=sms[i][j];total++;
        if(b){busy++;ctx.globalAlpha=.35+.65*(b.t/b.d);ctx.fillStyle=cols_k[b.k]}else{ctx.globalAlpha=1;ctx.fillStyle=cell}
        ctx.fillRect(x,y,cw,ch);
      }
    }
    ctx.globalAlpha=1;
    // memory bus bar
    var my=H-memH, util=busy/total;
    ctx.fillStyle=cell;ctx.fillRect(0,my,W,memH);
    ctx.fillStyle=cols_k[kIdx];ctx.globalAlpha=.8;ctx.fillRect(0,my,W*Math.min(1,util*(0.85+Math.random()*.15)),memH);ctx.globalAlpha=1;
    ctx.fillStyle=muted;ctx.font='10px "JetBrains Mono",monospace';ctx.textBaseline='middle';ctx.fillText('HBM',6,my+memH/2);
    if(el.occ){el.occ.textContent=Math.round(util*100)+'%';el.fly.textContent=busy;el.kn.textContent=KERNELS[kIdx].name;el.dn.textContent=done.toLocaleString();}
  }
  size();
  for(var w=0;w<60;w++)tick();
  draw();
  addEventListener('resize',function(){size();draw()});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
  if(!reduce){
    var last=0,vis=true;
    new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(cv);
    (function loop(ts){if(vis&&ts-last>70){tick();draw();last=ts}requestAnimationFrame(loop)})(0);
  }
})();
