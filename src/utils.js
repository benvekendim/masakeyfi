function getLevel(xp) { let lvl = XP_LEVELS[0]; for(const l of XP_LEVELS) { if(xp >= l.min) lvl = l; } return lvl; }
function getNextLevel(xp) { for(const l of XP_LEVELS) { if(xp < l.min) return l; } return null; }
function getLevelBadge(level) { return ['','🌱','⭐','🎯','💎','🔥','👑','🏆','🌟'][level] || '🌟'; }
function isOnlineGame() { return currentRoomId && !currentRoomId.startsWith('local-'); }

function makeDeck(){
    let d=[];
    for(let c of COLS)
        for(let n=1;n<=13;n++){d.push({c,n,id:c+n+'a'});d.push({c,n,id:c+n+'b'});}
    d.push({c:'j',n:0,id:'j1',jok:true});
    d.push({c:'j',n:0,id:'j2',jok:true});
    return d;
}

function shuffle(a){
    for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
}

function emptyGrid(){ return[new Array(NSLOTS).fill(null),new Array(NSLOTS).fill(null)]; }

function getOkey(t){ if(t.jok) return{c:'j',n:0,jok:true}; return{c:t.c,n:t.n===13?1:t.n+1}; }
function isOkey(t){ if(!G.okey) return false; if(t.jok) return false; return t.c===G.okey.c && t.n===G.okey.n; }

function tLong(t){if(!t)return'?';if(t.jok) return 'Sahte Okey (' + CLONG[t.c] + ' ' + t.n + ')';if(isOkey(t)) return 'Joker (' + CLONG[t.c] + ' ' + t.n + ')';return CLONG[t.c]+' '+t.n;}
function tLabel(t){if(t.jok) return '★'; return t.n; }
function tSub(t){if(t.jok) return G.yardim ? 'sahte' : CSYM[t.c]; if(isOkey(t)) return G.yardim ? '★' : (CSYM[t.c]||''); return CSYM[t.c]||'';}
function tCls(t){if(t.jok) return 'ok'; if(isOkey(t)) return G.yardim ? (t.c + ' real-okey') : t.c; return t.c;}
function tVal(t){if(isOkey(t))return 0;return t.n;}
function getHand(){return G.grid.flat().filter(Boolean);}
function firstEmpty(){for(let r=1;r>=0;r--)for(let s=NSLOTS-1;s>=0;s--)if(!G.grid[r][s])return[r,s];return[-1,-1];}

function cloneState() { return { grid: G.grid.map(row => row.map(t => t ? {...t} : null)), tableGroups: G.tableGroups.map(grp => grp.map(t => ({...t}))) }; }

function spawnFloatingText(text, color) {
    const ft = document.createElement('div'); ft.textContent = text;
    ft.style.cssText = `position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:${color};font-size:26px;font-weight:900;padding:20px 40px;border-radius:15px;border:4px solid ${color};z-index:9999;pointer-events:none;animation:floatUp 2.5s ease-out forwards;text-shadow: 2px 2px 4px #000;box-shadow: 0 10px 30px rgba(0,0,0,0.5);text-align:center;`;
    document.body.appendChild(ft); setTimeout(() => ft.remove(), 2500);
}