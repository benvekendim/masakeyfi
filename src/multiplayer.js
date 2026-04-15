// src/multiplayer.js

async function joinRoom(masaNo, settings) {
  const {data: rooms, error} = await supa.from('rooms').select('*').eq('masa_no', masaNo).single();
  if(error || !rooms) { console.error('Masa bulunamadı:', error); return false; }
  
  myRoomId = rooms.id;
  currentRoomData = rooms;
  const myName = (currentUser && currentProfile) ? currentProfile.username : (guestName || 'Misafir');
  
  let myUserId;
  if(currentUser) {
    myUserId = currentUser.id;
  } else {
    let guestId = localStorage.getItem('81okey_guest_id');
    if(!guestId) { guestId = 'guest-' + Date.now(); localStorage.setItem('81okey_guest_id', guestId); }
    myUserId = guestId;
  }
  
  for(let i = 0; i < 4; i++) {
    if(rooms['seat' + i + '_user'] === myUserId) { alert('Bu masada zaten oturuyorsunuz!'); return false; }
  }
  
  let bosSeat = -1;
  for(let i = 0; i < 4; i++) {
    if(!rooms['seat' + i + '_user']) { bosSeat = i; break; }
  }
  if(bosSeat === -1) { alert('Masa dolu!'); return false; }
  
  mySeat = bosSeat;
  isMasaKurucu = (bosSeat === 0);
  
  const update = {};
  update['seat' + bosSeat + '_user'] = myUserId;
  update['seat' + bosSeat + '_name'] = myName;
  
  if(isMasaKurucu && settings) {
    update.total_el = settings.totalEl;
    update.acilis_puan = settings.acilisPuan;
    update.normal_time = settings.normalTime;
    update.acik_time = settings.acikTime;
    update.oyun_turu = settings.oyunTuru;
    update.yardim_modu = settings.yardimModu;
    update.diff = settings.diff;
  }
  
  if(!isMasaKurucu && rooms.total_el) {
    G.totalEl = rooms.total_el;
    G.acilisPuan = rooms.acilis_puan || 81;
    G.normalTime = rooms.normal_time || 15;
    G.acikTime = rooms.acik_time || 30;
    G.diff = rooms.diff || 'medium';
    G.isEsli = rooms.oyun_turu === 'esli';
    G.yardim = rooms.yardim_modu !== 'yardimsiz';
  }
  
  const {error: updateError} = await supa.from('rooms').update(update).eq('id', myRoomId);
  if(updateError) { console.error('Koltuk alınamadı:', updateError); return false; }
  
  return true;
}

function amIHost() {
  if (!currentRoomData) return false;
  for(let i=0; i<4; i++) {
      const user = currentRoomData['seat'+i+'_user'];
      if (user && !user.startsWith('bot-')) {
          return mySeat === i;
      }
  }
  return false;
}

function isBotSeat(globalSeat) {
  if (!currentRoomData) return false;
  const user = currentRoomData['seat'+globalSeat+'_user'];
  return !user || user.startsWith('bot-'); 
}

function subscribeToRoom(roomId) {
  if(roomSub) supa.removeChannel(roomSub);
  roomSub = supa.channel('room-' + roomId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: 'id=eq.' + roomId }, 
    payload => { handleRoomUpdate(payload.new); }).subscribe();
}

function handleRoomUpdate(room) {
  currentRoomData = room;
  updateSeatDisplay(room);
  
  const names = [room.seat0_name, room.seat1_name, room.seat2_name, room.seat3_name]
    .map((n,i) => n || ('Oyuncu '+(i+1)));
  
  if(isMultiplayer && mySeat >= 0) {
    const myCurrentSeat = room['seat' + mySeat + '_user'];
    const myId = currentUser ? currentUser.id : localStorage.getItem('81okey_guest_id');
    if(myCurrentSeat === null && myId) {
      if(typeof turnTimer !== 'undefined') clearInterval(turnTimer);
      alert('Masadan çıkarıldınız!');
      window.close();
      return;
    }
  }
  
  if(room.status === 'playing' && room.game_state) {
    const deckEmpty = !G.deck || G.deck.length === 0;
    const notStarted = !G.gosterge;
    
    if((deckEmpty || notStarted) && room.game_state.seed) {
      hideWaitingScreen();
      G.names = names;
      names.forEach((n,i) => {
        const el = document.getElementById('n'+i); if(el) el.textContent = n;
        const sc = document.getElementById('sc-n'+i); if(sc) sc.textContent = n+':';
      });
      dealWithSeed(room.game_state.seed, names);
    }
    
    if (room.game_state.globalTurn !== undefined) {
        loadGameState(room.game_state);
    }

    if (G && G.phase && G.phase !== 'end' && amIHost()) {
        const currentGlobalTurn = (G.turn + mySeat) % 4;
        if (isBotSeat(currentGlobalTurn)) {
            if(window.botTimeout) clearTimeout(window.botTimeout);
            window.botTimeout = setTimeout(() => {
                if(G.turn !== 0 && isBotSeat((G.turn + mySeat) % 4)) {
                    botPlay(); 
                    saveGameState();
                }
            }, 1000);
        }
    }
  }
  
  if(room.status === 'finished') {
    if(typeof turnTimer !== 'undefined') clearInterval(turnTimer);
    setMsg('Oyun sona erdi.');
  }
}

function updateSeatDisplay(room) {
  if (mySeat < 0) return;
  const names = [
    room.seat0_name || (room.seat0_user && room.seat0_user.startsWith('bot-') ? 'Bot 1' : '— Boş —'),
    room.seat1_name || (room.seat1_user && room.seat1_user.startsWith('bot-') ? 'Bot 2' : '— Boş —'), 
    room.seat2_name || (room.seat2_user && room.seat2_user.startsWith('bot-') ? 'Bot 3' : '— Boş —'),
    room.seat3_name || (room.seat3_user && room.seat3_user.startsWith('bot-') ? 'Bot 4' : '— Boş —')
  ];
  
  for(let i = 1; i < 4; i++) {
    const globalSeat = (mySeat + i) % 4;
    const nameEl = document.getElementById('n' + i);
    if(nameEl) nameEl.textContent = names[globalSeat];
  }
}

async function saveGameState() {
  if(!isMultiplayer || !myRoomId) return;
  
  let hands = {}, discards = {}, acildiGlobal = {}, cifteGlobal = {}, acilisDegeriGlobal = {}, scoresGlobal = {};
  for(let i=0; i<4; i++) {
      const globalSeat = (mySeat + i) % 4;
      hands[globalSeat] = i === 0 ? getHand() : G.opp[i-1];
      discards[globalSeat] = i === 0 ? G.playerDisc : G.oppDisc[i-1];
      acildiGlobal[globalSeat] = G.acildi[i];
      cifteGlobal[globalSeat] = G.cifteGidiyor[i];
      acilisDegeriGlobal[globalSeat] = G.acilisDegeri[i];
      scoresGlobal[globalSeat] = G.scores[i];
  }

  const state = {
    deck: G.deck,
    hands: hands,
    discards: discards,
    tableGroups: G.tableGroups,
    acildi: acildiGlobal,
    cifteGidiyor: cifteGlobal,
    acilisDegeri: acilisDegeriGlobal,
    scoresGlobal: scoresGlobal,
    globalTurn: (G.turn + mySeat) % 4,
    phase: G.phase,
    gosterge: G.gosterge,
    okey: G.okey,
    turnEndTime: G.turnEndTime,
    last_action: Date.now(),
    last_seat: mySeat 
  };
  
  await supa.from('rooms').update({ game_state: state, current_turn: state.globalTurn }).eq('id', myRoomId);
}

function showWaitingScreen(masaNo, currentCount) {
  const existing = document.getElementById('waiting-screen');
  if(existing) existing.remove();
  
  const div = document.createElement('div');
  div.id = 'waiting-screen';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(6,32,51,.95);z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;';
  div.innerHTML = `
    <div style="font-size:48px;">⏳</div>
    <div style="font-size:24px;font-weight:900;color:#e8c84a;">Masa ${masaNo}</div>
    <div style="font-size:16px;color:rgba(255,255,255,.8);">Diğer oyuncular bekleniyor...</div>
    <div style="display:flex;gap:15px;margin:10px 0;" id="seat-indicators">
      ${[0,1,2,3].map(i => `
        <div id="seat-ind-${i}" style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.5);">
          <span style="font-size:20px;">${i === mySeat ? '😊' : '?'}</span>
          <span>${i === mySeat ? 'Sen' : 'Boş'}</span>
        </div>
      `).join('')}
    </div>
    <div style="font-size:13px;color:rgba(255,255,255,.5);">4 oyuncu dolunca oyun otomatik başlar</div>
    <button onclick="leaveRoom()" style="padding:10px 24px;background:rgba(255,0,0,.2);border:1px solid rgba(255,0,0,.4);color:#ff8888;border-radius:8px;font-size:13px;cursor:pointer;margin-top:10px;">Masadan Ayrıl</button>
  `;
  document.body.appendChild(div);
}

function hideWaitingScreen() {
  const el = document.getElementById('waiting-screen');
  if(el) el.remove();
}

async function leaveRoom() {
  if(!myRoomId || mySeat < 0) return;
  const update = {};
  let humanCount = 0;
  
  if(currentRoomData) {
      for(let i=0; i<4; i++) {
          const u = currentRoomData['seat'+i+'_user'];
          if(u && !u.startsWith('bot-')) humanCount++;
      }
  }
  
  if (humanCount <= 1) {
      update['status'] = 'waiting';
      update['game_state'] = null;
      for(let i=0; i<4; i++) { update['seat'+i+'_user'] = null; update['seat'+i+'_name'] = null; }
  } else {
      const isPlaying = G && G.phase && G.phase !== 'end' && currentRoomData?.status === 'playing';
      update['seat' + mySeat + '_user'] = isPlaying ? 'bot-' + mySeat : null;
      update['seat' + mySeat + '_name'] = isPlaying ? 'Bot ' + (mySeat+1) : null;
  }
  
  await supa.from('rooms').update(update).eq('id', myRoomId);
  
  lastMasaNo = currentMasaNo;
  myRoomId = null; mySeat = -1; isMultiplayer = false; currentRoomData = null;
  hideWaitingScreen();
  if(roomSub) { supa.removeChannel(roomSub); roomSub = null; }
  if(waitingInterval) { clearInterval(waitingInterval); waitingInterval = null; }
  window.close();
}

async function startMultiplayerGame(masaNo, settings) {
  const joined = await joinRoom(masaNo, settings);
  if(!joined) return;
  
  isMultiplayer = true;
  subscribeToRoom(myRoomId);
  subscribeToChatRoom('masa-' + masaNo);
  document.getElementById('chat-toggle').style.display = 'flex';
  document.getElementById('setup').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  showWaitingScreen(masaNo, 1);
  doResize();
  
  const checkInterval = setInterval(async () => {
    const {data: room} = await supa.from('rooms').select('*').eq('id', myRoomId).single();
    if(!room) { clearInterval(checkInterval); return; }
    currentRoomData = room;
    
    const seats = [room.seat0_user, room.seat1_user, room.seat2_user, room.seat3_user];
    const names = [room.seat0_name, room.seat1_name, room.seat2_name, room.seat3_name];
    const filledCount = seats.filter(s => s).length;
    
    seats.forEach((s, i) => {
      const ind = document.getElementById('seat-ind-' + i);
      if(ind && s) {
        ind.style.background = 'rgba(232,200,74,.2)';
        ind.style.borderColor = '#e8c84a';
        ind.innerHTML = `<span style="font-size:20px;">${i === mySeat ? '😊' : '👤'}</span><span style="font-size:9px;color:#e8c84a;">${names[i] || 'Oyuncu'}</span>`;
      }
    });
    
    if(filledCount === 4 && mySeat === 0 && room.status !== 'playing') {
      clearInterval(checkInterval);
      const realNames = names.map((n,i) => n || ('Oyuncu '+(i+1)));
      const seed = Date.now();
      await supa.from('rooms').update({
        status: 'playing',
        game_state: {seed: seed, started: true, names: realNames}
      }).eq('id', myRoomId);
      hideWaitingScreen();
      G.names = realNames;
      realNames.forEach((n,i) => {
        const el = document.getElementById('n'+i); if(el) el.textContent = n;
        const sc = document.getElementById('sc-n'+i); if(sc) sc.textContent = n+':';
      });
      dealWithSeed(seed, realNames);
    } else if(room.status === 'playing') {
      clearInterval(checkInterval);
      if(room.game_state && room.game_state.seed) {
        const rNames = [room.seat0_name, room.seat1_name, room.seat2_name, room.seat3_name].map((n,i) => n || ('Oyuncu '+(i+1)));
        hideWaitingScreen();
        G.names = rNames;
        rNames.forEach((n,i) => {
          const el = document.getElementById('n'+i); if(el) el.textContent = n;
          const sc = document.getElementById('sc-n'+i); if(sc) sc.textContent = n+':';
        });
        dealWithSeed(room.game_state.seed, rNames);
      }
    }
  }, 1000);
  waitingInterval = checkInterval;
}

function dealWithSeed(seed, names) {
  if(names) {
    G.names = names;
    names.forEach((n,i) => {
      const el = document.getElementById('n'+i); if(el) el.textContent = n;
      const sc = document.getElementById('sc-n'+i); if(sc) sc.textContent = n + ':';
    });
  }
  
  function seededRandom(seed) { let s = seed; return function() { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; }
  function seededShuffle(arr, rng) { const a = [...arr]; for(let i = a.length-1; i > 0; i--) { const j = Math.floor(rng() * (i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  
  const rng = seededRandom(seed);
  const deck = seededShuffle(makeDeck(), rng);
  
  let gostIdx; do { gostIdx = Math.floor(rng() * deck.length); } while(deck[gostIdx].jok);
  const gosterge = deck.splice(gostIdx, 1)[0];
  G.gosterge = gosterge; G.okey = getOkey(gosterge);
  deck.unshift(gosterge);
  deck.forEach(t => { if(t.jok) { t.c = G.okey.c; t.n = G.okey.n; } });
  
  const tempDeck = [...deck];
  const seat0Tiles = [], seat1Tiles = [], seat2Tiles = [], seat3Tiles = [];
  for(let i=0; i<15; i++) seat0Tiles.push(tempDeck.pop());
  for(let i=0; i<14; i++) seat1Tiles.push(tempDeck.pop());
  for(let i=0; i<14; i++) seat2Tiles.push(tempDeck.pop());
  for(let i=0; i<14; i++) seat3Tiles.push(tempDeck.pop());
  
  G.deck = tempDeck; G.grid = emptyGrid(); G.opp = [[],[],[]];
  G.disc = []; G.sel = null; G.phase = 'discard'; G.turn = 0; G.turnEndTime = null;
  G.playerDisc = []; G.oppDisc = [[],[],[]]; G.hiddenOkeys = new Set();
  G.acildi = [false,false,false,false]; G.mustUseTile = null; G.mustOpenThisTurn = false;
  G.tableGroups = []; G.eldenBiten = false; G.okeyBiten = false; acSelIds = [];
  G.turnStartedOpen = false; G.islenenBuTur = 0; G.preOpenState = null;
  G.cifteGidiyor = [false,false,false,false]; G.pendingTile = null;
  G.highestSeri = G.acilisPuan - 1; G.highestCift = 3; G.acilisDegeri = [null,null,null,null];
  G.roundBonus = [0,0,0,0]; G.roundPenalties = [0,0,0,0];
  
  const myTiles = [seat0Tiles, seat1Tiles, seat2Tiles, seat3Tiles][mySeat] || seat0Tiles;
  myTiles.forEach((t,i) => { const r = i < 8 ? 0 : 1; const s = i < 8 ? i : i - 8; G.grid[r][s] = t; });
  
  const oppTiles = [];
  for(let i = 0; i < 3; i++) {
    const seatIdx = (mySeat + i + 1) % 4;
    const tiles = [seat0Tiles, seat1Tiles, seat2Tiles, seat3Tiles][seatIdx];
    oppTiles.push(tiles || []);
  }
  G.opp = oppTiles.map(t => t.map(x => ({...x})));
  
  document.getElementById('el-chip').textContent = 'El: ' + G.curEl + '/' + G.totalEl;
  document.getElementById('okey-bar').textContent = 'Okey: ' + CLONG[G.okey.c] + ' ' + G.okey.n;
  
  renderGosterge(); renderAll(); setMsg('Oyun başladı! Sıranı bekle.'); updTurn(); updBtns(); updAcilisStatus(); 
  G.turnEndTime = Date.now() + (G.normalTime * 1000); 
  startTimer();
}

function loadGameState(state) {
  if(!state || state.globalTurn === undefined) return;
  if(state.last_seat === mySeat) return; 

  G.deck = state.deck || [];
  G.tableGroups = state.tableGroups || [];
  if(state.gosterge) G.gosterge = state.gosterge;
  if(state.okey) G.okey = state.okey;

  for(let i=0; i<4; i++) {
      const globalSeat = (mySeat + i) % 4;
      if (i !== 0) G.opp[i-1] = state.hands[globalSeat] || [];
      if (i === 0) G.playerDisc = state.discards[globalSeat] || []; else G.oppDisc[i-1] = state.discards[globalSeat] || [];

      G.acildi[i] = state.acildi[globalSeat] || false;
      G.cifteGidiyor[i] = state.cifteGidiyor[globalSeat] || false;
      G.acilisDegeri[i] = state.acilisDegeri[globalSeat] || null;
      G.scores[i] = state.scoresGlobal[globalSeat] || 0;
  }

  G.turn = (state.globalTurn - mySeat + 4) % 4;
  G.phase = state.phase;

  renderAll(); updTurn(); updBtns(); updAcilisStatus();
  
  for(let i=1; i<4; i++) {
      if (G.acildi[i] && G.opp[i-1] && G.opp[i-1].length === 0 && G.phase === 'draw') { endEl(i); }
  }
  
  if (state.turnEndTime) {
      G.turnEndTime = state.turnEndTime;
      G.turnEndTime = Date.now() + (G.normalTime * 1000); 
      startTimer();
  }

  if (isMultiplayer && isBotSeat(state.globalTurn) && amIHost()) {
      if(window.botTimeout) clearTimeout(window.botTimeout);
      window.botTimeout = setTimeout(() => {
          if (G.turn !== 0 && isBotSeat((G.turn + mySeat) % 4)) {
              botPlay(); saveGameState();
          }
      }, 1200);
  }
}

function updateMasaDurum(masaNo) {
  const el = document.getElementById('lobby-masa-durum'); if(!el) return;
  if(masaNo) { el.textContent = '🎮 Masa ' + masaNo + '\'de oynuyor'; el.style.display = 'block'; } else { el.style.display = 'none'; }
}

function showLobby() {
  document.getElementById('auth-screen').style.display = 'none'; document.getElementById('lobby').style.display = 'flex';
  const nameEl = document.getElementById('lobby-username'), scoreEl = document.getElementById('lobby-score'), avEl = document.getElementById('lobby-avatar'), logoutBtn = document.getElementById('logout-btn'), guestGirisBtn = document.getElementById('guest-giris-btn'), guestCikisBtn = document.getElementById('guest-cikis-btn'), profilBtn = document.getElementById('profil-btn'), isAnon = currentUser && currentUser.is_anonymous;
  if(currentUser && currentProfile && !isAnon) {
    const lvl = getLevel(currentProfile.xp||0);
    nameEl.textContent = getLevelBadge(lvl.level) + ' ' + currentProfile.username;
    scoreEl.textContent = '⚡ ' + (currentProfile.rating||1000) + ' | Seviye ' + lvl.level + ' ' + lvl.name;
    avEl.textContent = currentProfile.username.charAt(0).toUpperCase();
    logoutBtn.style.display = ''; if(guestGirisBtn) guestGirisBtn.style.display = 'none'; if(guestCikisBtn) guestCikisBtn.style.display = 'none'; if(profilBtn) profilBtn.style.display = '';
  } else {
    const name = (isAnon && currentProfile) ? currentProfile.username : (guestName || 'Misafir');
    nameEl.textContent = '👤 ' + name; scoreEl.textContent = 'Misafir — XP kazanılmaz';
    avEl.textContent = name.charAt(0).toUpperCase();
    logoutBtn.style.display = 'none'; if(profilBtn) profilBtn.style.display = 'none'; if(guestGirisBtn) guestGirisBtn.style.display = ''; if(guestCikisBtn) guestCikisBtn.style.display = '';
  }
  initLobby();
}

async function showProfile() {
  if(!currentUser) { alert('Profil için giriş yapın.'); return; }
  const {data} = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
  if(!data) { alert('Profil yüklenemedi.'); return; }
  currentProfile = data;
  const xp = data.xp||0, rating = data.rating||1000, lvl = getLevel(xp), nextLvl = getNextLevel(xp), onlineGames = data.online_games||0, onlineWins = data.online_wins||0, wr = onlineGames ? Math.round(onlineWins/onlineGames*100) : 0, xpProgress = nextLvl ? Math.round((xp-lvl.min)/(nextLvl.min-lvl.min)*100) : 100;
  document.getElementById('profile-content').innerHTML = `
    <div style="text-align:center;margin-bottom:14px;"><div style="font-size:36px;margin-bottom:4px;">${getLevelBadge(lvl.level)}</div><div style="font-size:20px;font-weight:900;color:#e8c84a;">${data.username}</div><div style="font-size:13px;color:#aaa;margin-top:2px;">Seviye ${lvl.level} — ${lvl.name}</div></div>
    <div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:4px;"><span>XP: ${xp}</span><span>${nextLvl ? nextLvl.name+' için '+nextLvl.min+' XP' : '🌟 Maks Seviye'}</span></div><div style="background:rgba(255,255,255,.1);border-radius:6px;height:8px;overflow:hidden;"><div style="background:linear-gradient(90deg,#e8c84a,#ff8c00);height:100%;width:${xpProgress}%;border-radius:6px;"></div></div></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.8);"><span>⚡ Rating</span><b style="color:#e8c84a;">${rating}</b></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.8);"><span>🎮 Online Oyun</span><b>${onlineGames}</b></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.8);"><span>🏆 Online Kazanma</span><b style="color:#88ff88;">${onlineWins}</b></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.8);"><span>📊 Kazanma Oranı</span><b>${wr}%</b></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:rgba(255,255,255,.8);"><span>📅 Üyelik</span><b>${new Date(data.created_at).toLocaleDateString('tr-TR')}</b></div>
  `;
  document.getElementById('profile-modal').style.display = 'flex';
}

function pickMod(mod) { gameMode = mod; document.getElementById('mod-online').classList.toggle('on', mod==='online'); document.getElementById('mod-bot').classList.toggle('on', mod==='bot'); }

function izleMasa(masaNo) {
  currentMasaNo = masaNo; currentRoomId = 'masa-' + masaNo; isSpectating = true;
  document.getElementById('lobby').style.display = 'none'; document.getElementById('game').style.display = 'flex';
  document.getElementById('mode-badge').textContent = '👁 İzleme — Masa ' + masaNo; document.getElementById('mode-badge').style.display = 'block';
  setTimeout(() => { document.querySelectorAll('.rack-outer').forEach(el => el.style.visibility='hidden'); document.querySelectorAll('.acts-col').forEach(el => el.style.visibility='hidden'); showSpectatorOturBtn(); }, 200);
  subscribeToChatRoom(currentRoomId); document.getElementById('chat-toggle').style.display = 'flex'; setMsg('İzleme modundasın. Boş koltuğa oturabilirsin.'); doResize();
}

function showSpectatorOturBtn() {
  let oturDiv = document.getElementById('spec-otur-bar');
  if(!oturDiv) { oturDiv = document.createElement('div'); oturDiv.id = 'spec-otur-bar'; oturDiv.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.85);border:2px solid #e8c84a;border-radius:12px;padding:10px 20px;'; oturDiv.innerHTML = '<span style="font-size:13px;color:#e8c84a;font-weight:700;">Boş koltuk var!</span><button onclick="izlemeciyiOturt()" style="padding:8px 20px;background:#e8c84a;color:#1a1a00;border:none;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;">▶ Masaya Otur</button><button onclick="kaldirOturBar()" style="padding:8px 12px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;font-size:12px;cursor:pointer;">İzlemeye Devam Et</button>'; document.body.appendChild(oturDiv); }
  oturDiv.style.display = 'flex';
}
function kaldirOturBar() { const el = document.getElementById('spec-otur-bar'); if(el) el.style.display = 'none'; }
function izlemeciyiOturt() { kaldirOturBar(); isSpectating = false; document.getElementById('mode-badge').textContent = '🌐 Çevrimiçi — Masa ' + currentMasaNo; document.querySelectorAll('.rack-outer').forEach(el => el.style.visibility='visible'); document.querySelectorAll('.acts-col').forEach(el => el.style.visibility='visible'); setMsg('Masaya oturdunuz! Sıranızı bekleyin...'); }
function toggleChat() { chatOpen = !chatOpen; document.getElementById('chat-panel').style.transform = chatOpen ? 'translateX(0)' : 'translateX(100%)'; }

async function sendChatMsg() {
  const inp = document.getElementById('chat-input'), txt = inp.value.trim(); if(!txt || !currentRoomId) return; inp.value = '';
  const name = currentUser ? (currentProfile?.username||'Üye') : guestName;
  await supa.from('messages').insert({ room_id: currentRoomId, user_id: currentUser?.id || null, guest_name: currentUser ? null : name, content: txt });
}

function subscribeToChatRoom(roomId) { if(chatSub) supa.removeChannel(chatSub); chatSub = supa.channel('chat-'+roomId).on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',filter:'room_id=eq.'+roomId}, p => addChatMsg(p.new)).subscribe(); }

function addChatMsg(msg) {
  const isMe = currentUser && msg.user_id === currentUser.id, name = msg.guest_name || (currentProfile?.username||'Üye'), div = document.createElement('div');
  div.style.cssText = 'background:rgba(0,0,0,.3);border-radius:8px;padding:6px 9px;' + (isMe?'background:rgba(14,61,34,.6);':''); div.innerHTML = `<div style="font-size:10px;font-weight:700;color:${isMe?'#88ff88':'#e8c84a'};margin-bottom:2px;">${name}</div><div style="font-size:12px;color:rgba(255,255,255,.85);word-break:break-word;">${msg.content.replace(/</g,'&lt;')}</div>`;
  const msgs = document.getElementById('chat-messages'); msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function goToLobby() {
  document.getElementById('game').style.display = 'none';
  document.getElementById('end-wrap').classList.remove('show');
  document.getElementById('chat-toggle').style.display = 'none';
  document.getElementById('mode-badge').style.display = 'none';
  isSpectating = false;
  updateMasaDurum(null);
  const oturBar = document.getElementById('spec-otur-bar');
  if(oturBar) oturBar.style.display = 'none';
  chatOpen = false;
  document.getElementById('chat-panel').style.transform = 'translateX(100%)';
  currentRoomId = null;
  if(chatSub) { supa.removeChannel(chatSub); chatSub = null; }
  window.history.replaceState({}, document.title, window.location.pathname);
  document.getElementById('lobby').style.display = 'flex';
  if(currentUser) loadProfile().then(() => showLobby()); else showLobby();
}

async function lobiyeDon() {
  if(confirm('Masadan çıkmak istediğinize emin misiniz?')) {
    if(typeof turnTimer !== 'undefined') clearInterval(turnTimer); 
    if(typeof waitingInterval !== 'undefined' && waitingInterval) { clearInterval(waitingInterval); waitingInterval = null; }
    
    if(isMultiplayer && myRoomId && mySeat >= 0) {
      const update = {};
      let humanCount = 0;
      
      if(currentRoomData) {
          for(let i=0; i<4; i++) {
              const u = currentRoomData['seat'+i+'_user'];
              if(u && !u.startsWith('bot-')) humanCount++;
          }
      }
      
      if (humanCount <= 1) { 
          update['status'] = 'waiting';
          update['game_state'] = null;
          for(let i=0; i<4; i++) { update['seat'+i+'_user'] = null; update['seat'+i+'_name'] = null; }
      } else { 
          const isPlaying = G && G.phase && G.phase !== 'end' && currentRoomData?.status === 'playing';
          update['seat' + mySeat + '_user'] = isPlaying ? 'bot-' + mySeat : null;
          update['seat' + mySeat + '_name'] = isPlaying ? 'Bot ' + (mySeat+1) : null;
      }
      
      await supa.from('rooms').update(update).eq('id', myRoomId);
    }
    
    lastMasaNo = currentMasaNo;
    myRoomId = null; mySeat = -1; isMultiplayer = false; currentRoomData = null;
    if(typeof roomSub !== 'undefined' && roomSub) { supa.removeChannel(roomSub); roomSub = null; }
    
    if(typeof hideWaitingScreen === 'function') hideWaitingScreen();
    document.getElementById('game').style.display = 'none';
    document.getElementById('mode-badge').style.display = 'none';
    document.getElementById('chat-toggle').style.display = 'none';
    isSpectating = false;
    updateMasaDurum(null);
    const oturBar = document.getElementById('spec-otur-bar');
    if(oturBar) oturBar.style.display = 'none';
    chatOpen = false;
    document.getElementById('chat-panel').style.transform = 'translateX(100%)';
    currentRoomId = null;
    
    window.history.replaceState({}, document.title, window.location.pathname);
    
    document.getElementById('lobby').style.display = 'flex';
    if(currentUser) loadProfile().then(() => { showLobby(); showGeriDonBtn(lastMasaNo); });
    else { showLobby(); showGeriDonBtn(lastMasaNo); }
  }
}

function showGeriDonBtn(masaNo) {
  if(!masaNo) return; let bar = document.getElementById('geri-don-bar');
  if(!bar) { bar = document.createElement('div'); bar.id = 'geri-don-bar'; bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,100,50,.9);border-bottom:2px solid #88ff88;padding:8px 16px;display:flex;align-items:center;gap:10px;z-index:600;'; document.body.appendChild(bar); }
  bar.innerHTML = `<span style="font-size:13px;color:#88ff88;font-weight:700;">Masa ${masaNo} — tekrar katılmak ister misin?</span><button onclick="geriDonMasaya(${masaNo})" style="padding:5px 16px;background:#22aa55;border:1.5px solid #88ff88;color:#fff;border-radius:7px;font-size:12px;font-weight:800;cursor:pointer;">↩ Geri Dön</button><button onclick="izleMasaYeniSekme(${masaNo})" style="padding:5px 14px;background:rgba(232,200,74,.2);border:1.5px solid #e8c84a;color:#e8c84a;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;">👁 İzle</button><button onclick="document.getElementById('geri-don-bar').style.display='none'" style="margin-left:auto;padding:4px 10px;background:none;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.6);border-radius:6px;font-size:11px;cursor:pointer;">Kapat</button>`; bar.style.display = 'flex';
}

function geriDonMasaya(masaNo) { const bar = document.getElementById('geri-don-bar'); if(bar) bar.style.display = 'none'; const url = new URL(window.location.href); url.searchParams.set('masa', masaNo); url.searchParams.set('mode', 'online'); localStorage.setItem('81okey_guest', guestName || ''); localStorage.setItem('81okey_gamemode', 'online'); window.open(url.toString(), '_blank'); }

async function initLobby() {
    const grid = document.getElementById('tables-grid');
    grid.innerHTML = '<div style="color:rgba(255,255,255,.4);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Masalar yükleniyor...</div>';
    
    const {data: rooms} = await supa.from('rooms').select('*').order('masa_no');
    const roomMap = {};
    if(rooms) rooms.forEach(r => roomMap[r.masa_no] = r);
    
    grid.innerHTML = '';
    
    let myUserId = currentUser ? currentUser.id : localStorage.getItem('81okey_guest_id');
    let currentlyPlayingMasa = null;
    
    for(let i=1; i<=40; i++) {
        const room = roomMap[i];
        const seats = room ? [
            {user: room.seat0_user, name: room.seat0_name},
            {user: room.seat1_user, name: room.seat1_name},
            {user: room.seat2_user, name: room.seat2_name},
            {user: room.seat3_user, name: room.seat3_name}
        ] : [{},{},{},{}];
        
        const doluSayisi = seats.filter(s => s.user && !s.user.startsWith('bot-')).length;
        
        if (room && (room.seat0_user === myUserId || room.seat1_user === myUserId || room.seat2_user === myUserId || room.seat3_user === myUserId)) {
            currentlyPlayingMasa = room.masa_no;
        }

        const now = Date.now();
        const gameState = room ? room.game_state : null;
        const lastAction = gameState && gameState.last_action ? gameState.last_action : now;
        const isFrozen = (now - lastAction) > 120000; 

        if (room && room.status === 'playing' && (doluSayisi === 0 || isFrozen)) {
            supa.from('rooms').update({
                status: 'waiting', game_state: null, current_turn: 0,
                seat0_user: null, seat0_name: null, seat1_user: null, seat1_name: null,
                seat2_user: null, seat2_name: null, seat3_user: null, seat3_name: null
            }).eq('id', room.id).then(()=>{});
            
            room.status = 'waiting';
            for(let k=0; k<4; k++) { seats[k].user = null; seats[k].name = null; }
        }

        const status = room ? room.status : 'waiting';
        const colors = ['#e8c84a','#88ccff','#ff8888','#88ff88'];
        
        function makeSeatBtn(seat, posClass, idx) {
            if(seat.user && !seat.user.startsWith('bot-')) {
                const initial = (seat.name||'?').charAt(0).toUpperCase();
                const c = colors[idx];
                return '<div class="oyna-btn '+posClass+'" style="background:'+c+'22;border-color:'+c+';color:'+c+';font-size:11px;flex-direction:column;gap:1px;cursor:default;" title="'+(seat.name||'Oyuncu')+'"><span style="font-size:18px;font-weight:900;">'+initial+'</span><span style="font-size:8px;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(seat.name||'').split(' ')[0]+'</span></div>';
            } else if(seat.user && seat.user.startsWith('bot-')) {
                return '<div class="oyna-btn '+posClass+'" style="background:rgba(128,0,128,.2);border-color:#a020a0;color:#cc88ff;cursor:default;" title="Bot">🤖</div>';
            } else {
                return '<div class="oyna-btn '+posClass+'" onclick="openSetup('+i+')">OYNA</div>';
            }
        }
        
        const badge = status === 'playing'
            ? '<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#22aa44;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;white-space:nowrap;z-index:10;">🎮 Oyunda</div>'
            : doluSayisi > 0
            ? '<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#e8c84a;color:#1a1a00;font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;white-space:nowrap;z-index:10;">'+doluSayisi+'/4 Oyuncu</div>'
            : '';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'masa-wrapper';
        wrapper.style.cssText = 'position:relative;padding-bottom:28px;padding-top:12px;';
        wrapper.innerHTML = badge +
            '<div class="masa-board"><span>Masa '+i+'</span><small>'+(doluSayisi > 0 ? doluSayisi+'/4' : 'Boş')+'</small></div>' +
            makeSeatBtn(seats[0], 'seat-top', 0) +
            makeSeatBtn(seats[1], 'seat-bottom', 1) +
            makeSeatBtn(seats[2], 'seat-left', 2) +
            makeSeatBtn(seats[3], 'seat-right', 3) +
            '<div style="position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);font-size:10px;padding:3px 10px;border-radius:10px;cursor:pointer;white-space:nowrap;" onclick="izleMasaYeniSekme('+i+')">👁 İzle</div>';
        grid.appendChild(wrapper);
    }
    
    updateMasaDurum(currentlyPlayingMasa);
    
    if(!window._lobiRefreshInterval) {
        window._lobiRefreshInterval = setInterval(() => {
            if(document.getElementById('lobby').style.display !== 'none') initLobby();
        }, 10000);
    }
}

async function openSetup(masaNo) {
    currentMasaNo = masaNo || 1;
    isSpectating = false;
    const oturBar = document.getElementById('spec-otur-bar');
    if(oturBar) oturBar.style.display = 'none';
    
    if(gameMode !== 'online') {
      if(currentUser && currentProfile) document.getElementById('pname').value = currentProfile.username;
      else if(guestName) document.getElementById('pname').value = guestName;
      const url = new URL(window.location.href);
      url.searchParams.set('masa', currentMasaNo);
      url.searchParams.set('mode', gameMode);
      localStorage.setItem('81okey_guest', guestName || '');
      localStorage.setItem('81okey_gamemode', gameMode);
      window.open(url.toString(), '_blank');
      return;
    }
    
    const {data: room} = await supa.from('rooms').select('*').eq('masa_no', masaNo).single();
    
    if(!room) { alert('Masa bulunamadı!'); return; }
    
    const seat0Bos = !room.seat0_user;
    
    if(seat0Bos) {
      if(currentUser && currentProfile) document.getElementById('pname').value = currentProfile.username;
      else if(guestName) document.getElementById('pname').value = guestName;
      const url = new URL(window.location.href);
      url.searchParams.set('masa', currentMasaNo);
      url.searchParams.set('mode', 'online');
      localStorage.setItem('81okey_guest', guestName || '');
      localStorage.setItem('81okey_gamemode', 'online');
      window.open(url.toString(), '_blank');
    } else {
      localStorage.setItem('81okey_guest', guestName || '');
      localStorage.setItem('81okey_gamemode', 'online');
      const url = new URL(window.location.href);
      url.searchParams.set('masa', currentMasaNo);
      url.searchParams.set('mode', 'katilimci');
      window.open(url.toString(), '_blank');
    }
}

function izleMasaYeniSekme(masaNo) {
    const url = new URL(window.location.href);
    url.searchParams.set('masa', masaNo);
    url.searchParams.set('mode', 'izle');
    localStorage.setItem('81okey_guest', guestName || '');
    window.open(url.toString(), '_blank');
}

function closeSetup() {
    document.getElementById('setup').style.display = 'none';
}