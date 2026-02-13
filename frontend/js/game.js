let player;
let songData = null;
let currentNotes = [];
let gameStarted = false;
let startTime = 0;
let lastLane = -1;
let noteIndex = 0;

// Game constants adjusted by settings
let NOTE_FLIGHT_TIME = 667;
const NOTE_HEIGHT = 48; // Updated to 2x (48px)
const JUDGMENT_LINE_Y_PCT = 88;

const JUDGMENT_WINDOWS = {
    PERFECT: 50,
    GREAT: 105,
    GOOD: 160,
    NORMAL: 210
};

let KEY_MAP = {
    68: 0,
    70: 1,
    74: 2,
    75: 3
};

let gameSettings = {
    speed: 5,
    dim: 40,
    offset: 0,
    fx: true,
    dynamicAnim: true,
    keys: ['D', 'F', 'J', 'K']
};

function applySettings() {
    const saved = localStorage.getItem('void_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        gameSettings = { ...gameSettings, ...parsed }; // Merge to preserve new defaults
        // Speed: 1 to 10. 5 is default (667ms). 1 is slow (~1200ms), 10 is fast (~300ms)
        NOTE_FLIGHT_TIME = 1000 - (gameSettings.speed * 60);

        // Key Map
        const newMap = {};
        gameSettings.keys.forEach((key, i) => {
            const charCode = (key || "").toUpperCase().charCodeAt(0);
            if (charCode) newMap[charCode] = i;
        });
        KEY_MAP = newMap;

        // Update Key Labels in UI
        gameSettings.keys.forEach((key, i) => {
            const keyObj = document.getElementById(`key-obj-${i}`);
            if (keyObj) keyObj.querySelector('.key-top').innerText = key;
        });

        // Apply Background Dim
        const bg = document.getElementById('video-background');
        if (bg) bg.style.opacity = (100 - (gameSettings.dim || 40)) / 100;
    }
}

// Game Stats
let score = 0;
let combo = 0;
let maxCombo = 0;
let stats = {
    perfect: 0,
    great: 0,
    good: 0,
    normal: 0,
    miss: 0
};

let gameState = 'loading'; // loading, ready, leadin, playing, ended
let gameTime = 0;
let firstNoteTime = 0;
let lastFrameTime = 0;
let processedNotes = [];
let playerType = 'youtube'; // 'youtube' or 'local'

const urlParams = new URLSearchParams(window.location.search);
const songId = urlParams.get('song');

// DOM Cache
let domElements = {};

function cacheElements() {
    domElements = {
        playfield: document.getElementById('playfield'),
        noteContainer: document.getElementById('note-container'),
        effectContainer: document.getElementById('effect-container'),
        score: document.getElementById('in-game-score'),
        comboContainer: document.getElementById('combo-container'),
        comboCount: document.getElementById('combo-count'),
        songTitle: document.getElementById('song-title'),
        songArtist: document.getElementById('song-artist'),
        songInfoOverlay: document.getElementById('song-info-overlay'),
        difficultyDisplay: document.getElementById('difficulty-display'),
        loadingText: document.getElementById('loading-text'),
        startBtn: document.getElementById('start-btn'),
        startOverlay: document.getElementById('start-overlay'),
        resultOverlay: document.getElementById('result-overlay'),
        resultSongInfo: document.getElementById('result-song-info'),
        resPerfect: document.getElementById('res-perfect'),
        resGreat: document.getElementById('res-great'),
        resGood: document.getElementById('res-good'),
        resNormal: document.getElementById('res-normal'),
        resMiss: document.getElementById('res-miss'),
        resCombo: document.getElementById('res-combo'),
        resScore: document.getElementById('res-score'),
        rankingReg: document.getElementById('ranking-reg'),
        nicknameInput: document.getElementById('nickname-input'),
        submitRankBtn: document.getElementById('submit-rank'),
        lanes: document.querySelectorAll('.lane')
    };
}

async function initGame() {
    cacheElements();
    applySettings();
    try {
        const response = await fetch('/api/charts');
        const charts = await response.json();
        if (charts && charts.error) {
            alert('Error loading chart: ' + charts.error);
            return;
        }
        if (Array.isArray(charts)) {
            let matched = charts.find(c => {
                const meta = Array.isArray(c) ? c[0] : c;
                return meta && (meta.name === songId || meta.name === decodeURIComponent(songId));
            }) || charts[0];

            if (matched) {
                if (Array.isArray(matched)) {
                    songData = matched[0];
                    const rawNotes = Array.isArray(matched[1]) ? matched[1] : (songData.chart || songData.notes || []);
                    processedNotes = rawNotes.map(n => ({
                        time: Number(n.time || 0),
                        lane: Number(n.lane || 0),
                        type: n.type || 'short',
                        duration: Number(n.duration || 0)
                    }));
                } else {
                    songData = matched;
                    const rawNotes = songData.chart || songData.notes || songData.timestamps || [];
                    processedNotes = rawNotes.map(n => {
                        if (typeof n === 'number') return { time: n * 1000, lane: Math.floor(Math.random() * 4), type: 'short', duration: 0 };
                        return {
                            time: Number(n.time || 0),
                            lane: Number(n.lane || 0),
                            type: n.type || 'short',
                            duration: Number(n.duration || 0)
                        };
                    });
                }
            }
        }

        if (!songData || !processedNotes || processedNotes.length === 0) {
            alert('Could not load song chart data!');
            return;
        }

        processedNotes.sort((a, b) => a.time - b.time);
        firstNoteTime = processedNotes[0].time;

        // UI Updates using cache
        domElements.songTitle.innerText = songData.name || 'Unknown';
        domElements.songArtist.innerText = songData.artist || 'Unknown';
        domElements.songInfoOverlay.innerText = `${songData.name} - ${songData.artist}`;
        domElements.difficultyDisplay.innerText = songData.difficulty || 'Easy';
        const diff = (songData.difficulty || 'Easy').toLowerCase();
        domElements.difficultyDisplay.className = `difficulty-badge ${diff === 'hard' ? 'diff-hard' : 'diff-easy'}`;

        domElements.startBtn.addEventListener('click', () => {
            domElements.startOverlay.style.opacity = '0';
            setTimeout(() => {
                domElements.startOverlay.style.display = 'none';
                startLevel();
            }, 500);
        });

        window.removeEventListener('keydown', handleInput);
        window.removeEventListener('keyup', handleKeyUp);
        window.addEventListener('keydown', handleInput);
        window.addEventListener('keyup', handleKeyUp);

        // Mobile Touch Events
        const playfield = domElements.playfield;
        playfield.addEventListener('touchstart', handleTouch, { passive: false });
        playfield.addEventListener('touchend', handleTouchEnd, { passive: false });
        playfield.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        createPlayer();
    } catch (error) {
        console.error('Failed to init game:', error);
    }
}

function createPlayer() {
    if (!songData) return;
    const link = songData.song_link || songData.link;
    const videoId = link ? getYouTubeId(link) : null;

    if (videoId) {
        playerType = 'youtube';
        player = new YT.Player('youtube-player', {
            videoId: videoId,
            playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'rel': 0, 'showinfo': 0, 'origin': window.location.origin },
            events: {
                'onReady': () => {
                    domElements.loadingText.classList.add('hidden');
                    domElements.startBtn.classList.remove('hidden');
                    if (gameState === 'loading') gameState = 'ready';
                },
                'onError': () => {
                    if (songData.filename) setupLocalPlayer();
                }
            }
        });
    } else if (songData.filename) {
        setupLocalPlayer();
    }
}

let audioStartOffset = 0; // The actual time sound starts in the file

function setupLocalPlayer() {
    playerType = 'local';
    const audioUrl = `/songs/${songData.filename}`;
    player = new Audio(audioUrl);
    player.preload = 'auto';

    const ytContainer = document.getElementById('youtube-player');
    if (ytContainer) ytContainer.style.display = 'none';

    // Advanced: Load as ArrayBuffer to detect silence
    fetch(audioUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            return audioCtx.decodeAudioData(buffer);
        })
        .then(audioBuffer => {
            detectAudioStart(audioBuffer);
            onReady();
        })
        .catch(err => {
            console.error('Auto-sync analysis failed:', err);
            onReady();
        });

    const onReady = () => {
        domElements.loadingText.classList.add('hidden');
        domElements.startBtn.classList.remove('hidden');
        if (gameState === 'loading') gameState = 'ready';
    };
}

function detectAudioStart(buffer) {
    const data = buffer.getChannelData(0); // Take first channel
    const threshold = 0.005; // Amplitude threshold to consider as 'sound'
    let firstPeak = 0;

    for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
            firstPeak = i;
            break;
        }
    }

    // Convert sample index to milliseconds
    audioStartOffset = (firstPeak / buffer.sampleRate) * 1000;
    console.log(`[Auto-Sync] Detected audio start at: ${audioStartOffset.toFixed(2)}ms`);
}

function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function startLevel() {
    gameStarted = true;
    gameState = 'leadin';
    noteIndex = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    stats = { perfect: 0, great: 0, good: 0, normal: 0, miss: 0 };
    currentNotes = [];
    domElements.noteContainer.innerHTML = '';

    gameTime = firstNoteTime - NOTE_FLIGHT_TIME;
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!gameStarted) return;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (gameState === 'leadin') {
        gameTime += dt;
        // Start playback so that the FIRST SOUND (at audioStartOffset) hits at firstNoteTime
        if (gameTime >= firstNoteTime - audioStartOffset) {
            gameState = 'playing';
            if (playerType === 'youtube') {
                player.seekTo(0, true);
                player.playVideo();
            } else {
                player.currentTime = 0;
                player.play().catch(() => { });
            }
        }
    } else if (gameState === 'playing') {
        if (player) {
            let playerTimeMs = -1;
            if (playerType === 'youtube' && typeof player.getCurrentTime === 'function') {
                playerTimeMs = player.getCurrentTime() * 1000;
            } else if (playerType === 'local') {
                playerTimeMs = player.currentTime * 1000;
            }

            if (playerTimeMs >= 0) {
                // The intended gameTime is: Player Pos (from 0) + firstNoteTime - audioStartOffset
                const targetGameTime = playerTimeMs + (firstNoteTime - audioStartOffset);
                const diff = targetGameTime - gameTime;

                if (Math.abs(diff) > 1000) gameTime = targetGameTime;
                else if (Math.abs(diff) > 20) gameTime += dt + (diff * 0.15); // Slightly faster catch-up
                else gameTime += dt;
            } else {
                gameTime += dt;
            }
        } else {
            gameTime += dt;
        }

        if (noteIndex >= processedNotes.length && currentNotes.length === 0 && gameState !== 'ended') {
            endGame();
        }
    }

    updateNotes(gameTime);
    if (gameState !== 'ended') requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState = 'ended';
    setTimeout(() => {
        domElements.resultSongInfo.innerText = `${songData.name} - ${songData.artist}`;
        domElements.resPerfect.innerText = stats.perfect;
        domElements.resGreat.innerText = stats.great;
        domElements.resGood.innerText = stats.good;
        domElements.resNormal.innerText = stats.normal;
        domElements.resMiss.innerText = stats.miss;
        domElements.resCombo.innerText = maxCombo;
        domElements.resScore.innerText = score.toString().padStart(7, '0');

        // Check for good result (> 0 score for now) to ask for nickname
        if (score > 1000) {
            domElements.rankingReg.classList.remove('hidden');
            domElements.submitRankBtn.onclick = async () => {
                const name = domElements.nicknameInput.value.trim() || 'Anonymous';
                try {
                    await fetch('/api/rankings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            song: songData.name,
                            name: name,
                            score: score,
                            date: new Date().toLocaleDateString()
                        })
                    });
                    domElements.rankingReg.innerHTML = `<p class="text-green-500 font-bold uppercase tracking-widest">Score Registered!</p>`;
                } catch (e) {
                    console.error('Failed to post ranking:', e);
                }
            };
        }

        domElements.resultOverlay.classList.remove('pointer-events-none');
        domElements.resultOverlay.style.opacity = '1';
    }, 2000);
}

function updateNotes(currentTime) {
    while (noteIndex < processedNotes.length) {
        if (currentTime >= processedNotes[noteIndex].time - NOTE_FLIGHT_TIME) {
            spawnNoteObject(processedNotes[noteIndex]);
            noteIndex++;
        } else break;
    }

    const fieldHeight = domElements.playfield.clientHeight;
    const scrollDist = fieldHeight * (JUDGMENT_LINE_Y_PCT / 100);

    for (let i = currentNotes.length - 1; i >= 0; i--) {
        const note = currentNotes[i];
        const progress = (currentTime - (note.targetTime - NOTE_FLIGHT_TIME)) / NOTE_FLIGHT_TIME;
        const endProgress = note.type === 'long' ? (currentTime - (note.endTime - NOTE_FLIGHT_TIME)) / NOTE_FLIGHT_TIME : progress;

        if (endProgress > 1.1 && !note.hit && !note.holding) {
            handleMiss(note, i);
        } else {
            // Base pixel position (linear downward)
            let yPos = (progress * scrollDist);
            let xOffset = 0;
            let yOffset = 0;
            let rotation = 0;

            // Dynamic Entry Animation (Cross Fly-in + Rotation)
            if (gameSettings.dynamicAnim && progress < 0.6) {
                const entryProgress = progress / 0.6;
                const ease = 1 - Math.pow(1 - entryProgress, 3);

                // 1,2라인 (left side) from right, 3,4라인 (right side) from left
                const side = (note.lane < 2) ? 1 : -1;
                xOffset = (1 - ease) * 500 * side;
                yOffset = (1 - ease) * -200;
                rotation = (1 - ease) * 360 * side;
            }

            // Apply transform: translate3d(X, Y, 0) + Rotation
            note.element.style.transform = `translate3d(${xOffset}px, ${yPos + yOffset - NOTE_HEIGHT}px, 0) rotate(${rotation}deg)`;

            if (note.type === 'long' && note.holding) {
                // Keep the bottom of the head at the judgment line
                note.element.style.transform = `translate3d(0, ${scrollDist - NOTE_HEIGHT}px, 0)`;
                const tailProgress = (currentTime - (note.endTime - NOTE_FLIGHT_TIME)) / NOTE_FLIGHT_TIME;
                const currentHeight = (scrollDist) - (tailProgress * scrollDist);
                if (note.body) note.body.style.height = `${currentHeight}px`;
                if (currentTime >= note.endTime) completeLongNote(note, i);
            }
        }
    }
}

function completeLongNote(note, index) {
    note.hit = true;
    note.holding = false;
    note.element.classList.add('hit');
    showJudgment('PERFECT');
    updateCombo(true);
    updateScore(1000);
    spawnExplosionParticles(note.lane, (note.lane === 1 || note.lane === 2) ? '#00f3ff' : '#ffffff', true);
    note.element.remove();
    currentNotes.splice(index, 1);
}

function spawnNoteObject(noteData) {
    const noteEl = document.createElement('div');
    noteEl.className = `note note-lane-${noteData.lane} ${noteData.type === 'long' ? 'long-note' : ''}`;
    noteEl.style.left = `${noteData.lane * 25}%`;

    let body = null;
    if (noteData.type === 'long') {
        body = document.createElement('div');
        body.className = 'note-body';
        // Lane specific colors for long body
        const isCenter = (noteData.lane === 1 || noteData.lane === 2);
        body.style.background = isCenter
            ? 'linear-gradient(0deg, var(--cyber-blue), rgba(0, 243, 255, 0.1))'
            : 'linear-gradient(0deg, #ffffff, rgba(255, 255, 255, 0.1))';
        body.style.boxShadow = isCenter
            ? '0 0 15px rgba(0, 243, 255, 0.3)'
            : '0 0 15px rgba(255, 255, 255, 0.3)';

        const h = domElements.playfield.clientHeight * (JUDGMENT_LINE_Y_PCT / 100);
        body.style.height = `${(noteData.duration / NOTE_FLIGHT_TIME) * h}px`;
        noteEl.appendChild(body);
    }

    const inner = document.createElement('div');
    inner.className = 'note-inner';
    noteEl.appendChild(inner);
    domElements.noteContainer.appendChild(noteEl);

    currentNotes.push({
        element: noteEl,
        body: body,
        targetTime: noteData.time,
        lane: noteData.lane,
        type: noteData.type,
        duration: noteData.duration,
        endTime: noteData.time + noteData.duration,
        hit: false,
        holding: false
    });
}

function handleInput(e) {
    if (!gameStarted || gameState === 'ended' || e.repeat) return;
    const lane = KEY_MAP[e.keyCode];
    if (lane === undefined) return;

    domElements.lanes[lane].classList.add('active');
    const keyObj = document.getElementById(`key-obj-${lane}`);
    if (keyObj) {
        keyObj.classList.add('pressed');
        keyObj.classList.add(lane === 1 || lane === 2 ? 'glow-cyan' : 'glow-white');
    }

    let closestNote = null, minDiff = Infinity, closestIdx = -1;
    for (let i = 0; i < currentNotes.length; i++) {
        const note = currentNotes[i];
        if (note.lane === lane && !note.hit) {
            // Apply Audio Offset to the measurement
            const diff = Math.abs((gameTime - (gameSettings.offset || 0)) - note.targetTime);
            if (diff < minDiff) { minDiff = diff; closestNote = note; closestIdx = i; }
        }
    }

    if (closestNote && minDiff <= JUDGMENT_WINDOWS.NORMAL) {
        if (closestNote.type === 'long') {
            closestNote.holding = true;
            closestNote.element.classList.add('holding');
            createBasicHitEffect(lane);
        } else {
            closestNote.hit = true;
            const color = (lane === 1 || lane === 2) ? '#00f3ff' : '#ffffff';
            let text = 'NORMAL', points = 100;

            if (minDiff <= JUDGMENT_WINDOWS.PERFECT) {
                text = 'PERFECT'; points = 1000; stats.perfect++;
                spawnExplosionParticles(lane, color, 'perfect');
            }
            else if (minDiff <= JUDGMENT_WINDOWS.GREAT) {
                text = 'GREAT'; points = 700; stats.great++;
                spawnExplosionParticles(lane, color, 'great');
            }
            else if (minDiff <= JUDGMENT_WINDOWS.GOOD) {
                text = 'GOOD'; points = 400; stats.good++;
                spawnExplosionParticles(lane, color, 'good');
            }
            else { stats.normal++; createBasicHitEffect(lane); }

            updateCombo(true);
            updateScore(points);
            showJudgment(text);
            closestNote.element.remove();
            currentNotes.splice(closestIdx, 1);
        }
    }
}

function updateCombo(hit) {
    if (hit) {
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        if (combo >= 2) {
            domElements.comboContainer.style.opacity = '1';
            domElements.comboCount.innerText = combo;
            domElements.comboCount.style.transform = 'scale(1.2)';
            setTimeout(() => domElements.comboCount.style.transform = 'scale(1)', 50);
        }
    } else {
        combo = 0;
        domElements.comboContainer.style.opacity = '0';
    }
}

function updateScore(points) {
    score += points;
    domElements.score.innerText = score.toString().padStart(7, '0');
}

function handleKeyUp(e) {
    const lane = KEY_MAP[e.keyCode];
    if (lane === undefined) return;
    domElements.lanes[lane].classList.remove('active');
    const keyObj = document.getElementById(`key-obj-${lane}`);
    if (keyObj) keyObj.classList.remove('pressed', 'glow-cyan', 'glow-white');

    for (let i = 0; i < currentNotes.length; i++) {
        if (currentNotes[i].lane === lane && currentNotes[i].holding) {
            currentNotes[i].holding = false;
            handleMiss(currentNotes[i], i);
            break;
        }
    }
}

function createBasicHitEffect(lane) {
    const spark = document.createElement('div');
    spark.className = 'hit-spark';
    spark.style.left = `${(lane * 25) + 12.5}%`;
    spark.style.top = `${JUDGMENT_LINE_Y_PCT}%`;
    domElements.effectContainer.appendChild(spark);
    setTimeout(() => spark.remove(), 400);
}

function spawnExplosionParticles(lane, color, judgment) {
    if (gameSettings.fx === false) return;
    const x = (lane * 25) + 12.5, y = JUDGMENT_LINE_Y_PCT;
    const isPerfect = judgment === 'perfect';
    const isGreat = judgment === 'great';

    const particleCount = isPerfect ? 60 : (isGreat ? 25 : 12);
    const spread = isPerfect ? 600 : (isGreat ? 300 : 150);

    // Dynamic Blast Ring
    const ring = document.createElement('div');
    ring.className = isPerfect ? 'blast-ring perfect-ring' : 'blast-ring';
    ring.style.cssText = `left:${x}%; top:${y}%; border-color:${color}; animation: blast-bloom ${isPerfect ? '0.8s' : '0.4s'} ease-out forwards;`;
    domElements.effectContainer.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        if (isPerfect && Math.random() > 0.5) p.classList.add('square-particle');

        const size = Math.random() * (isPerfect ? 12 : 6) + 3;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spread;
        const destX = Math.cos(angle) * distance;
        const destY = Math.sin(angle) * distance - (isPerfect ? 200 : 50);

        p.style.cssText = `background-color:${color}; box-shadow:0 0 15px ${color}; width:${size}px; height:${size}px; left:${x}%; top:${y}%;`;
        fragment.appendChild(p);

        p.animate([
            { transform: 'translate3d(-50%, -50%, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate3d(calc(-50% + ${destX}px), calc(-50% + ${destY}px), 0) scale(0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: (isPerfect ? 1200 : 700) + Math.random() * 300,
            easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
            fill: 'forwards'
        }).onfinish = () => p.remove();
    }
    domElements.effectContainer.appendChild(fragment);
    if (isPerfect) triggerScreenShake();
}

function triggerScreenShake() {
    if (gameSettings.fx === false) return;
    // Body shake for more impact
    document.body.classList.add('perfect-shake');
    setTimeout(() => document.body.classList.remove('perfect-shake'), 300);

    // Dynamic Flash
    const flash = document.createElement('div');
    flash.className = 'perfect-bg-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
}

function showJudgment(text) {
    let el = document.getElementById('judgment-text');
    if (!el) {
        el = document.createElement('div');
        el.id = 'judgment-text';
        document.querySelector('.relative.flex.justify-center').appendChild(el);
        el.className = 'absolute top-[35%] left-0 right-0 text-center text-8xl font-black italic z-50 pointer-events-none tracking-tighter';
    }
    el.innerText = text;
    let color = '#fbbf24', shadow = 'none';
    if (text === 'PERFECT') { color = '#fff'; shadow = '0 0 20px #f425af, 0 0 40px #f425af'; }
    else if (text === 'GREAT') { color = '#00f3ff'; shadow = '0 0 15px #00f3ff'; }
    else if (text === 'GOOD') { color = '#39ff14'; shadow = '0 0 10px #39ff14'; }
    else if (text === 'MISS') { color = '#ef4444'; }

    el.style.color = color;
    el.style.textShadow = shadow;
    el.classList.remove('animate-judgment');
    void el.offsetWidth;
    el.classList.add('animate-judgment');
}

function handleMiss(note, index) {
    stats.miss++;
    updateCombo(false);
    showJudgment('MISS');
    note.element.style.opacity = '0';
    setTimeout(() => note.element.remove(), 100);
    currentNotes.splice(index, 1);
}

function handleTouch(e) {
    if (!gameStarted || gameState === 'ended') return;
    e.preventDefault();

    const rect = domElements.playfield.getBoundingClientRect();
    const laneWidth = rect.width / 4;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const relativeX = touch.clientX - rect.left;
        const lane = Math.floor(relativeX / laneWidth);
        const clampedLane = Math.max(0, Math.min(3, lane));

        // Use a synthetic key event or call handleInput logic
        const keyCode = Object.keys(KEY_MAP).find(key => KEY_MAP[key] === clampedLane);
        if (keyCode) {
            handleInput({ keyCode: parseInt(keyCode), repeat: false, preventDefault: () => { } });

            // Store touch ID for release
            if (!touchMap) touchMap = {};
            touchMap[touch.identifier] = clampedLane;
        }

        // Add visual touch feedback
        createTouchRipple(touch.clientX, touch.clientY);
    }
}

let touchMap = {}; // Tracks which touch is on which lane

function handleTouchEnd(e) {
    if (!gameStarted || gameState === 'ended') return;
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const lane = touchMap[touch.identifier];

        if (lane !== undefined) {
            const keyCode = Object.keys(KEY_MAP).find(key => KEY_MAP[key] === lane);
            if (keyCode) {
                handleKeyUp({ keyCode: parseInt(keyCode) });
            }
            delete touchMap[touch.identifier];
        }
    }
}

function createTouchRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 400);
}

initGame();
