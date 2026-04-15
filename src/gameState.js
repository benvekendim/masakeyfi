// src/gameState.js

function startGame() {
  const diff = val('diffs') || 'medium';
  const totalEl = parseInt(val('elSayisi') || '5');
  const acilisPuan = parseInt(val('acilis') || '81');
  const normalTime = parseInt(val('normal-sure') || '15');
  const acikTime = parseInt(val('acik-sure') || '30');
  const pn = document.getElementById('pname').value.trim() || 'Oyuncu';
  const isEsli = val('oyunTuru') === 'esli'; 
  const yardim = val('yardimModu') !== 'yardimsiz';
  
  G = { 
    diff, totalEl, acilisPuan, curEl: 1, scores: [0,0,0,0], teamScores: [0,0], isEsli, yardim, names: [pn, 'Bot 1', 'Bot 2', 'Bot 3'], normalTime, acikTime, timeLeft: 0, mustUseTile: null, mustOpenThisTurn: false,
    deck: [], disc: [], grid: emptyGrid(), opp: [[],[],[]], okey: null, gosterge: null, turn: 0, turnEndTime: null, phase: 'discard', sel: null, acildi: [false,false,false,false], tableGroups: [], playerDisc: [], oppDisc: [[],[],[]], hiddenOkeys: new Set(), eldenBiten: false, okeyBiten: false, turnStartedOpen: false, islenenBuTur: 0, preOpenState: null, cifteGidiyor: [false,false,false,false], pendingTile: null,
    highestSeri: acilisPuan - 1, highestCift: 3, acilisDegeri: [null, null, null, null],
    history: []
  };
  
  if (G.isEsli) {
      document.getElementById('sc-n0').innerHTML = 'Biz (<span style="color:#e8c84a">Sen</span>):';
      document.getElementById('sc-n2').innerHTML = 'Biz (<span style="color:#aaa">Ortak</span>):';
      document.getElementById('sc-n1').innerHTML = 'Onlar (<span style="color:#aaa">Bot 1</span>):';
      document.getElementById('sc-n3').innerHTML = 'Onlar (<span style="color:#aaa">Bot 3</span>):';
  } else {
      document.getElementById('sc-n0').textContent = pn + ':';
      document.getElementById('sc-n2').textContent = 'Bot 2:';
      document.getElementById('sc-n1').textContent = 'Bot 1:';
      document.getElementById('sc-n3').textContent = 'Bot 3:';
  }

  document.getElementById('n0').textContent = pn;
  document.getElementById('acilis-chip').textContent = 'Açılış: ' + acilisPuan + 'p';
  
  document.getElementById('lobby').style.display = 'none'; 
  document.getElementById('setup').style.display = 'none'; 
  document.getElementById('game').style.display = 'flex';
  
  doResize(); 
  setTimeout(doResize, 50);
  
  // Tıklama olayını bir kere tanımlıyoruz
  document.getElementById('disc-player').addEventListener('click', () => {
      if(G.turn === 0 && G.phase === 'discard' && G.sel) doDiscard(G.sel);
  });

  const badge = document.getElementById('mode-badge');

  if (gameMode === 'online' && (currentUser || guestName)) {
    badge.textContent = '🌐 Çevrimiçi — Masa ' + (currentMasaNo || 1);
    badge.style.display = 'block';
    updateMasaDurum(currentMasaNo);
    
    const settings = {
      totalEl, acilisPuan, normalTime, acikTime,
      oyunTuru: val('oyunTuru') || 'bireysel',
      yardimModu: val('yardimModu') || 'yardimli',
      diff: val('diffs') || 'medium'
    };
    startMultiplayerGame(currentMasaNo, settings);
    return;
  } else {
    currentRoomId = 'local-' + Date.now();
    badge.textContent = '🤖 Tek Başına — XP Kazanılmaz';
    badge.style.display = 'block';
    deal();
  }
}

function deal() {
  G.deck = shuffle(makeDeck());
  G.grid = emptyGrid();
  G.opp = [[],[],[]];
  G.disc = [];
  G.sel = null;
  G.phase = 'discard';
  G.turn = 0; 
  G.turnEndTime = null;
  G.playerDisc = [];
  G.oppDisc = [[],[],[]];
  G.hiddenOkeys = new Set(); 
  G.acildi = [false,false,false,false];
  G.mustUseTile = null; 
  G.mustOpenThisTurn = false; 
  G.tableGroups = [];
  G.eldenBiten = false;
  G.okeyBiten = false;
  acSelIds = [];
  G.turnStartedOpen = false; 
  G.islenenBuTur = 0; 
  G.preOpenState = null; 
  G.cifteGidiyor = [false,false,false,false]; 
  G.pendingTile = null;
  G.highestSeri = G.acilisPuan - 1; 
  G.highestCift = 3; 
  G.acilisDegeri = [null, null, null, null];
  G.roundBonus = [0,0,0,0]; 
  G.roundPenalties = [0,0,0,0];
  
  const btnCifte = document.getElementById('btn-cifte-git'); 
  if (btnCifte) { 
      btnCifte.classList.remove('on'); 
      btnCifte.textContent = 'Çifte Git'; 
      btnCifte.disabled = false; 
  }
  
  document.getElementById('n0').textContent = G.names[0];
  
  let gostIdx; 
  do { 
      gostIdx = Math.floor(Math.random() * G.deck.length); 
  } while(G.deck[gostIdx].jok);
  
  const gosterge = G.deck.splice(gostIdx, 1)[0]; 
  G.gosterge = gosterge; 
  G.okey = getOkey(gosterge); 
  G.deck.unshift(gosterge);
  
  G.deck.forEach(t => { if (t.jok) { t.c = G.okey.c; t.n = G.okey.n; } });
  
  const tiles = [];
  for(let i=0; i<15; i++) tiles.push(G.deck.pop());
  for(let i=0; i<14; i++) G.opp[0].push(G.deck.pop()); 
  for(let i=0; i<14; i++) G.opp[1].push(G.deck.pop()); 
  for(let i=0; i<14; i++) G.opp[2].push(G.deck.pop());
  
  tiles.forEach((t, i) => {
      const r = i < 8 ? 0 : 1;
      const s = i < 8 ? i : i - 8;
      G.grid[r][s] = t;
  });
  
  document.getElementById('el-chip').textContent = 'El: ' + G.curEl + '/' + G.totalEl; 
  document.getElementById('okey-bar').textContent = 'Okey: ' + CLONG[G.okey.c] + ' ' + G.okey.n;
  
  renderGosterge(); 
  renderAll(); 
  setMsg('15 taşın var! Aç, taşı at veya bitir.'); 
  updTurn();
  updBtns();
  updAcilisStatus(); 
  
  G.turnEndTime = Date.now() + (G.normalTime * 1000); 
  startTimer(); 
}

function checkElBitti() { 
    const hand = getHand(); 
    if (hand.length === 0 && G.acildi[0]) endEl(0); 
}