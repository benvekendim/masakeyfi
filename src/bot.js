// src/bot.js

function botPlay(){
  if(G.turn===0)return; const p=G.turn-1,hand=G.opp[p];
  if(!G.deck.length){endEl(-1);return;} const drawn=G.deck.pop(); if(G.gosterge&&drawn.id===G.gosterge.id) setMsg(G.names[G.turn]+' gösterge taşı çekti!'); hand.push(drawn); 
  if(!G.acildi[G.turn]){ 
      const minSeri = Math.max(G.acilisPuan, G.highestSeri + 1);
      const minCift = Math.max(4, G.highestCift + 1);
      
      if(!G.cifteGidiyor[G.turn]) {
          const n=hand.filter(t=>!isOkey(t)), optimal=findOptimalGroups(n), totalPts = optimal ? optimal.reduce((acc,g)=>acc+calcGroupPts(g.tiles),0) : 0; 
          if(totalPts>=minSeri) { 
              G.acildi[G.turn]='seri'; 
              if(totalPts > G.highestSeri) G.highestSeri = totalPts; G.acilisDegeri[G.turn] = totalPts + " ile açtı"; updAcilisStatus();
              checkAndApplyBonus(G.turn, 'seri', totalPts);
              optimal.forEach(g => { g.tiles.forEach(t => { const idx = hand.findIndex(x => x.id === t.id); if(idx !== -1) hand.splice(idx, 1); }); G.tableGroups.push(g.tiles); }); 
          } 
          else { 
              const pairs=findPairGroups(hand); 
              if (pairs.length >= minCift) { 
                  G.acildi[G.turn]='cift'; 
                  if(pairs.length > G.highestCift) G.highestCift = pairs.length; G.acilisDegeri[G.turn] = pairs.length + " çiftle açtı"; updAcilisStatus();
                  checkAndApplyBonus(G.turn, 'cift', pairs.length);
                  const pToOpen = pairs; pToOpen.forEach(pair => { pair.forEach(t => { const idx = hand.findIndex(x => x.id === t.id); if(idx !== -1) hand.splice(idx, 1); }); G.tableGroups.push(pair); }); 
              } 
          }
      } else {
          const pairs=findPairGroups(hand); 
          if (pairs.length >= minCift) { 
              G.acildi[G.turn]='cift'; 
              if(pairs.length > G.highestCift) G.highestCift = pairs.length; G.acilisDegeri[G.turn] = pairs.length + " çiftle açtı"; updAcilisStatus();
              checkAndApplyBonus(G.turn, 'cift', pairs.length);
              const pToOpen = pairs; pToOpen.forEach(pair => { pair.forEach(t => { const idx = hand.findIndex(x => x.id === t.id); if(idx !== -1) hand.splice(idx, 1); }); G.tableGroups.push(pair); }); 
          }
      }
  } else {
      let islendi = false;
      do { islendi = false;
          for(let i=0; i<hand.length; i++) { const tile = hand[i];
              for(let gi=0; gi<G.tableGroups.length; gi++) { const grp = G.tableGroups[gi], swapIdx = getOkeySwapIndex(grp, tile);
                  if(swapIdx !== -1) { const okeyTile = grp[swapIdx]; grp[swapIdx] = tile; hand.splice(i, 1); hand.push(okeyTile); islendi = true; break; }
                  if(canAddToGroup(grp, tile, 'end')) { grp.push(tile); hand.splice(i, 1); islendi = true; break; }
                  if(canAddToGroup(grp, tile, 'start')) { grp.unshift(tile); hand.splice(i, 1); islendi = true; break; }
              } if(islendi) break;
          }
      } while(islendi);
      if (G.acildi[G.turn] === 'cift') { const newPairs = findPairGroups(hand); if (newPairs && newPairs.length > 0) { newPairs.forEach(p => { p.forEach(t => { const idx = hand.findIndex(x => x.id === t.id); if(idx !== -1) hand.splice(idx, 1); }); G.tableGroups.push(p); }); } } 
      else { const newGroups = findOptimalGroups(hand); if (newGroups && newGroups.length > 0) { newGroups.forEach(g => { g.tiles.forEach(t => { const idx = hand.findIndex(x => x.id === t.id); if(idx !== -1) hand.splice(idx, 1); }); G.tableGroups.push(g.tiles); }); } }
  }
  let wi=0,wv=-1;for(let i=0;i<hand.length;i++){if(isOkey(hand[i]))continue;if(hand[i].n>wv){wv=hand[i].n;wi=i;}}
  const atilan=hand.splice(wi,1)[0]; G.disc.push(atilan); G.oppDisc[p].push(atilan); renderAll();setMsg(G.names[G.turn]+' oynadı.');
  if(G.acildi[G.turn]&&hand.length<=0){ G.okeyBiten = isOkey(atilan); endEl(G.turn); return; } nextTurn();
}