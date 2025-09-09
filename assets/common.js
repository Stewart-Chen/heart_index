/* assets/common.js */
window.Common = (function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const pickColor=i=>['#59d1c5','#7aa6ff','#ffc857','#ff6b6b','#c792ea','#4cd984','#ffa07a','#6b8cff'][i%8];
  const hexToRgba=(h,a)=>{h=h.replace('#','');const n=parseInt(h,16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return `rgba(${r},${g},${b},${a})`;};
  const parseLines = (txt) => (txt||'').split(/\n/).map(s=>s.trim()).filter(Boolean);
  const parseFour = (txt,def=[0,0,0,0])=>{
    const m=(txt||'').split(/,|\s+/).map(Number).filter(n=>!isNaN(n));
    return m.length===4?m:def;
  };
  const esc = s => (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const kpiHTML = items => items.map(x=>`<div class="kpi"><div class="v">${x.v}</div><div class="l">${x.l}</div></div>`).join("");
  const legendHTML = ds => ds.map(d=>`<span><i class="dot" style="background:${d.color}"></i>${d.label}</span>`).join("");
  const listHTML = lines => (lines&&lines.length)? `<ul style="margin:0;padding-left:18px">${lines.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>` : '（尚未填寫）';

  function barsHTML(items){
    if(!items || !items.length) return '（尚未填寫）';
    let html = '<div class="barlist">';
    items.forEach(x=>{
      const p = clamp(parseInt(x.pct,10)||0,0,100);
      html += `<div class="barname">${esc(x.name||'—')}</div>
               <div class="bartrack"><div class="barfill" style="width:${p}%"></div></div>
               <div class="barpct">${p}%</div>`;
    });
    html += '</div>';
    return html;
  }

  /* ── 情緒投影 ── */
  function indicatorsToPlutchik(ind){
    const c=v=>Math.max(0,Math.min(1.5,v));
    return {
      "Joy(快樂)": (ind.social + ind.res)/2,
      "Trust(信任)": ind.social,
      "Fear(恐懼)": c(1.5 - ind.stable),
      "Surprise(驚訝)": 0.5 + (ind.focus/2),
      "Sadness(悲傷)": c(1.5 - ind.res),
      "Disgust(厭惡)": c(1.5 - ind.social),
      "Anger(憤怒)": c(1.5 - ind.focus),
      "Anticipation(期待)": (ind.focus + ind.stable)/2
    };
  }

  /* ── 雷達圖 ── */
  function drawRadar(canvas, labels, datasets, options={}){
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || 900;
    const cssH = rect.height|| canvas.clientHeight|| 560;
    const dpr = options.forceDPR || window.devicePixelRatio || 1;

    canvas.width  = Math.round(cssW*dpr);
    canvas.height = Math.round(cssH*dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.scale(dpr,dpr);

    const W=canvas.width/dpr,H=canvas.height/dpr,cx=W/2,cy=H/2;
    const pad=options.padding??60, r=Math.min(W,H)/2 - pad;

    let maxVal=0; datasets.forEach(ds=>ds.values.forEach(v=>{if(v>maxVal)maxVal=v;}));
    maxVal=Math.max(maxVal, options.minMax?.max ?? 1.2);
    const rings=options.rings??4;

    ctx.save();
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid')||'#e5ecfa';
    ctx.lineWidth=1;
    for(let i=1;i<=rings;i++){
      const rr=r*i/rings; ctx.beginPath();
      for(let k=0;k<labels.length;k++){
        const ang=(Math.PI*2/labels.length)*k - Math.PI/2;
        const x=cx+rr*Math.cos(ang), y=cy+rr*Math.sin(ang);
        if(k===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.stroke();
    }
    const fontPx=options.fontPx||16;
    ctx.fillStyle=getComputedStyle(document.body).color||'#111';
    ctx.font=`500 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans TC, Arial`;
    labels.forEach((lab,k)=>{
      const ang=(Math.PI*2/labels.length)*k - Math.PI/2;
      const x=cx+(r+14)*Math.cos(ang), y=cy+(r+14)*Math.sin(ang);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+r*Math.cos(ang), cy+r*Math.sin(ang)); ctx.stroke();
      ctx.textAlign=Math.cos(ang)>0.2?"left":(Math.cos(ang)<-0.2?"right":"center");
      ctx.textBaseline=Math.sin(ang)>0.2?"top":(Math.sin(ang)<-0.2?"bottom":"middle");
      ctx.fillText(lab,x,y);
    });
    ctx.restore();

    datasets.forEach((ds,idx)=>{
      const color=ds.color||pickColor(idx), alpha=ds.fill??0.18;
      const pts=ds.values.map((v,k)=>{const ang=(Math.PI*2/labels.length)*k - Math.PI/2; const rr=(v/maxVal)*r; return [cx+rr*Math.cos(ang), cy+rr*Math.sin(ang)];});
      ctx.beginPath(); pts.forEach((p,i)=>{if(i===0)ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]);}); ctx.closePath();
      ctx.fillStyle=hexToRgba(color,alpha); ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle=color; pts.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fill();});
    });

    return {
      toPNG(scale=2){
        const w=Math.round(cssW*scale), h=Math.round(cssH*scale);
        const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
        const c=tmp.getContext('2d'); c.scale(scale,scale);
        drawRadar(tmp,labels,datasets,{...options,forceDPR:1,fontPx:(options.fontPx||16)+Math.round(scale)});
        return tmp.toDataURL('image/png');
      }
    };
  }

  /* ── PDF 輸出（避免重複：動態建 DOM，依 mode 顯示對應段落） ── */
  function printNow(mode, brand, kpiNodesHTML, tableTitle, tableHTML, opts){
    // opts: {quotes, actionsHTML, rippleHTML, suggestionsHTML, roi, planHTML, radarPNGs:[p1,p2], legends:[l1,l2]}
    const root = document.createElement('div');
    root.className='print-container';
    root.innerHTML = `
      <section class="page">
        <div class="ph"><span>${new Date().toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          <span>心聚指標報告（Lite / Pro / Enterprise）</span><span>（正式版 PDF）</span></div>
        <div style="display:flex;align-items:center;gap:6mm;margin:6mm 0 4mm">
          ${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" style="width:20mm;height:20mm;object-fit:contain;border-radius:4px">`
            : `<svg width="20mm" height="20mm" viewBox="0 0 100 100" style="border-radius:6px"><defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${brand.color||'#1bb1c9'}"/><stop offset="100%" stop-color="#52d09b"/></linearGradient>
              </defs><rect x="0" y="0" width="100" height="100" rx="8" ry="8" fill="url(#g1)"/></svg>`}
          <div><div style="font-weight:800">${esc(brand.company)}</div><div style="font-size:12px;color:#666">心聚指標｜成效報告</div></div>
        </div>
        <div class="ptitle">心聚指標成效報告（${mode==='lite'?'Lite（單場）':mode==='pro'?'Pro（季度）':'Enterprise（年度）'}）</div>
        <p class="psub">公司：${esc(brand.company)}　專案：${esc(brand.project||'—')}　日期：${esc(brand.date||new Date().toLocaleDateString('zh-TW'))}</p>
        <div class="kpis print">${kpiNodesHTML}</div>
        <div class="pfooter"><span>${location.href}</span><span style="float:right">第 1 / 3 頁</span></div>
      </section>

      <section class="page">
        <div class="ph"><span>${new Date().toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          <span>指標雷達 & 情緒雷達</span><span>（正式版 PDF）</span></div>
        <div class="section-title">雷達圖①｜心聚四指標</div>
        <img class="radarPrint" src="${opts.radarPNGs[0]||''}" />
        <div class="small">${opts.legends[0]||''}</div>
        <div class="section-title" style="margin-top:4mm">雷達圖②｜Plutchik 八大情緒（由四指標投影）</div>
        <img class="radarPrint" src="${opts.radarPNGs[1]||''}" />
        <div class="small">${opts.legends[1]||''}</div>
        <div class="pfooter"><span>${location.href}</span><span style="float:right">第 2 / 3 頁</span></div>
      </section>

      <section class="page">
        <div class="ph"><span>${new Date().toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          <span>重點摘要與合規聲明</span><span>（正式版 PDF）</span></div>
        <div class="section-title">${esc(tableTitle)}</div>
        <div class="pcard">${tableHTML}</div>

        ${mode==='lite'?`
          <div class="section-title" style="margin-top:5mm">下一步建議</div>
          <div class="pcard small">${opts.suggestionsHTML||'（尚未填寫）'}</div>
          <div class="section-title" style="margin-top:5mm">學員一句話</div>
          <div class="pcard small">${opts.quotes||'（尚未填寫）'}</div>
          <div class="section-title" style="margin-top:5mm">行動採納（72h）</div>
          <div class="pcard small">${opts.actionsHTML||'（尚未填寫）'}</div>
          <div class="section-title" style="margin-top:5mm">關係圈擴散</div>
          <div class="pcard small">${opts.rippleHTML||'（尚未填寫）'}</div>
        `: mode==='pro'?`
          <div class="section-title" style="margin-top:5mm">建議處方</div>
          <div class="pcard small">${opts.suggestionsHTML||'（尚未填寫）'}</div>
        `:`
          <div class="section-title" style="margin-top:5mm">ROI 故事</div>
          <div class="pcard small">${esc(opts.roi||'（尚未填寫）')}</div>
          <div class="section-title" style="margin-top:5mm">年度建議</div>
          <div class="pcard small">${opts.planHTML||'（尚未填寫）'}</div>
        `}

        <div class="section-title" style="margin-top:5mm">法遵與版權聲明</div>
        <div class="pcard small">
          <ol style="margin:0;padding-left:4mm">
            <li><b>資訊安全與隱私</b>：本報告僅呈現統計性結果，不含可識別個人資訊；若涉及個資，已採去識別化處理。</li>
            <li><b>使用範圍</b>：限於內部教育訓練與管理決策使用，未經書面同意，不得對外散布或轉載。</li>
            <li><b>非醫療聲明</b>：本報告不構成醫療診斷、治療或心理諮商建議。</li>
            <li><b>資料來源</b>：數據由課程回饋與「心聚指標」自填問卷彙整，結果可能受樣本與情境影響。</li>
            <li><b>智慧財產</b>：本報告之文字、圖表與版型為 © ${esc(brand.company)} 所有；未經授權請勿重製。</li>
            <li><b>聯絡窗口</b>：${esc(brand.contact||'support@example.com')}</li>
          </ol>
        </div>
        <div class="pfooter"><span>${location.href}</span><span style="float:right">第 3 / 3 頁</span></div>
      </section>
    `;
    document.body.appendChild(root);
    window.print();
    window.setTimeout(()=>root.remove(),100); // 列印後移除, 避免重複
  }

  return {
    $, $$, clamp, avg, parseLines, parseFour, esc,
    kpiHTML, legendHTML, listHTML, barsHTML,
    indicatorsToPlutchik, drawRadar, printNow, pickColor
  };
})();

