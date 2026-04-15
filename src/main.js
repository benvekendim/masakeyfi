// src/main.js

window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search), masaParam = urlParams.get('masa'), modeParam = urlParams.get('mode');
  const {data:{session}} = await supa.auth.getSession();
  
  if(session) { 
      currentUser = session.user; 
      await loadProfile(); 
      if(session.user.is_anonymous && currentProfile) { 
          guestName = currentProfile.username; 
      } 
  } else { 
      const savedGuest = localStorage.getItem('81okey_guest'); 
      if(savedGuest) guestName = savedGuest; 
  }
  
  if(masaParam) {
    currentMasaNo = parseInt(masaParam); 
    gameMode = localStorage.getItem('81okey_gamemode') || modeParam || 'online';
    document.getElementById('auth-screen').style.display = 'none'; 
    document.getElementById('lobby').style.display = 'none';
    
    if(modeParam === 'izle') { 
        document.getElementById('game').style.display = 'flex'; 
        setTimeout(() => izleMasa(currentMasaNo), 100); 
    } 
    else if(modeParam === 'katilimci') {
      document.getElementById('game').style.display = 'none';
      if(currentUser || guestName) {
        gameMode = 'online'; 
        const defSettings = {totalEl:5,acilisPuan:81,normalTime:15,acikTime:30,oyunTuru:'bireysel',yardimModu:'yardimli',diff:'medium'}; 
        const pn = (currentUser && currentProfile) ? currentProfile.username : (guestName || 'Oyuncu');
        G = {diff:'medium',totalEl:5,acilisPuan:81,curEl:1,scores:[0,0,0,0],teamScores:[0,0], isEsli:false,yardim:true,names:[pn,'Oyuncu 1','Oyuncu 2','Oyuncu 3'], normalTime:15,acikTime:30,timeLeft:0,mustUseTile:null,mustOpenThisTurn:false, deck:[],disc:[],grid:[[],[]],opp:[[],[],[]],okey:null,gosterge:null,turn:0, turnEndTime:null, phase:'discard',sel:null,acildi:[false,false,false,false],tableGroups:[], playerDisc:[],oppDisc:[[],[],[]],hiddenOkeys:new Set(),eldenBiten:false, okeyBiten:false,turnStartedOpen:false,islenenBuTur:0,preOpenState:null, cifteGidiyor:[false,false,false,false],pendingTile:null, highestSeri:80,highestCift:3,acilisDegeri:[null,null,null,null], history:[],roundBonus:[0,0,0,0],roundPenalties:[0,0,0,0]};
        document.getElementById('n0').textContent = pn; 
        document.getElementById('game').style.display = 'flex'; 
        const badge = document.getElementById('mode-badge'); 
        badge.textContent = '🌐 Çevrimiçi — Masa ' + currentMasaNo; 
        badge.style.display = 'block'; 
        document.getElementById('disc-player').addEventListener('click',()=>{if(G.turn===0&&G.phase==='discard'&&G.sel) doDiscard(G.sel);}); 
        doResize(); 
        startMultiplayerGame(currentMasaNo, defSettings);
      } else { 
          document.getElementById('auth-screen').style.display = 'flex'; 
      }
    } else {
      document.getElementById('game').style.display = 'none';
      if(currentUser || guestName) { 
          document.getElementById('setup').style.display = 'flex'; 
          if(currentUser && currentProfile) document.getElementById('pname').value = currentProfile.username; 
          else if(guestName) document.getElementById('pname').value = guestName; 
      } else { 
          document.getElementById('auth-screen').style.display = 'flex'; 
      }
    }
  } else { 
      if(currentUser || guestName) { showLobby(); } 
  }
});

window.addEventListener('beforeunload', (e) => {
  if(isMultiplayer && myRoomId && mySeat >= 0) {
    const update = {};
    const isPlaying = G && G.phase && G.phase !== 'end' && currentRoomData?.status === 'playing';
    update['seat' + mySeat + '_user'] = isPlaying ? 'bot-' + mySeat : null;
    update['seat' + mySeat + '_name'] = isPlaying ? 'Bot ' + (mySeat+1) : null;
    
    const url = `${SUPA_URL}/rest/v1/rooms?id=eq.${myRoomId}`;
    fetch(url, {
        method: 'PATCH',
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(update),
        keepalive: true
    });
  }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && G && G.phase) {
        const now = Date.now();
        if (G.turnEndTime) {
            G.timeLeft = Math.ceil((G.turnEndTime - now) / 1000);
            
            updTimerUI(); 
            
            if (G.timeLeft <= 0) {
                if(G.turn === 0 && G.phase !== 'end') {
                    G.timeLeft = 0; 
                    if(turnTimer) clearInterval(turnTimer);
                    autoPlayHuman();
                }
            }
        }
    }
});