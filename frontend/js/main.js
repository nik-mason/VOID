let allCharts = [];
let favorites = {};
const DEFAULT_SETTINGS = {
    speed: 5,
    dim: 40,
    offset: 0,
    fx: true,
    dynamicAnim: true,
    keys: ['D', 'F', 'J', 'K']
};

async function loadData() {
    try {
        const [chartRes, favRes] = await Promise.all([
            fetch('/api/charts'),
            fetch('/api/favorites')
        ]);
        allCharts = await chartRes.json();
        favorites = await favRes.json();
        renderSongList(allCharts);
    } catch (error) {
        console.error('Error loading data:', error);
        showError(error);
    }
}

function renderSongList(charts, filterFavs = false) {
    const songList = document.getElementById('song-list');
    songList.innerHTML = '';

    let songs = [];
    if (Array.isArray(charts)) {
        songs = Array.isArray(charts[0]) ? charts.map(s => s[0]) : charts;
    } else if (charts && typeof charts === 'object' && charts.name) {
        songs = [charts];
    }

    if (filterFavs) {
        songs = songs.filter(s => favorites[s.name]);
    }

    if (songs.length === 0) {
        songList.innerHTML = `<div class="text-center py-20 text-white/20 font-bold uppercase tracking-widest italic">No songs found in this category</div>`;
        return;
    }

    songs.forEach(chart => {
        const isFav = favorites[chart.name];
        const card = document.createElement('div');
        card.className = 'song-card group flex items-center p-4 gap-6 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden';

        const videoId = getYouTubeId(chart.song_link || chart.link || '');
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : 'https://via.placeholder.com/320x180/0d060c/f425af?text=VOID';
        const diff = (chart.difficulty || 'Easy').toLowerCase();

        card.innerHTML = `
            <div class="relative w-40 h-24 bg-zinc-900 rounded-lg overflow-hidden shrink-0 group-hover:ring-2 ring-primary transition-all">
                <img src="${thumbnailUrl}" class="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-all duration-700 pointer-events-none">
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-icons text-white text-4xl">play_circle_filled</span>
                </div>
            </div>
            <div class="flex-1">
                <h3 class="text-xl font-bold tracking-tight text-white group-hover:text-primary transition-colors uppercase">${chart.name}</h3>
                <p class="text-sm text-white/40 font-medium">${chart.artist}</p>
            </div>
            <div class="flex items-center gap-4 px-4">
               <button onclick="event.stopPropagation(); showRankings('${chart.name.replace(/'/g, "\\'")}')" class="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-all" title="Rankings">
                    <span class="material-icons">leaderboard</span>
               </button>
               <button onclick="event.stopPropagation(); toggleFavorite('${chart.name.replace(/'/g, "\\'")}')" class="p-2 bg-white/5 hover:bg-white/10 rounded-lg ${isFav ? 'text-primary' : 'text-white/30'} hover:scale-110 transition-all" title="Favorite">
                    <span class="material-icons">${isFav ? 'favorite' : 'favorite_border'}</span>
               </button>
            </div>
            <div class="hidden lg:flex flex-col items-center gap-1 px-8 border-l border-white/5">
                <span class="text-[10px] text-white/30 tracking-widest font-bold uppercase">Difficulty</span>
                <span class="difficulty-badge ${diff === 'hard' ? 'diff-hard' : 'diff-easy'}">${chart.difficulty || 'Easy'}</span>
            </div>
        `;

        card.onclick = () => {
            window.location.href = `game.html?song=${encodeURIComponent(chart.name)}`;
        };

        songList.appendChild(card);
    });
}

async function toggleFavorite(songName) {
    const isNowFav = !favorites[songName];
    try {
        await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: songName, favorite: isNowFav })
        });
        favorites[songName] = isNowFav;
        renderSongList(allCharts);
    } catch (e) {
        console.error('Failed to toggle favorite:', e);
    }
}

async function showRankings(songName) {
    const modal = document.getElementById('rankings-modal');
    const list = document.getElementById('rank-list');
    const title = document.getElementById('ranking-song-title');

    title.innerText = songName;
    list.innerHTML = `<div class="text-center py-20 text-white/20 font-bold uppercase tracking-widest italic">Loading rankings...</div>`;
    openModal('rankings');

    try {
        const res = await fetch(`/api/rankings?song=${encodeURIComponent(songName)}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-20 bg-white/5 rounded-xl border border-white/5 m-4">
                <span class="material-icons text-white/10 text-6xl mb-4">leaderboard</span>
                <p class="text-white/30 font-bold uppercase tracking-widest italic">No rankings yet</p>
                <p class="text-[10px] text-white/10 mt-2 uppercase tracking-widest">Be the first to set a score!</p>
            </div>`;
            return;
        }

        list.innerHTML = data.map((entry, i) => `
            <div class="flex items-center gap-6 p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all mb-2">
                <div class="w-12 text-center text-2xl font-black italic ${i < 3 ? 'text-primary' : 'text-white/20'}">#${i + 1}</div>
                <div class="flex-1">
                    <p class="text-lg font-bold uppercase text-white">${entry.name}</p>
                    <p class="text-[10px] font-bold text-white/20 uppercase tracking-widest">${entry.date}</p>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-black italic text-primary">${entry.score.toString().padStart(7, '0')}</p>
                    <p class="text-[10px] font-bold text-cyber-blue uppercase tracking-widest">MISSION SCORE</p>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="text-center py-20 text-red-500/50 font-bold">Failed to load rankings</div>`;
    }
}

// Settings Logic
function loadSettings() {
    const saved = localStorage.getItem('void_settings');
    const settings = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;

    document.getElementById('setting-speed').value = settings.speed;
    document.getElementById('speed-val').innerText = settings.speed.toFixed(1);

    document.getElementById('setting-dim').value = settings.dim || 40;
    document.getElementById('dim-val').innerText = `${settings.dim || 40}%`;

    document.getElementById('setting-offset').value = settings.offset || 0;
    document.getElementById('setting-fx').checked = settings.fx !== false;
    document.getElementById('setting-dynamic-anim').checked = settings.dynamicAnim !== false;

    const keys = settings.keys || DEFAULT_SETTINGS.keys;
    keys.forEach((key, i) => {
        const el = document.getElementById(`key-${i}`);
        if (el) el.value = key;
    });
}

function saveSettings() {
    const settings = {
        speed: parseFloat(document.getElementById('setting-speed').value),
        dim: parseInt(document.getElementById('setting-dim').value),
        offset: parseInt(document.getElementById('setting-offset').value),
        fx: document.getElementById('setting-fx').checked,
        dynamicAnim: document.getElementById('setting-dynamic-anim').checked,
        keys: [
            document.getElementById('key-0').value.toUpperCase() || 'D',
            document.getElementById('key-1').value.toUpperCase() || 'F',
            document.getElementById('key-2').value.toUpperCase() || 'J',
            document.getElementById('key-3').value.toUpperCase() || 'K'
        ]
    };
    localStorage.setItem('void_settings', JSON.stringify(settings));

    // Feedback
    const btn = document.getElementById('save-settings');
    const original = btn.innerText;
    btn.innerText = 'SAVED!';
    btn.classList.add('bg-green-500');
    setTimeout(() => {
        btn.innerText = original;
        btn.classList.remove('bg-green-500');
        closeModal();
    }, 1000);
}

// Modal Controllers
function openModal(type) {
    document.getElementById('modal-container').classList.remove('hidden');
    document.getElementById('modal-container').classList.add('flex');
    if (type === 'settings') {
        document.getElementById('settings-modal').classList.remove('hidden');
        loadSettings();
    } else if (type === 'rankings') {
        document.getElementById('rankings-modal').classList.remove('hidden');
    }
}

function closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
    document.getElementById('modal-container').classList.remove('flex');
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('rankings-modal').classList.add('hidden');
}

function showError(error) {
    document.getElementById('song-list').innerHTML = `
        <div class="text-center py-20 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
            <span class="material-icons text-6xl text-red-500/50 mb-4 iterate-pulse">error_outline</span>
            <p class="text-red-500 font-bold text-xl uppercase tracking-tighter">System Error</p>
            <p class="text-sm text-white/50 mt-2 font-mono">CODE: ${error.name}<br>MSG: ${error.message}</p>
        </div>
    `;
}

function getYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('nav-play').onclick = () => renderSongList(allCharts);
    document.getElementById('nav-favorites').onclick = () => renderSongList(allCharts, true);
    document.getElementById('nav-rankings').onclick = () => openModal('rankings');
    document.getElementById('nav-settings').onclick = () => openModal('settings');
    document.getElementById('modal-overlay').onclick = closeModal;
    document.getElementById('save-settings').onclick = saveSettings;

    document.getElementById('setting-speed').oninput = (e) => {
        document.getElementById('speed-val').innerText = parseFloat(e.target.value).toFixed(1);
    };
    document.getElementById('setting-dim').oninput = (e) => {
        document.getElementById('dim-val').innerText = `${e.target.value}%`;
    };
});
