// src/ui.js

function doResize() {
  const board = document.getElementById('game-board'); if(!board) return;
  const scaleX = (window.innerWidth - 40) / 1140; const scaleY = (window.innerHeight - 80) / 660;
  gameScale = Math.max(0.3, Math.min(1.45, Math.min(scaleX, scaleY))); board.style.transform = `scale(${gameScale})`;
}
window.addEventListener('resize', doResize); window.addEventListener('orientationchange', () => setTimeout(doResize, 150));

function pick(el,g){document.querySelectorAll('#'+g+' .cb').forEach(b=>b.classList.remove('on'));el.classList.add('on');}
function val(g){return document.querySelector('#'+g+' .on')?.dataset.v}
function setMsg(m){document.getElementById('msg').textContent=m;}

function renderGosterge(){
  const area=document.getElementById('gosterge-area');
  if(!G.gosterge){area.innerHTML='';return;}
  const el=document.createElement('div'); el.className='tile '+tCls(G.gosterge); el.style.cssText='cursor:default;pointer-events:none;'; el.innerHTML=`<span class="tv">${tLabel(G.gosterge)}</span><span class="tc">${tSub(G.gosterge)}</span>`; area.innerHTML=''; area.appendChild(el); 
}

function renderAll(){
    renderRack();
    renderDisc();
    document.getElementById('dc').textContent=G.deck.length;
    document.getElementById('deck-chip').textContent='Deste: '+G.deck.length;
    updScores();
    calcRackScore();
    renderTable();
}

function renderRack(){
  for(let r=0;r<2;r++){
    const rowEl=document.getElementById('row'+r); rowEl.innerHTML='';
    for(let s=0;s<NSLOTS;s++){
      const t=G.grid[r][s];
      if(t){
        const inAcSel=acSelIds.includes(t.id), isDragging=DG.active&&DG.id===t.id, isHidden=isOkey(t)&&G.hiddenOkeys&&G.hiddenOkeys.has(t.id);
        const isIsler = G.yardim && !isOkey(t) && G.tableGroups && G.tableGroups.length > 0 && canAddTileToAnyGroup(t);
        const el=document.createElement('div'); el.className='tile '+(isHidden?'k':tCls(t))+(G.sel===t.id?' sel-t':'')+(isDragging?' is-drag':'')+(inAcSel?' sel-t':'')+(isIsler?' isler-tas':'');
        if(isHidden){el.innerHTML=`<span class="tv">?</span><span class="tc" style="font-size:8px;opacity:.6">gizli</span>`; el.title='Okey — sağ tık ile göster';} 
        else {el.innerHTML=`<span class="tv">${tLabel(t)}</span><span class="tc">${tSub(t)}</span>`; el.title=isOkey(t)?'Okey — sağ tık ile gizle':tLong(t);}
        el.dataset.r=r; el.dataset.s=s; el.dataset.id=t.id; el.addEventListener('pointerdown', function(e){ if(e.pointerType === 'mouse' && e.button !== 0) return; onTileMouseDown(e, t.id, r, s); });
        if(isOkey(t)){el.addEventListener('contextmenu', function(e){e.preventDefault(); if(G.hiddenOkeys.has(t.id)) G.hiddenOkeys.delete(t.id); else G.hiddenOkeys.add(t.id); renderRack();});}
        rowEl.appendChild(el);
      } else { const el=document.createElement('div'); el.className='slot'; el.dataset.r=r; el.dataset.s=s; rowEl.appendChild(el); }
    }
  }
}

function onTileMouseDown(e, id, r, s){
  DG={active:false, id, fr:r, fs:s, startX:e.clientX, startY:e.clientY, moved:false};
  function onPointerMove(ev){
    const dx=ev.clientX-DG.startX, dy=ev.clientY-DG.startY;
    if(!DG.active && Math.sqrt(dx*dx+dy*dy)>6){
      DG.active=true; DG.moved=true; const gh=document.getElementById('ghost'); const t=G.grid[DG.fr][DG.fs]; if(!t){cleanup();return;}
      const bgM={r:'#fff0f0',b:'#f0f0ff',g:'#e8ffd8',k:'#f2f2f2',ok:'#1a0a3a'}, coM={r:'#cc0000',b:'#0044cc',g:'#118833',k:'#111',ok:'#f5d84a'}, cl=tCls(t);
      gh.style.background=bgM[cl]||'#f0f0f0'; gh.style.color=coM[cl]||'#111'; gh.innerHTML=`<span style="font-size:26px;font-weight:900;line-height:1;margin-top:-2px;">${tLabel(t)}</span><span style="font-size:12px;font-weight:700;margin-top:2px;">${tSub(t)}</span>`; gh.style.display='flex'; renderRack();
    }
    if(DG.active){
      const gh=document.getElementById('ghost'); gh.style.left=ev.clientX+'px'; gh.style.top=ev.clientY+'px'; gh.style.transform = `translate(-50%,-65%) scale(${gameScale * 1.15})`;
      document.querySelectorAll('.slot.hov').forEach(el=>el.classList.remove('hov')); 
      document.querySelectorAll('.open-group-row.hov, .has-pair.hov').forEach(el=>el.classList.remove('hov'));
      
      const dfp=document.getElementById('disc-player'),dfr=dfp.getBoundingClientRect(); dfp.classList.toggle('drop-fin', G.turn===0&&G.phase==='discard'&&ev.clientX>=dfr.left&&ev.clientX<=dfr.right&&ev.clientY>=dfr.top&&ev.clientY<=dfr.bottom);
      gh.style.visibility='hidden'; const under=document.elementFromPoint(ev.clientX,ev.clientY); gh.style.visibility='visible';
      
      under?.closest?.('.slot')?.classList.add('hov'); 
      if(G.acildi[0] && G.turn===0 && G.phase==='discard') { 
          const grp = under?.closest?.('.open-group-row, .has-pair'); 
          if (grp) grp.classList.add('hov'); 
      }
    }
  }
  function onPointerUp(ev){
    cleanup(); document.querySelectorAll('.slot.hov').forEach(el=>el.classList.remove('hov')); document.querySelectorAll('.open-group-row.hov, .has-pair.hov').forEach(el=>el.classList.remove('hov')); const dfp=document.getElementById('disc-player'); dfp.classList.remove('drop-fin'); document.getElementById('ghost').style.display='none';
    if(!DG.moved){ const now=Date.now(); if(lastTap.id===id && now-lastTap.t<400){ lastTap={id:null,t:0}; if(G.turn===0&&G.phase==='discard') doDiscard(id); } else { lastTap={id,t:now}; const acPanel=document.getElementById('ac-panel'); if(acPanel.style.display!=='none'){ const idx=acSelIds.indexOf(id); if(idx>=0) acSelIds.splice(idx,1); else acSelIds.push(id); renderRack(); renderAcPanel(); } else { G.sel = G.sel===id ? null : id; renderRack(); updBtns(); } } return; }
    const cx=ev.clientX, cy=ev.clientY, dfr=dfp.getBoundingClientRect(); if(G.turn===0&&G.phase==='discard'&&cx>=dfr.left&&cx<=dfr.right&&cy>=dfr.top&&cy<=dfr.bottom){ doDiscard(DG.id); return; }
    document.getElementById('ghost').style.visibility='hidden'; const under=document.elementFromPoint(cx,cy); document.getElementById('ghost').style.visibility='visible'; 
    const droppedGroup = under?.closest('.open-group-row, .has-pair');
    
    if(G.acildi[0] && G.turn===0 && G.phase==='discard' && droppedGroup) {
      const gi = parseInt(droppedGroup.dataset.gi); G.sel = DG.id; const tile = getHand().find(t=>t.id===DG.id); const grp = G.tableGroups[gi];
      if(tile && grp) { 
          const swapIdx = getOkeySwapIndex(grp, tile); 
          if (swapIdx !== -1) { doOkeySwap(gi, swapIdx, tile); DG.active=false; renderRack(); return; } 
          if(canAddToGroup(grp, tile, 'end')) { doEklePos(gi, 'end'); DG.active=false; renderRack(); return; } 
          if(canAddToGroup(grp, tile, 'start')) { doEklePos(gi, 'start'); DG.active=false; renderRack(); return; } 
          setMsg(grp.length >= 8 ? 'Grup en fazla 8 taş olabilir!' : 'Bu taş bu gruba işlenemez!'); 
      }
      DG.active=false; renderRack(); return;
    }
    const tgt=under?.closest?.('[data-r][data-s]'); if(tgt){ const tr=parseInt(tgt.dataset.r), ts=parseInt(tgt.dataset.s), fr=DG.fr, fs=DG.fs; if(tr!==fr||ts!==fs){ const mv=G.grid[fr][fs], de=G.grid[tr][ts]; G.grid[tr][ts]=mv; G.grid[fr][fs]=de; } }
    DG.active=false; renderRack(); calcRackScore(); updBtns();
  }
  function cleanup(){ document.removeEventListener('pointermove', onPointerMove); document.removeEventListener('pointerup', onPointerUp); document.removeEventListener('pointercancel', onPointerUp); }
  document.addEventListener('pointermove', onPointerMove); document.addEventListener('pointerup', onPointerUp); document.addEventListener('pointercancel', onPointerUp);
}

function renderDisc(){
  const pp=document.getElementById('disc-player'),pt=document.getElementById('disc-player-top');
  if(!G.playerDisc.length){ pp.classList.remove('has'); pt.innerHTML='<span style="font-size:11px;color:rgba(255,255,255,.3)">atık</span>'; } 
  else { pp.classList.add('has'); pt.innerHTML=''; const top=G.playerDisc[G.playerDisc.length-1]; const el=document.createElement('div'); el.className='tile ' + tCls(top); el.style.cssText='cursor:default;pointer-events:none;'; el.innerHTML=`<span class="tv">${tLabel(top)}</span><span class="tc">${tSub(top)}</span>`; pt.appendChild(el); }
  for(let p=1;p<=3;p++){
    const area=document.getElementById('disc-opp'+p); if(!area)continue; area.innerHTML=''; const lastDiscs=G.oppDisc[p-1];
    if(p === 3 && G.turn === 0 && G.phase === 'draw' && lastDiscs && lastDiscs.length > 0) { area.classList.add('takeable'); area.title = 'Tıklayarak taşı alın'; area.onclick = () => takeSideTile(); } else { area.classList.remove('takeable'); area.title = ''; area.onclick = null; }
    if(!lastDiscs||!lastDiscs.length){ area.innerHTML='<span style="font-size:11px;color:rgba(255,255,255,.25)">atık</span>'; } else { const top=lastDiscs[lastDiscs.length-1]; const el=document.createElement('div'); el.className='tile '+tCls(top); el.style.cssText='cursor:default;pointer-events:none;'; el.innerHTML=`<span class="tv">${tLabel(top)}</span><span class="tc">${tSub(top)}</span>`; area.appendChild(el); }
  }
}

function renderTable() {
    const ts = document.getElementById('table-series');
    const tper = document.getElementById('table-pers');
    const tp = document.getElementById('table-pairs');
    ts.innerHTML = ''; tper.innerHTML = ''; tp.innerHTML = '';

    const seriesRows = [];
    for(let i=0; i<12; i++) {
        const row = document.createElement('div'); row.className = 'series-row';
        for(let j=0; j<13; j++) {
            const cell = document.createElement('div'); cell.className = 'board-cell';
            row.appendChild(cell);
        }
        ts.appendChild(row); seriesRows.push(row);
    }

    const perRows = [];
    for(let i=0; i<12; i++) {
        const row = document.createElement('div'); row.className = 'per-row';
        for(let j=0; j<4; j++) {
            const cell = document.createElement('div'); cell.className = 'board-cell';
            row.appendChild(cell);
        }
        tper.appendChild(row); perRows.push(row);
    }

    const pairSlots = [];
    for(let i=0; i<12; i++) {
        const row = document.createElement('div'); row.className = 'pair-row';
        for(let j=0; j<3; j++) {
            const cell = document.createElement('div'); cell.className = 'pair-cell';
            const c1 = document.createElement('div'); c1.className = 'board-cell';
            const c2 = document.createElement('div'); c2.className = 'board-cell';
            cell.appendChild(c1); cell.appendChild(c2);
            row.appendChild(cell);
            pairSlots.push(cell); 
        }
        tp.appendChild(row); 
    }

    let sIdx = 0, perIdx = 0, pIdx = 0;
    const canAct = G.turn===0 && G.phase==='discard' && G.acildi[0];

    G.tableGroups.forEach((grp, gi) => {
        const isPair = grp.length === 2;

        if (isPair) {
            if (pIdx < 36) {
                const slot = pairSlots[pIdx++];
                slot.dataset.gi = gi;
                slot.classList.add('has-pair');
                
                if(canAct) slot.addEventListener('click', () => onGrpClick(gi));
                
                grp.forEach((t, i) => {
                    const el = document.createElement('div'); el.className = 'tile board ' + tCls(t); el.innerHTML=`<span class="tv">${tLabel(t)}</span><span class="tc">${tSub(t)}</span>`;
                    slot.children[i].innerHTML = ''; 
                    slot.children[i].appendChild(el);
                });
            }
        } else {
            const norms = grp.filter(t => !isOkey(t));
            const isPer = new Set(norms.map(t => t.n)).size === 1;

            if (isPer) {
                if (perIdx < 12) {
                    const row = perRows[perIdx++];
                    row.dataset.gi = gi;
                    row.classList.add('open-group-row');
                    if(canAct) row.addEventListener('click', () => onGrpClick(gi));

                    grp.forEach((t, i) => {
                        if (i < 4) {
                            const el = document.createElement('div'); el.className = 'tile board ' + tCls(t); el.innerHTML=`<span class="tv">${tLabel(t)}</span><span class="tc">${tSub(t)}</span>`;
                            row.children[i].innerHTML = '';
                            row.children[i].appendChild(el);
                        }
                    });
                }
            } else { 
                if (sIdx < 12) {
                    const row = seriesRows[sIdx++];
                    row.dataset.gi = gi;
                    row.classList.add('open-group-row');
                    if(canAct) row.addEventListener('click', () => onGrpClick(gi));

                    let firstNormIdx = grp.findIndex(t => !isOkey(t));
                    let startVal = grp[firstNormIdx].n - firstNormIdx;
                    let expected = startVal;
                    
                    for (let i = 0; i < grp.length; i++) {
                        let val = expected;
                        while (val < 1) val += 13;
                        while (val > 13) val -= 13;

                        let t = grp[i];
                        const el = document.createElement('div'); el.className = 'tile board ' + tCls(t); el.innerHTML=`<span class="tv">${tLabel(t)}</span><span class="tc">${tSub(t)}</span>`;
                        
                        const slotIdx = val - 1; 
                        if (slotIdx >= 0 && slotIdx < 13) {
                            row.children[slotIdx].innerHTML = '';
                            row.children[slotIdx].appendChild(el);
                        }
                        expected++;
                    }
                }
            }
        }
    });
}

function showAcPanel(){ if(G.turn!==0||G.phase!=='discard')return; acSelIds=[]; document.getElementById('ac-panel').style.display='block'; document.getElementById('ac-pts-min').textContent = G.acildi[0] ? '0 (Sınır yok)' : `(Min ${Math.max(G.acilisPuan, G.highestSeri+1)} sayı / ${Math.max(4, G.highestCift+1)} çift)`; document.getElementById('ac-ok-btn').disabled = false; renderRack();renderAcPanel(); setMsg('Açmak istediğin taşları seç'); }
function hideAcPanel(){ acSelIds=[]; document.getElementById('ac-panel').style.display='none'; renderRack(); }

function renderAcPanel(){
  const div=document.getElementById('ac-sel-tiles');
  if(!div) return; 
  const hand=getHand(), selTiles=hand.filter(t=>acSelIds.includes(t.id)); div.innerHTML='';
  selTiles.forEach(t=>{ const el=document.createElement('div');el.className='tile sm '+tCls(t); el.innerHTML=`<span class="tv">${tLabel(t)}</span><span class="tc">${tSub(t)}</span>`; div.appendChild(el); });
  let pts=0, validGroups=false, validPairs=false; const pairs=findPairGroups(selTiles); let valid = false;
  const minSeri = Math.max(G.acilisPuan, G.highestSeri + 1);
  const minCift = Math.max(4, G.highestCift + 1);

  if (G.acildi[0]) {
      const isCift=G.acildi.includes('cift');
      if (G.acildi[0]==='cift') { valid=pairs.length>0&&selTiles.length===pairs.length*2; pts=selTiles.filter(t=>!isOkey(t)).reduce((s,t)=>s+t.n,0); document.getElementById('ac-status').textContent=valid?'✓ Geçerli Çift':'Geçersiz Çift'; } 
      else { const groups=findGroups(selTiles); valid=(groups!==null&&groups.length>0); pts=groups?groups.reduce((s,g)=>s+calcGroupPts(g),0):selTiles.filter(t=>!isOkey(t)).reduce((s,t)=>s+t.n,0);
          if(!valid&&isCift&&pairs.length>0&&selTiles.length===pairs.length*2){ valid=true;pts=selTiles.filter(t=>!isOkey(t)).reduce((s,t)=>s+t.n,0); document.getElementById('ac-status').textContent='✓ Geçerli Çift İşleme'; } else { document.getElementById('ac-status').textContent=valid?'✓ Geçerli Grup':'Geçersiz Grup'; }
      }
  } else {
      if(pairs.length>=minCift&&selTiles.length===pairs.length*2){ validPairs=true; pts=selTiles.filter(t=>!isOkey(t)).reduce((s,t)=>s+t.n,0); } 
      else { const groups=findGroups(selTiles); if(groups) { pts=groups.reduce((s,g)=>s+calcGroupPts(g),0); validGroups=pts>=minSeri; } else { pts=selTiles.filter(t=>!isOkey(t)).reduce((s,t)=>s+t.n,0); } }
      valid=validGroups||validPairs; document.getElementById('ac-status').textContent=validPairs?`✓ ${pairs.length} çift!`:(validGroups?'✓ Geçerli':(pairs.length>0?`${pairs.length}/${minCift} çift`:`Geçersiz (Min ${minSeri} sayı)`));
  }
  document.getElementById('ac-pts-val') ? document.getElementById('ac-pts-val').textContent=pts : null; document.getElementById('ac-status').style.color=valid?'#88ff88':'#ff8888'; 
}

function updAcilisStatus() {
  const statusEl = document.getElementById('acilis-status');
  if (!G.acildi[0]) {
      statusEl.textContent = 'Henüz açılmadın';
      statusEl.style.color = 'rgba(255,255,255,.4)';
  } else {
      statusEl.textContent = G.acilisDegeri[0];
      statusEl.style.color = '#88ff88';
  }
  for(let i=1; i<4; i++){
      const el = document.getElementById('acilis-text-'+i);
      if(el) el.textContent = G.acilisDegeri[i] || '';
  }
}

function updTimerUI() {
  const tc = document.getElementById('timer-chip'); tc.textContent = `⏳ ${G.timeLeft}s`;
  if(G.timeLeft <= 5 && G.turn === 0) tc.style.color = '#ff4444'; else tc.style.color = '#ffdd55';
  const pt = document.getElementById('timer-'+G.turn);
  if(pt) { pt.textContent = `⏳ ${G.timeLeft}s`; if(G.timeLeft <= 5) pt.classList.add('warn'); else pt.classList.remove('warn'); }
}

function updTurn(){
  document.getElementById('turn-chip').textContent='Sıra: '+G.names[G.turn];
  for(let i=0; i<4; i++){ const pinfo = document.getElementById('pinfo-'+i), ptimer = document.getElementById('timer-'+i); if(pinfo) pinfo.classList.remove('active-player'); if(ptimer) { ptimer.textContent = ''; ptimer.classList.remove('warn'); } }
  const activePinfo = document.getElementById('pinfo-'+G.turn); if(activePinfo) activePinfo.classList.add('active-player');
}

function updScores(){ 
  for(let i=0;i<4;i++){ 
    if(G.isEsli) G.scores[i] = G.teamScores[(i===0||i===2)?0:1]; 
    const scEl = document.getElementById('sc-v'+i);
    const sEl = document.getElementById('s'+i);
    if(scEl) scEl.textContent = G.scores[i]; 
    if(sEl) sEl.textContent = G.scores[i] + ' Puan';
  } 
}

function updBtns(){
  const myTurn=G.turn===0,canAct=myTurn&&G.phase==='discard'; document.getElementById('disc-btn').disabled=!(canAct&&!!G.sel);
  const btnCifte = document.getElementById('btn-cifte-git'); if (btnCifte) { if (G.acildi[0]) { btnCifte.style.display = 'none'; } else { btnCifte.style.display = ''; btnCifte.disabled = G.cifteGidiyor[0]; } }
  const btnTasiBirak = document.getElementById('btn-tasi-birak'); if (btnTasiBirak) { if (canAct && G.mustUseTile) { const tileInHand = getHand().some(t => t.id === G.mustUseTile); if (tileInHand) { btnTasiBirak.style.display = ''; btnTasiBirak.disabled = false; } else { btnTasiBirak.style.display = 'none'; } } else { btnTasiBirak.style.display = 'none'; } }
  if (G.acildi[0]) { document.getElementById('ac-btn').style.display=''; document.getElementById('ac-btn').disabled=!(canAct); document.getElementById('auto-ac-seri-btn').style.display='none'; document.getElementById('auto-ac-cift-btn').style.display='none'; document.getElementById('oto-isle-btn').style.display=''; document.getElementById('oto-isle-btn').disabled = !canAct; document.getElementById('geri-al-btn').style.display=(!G.turnStartedOpen) ? '' : 'none'; document.getElementById('geri-al-btn').disabled = !canAct; } 
  else { document.getElementById('ac-btn').style.display=''; document.getElementById('ac-btn').disabled=!(canAct&&!G.acildi[0]); document.getElementById('auto-ac-seri-btn').style.display=''; document.getElementById('auto-ac-seri-btn').disabled=!(canAct&&!G.acildi[0]); document.getElementById('auto-ac-cift-btn').style.display=''; document.getElementById('auto-ac-cift-btn').disabled=!(canAct&&!G.acildi[0]); document.getElementById('oto-isle-btn').style.display='none'; document.getElementById('geri-al-btn').style.display='none'; }
}

function showSkorModal(){
  const modal = document.getElementById('skor-modal');
  const card = document.getElementById('skor-modal-content');
  
  let html = `<h2>Genel Toplam Puan Durumu</h2>`;
  html += `<div style="overflow-x:auto;"><table class="skor-table" style="margin-bottom:20px;">`;
  if (G.isEsli) {
      html += `<tr><th>Takım Bilgisi</th><th>Toplam Puan</th></tr>`;
      html += `<tr><td>Bizim Takım (${G.names[0]} & ${G.names[2]})</td><td><b style="font-size:14px;color:${G.teamScores[0]<0?'#88ff88':(G.teamScores[0]>0?'#ff8888':'#fff')}">${G.teamScores[0]}</b></td></tr>`;
      html += `<tr><td>Rakip Takım (${G.names[1]} & ${G.names[3]})</td><td><b style="font-size:14px;color:${G.teamScores[1]<0?'#88ff88':(G.teamScores[1]>0?'#ff8888':'#fff')}">${G.teamScores[1]}</b></td></tr>`;
  } else {
      html += `<tr><th>Oyuncular</th><th>Toplam Puan</th></tr>`;
      for(let p=0; p<4; p++) {
          html += `<tr><td>${G.names[p]}</td><td><b style="font-size:14px;color:${G.scores[p]<0?'#88ff88':(G.scores[p]>0?'#ff8888':'#fff')}">${G.scores[p]}</b></td></tr>`;
      }
  }
  html += `</table></div>`;
  html += `<div style="max-height: 40vh; overflow-y: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 10px; background: rgba(0,0,0,.2); scrollbar-width:thin;">`;
  
  G.history.forEach((h) => {
      html += `<div style="margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 10px;">`;
      html += `<div style="text-align:center; font-weight:bold; color:#e8c84a; margin-bottom: 8px; background:rgba(0,0,0,.4); padding:4px; border-radius:4px;">${h.el}. EL SONU — DETAYLI PUANLAR</div>`;
      html += `<div style="overflow-x:auto;"><table class="skor-table" style="margin-bottom: 5px;">`;
      html += `<tr><th style="text-align:left;">Oyuncular</th><th>Durum</th><th>Puan</th><th>Kafa</th><th>Cezalar</th><th>Toplam</th></tr>`;
      
      for (let p=0; p<4; p++) {
          const formatPts = (v) => v === 0 ? `<span style="color:#aaa">0</span>` : (v < 0 ? `<span class="bonus">${v}</span>` : `<span class="ceza">+${v}</span>`);
          html += `<tr>`;
          html += `<td style="text-align:left;">${G.names[p]}</td>`;
          html += `<td>${h.durum[p]}</td>`;
          html += `<td>${formatPts(h.puan[p])}</td>`;
          html += `<td>${formatPts(h.kafa[p])}</td>`;
          html += `<td>${formatPts(h.cezalar[p])}</td>`;
          html += `<td><b>${formatPts(h.toplam[p])}</b></td>`;
          html += `</tr>`;
      }
      html += `</table></div>`;
      if (h.winner === -1) html += `<div style="color:#ffcc44;text-align:center;font-size:10px;">Deste bitti — Herkes kalan sayısına göre ceza yedi.</div>`;
      else if (h.mult > 1) html += `<div style="color:#ffaa44;text-align:center;font-size:10px;">⚡ ${G.names[h.winner]} katlamalı (${h.mult}x) ceza kesti!</div>`;
      html += `</div>`;
  });
  
  html += `</div>`; 
  html += `<button class="devam-btn" onclick="nextEl()">Devam →</button>`;
  card.innerHTML = html;
  modal.classList.add('show');
}