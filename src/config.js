window.SUPA_URL = 'https://fviczkwqenvjijwolqdz.supabase.co';
window.SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aWN6a3dxZW52amlqd29scWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTM2OTMsImV4cCI6MjA5MTQyOTY5M30.FFPszVpQtjskW4a2u84ydBYKUAgoWfNsCdDfi1MqqQM';

// Oyun Sabitleri
const COLS = ['r','b','g','k'];
const CLONG = {r:'Kırmızı',b:'Mavi',g:'Sarı',k:'Siyah'};
const CSYM = {r:'♥',b:'♦',g:'♣',k:'♠'};
const NSLOTS = 16;

// XP ve Seviye Ayarları
const XP_LEVELS = [ 
    {level:1,name:'Acemi',min:0}, 
    {level:2,name:'Amatör',min:200}, 
    {level:3,name:'Oyuncu',min:500}, 
    {level:4,name:'Tecrübeli',min:1000}, 
    {level:5,name:'Uzman',min:2000}, 
    {level:6,name:'Usta',min:4000}, 
    {level:7,name:'Şampiyon',min:7000}, 
    {level:8,name:'Efsane',min:12000} 
];