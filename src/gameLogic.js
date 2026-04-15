// src/gameLogic.js

function applyPenalty(player, amount, msgStr) {
    G.roundPenalties[player] += amount;
    G.scores[player] += amount;
    if (G.isEsli) {
        const tIdx = (player === 0 || player === 2) ? 0 : 1;
        G.teamScores[tIdx] += amount;
        G.scores[0] = G.scores[2] = G.teamScores[0];
        G.scores[1] = G.scores[3] = G.teamScores[1];
    }
    updScores();
    if (msgStr) spawnFloatingText(msgStr, '#ff4444');
}

function checkAndApplyBonus(player, type, val) {
    let bonus = 0; let msg = '';
    if (type === 'seri') {
        if (val >= 121) { bonus = -200; msg = '🌟 121+ ile Açılış: -200 Puan'; }
        else if (val >= 101) { bonus = -100; msg = '⭐ 101+ ile Açılış: -100 Puan'; }
    } else if (type === 'cift') {
        if (val >= 6) { bonus = -200; msg = '🌟 6+ Çift ile Açılış: -200 Puan'; }
        else if (val >= 5) { bonus = -100; msg = '⭐ 5 Çift ile Açılış: -100 Puan'; }
    }
    if (bonus !== 0) {
        G.roundBonus[player] += bonus; 
        G.scores[player] += bonus;
        if (G.isEsli) { const tIdx = (player === 0 || player === 2) ? 0 : 1; G.teamScores[tIdx] += bonus; G.scores[0]=G.scores[2]=G.teamScores[0]; G.scores[1]=G.scores[3]=G.teamScores[1]; }
        updScores();
        if (player === 0) spawnFloatingText(msg, '#88ff88');
        else spawnFloatingText(G.names[player] + ' ' + msg, '#88ff88');
    }
}

function addExtraTime() {
    if (G.turn === 0) {
        G.turnEndTime = Date.now() + (G.acikTime * 1000);
        G.timeLeft = G.acikTime;
        updTimerUI();
        if(isMultiplayer) saveGameState(); 
    }
}

function startTimer() {
  if (turnTimer) clearInterval(turnTimer); 
  const duration = G.acildi[G.turn] ? G.acikTime : G.normalTime;
  
  if (!isMultiplayer || G.turn === 0 || (isMultiplayer && amIHost() && isBotSeat((G.turn + mySeat)%4))) {
      G.turnEndTime = Date.now() + (duration * 1000); 
  }

  turnTimer = setInterval(() => { 
      if (!G.turnEndTime) return;
      const now = Date.now();
      G.timeLeft = Math.ceil((G.turnEndTime - now) / 1000);
      
      updTimerUI(); 
      
      if (G.timeLeft <= 0) { 
          if (G.turn === 0) {
              clearInterval(turnTimer); 
              autoPlayHuman(); 
          } else if (isMultiplayer) {
              if (G.timeLeft < -3) {
                  const globalTurn = (G.turn + mySeat) % 4;
                  if (!isBotSeat(globalTurn) && !window.kickingOffline) {
                      console.log("Oyuncu koptu. Bota çevriliyor...");
                      window.kickingOffline = true; 
                      
                      const update = {};
                      update['seat' + globalTurn + '_user'] = 'bot-' + globalTurn;
                      update['seat' + globalTurn + '_name'] = 'Bot ' + (globalTurn+1);
                      
                      supa.from('rooms').update(update).eq('id', myRoomId).then(() => {
                          window.kickingOffline = false;
                      });
                  }
              }
          }
      } 
  }, 1000);
}

function autoPlayHuman() {
  if (G.turn !== 0) return;
  if(DG.active){ DG.active = false; document.getElementById('ghost').style.display = 'none'; document.querySelectorAll('.slot.hov, .open-group-row.hov, .has-pair.hov').forEach(el=>el.classList.remove('hov')); document.getElementById('disc-player').classList.remove('drop-fin'); renderRack(); }
  if(document.getElementById('ac-panel').style.display !== 'none') hideAcPanel();
  if(document.getElementById('reject-modal').classList.contains('show')) onRejectVazgec(); 
  
  if(G.mustOpenThisTurn && !G.acildi[0]) { applyPenalty(0, 81, 'Açmadınız! +81 Ceza'); setMsg('Süre bitti! Yandan taş alıp açmadığınız/çifte gitmediğiniz için +81 puan ceza yediniz.'); G.mustOpenThisTurn = false; G.mustUseTile = null; } 
  else if(G.mustUseTile) { const stillInHand = getHand().some(t => t.id === G.mustUseTile); if(stillInHand && G.acildi[0]) { applyPenalty(0, 81, 'Aldığınız taşı işleyin! +81 Ceza'); setMsg('Süre bitti! Yandan aldığınız taşı işlemediğiniz için +81 puan ceza yediniz.'); } G.mustUseTile = null; }
  
  if (G.phase === 'draw') { if(G.deck.length > 0) { const t = G.deck.pop(); const [r,s] = firstEmpty(); if(r >= 0) G.grid[r][s] = t; G.phase = 'discard'; renderAll(); setMsg('Süre bitti, desteden otomatik taş çekildi.'); } else { endEl(-1); return; } }
  
  const hand = getHand(); if (hand.length > 0) { let wi=0,wv=-1;for(let i=0;i<hand.length;i++){if(isOkey(hand[i]))continue;if(hand[i].n>wv){wv=hand[i].n;wi=i;}} const atilan = hand[wi]; if (atilan) { setMsg('Süre bitti, otomatik hamle yapıldı.'); doDiscard(atilan.id); } }
}

function nextTurn(){
  G.turn=(G.turn+1)%4; G.phase='draw'; G.turnStartedOpen=G.acildi[G.turn]; 
  const duration = G.acildi[G.turn] ? G.acikTime : G.normalTime;
  G.turnEndTime = Date.now() + (duration * 1000);
  updTurn(); startTimer(); 
  
  if(isMultiplayer){ 
     renderAll(); updBtns(); 
     const globalTurn = (G.turn + mySeat) % 4;
     if(isBotSeat(globalTurn) && amIHost()) {
         setTimeout(() => { botPlay(); saveGameState(); }, 1200);
     }
  } else {
     if(G.turn!==0){ setTimeout(botPlay,1200); } else { renderAll(); updBtns(); }
  }
}

function drawDeck(){
  if(G.turn!==0||G.phase!=='draw')return; if(!G.deck.length){setMsg('Deste bitti! El berabere.');endEl(-1);return;}
  const t=G.deck.pop(), isGosterge=G.gosterge&&t.id===G.gosterge.id; const[r,s]=firstEmpty();if(r<0)return;
  G.grid[r][s]=t;G.phase='discard';G.islenenBuTur=0;renderAll(); setMsg(isGosterge?'⭐ Gösterge taşını çektin!':'Çektin: '+tLong(t)); updBtns();
  if(isMultiplayer) saveGameState();
}

function doDiscard(id){
  if(G.turn!==0||G.phase!=='discard')return false;
  if(G.mustOpenThisTurn && !G.acildi[0]) { applyPenalty(0, 81, 'Aç veya Çifte Git! (+81 Ceza)'); setMsg('Yandan taş aldın! Ya elini AÇMALISIN ya da ÇİFTE GİT butonuna basmalısın.'); return false; }
  if(G.mustUseTile) { const stillInHand = getHand().some(t => t.id === G.mustUseTile); if(stillInHand) { applyPenalty(0, 81, 'Aldığın taşı işle! +81 Ceza'); setMsg('Yandan aldığınız taşı henüz kullanmadınız! İşlemeden veya açmadan taş atamazsınız.'); return false; } else { G.mustUseTile = null; } }

  const t = getHand().find(tile => tile.id === id); if (!t) return false;
  let isOkeyTile = isOkey(t), isIsler = canAddTileToAnyGroup(t);
  
  if(isOkeyTile) { applyPenalty(0, 81, '⚠ Okey Attın! +81 Ceza'); setMsg('⚠ Okey attın! +81 Puan ceza.'); } 
  else if (isIsler) { applyPenalty(0, 81, '⚠ İşler Taş Attın! +81 Ceza'); setMsg('⚠ İşler taş attınız! +81 Puan ceza.'); }

  for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){
    if(G.grid[r][s]?.id===id){
      G.grid[r][s]=null; G.playerDisc.push(t); G.sel=null;G.phase='draw'; renderAll();
      if (!isOkeyTile && !isIsler) setMsg('Attın: '+tLong(t)); updBtns();
      if(G.acildi[0]){ const remaining=getHand(); if(remaining.length===0){ G.eldenBiten = !G.turnStartedOpen; G.okeyBiten = isOkeyTile; endEl(0); if(isMultiplayer) saveGameState(); return true; } }
      nextTurn();
      if(isMultiplayer) saveGameState();
      return true;
    }
  }return false;
}

function discardSelected(){if(G.sel)doDiscard(G.sel);}

function takeSideTile() {
    if(G.turn !== 0 || G.phase !== 'draw') return;
    const globalPrevIdx = 3; const oppDiscIdx = 2; const discards = G.oppDisc[oppDiscIdx];
    if(!discards || discards.length === 0) return;

    const tile = discards[discards.length - 1];

    if (G.cifteGidiyor[0] || G.acildi[0] === 'cift') {
        processSideTileTake(tile, oppDiscIdx, true);
        return;
    }

    let botRejects = false;
    
    if (G.cifteGidiyor[globalPrevIdx] || G.acildi[globalPrevIdx] === 'cift') {
        botRejects = true;
    } else {
        const pairs = findPairGroups(G.opp[oppDiscIdx]);
        if (pairs.length >= 3 || Math.random() < 0.25) { 
            botRejects = true;
        }
    }

    if (botRejects) {
        G.cifteGidiyor[globalPrevIdx] = true;
        
        if (G.acildi[0] === 'seri') {
            spawnFloatingText('Taş Alınamaz!', '#ff4444');
            setMsg(`${G.names[globalPrevIdx]} çifte gidiyor/açtı. Seri açtığın için ondan taş alamazsın!`);
            return;
        }
        
        G.pendingTile = { tile: tile, oppDiscIdx: oppDiscIdx };
        
        document.getElementById('reject-text').innerHTML = `${G.names[globalPrevIdx]} çifte gittiği için taş almana izin vermiyor.<br><br>Sadece sen de çifte gidersen alabilirsin. Ne yapmak istersin?`;
        document.getElementById('reject-modal').classList.add('show');
    } else {
        setMsg(`${G.names[globalPrevIdx]} taşı almana olur verdi.`);
        processSideTileTake(tile, oppDiscIdx, false);
    }
}

function processSideTileTake(tile, oppDiscIdx, isCifte) {
    executeTakeSideTile(tile, oppDiscIdx);
    if (isCifte && !G.acildi[0]) {
        setMsg('Çifte gittiğin için yandan taşı serbestçe aldın.');
    } else {
        G.mustUseTile = tile.id; 
        if(G.acildi[0]) { setMsg('Yandan taş aldınız! Bu taşı işlemek veya YENİ bir grupla açmak zorundasınız.'); } 
        else { G.mustOpenThisTurn = true; setMsg('Yandan taş aldınız! Ya elini AÇMALISIN ya da ÇİFTE GİT butonuna basmalısın.'); }
    }
    G.islenenBuTur = 0; updBtns();
}

function executeTakeSideTile(tile, oppDiscIdx) {
    G.oppDisc[oppDiscIdx].pop(); const [r,s] = firstEmpty(); if(r >= 0) G.grid[r][s] = tile;
    G.phase = 'discard'; renderAll();
    if(isMultiplayer) saveGameState();
}

function onRejectVazgec() {
    document.getElementById('reject-modal').classList.remove('show');
    G.pendingTile = null;
    setMsg('Taş almaktan vazgeçtin. Desteden çekebilirsin.');
}

function onRejectCifteGit() {
    document.getElementById('reject-modal').classList.remove('show');
    if (G.pendingTile) {
        G.cifteGidiyor[0] = true;
        const btn = document.getElementById('btn-cifte-git'); 
        if(btn) { btn.classList.add('on'); btn.textContent = 'Çifte Gidiliyor'; btn.disabled = true; }
        
        processSideTileTake(G.pendingTile.tile, G.pendingTile.oppDiscIdx, true);
        G.pendingTile = null;
        setMsg('İzin verilmediği halde taşı zorla aldın! Artık Çifte gitmek zorundasın.');
    }
}

function doCifteGit() {
    if(G.turn !== 0 || G.acildi[0]) return; G.cifteGidiyor[0] = true;
    const btn = document.getElementById('btn-cifte-git'); btn.classList.add('on'); btn.textContent = 'Çifte Gidiliyor'; btn.disabled = true; 
    
    if(G.mustOpenThisTurn) {
        G.mustOpenThisTurn = false;
        G.mustUseTile = null;
        setMsg('Çifte gitmeye karar verdin! Açma zorunluluğu kalktı.');
    } else {
        setMsg('Çifte gitme modu aktif! Açmak zorunda kalmadan yandan taş alabilirsin.');
    }
    updBtns();
}

function doTasiBirak() {
    if (G.turn !== 0 || G.phase !== 'discard' || !G.mustUseTile) return;
    let foundTile = null; for (let r = 0; r < 2; r++) { for (let s = 0; s < NSLOTS; s++) { if (G.grid[r][s] && G.grid[r][s].id === G.mustUseTile) { foundTile = G.grid[r][s]; G.grid[r][s] = null; break; } } if (foundTile) break; }
    if (foundTile) { 
        G.oppDisc[2].push(foundTile); G.mustUseTile = null; G.mustOpenThisTurn = false; G.phase = 'draw'; 
        applyPenalty(0, 81, 'Taşı Geri Bıraktın! +81 Ceza'); setMsg('Aldığınız taşı geri bıraktınız. +81 Puan Ceza!'); 
        renderAll(); updBtns(); 
    } else { setMsg('Taş elinizde bulunamadı (işlenmiş veya açılmış olabilir).'); }
}

function canAddTileToAnyGroup(tile) {
    for(let gi=0; gi<G.tableGroups.length; gi++) { const grp = G.tableGroups[gi]; if(getOkeySwapIndex(grp, tile) !== -1) return true; if(canAddToGroup(grp, tile, 'end')) return true; if(canAddToGroup(grp, tile, 'start')) return true; } return false;
}

function isValidGroup(tiles){
  if(tiles.length<3 || tiles.length>8) return false; 
  const norms=tiles.filter(t=>!isOkey(t)); if(!norms.length) return tiles.length<=4; 
  const nums=new Set(norms.map(t=>t.n)), cols=norms.map(t=>t.c), uniqueCols=new Set(cols);
  if(nums.size===1 && uniqueCols.size===cols.length && tiles.length<=4) return true;
  const cs=new Set(norms.map(t=>t.c));
  if(cs.size===1){ 
    let firstNormIdx = tiles.findIndex(t=>!isOkey(t)), startVal = tiles[firstNormIdx].n - firstNormIdx; 
    if (startVal < 1) return false; 
    let expected = startVal; 
    for(let i=0; i<tiles.length; i++) { 
        let t = tiles[i]; 
        if (!isOkey(t)) { 
            if (t.n !== expected) return false; 
        } 
        expected++; 
        if (expected > 14) return false; // 13'ten sonra taş gelmesini KESİN OLARAK engeller
    } 
    return true; 
  } 
  return false;
}

function calcGroupPts(grp){
  const norms=grp.filter(t=>!isOkey(t)); if(!norms.length)return 0; const cs=new Set(norms.map(t=>t.c));
  if(cs.size===1 && norms.length >= 1){ 
    let firstNormIdx = grp.findIndex(t=>!isOkey(t)), currentVal = grp[firstNormIdx].n - firstNormIdx, sum = 0;
    for(let i=0; i<grp.length; i++) { sum += currentVal; currentVal++; } return sum;
  } else { return norms[0].n * grp.length; }
}

function canAddToGroup(grp,tile,pos){
  if (grp.length === 2) return false; const testGrp=pos==='start'?[tile,...grp]:[...grp,tile];
  if(testGrp.length > 8) return false; return isValidGroup(testGrp);
}

function getOkeySwapIndex(grp, tile) {
  if(isOkey(tile)) return -1; const norms = grp.filter(t => !isOkey(t)); if(norms.length === 0) return -1;
  if (grp.length === 2) { const norm = norms[0]; if (norm && tile.c === norm.c && tile.n === norm.n) { return grp.findIndex(t => isOkey(t)); } return -1; }
  for(let i=0; i<grp.length; i++) { if(isOkey(grp[i])) { const testGrp = [...grp]; testGrp[i] = tile; if (isValidGroup(testGrp)) return i; } } return -1;
}

function doOkeySwap(gi, swapIdx, tile) {
  if (G.acildi[0] === 'cift' && G.islenenBuTur >= 2) { setMsg('Çift açanlar bir elde en fazla 2 taş işleyebilir!'); return; }
  const grp = G.tableGroups[gi], okeyTile = grp[swapIdx]; 
  for(let r=0; r<2; r++) { for(let s=0; s<NSLOTS; s++) { if(G.grid[r][s]?.id === tile.id) { G.grid[r][s] = null; break; } } }
  grp[swapIdx] = tile; const [er, es] = firstEmpty(); if (er >= 0) G.grid[er][es] = okeyTile;
  if (G.acildi[0] === 'cift') G.islenenBuTur++; G.sel = null; addExtraTime(); renderAll(); renderTable(); updBtns(); setMsg('⭐ Okeyi takıma geri aldın!'); checkElBitti();
  if(isMultiplayer) saveGameState();
}

function onGrpClick(gi){
  if(G.turn!==0||G.phase!=='discard')return; if(!G.acildi[0]){setMsg('Önce elini açman gerekiyor!');return;} if(!G.sel){setMsg('Önce taşı seç, sonra gruba tıkla.');return;}
  const tile=getHand().find(t=>t.id===G.sel); if(!tile)return; const grp=G.tableGroups[gi];
  const swapIdx = getOkeySwapIndex(grp, tile); if (swapIdx !== -1) { doOkeySwap(gi, swapIdx, tile); return; }
  if(canAddToGroup(grp,tile,'end')){doEklePos(gi,'end');return;} if(canAddToGroup(grp,tile,'start')){doEklePos(gi,'start');return;} setMsg(grp.length >= 8 ? 'Bir grup en fazla 8 taştan oluşabilir!' : 'Bu taş bu gruba eklenemiyor!');
}

function doEklePos(gi,pos){
  if(G.turn!==0||G.phase!=='discard'||!G.acildi[0])return; if(!G.sel){setMsg('Önce taşı seç.');return;}
  if (G.acildi[0] === 'cift' && G.islenenBuTur >= 2) { setMsg('Çift açanlar bir elde en fazla 2 taş işleyebilir!'); return; }
  const hand=getHand(), tile=hand.find(t=>t.id===G.sel); if(!tile)return; const grp=G.tableGroups[gi];
  if(!canAddToGroup(grp,tile,pos)){ setMsg(grp.length >= 8 ? 'Bir grup en fazla 8 taştan oluşabilir!' : 'Eklenemiyor!'); return; }
  doEklePosInternal(gi, pos, tile); if (G.acildi[0] === 'cift') G.islenenBuTur++; G.sel=null; addExtraTime(); renderAll();renderTable();updBtns(); setMsg(tLong(tile)+' gruba işlendi!'); checkElBitti();
  if(isMultiplayer) saveGameState();
}

function doEklePosInternal(gi, pos, tile) {
  for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===tile.id){G.grid[r][s]=null;break;}}
  if(pos==='start') G.tableGroups[gi].unshift(tile); else G.tableGroups[gi].push(tile);
}

function doOtoIsle() {
  if(G.turn!==0 || G.phase!=='discard' || !G.acildi[0]) return;
  if (G.acildi[0] === 'cift' && G.islenenBuTur >= 2) { setMsg('Çift açanlar bir elde en fazla 2 taş işleyebilir!'); return; }
  let islendi = false, addedCount = 0, swappedCount = 0, newGroupCount = 0;
  do { islendi = false; const hand = getHand();
    for (let i = 0; i < hand.length; i++) { const tile = hand[i];
      for (let gi = 0; gi < G.tableGroups.length; gi++) { const grp = G.tableGroups[gi];
        const swapIdx = getOkeySwapIndex(grp, tile);
        if (swapIdx !== -1) { const okeyTile = grp[swapIdx]; for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===tile.id){G.grid[r][s]=null;break;}} grp[swapIdx] = tile; const [er, es] = firstEmpty(); if (er >= 0) G.grid[er][es] = okeyTile; islendi = true; swappedCount++; break; }
        if (canAddToGroup(grp, tile, 'end')) { doEklePosInternal(gi, 'end', tile); islendi = true; addedCount++; break; }
        if (canAddToGroup(grp, tile, 'start')) { doEklePosInternal(gi, 'start', tile); islendi = true; addedCount++; break; }
      }
      if (islendi) { if (G.acildi[0] === 'cift') { G.islenenBuTur++; if (G.islenenBuTur >= 2) break; } break; }
    }
  } while(islendi && !(G.acildi[0] === 'cift' && G.islenenBuTur >= 2));

  const remainingHand = getHand();
  if (G.acildi.includes('cift')) { const newPairs = findPairGroups(remainingHand); if (newPairs && newPairs.length > 0) { for(let p of newPairs) { if (G.acildi[0] === 'cift' && G.islenenBuTur >= 2) break; p.forEach(t=>{ for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;} }); G.tableGroups.push(p); newGroupCount++; if (G.acildi[0] === 'cift') G.islenenBuTur++; } } } 
  if (G.acildi[0] === 'seri') { const newGroups = findOptimalGroups(remainingHand); if (newGroups && newGroups.length > 0) { newGroups.forEach(g => { g.tiles.forEach(t=>{ for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;} }); G.tableGroups.push(g.tiles); newGroupCount++; }); } }
  if (addedCount > 0 || swappedCount > 0 || newGroupCount > 0) { G.sel = null; addExtraTime(); renderAll(); renderTable(); updBtns(); checkElBitti(); let msgStr = '✓ İşlem başarılı: '; if(addedCount > 0) msgStr += `${addedCount} taş eklendi. `; if(newGroupCount > 0) msgStr += `${newGroupCount} yeni grup açıldı. `; if(swappedCount > 0) msgStr += `${swappedCount} okey alındı.`; setMsg(msgStr.trim()); if(isMultiplayer) saveGameState(); } else { setMsg('Şu an masaya işlenecek taşın veya açılacak yepyeni bir grubun yok.'); }
}

function doAc(){
  const hand=getHand(), selTiles=hand.filter(t=>acSelIds.includes(t.id)); if (selTiles.length === 0) return;
  if(G.mustUseTile && !acSelIds.includes(G.mustUseTile)) { setMsg('Yandan aldığınız taşı açtığınız grupta kullanmalısınız!'); return; }

  const minSeri = Math.max(G.acilisPuan, G.highestSeri + 1);
  const minCift = Math.max(4, G.highestCift + 1);
  const isFinish = (hand.length - selTiles.length) <= 1, groups = findGroups(selTiles), pairs = findPairGroups(selTiles), isPairOnly = pairs.length > 0 && selTiles.length === pairs.length * 2, isGroupsValid = groups !== null && groups.length > 0, pts = groups ? groups.reduce((s,g)=>s+calcGroupPts(g),0) : 0;

  if (G.cifteGidiyor[0] && !G.acildi[0] && !isPairOnly) { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg('Çifte gitme modu aktifken seri açılamaz! Sadece çift açabilirsin. +81 Puan.'); hideAcPanel(); return; }

  if (G.acildi[0]) {
      if (G.acildi[0] === 'cift' && !isPairOnly) { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg('Hatalı Açılış! Çift açan seri açamaz! +81 Puan.'); hideAcPanel(); return; }
      if (isPairOnly && !G.acildi.includes('cift')) { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg('Hatalı Açılış! Oyunda çift açan yoksa çift işlenemez! +81 Puan.'); hideAcPanel(); return; }
      if (!isPairOnly && !isGroupsValid) { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg('Hatalı Açılış! Geçersiz dizilim. +81 Puan.'); hideAcPanel(); return; }
      selTiles.forEach(t=>{for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;}});
      if (isPairOnly) pairs.forEach(p=>G.tableGroups.push(p)); else groups.forEach(grp=>G.tableGroups.push(grp));
      acSelIds=[]; hideAcPanel(); addExtraTime(); renderAll(); renderTable(); updBtns(); setMsg('✓ Yeni taşlar masaya açıldı!'); checkElBitti();
      if(isMultiplayer) saveGameState();
      return;
  }

  if (isPairOnly) {
      if (pairs.length >= minCift || isFinish) { 
          const isFirstOpen = !G.acildi[0];
          if(isFirstOpen) { G.preOpenState = cloneState(); G.preOpenState.highestSeri = G.highestSeri; G.preOpenState.highestCift = G.highestCift; G.preOpenState.scores = [...G.scores]; G.preOpenState.teamScores = [...G.teamScores]; G.preOpenState.roundBonus = [...G.roundBonus]; } 
          selTiles.forEach(t=>{for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;}}); pairs.forEach(p=>G.tableGroups.push(p)); G.acildi[0] = 'cift'; acSelIds=[]; G.mustUseTile = null; G.mustOpenThisTurn = false; 
          if(pairs.length > G.highestCift) G.highestCift = pairs.length; G.acilisDegeri[0] = pairs.length + " çiftle açtı";
          if(isFirstOpen) checkAndApplyBonus(0, 'cift', pairs.length);
          hideAcPanel(); addExtraTime(); renderAll(); renderTable(); updBtns(); updAcilisStatus(); setMsg('✓ ' + pairs.length + ' çift ile açıldın!'); checkElBitti();
          if(isMultiplayer) saveGameState();
          return; 
      } 
      else { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg(`Hatalı Açılış: En az ${minCift} çift gerekli! +81 Puan.`); hideAcPanel(); return; }
  } else {
      if (isGroupsValid && (pts >= minSeri || isFinish)) { 
          const isFirstOpen = !G.acildi[0];
          if(isFirstOpen) { G.preOpenState = cloneState(); G.preOpenState.highestSeri = G.highestSeri; G.preOpenState.highestCift = G.highestCift; G.preOpenState.scores = [...G.scores]; G.preOpenState.teamScores = [...G.teamScores]; G.preOpenState.roundBonus = [...G.roundBonus]; } 
          selTiles.forEach(t=>{for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;}}); groups.forEach(grp=>G.tableGroups.push(grp)); G.acildi[0] = 'seri'; acSelIds=[]; G.mustUseTile = null; G.mustOpenThisTurn = false; 
          if(pts > G.highestSeri) G.highestSeri = pts; G.acilisDegeri[0] = pts + " ile açtı";
          if(isFirstOpen) checkAndApplyBonus(0, 'seri', pts);
          hideAcPanel(); addExtraTime(); renderAll(); renderTable(); updBtns(); updAcilisStatus(); setMsg('Açıldın! '+pts+'p.'); checkElBitti();
          if(isMultiplayer) saveGameState();
          return; 
      } 
      else { applyPenalty(0, 81, 'Hatalı Açılış! +81 Ceza'); setMsg(`Hatalı Açılış: En az ${minSeri} sayı gerekli! +81 Puan.`); hideAcPanel(); return; }
  }
}

function findGroups(tiles){
  if(!tiles.length)return[]; if(isValidGroup(tiles))return[tiles]; const result=[], remaining=[...tiles];
  while(remaining.length>=3){ let found=false; for(let sz=remaining.length;sz>=3;sz--){ const combos=getCombinations(remaining,sz); for(const combo of combos){ if(isValidGroup(combo)){ result.push(combo); combo.forEach(t=>{const i=remaining.findIndex(x=>x.id===t.id);if(i>=0)remaining.splice(i,1);}); found=true;break; } } if(found)break; } if(!found)break; }
  if(remaining.length>0)return null; return result;
}

function findPairGroups(hand){
  const okeyler=hand.filter(t=>isOkey(t)), normal=hand.filter(t=>!isOkey(t)), pairs=[], usedIds=new Set();
  for(let i=0;i<normal.length;i++){ if(usedIds.has(normal[i].id))continue; for(let j=i+1;j<normal.length;j++){ if(usedIds.has(normal[j].id))continue; if(normal[i].c===normal[j].c&&normal[i].n===normal[j].n){ pairs.push([normal[i],normal[j]]); usedIds.add(normal[i].id);usedIds.add(normal[j].id); break; } } }
  const kalanNormal = normal.filter(t => !usedIds.has(t.id)).sort((a,b) => b.n - a.n); let okIdx = 0;
  for(let i=0;i<kalanNormal.length;i++){ if(okIdx < okeyler.length) { pairs.push([kalanNormal[i], okeyler[okIdx]]); usedIds.add(kalanNormal[i].id); okIdx++; } }
  while(okIdx + 1 < okeyler.length) { pairs.push([okeyler[okIdx], okeyler[okIdx+1]]); okIdx += 2; }
  return pairs;
}

function getCombinations(arr,k){
  if(k===arr.length)return[arr]; if(k===1)return arr.map(x=>[x]); const result=[];
  for(let i=0;i<=arr.length-k;i++){ const rest=getCombinations(arr.slice(i+1),k-1); rest.forEach(c=>result.push([arr[i],...c])); } return result;
}

function endEl(winner){
  if(turnTimer) clearInterval(turnTimer); const berabere=winner===-1, eldenBiten = winner >= 0 && !G.turnStartedOpen;

  let condCount = 0;
  if (winner >= 0) {
      if (G.okeyBiten) condCount++;
      if (G.acildi[winner] === 'cift' || G.cifteGidiyor[winner]) condCount++;
      if (eldenBiten) condCount++;
  }
  
  let mult = 1;
  if (condCount === 1) mult = 2;
  else if (condCount === 2) mult = 4;
  else if (condCount === 3) mult = 6;

  const roundPuan = [0,0,0,0];
  const durumStrings = ['','','',''];

  for(let p=0;p<4;p++){
    if(!berabere && p===winner){
        roundPuan[p] = condCount > 0 ? -200 : -100;
        durumStrings[p] = eldenBiten ? '🏆 Elden Bitti' : (G.okeyBiten ? '🏆 Okey Bitti' : '🏆 Bitti');
        continue;
    }
    if(!berabere && G.isEsli && p===(winner+2)%4){
        roundPuan[p] = 0;
        durumStrings[p] = 'Ortak yırttı';
        continue;
    }
    
    const hand=p===0?getHand():G.opp[p-1];
    let pCeza = 0;

    if(!G.acildi[p]){ 
        pCeza = G.cifteGidiyor[p] ? 200 : 100; 
        durumStrings[p] = G.cifteGidiyor[p] ? 'Çifte, Açamadı' : 'Açamadı';
    } else { 
        const handVals = hand.map(t=>tVal(t)); let sum = handVals.reduce((a,b)=>a+b, 0); 
        if (G.acildi[p] === 'cift' || G.cifteGidiyor[p]) sum *= 2; 
        pCeza = sum; 
        if (hand.some(t => isOkey(t))) pCeza += 100; 
        durumStrings[p] = `${hand.length} taş (${handVals.reduce((a,b)=>a+b,0)} sayı)`;
    }
    
    roundPuan[p] = pCeza * mult;
  }

  if(berabere) {
      for(let p=0; p<4; p++) {
          if(!G.acildi[p]) durumStrings[p] = G.cifteGidiyor[p] ? 'Çifte, Açamadı' : 'Açamadı';
          else {
             const hand = p===0 ? getHand() : G.opp[p-1];
             durumStrings[p] = `${hand.length} taş (${hand.reduce((a,b)=>a+tVal(b), 0)} sayı)`;
          }
      }
  }

  const totalElScore = roundPuan.map((pts, i) => pts + G.roundBonus[i] + G.roundPenalties[i]);

  G.history.push({
      el: G.curEl,
      puan: [...roundPuan],
      kafa: [...G.roundBonus],
      cezalar: [...G.roundPenalties],
      toplam: totalElScore,
      durum: [...durumStrings],
      mult: mult,
      winner: winner
  });
  
  for(let p=0;p<4;p++) {
      if(G.isEsli) {
          const tIdx = (p===0||p===2)?0:1;
          G.teamScores[tIdx] += roundPuan[p];
      } else {
          G.scores[p] += roundPuan[p]; 
      }
  }
  if(G.isEsli) { G.scores[0] = G.scores[2] = G.teamScores[0]; G.scores[1] = G.scores[3] = G.teamScores[1]; }
  
  showSkorModal();
}

function nextEl(){
  document.getElementById('skor-modal').classList.remove('show');
  if(G.curEl>=G.totalEl){ 
      let txt='', winText='', icon='';
      if(G.isEsli) {
          const weWin = G.teamScores[0] <= G.teamScores[1], draw = G.teamScores[0] === G.teamScores[1];
          icon = draw ? '🤝' : (weWin ? '🏆' : '😢'); winText = draw ? 'Berabere!' : (weWin ? 'Takımınız Kazandı!' : 'Rakip Takım Kazandı!');
          txt = `Bizim Takım: ${G.teamScores[0]} Puan\nRakip Takım: ${G.teamScores[1]} Puan`;
      } else {
          const sorted=[...G.scores.map((s,i)=>({s,i}))].sort((a,b)=>a.s-b.s), winner=sorted[0];
          icon=winner.i===0?'🏆':'😢'; winText=winner.i===0?'Kazandın!':G.names[winner.i]+' Kazandı!'; txt=G.scores.map((s,i)=>G.names[i]+': '+s+' Puan').join('\n');
      }
      document.getElementById('end-icon').textContent=icon;
      document.getElementById('end-title').textContent=winText;
      document.getElementById('end-text').textContent='Tüm eller tamamlandı.';
      if(document.getElementById('end-scores')) {
        window._lastScores = [...G.scores];
        document.getElementById('end-scores').innerHTML = G.scores.map((s,i)=>{
          const isMe=i===0, isWin=s===Math.min(...G.scores);
          return '<div style="display:flex;justify-content:space-between;padding:2px 0;'+(isMe?'color:#e8c84a;font-weight:700;':'')+(isWin?'color:#88ff88;':'')+'"><span>'+(isWin?'🏆 ':"")+G.names[i]+(isMe?' (Sen)':'')+'</span><span>'+s+' Puan</span></div>';
        }).join('');
      }
      document.getElementById('end-wrap').classList.add('show');
      saveGameStats();
      return; 
  }
  G.curEl++; deal();
}

function saveGameStats() {
  if(!currentUser || !isOnlineGame()) return;
  const scores = window._lastScores || (G&&G.scores); if(!scores) return;
  const myScore = scores[0], minScore = Math.min(...scores), isWin = myScore === minScore;
  let xpGain = 10; if(isWin) xpGain += 20; if(myScore === 0) xpGain += 15;
  const ratingChange = isWin ? 25 : -10;
  supa.from('profiles').select('*').eq('id', currentUser.id).single().then(({data}) => {
    if(!data) return;
    const newXp = (data.xp||0) + xpGain, newRating = Math.max(1000, (data.rating||1000) + ratingChange), newLevel = getLevel(newXp).level, oldLevel = getLevel(data.xp||0).level;
    supa.from('profiles').update({ online_games: (data.online_games||0)+1, online_wins: (data.online_wins||0)+(isWin?1:0), total_score: (data.total_score||0)+myScore, xp: newXp, rating: newRating, level: newLevel }).eq('id', currentUser.id).then(() => { if(newLevel > oldLevel) { const lvlInfo = getLevel(newXp); spawnFloatingText('🎉 Seviye Atladın! ' + getLevelBadge(newLevel) + ' ' + lvlInfo.name, '#e8c84a'); } });
    supa.from('game_history').insert({user_id:currentUser.id, result:isWin?'win':'lose', score_delta:myScore});
  });
}

function calcRackScore(){
  if(!G.okey)return{groups:[],total:0,pairs:[],validIds:new Set()}; const validGroups=[];
  for(let r=0;r<2;r++){ let run=[]; for(let s=0;s<NSLOTS;s++){ const t=G.grid[r][s]; if(t){ run.push(t); } else { if(run.length>=3 && isValidGroup(run)) validGroups.push([...run]); run=[]; } } if(run.length>=3 && isValidGroup(run)) validGroups.push([...run]); }
  let total=0; const detailParts=[], validIds=new Set();
  for(const grp of validGroups){ grp.forEach(t=>validIds.add(t.id)); const gPts=calcGroupPts(grp); total+=gPts; const norms=grp.filter(t=>!isOkey(t)), cs=new Set(norms.map(t=>t.c)), type=(cs.size===1&&norms.length>0)||norms.length===0?'Seri':'Per'; detailParts.push(type+' '+gPts+'p'); }
  const pairs=findPairGroups(getHand()), pairInfo=pairs.length>=Math.max(4, G.highestCift + 1)?` | ${pairs.length} çift ✓`:(pairs.length>0?` | ${pairs.length} çift`:'');
  const minSeri = Math.max(G.acilisPuan || 81, G.highestSeri + 1);
  const minCift = Math.max(4, G.highestCift + 1);
  const rackScoreEl = document.getElementById('rack-score');
  const rackDetailEl = document.getElementById('rack-score-detail');
  if (rackScoreEl) {
      rackScoreEl.textContent=total>0?(total+'p'):'—'; 
      rackScoreEl.style.color=(total>=minSeri||pairs.length>=minCift)?'#88ff88':'#e8c84a'; 
  }
  if (rackDetailEl) {
      rackDetailEl.textContent=detailParts.join(' | ')+pairInfo;
  }
  return{groups:validGroups.map(g=>({tiles:g,type:'auto'})),total,pairs,validIds};
}

function doSort(mode){
  sortMode=mode; document.getElementById('btn-diz').classList.toggle('on',mode==='diz'); document.getElementById('btn-cift').classList.toggle('on',mode==='cift');
  const hand=getHand();if(!hand.length)return; const sorted=mode==='cift'?smartSortCift(hand):smartSortDiz(hand); G.grid=emptyGrid();
  sorted.forEach((t,i)=>{if(i>=NSLOTS*2)return; const r=i<NSLOTS?0:1,s=i<NSLOTS?i:i-NSLOTS; G.grid[r][s]=t;}); renderRack();calcRackScore(); setMsg(mode==='cift'?'Çiftler dizildi.':'Taşlar seri/per dizildi.');
}

function smartSortDiz(hand){
  const okeyler=hand.filter(t=>isOkey(t)), normal=hand.filter(t=>!isOkey(t)), groups=findOptimalGroups(hand);
  const usedIds=new Set(groups.flatMap(g=>g.tiles).filter(t=>!isOkey(t)).map(t=>t.id)), usedOkeyTiles=groups.flatMap(g=>g.tiles).filter(t=>isOkey(t));
  const leftover=normal.filter(t=>!usedIds.has(t.id)), freeOkeys=okeyler.filter(o=>!usedOkeyTiles.some(u=>u.id===o.id)); const result=[]; groups.forEach((g,i)=>{result.push(...g.tiles);if(i<groups.length-1)result.push(null);}); if(groups.length&&leftover.length)result.push(null); result.push(...leftover,...freeOkeys); return result;
}

function smartSortCift(hand){
  const okeyler=hand.filter(t=>isOkey(t)), normal=hand.filter(t=>!isOkey(t)), pairs=[]; const usedIds=new Set();
  for(let i=0;i<normal.length;i++){ if(usedIds.has(normal[i].id))continue; for(let j=i+1;j<normal.length;j++){ if(usedIds.has(normal[j].id))continue; if(normal[i].c===normal[j].c&&normal[i].n===normal[j].n){ pairs.push([normal[i],normal[j]]); usedIds.add(normal[i].id);usedIds.add(normal[j].id);break; } } }
  pairs.sort((a,b)=>b[0].n-a[0].n); const leftover=normal.filter(t=>!usedIds.has(t.id)).sort((a,b)=>a.n-b.n), result=[];
  pairs.forEach((p,i)=>{result.push(...p);if(i<pairs.length-1)result.push(null);}); if(pairs.length&&leftover.length)result.push(null); result.push(...leftover,...okeyler); return result;
}

function doAutoAcSeri(){
  if(G.turn!==0||G.phase!=='discard'||G.acildi[0])return; const {groups,total}=calcRackScore(); const allTiles=groups.flatMap(g=>g.tiles); 
  if(G.mustUseTile && !allTiles.some(t => t.id === G.mustUseTile)) { setMsg('Yandan aldığınız taşı kullanarak açmalısınız. Lütfen el ile (Aç butonu) açınız.'); return; }
  const remainingCount = getHand().length - allTiles.length, isFinish = remainingCount <= 1;
  const minSeri = Math.max(G.acilisPuan, G.highestSeri + 1);
  if(!groups.length||(total<minSeri && !isFinish)){ setMsg('⚠ Seri açmak için en az '+minSeri+'p gerekli.');return; }
  const isFirstOpen = !G.acildi[0];
  if(isFirstOpen) { G.preOpenState = cloneState(); G.preOpenState.highestSeri = G.highestSeri; G.preOpenState.highestCift = G.highestCift; G.preOpenState.scores = [...G.scores]; G.preOpenState.teamScores = [...G.teamScores]; G.preOpenState.roundBonus = [...G.roundBonus]; }
  allTiles.forEach(t=>{for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;}}); groups.forEach(g=>G.tableGroups.push(g.tiles)); 
  G.acildi[0]='seri';acSelIds=[]; G.mustUseTile = null; G.mustOpenThisTurn = false; 
  if(total > G.highestSeri) G.highestSeri = total; G.acilisDegeri[0] = total + " ile açtı";
  if(isFirstOpen) checkAndApplyBonus(0, 'seri', total);
  addExtraTime(); renderAll();renderTable();updBtns();updAcilisStatus(); setMsg('✓ Seri ile otomatik açıldın! '+total+'p.'); document.getElementById('geri-al-btn').style.display=''; checkElBitti();
}

function doAutoAcCift(){
  if(G.turn!==0||G.phase!=='discard'||G.acildi[0])return; const {pairs}=calcRackScore(); const pairTiles=pairs.flat();
  if(G.mustUseTile && !pairTiles.some(t => t.id === G.mustUseTile)) { setMsg('Yandan aldığınız taşı çiftinizde kullanmalısınız!'); return; }
  const remainingCount = getHand().length - pairTiles.length, isFinish = remainingCount <= 1;
  const minCift = Math.max(4, G.highestCift + 1);
  if(pairs.length<minCift && !isFinish){ setMsg('⚠ Çifte açmak için en az '+minCift+' çift gerekli.');return; }
  const isFirstOpen = !G.acildi[0];
  if(isFirstOpen) { G.preOpenState = cloneState(); G.preOpenState.highestSeri = G.highestSeri; G.preOpenState.highestCift = G.highestCift; G.preOpenState.scores = [...G.scores]; G.preOpenState.teamScores = [...G.teamScores]; G.preOpenState.roundBonus = [...G.roundBonus]; }
  pairTiles.forEach(t=>{for(let r=0;r<2;r++)for(let s=0;s<NSLOTS;s++){if(G.grid[r][s]?.id===t.id)G.grid[r][s]=null;}}); pairs.forEach(p=>G.tableGroups.push(p)); 
  G.acildi[0]='cift';acSelIds=[]; G.mustUseTile = null; G.mustOpenThisTurn = false; 
  if(pairs.length > G.highestCift) G.highestCift = pairs.length; G.acilisDegeri[0] = pairs.length + " çiftle açtı";
  if(isFirstOpen) checkAndApplyBonus(0, 'cift', pairs.length);
  addExtraTime(); renderAll();renderTable();updBtns();updAcilisStatus(); setMsg('✓ ' + pairs.length + ' çift ile otomatik açıldın!'); document.getElementById('geri-al-btn').style.display=''; checkElBitti();
}

function doGeriAl(){
  if(!G.acildi[0] || G.turnStartedOpen || !G.preOpenState) return; if(!confirm('Açılışı geri almak +81 puan ekler. Emin misin?')) return;
  G.grid = G.preOpenState.grid; G.tableGroups = G.preOpenState.tableGroups; G.acildi[0] = false; 
  G.scores = [...G.preOpenState.scores]; G.teamScores = [...G.preOpenState.teamScores]; G.roundBonus = [...G.preOpenState.roundBonus];
  applyPenalty(0, 81, 'Açılış Geri Alındı! +81 Ceza');
  G.highestSeri = G.preOpenState.highestSeri; G.highestCift = G.preOpenState.highestCift; G.acilisDegeri[0] = null;
  G.preOpenState = null; G.islenenBuTur = 0; document.getElementById('geri-al-btn').style.display='none'; renderAll();renderTable();updBtns();updAcilisStatus();updScores(); setMsg('Açılış geri alındı! (Varsa kafa bonusu silindi)');
}

function splitChain(tiles){
  const n=tiles.length; if(n<=5)return[tiles]; if(n===6)return[tiles.slice(0,3),tiles.slice(3)]; if(n===7)return[tiles.slice(0,3),tiles.slice(3)]; if(n===8)return[tiles.slice(0,4),tiles.slice(4)];
  const res=[];let i=0; while(i<n){const left=n-i;if(left<=5){res.push(tiles.slice(i));break;}else if(left===6){res.push(tiles.slice(i,i+3));i+=3;}else{res.push(tiles.slice(i,i+5));i+=5;}} return res;
}

function allSeriCandidates(normal, okeyler){
  const res=[];
  for(const c of COLS){ 
    const byColorOrig=normal.filter(t=>t.c===c).sort((a,b)=>a.n-b.n),byColor=[],seen=new Set(); for(const t of byColorOrig){if(!seen.has(t.n)){seen.add(t.n);byColor.push(t);}}
    for(let i=0;i<byColor.length;i++){
      const chainInfo=[{tile:byColor[i],fakeN:byColor[i].n}]; let usedOk=0; let j=i+1;
      while(j<byColor.length){ const lastN=chainInfo[chainInfo.length-1].fakeN, gap=byColor[j].n-lastN-1; if(gap===0){chainInfo.push({tile:byColor[j],fakeN:byColor[j].n});j++;} else if(gap>0&&usedOk+gap<=okeyler.length){ for(let k=0;k<gap;k++) chainInfo.push({tile:okeyler[usedOk+k],fakeN:lastN+k+1}); usedOk+=gap; chainInfo.push({tile:byColor[j],fakeN:byColor[j].n});j++; } else break; }
      if(chainInfo.length>=3){ const tiles=chainInfo.map(x=>x.tile), pts=chainInfo.reduce((s,x)=>s+x.fakeN,0), ids=new Set(tiles.filter(t=>!isOkey(t)).map(t=>t.id)); res.push({tiles, okUsed:usedOk, pts, type:'seri', ids, chainInfo}); }
    }
  } return res;
}

function allPerCandidates(normal, okeyler){
  const res=[];
  for(let n=1;n<=13;n++){ const same=normal.filter(t=>t.n===n), uniq=[], seenC=new Set(); for(const t of same){if(!seenC.has(t.c)){seenC.add(t.c);uniq.push(t);}}
    if(uniq.length>=3){ const pts=uniq.reduce((s,t)=>s+t.n,0); res.push({tiles:uniq, okUsed:0, pts, type:'per', ids:new Set(uniq.map(t=>t.id))}); } 
    else if(uniq.length===2&&okeyler.length>=1){ const pts=uniq.reduce((s,t)=>s+t.n,0)+n; res.push({tiles:[...uniq,okeyler[0]], okUsed:1, pts, type:'per', ids:new Set(uniq.map(t=>t.id))}); }
  } return res;
}

function findOptimalGroups(hand){
  const okeyler=hand.filter(t=>isOkey(t)), normal=hand.filter(t=>!isOkey(t)), seriC=allSeriCandidates(normal, okeyler), perC=allPerCandidates(normal, okeyler), all=[...seriC,...perC].sort((a,b)=>b.pts-a.pts);
  const usedNormalIds=new Set(), result=[]; let usedOkeys=0;
  for(const cand of all){ const normalIds=[...cand.ids]; if(normalIds.some(id=>usedNormalIds.has(id)))continue; if(cand.okUsed>0&&usedOkeys+cand.okUsed>okeyler.length)continue;
    normalIds.forEach(id=>usedNormalIds.add(id)); usedOkeys+=cand.okUsed; let tiles=cand.tiles; if(cand.okUsed>0&&cand.type==='seri'&&cand.chainInfo) tiles=cand.chainInfo.map(x=>x.tile);
    if(cand.type==='seri') splitChain(tiles).forEach(g=>result.push({tiles:g,type:'seri'})); else result.push({tiles,type:'per'});
  } return result;
}