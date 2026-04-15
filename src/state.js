// Global Oyun Durumu (G objesi)
let G = {}; 

// Multiplayer ve Oda Durumları
let myRoomId = null;      
let mySeat = -1;          
let roomSub = null;       
let waitingInterval = null;
let isMultiplayer = false;
let currentRoomData = null; 
let isMasaKurucu = false;

// Kullanıcı Durumları
let currentUser = null;
let currentProfile = null;
let currentRoomId = null;
let chatSub = null;
let chatOpen = false;
let guestName = '';

// Arayüz ve Oyun Modu Durumları
let isSpectating = false;
let gameMode = 'online';
let currentMasaNo = 1;
let lastMasaNo = null;

// Sürükle Bırak ve Seçim Durumları
let sortMode = 'diz'; 
let DG = {active:false, id:null, fr:-1, fs:-1, startX:0, startY:0, moved:false};
let lastTap = {id:null, t:0}; 
let acSelIds = []; 

// Zamanlayıcılar
let turnTimer = null; 
let gameScale = 1;