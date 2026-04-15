// src/auth.js

function switchAuthTab(tab) {
  document.getElementById('tab-giris').style.background = tab === 'giris' ? '#e8c84a' : 'rgba(0,0,0,.3)';
  document.getElementById('tab-giris').style.color = tab === 'giris' ? '#1a1a00' : 'rgba(255,255,255,.5)';
  document.getElementById('tab-kayit').style.background = tab === 'kayit' ? '#e8c84a' : 'rgba(0,0,0,.3)';
  document.getElementById('tab-kayit').style.color = tab === 'kayit' ? '#1a1a00' : 'rgba(255,255,255,.5)';
  document.getElementById('auth-giris').style.display = tab === 'giris' ? 'block' : 'none';
  document.getElementById('auth-kayit').style.display = tab === 'kayit' ? 'block' : 'none';
  document.getElementById('auth-error').textContent = '';
}

async function doGiris() {
  const email = document.getElementById('giris-email').value.trim();
  const pw = document.getElementById('giris-sifre').value;
  if (!email || !pw) { document.getElementById('auth-error').textContent = 'E-posta ve şifre girin.'; return; }
  
  const { data, error } = await supa.auth.signInWithPassword({ email, password: pw });
  if (error) { document.getElementById('auth-error').textContent = 'Hata: ' + error.message; return; }
  
  currentUser = data.user; 
  // Giriş başarılı olunca kullanıcı bilgilerini ekrana bas
updateDashboardUI();
  await loadProfile(); 
  showLobby();
}

async function doKayit() {
  const u = document.getElementById('kayit-kullanici').value.trim();
  const email = document.getElementById('kayit-email').value.trim();
  const pw = document.getElementById('kayit-sifre').value;
  
  if (!u || !email || !pw) { document.getElementById('auth-error').textContent = 'Tüm alanları doldurun.'; return; }
  if (pw.length < 6) { document.getElementById('auth-error').textContent = 'Şifre en az 6 karakter.'; return; }
  
  const { data, error } = await supa.auth.signUp({ email, password: pw, options: { data: { username: u } } });
  if (error) { document.getElementById('auth-error').textContent = 'Hata: ' + error.message; return; }
  
  currentUser = data.user; 
  await loadProfile(); 
  showLobby();
}

async function doMisafir() {
  const n = prompt('Misafir adın?', 'Misafir' + Math.floor(Math.random() * 1000));
  if (!n) return; 
  guestName = n;
  
  try {
    const { data, error } = await supa.auth.signInAnonymously();
    if (error) throw error;
    currentUser = data.user;
    await supa.from('profiles').upsert({ id: currentUser.id, username: n, rating: 1000, xp: 0, level: 1 }, { onConflict: 'id', ignoreDuplicates: true });
    await loadProfile();
  } catch(e) { 
    currentUser = null; 
  }
  showLobby();
}

async function doLogout() {
  await supa.auth.signOut(); 
  currentUser = null; 
  currentProfile = null;
  document.getElementById('lobby').style.display = 'none'; 
  document.getElementById('game').style.display = 'none'; 
  document.getElementById('auth-screen').style.display = 'flex';
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supa.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentProfile = data;
}

function doGuestGiris() { doGuestCikis(false); }

async function doGuestCikis(confirm_needed = true) {
  if (confirm_needed && !confirm('Misafir hesabından çıkılacak. Tüm veriler silinecek. Emin misiniz?')) return;
  
  try { await supa.auth.signOut(); } catch(e) {}
  
  localStorage.removeItem('81okey_guest'); 
  localStorage.removeItem('81okey_guest_id'); 
  localStorage.removeItem('81okey_gamemode');
  guestName = ''; 
  currentUser = null; 
  currentProfile = null; 
  currentRoomId = null;
  
  document.getElementById('lobby').style.display = 'none'; 
  document.getElementById('game').style.display = 'none'; 
  document.getElementById('auth-screen').style.display = 'flex';
}

async function updateDashboardUI() {
    if (!currentUser) return;

    // Supabase'den profil bilgilerini çek
    const { data: profile, error } = await supa
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        document.getElementById('header-username').innerText = profile.username || 'İsimsiz Oyuncu';
        document.getElementById('header-avatar').src = profile.avatar_url;
        document.getElementById('user-level-badge').innerText = `LVL ${profile.level}`;
        document.getElementById('stat-total').innerText = profile.total_games;
        document.getElementById('stat-wins').innerText = profile.wins;
        document.getElementById('stat-coins').innerText = profile.coins.toLocaleString();
        
        // XP Bar Hesaplama (Örn: Her seviye 1000 XP)
        const xpPercent = (profile.xp % 1000) / 10;
        document.getElementById('xp-progress-bar').style.width = `${xpPercent}%`;
        document.getElementById('header-xp-text').innerText = `${profile.xp % 1000} / 1000 XP`;
    }
}

// src/auth.js en altı
async function checkAdminStatus() {
    if (!currentUser) return;
    
    const { data: profile, error } = await supa
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

    if (profile && profile.role === 'admin') {
        console.log("Patron hoş geldin!");
        // Eğer admin panel butonu henüz yoksa ekle
        if (!document.getElementById('admin-btn-nav')) {
            const navContainer = document.querySelector('#user-dashboard-bar div:last-child');
            const adminBtn = document.createElement('button');
            adminBtn.id = 'admin-btn-nav';
            adminBtn.innerHTML = "👑 Panel";
            adminBtn.style.cssText = "background: #e8c84a; color: #1a1a00; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold;";
            adminBtn.onclick = () => document.getElementById('admin-panel').style.display = 'block';
            navContainer.prepend(adminBtn); // Çıkış butonunun yanına koyar
        }
    }
}