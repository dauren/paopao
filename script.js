// Telegram Web App integration
let tg = null;
try {
    tg = window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        console.log('Telegram Web App initialized');
        tg.SettingsButton.isVisible = false;
        tg.SettingsButton.hide();
    }
} catch (e) {
    console.log('Telegram Web App not available, running in browser mode');
}

// Set up Telegram theme support
function updateTelegramTheme() {
    if (tg && tg.themeParams) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f0f0f0');
    }
}

// Update theme when it changes
if (tg) {
    tg.onEvent('themeChanged', updateTelegramTheme);
    updateTelegramTheme();
}
const ROWS = 16;
const COLS = 10;
const INNER_ROWS = 14;
const INNER_COLS = 8;
const INNER_OFFSET_ROW = 1;
const INNER_OFFSET_COL = 1;

class PaoPaoGame {
    constructor() {
        this.board = [];
        // Полная сетка для BFS и логики путей
        this.boardSize = { rows: ROWS, cols: COLS};
        this.innerSize = { rows: INNER_ROWS, cols: INNER_COLS};
        this.innerOffset = { row: 1, col: 1 }; // смещение внутрь полной сетки
        this.tiles = [];
        this.selectedTile = null;
        this.score = 0;
        this.timeLeft = 600; // 10 минут в секундах
        this.gameTimer = null;
        this.isPaused = false;
        this.isGameOver = false;
        this.sounds = {};
        this.soundEnabled = true;
        this.path = []; // Путь для отображения
        
        // Heart system
        this.hearts = 10;
        this.maxHearts = 10;
        
        // Level system
        this.currentLevel = 1;
        this.maxLevel = 11;
        this.levels = this.createLevels();
        
        // Отладка отключена
        this.debugBFS = false;
        this.debugVisual = false;

        // Флаги процессов
        this.isShuffling = false;
        this.isSolving = false;
        
        this.initializeSounds();
        this.initializeGame();
        this.setupEventListeners();
        
        // Initialize Telegram back button if available
        this.initializeTelegramBackButton();
        
        // Update safe area insets for mobile devices
        this.updateSafeAreaInsets();
    }
    
    initializeSounds() {
        // Initialize Web Audio API for better control
        this.initializeWebAudio();
        
        // Инициализируем звуки с music-friendly настройками
        this.sounds = {
            gameover: new Audio('sounds/gameover.mp3'),
            levelcomplited: new Audio('sounds/levelcomplited.mp3'),
            pause: new Audio('sounds/pause.mp3'),
            savegame: new Audio('sounds/savegame.mp3'),
            success: new Audio('sounds/connected.mp3'),
            wrong: new Audio('sounds/wrongstep.mp3'),
            victory: new Audio('sounds/victory.mp3'),
            shuffle: new Audio('sounds/shuffle.mp3'),
            click: new Audio('sounds/successstep.mp3'),
        };
        
        // Configure sounds for music coexistence
        this.configureSoundsForMusic();
        
        // Detect if user is playing background music
        this.detectBackgroundMusic();
    }
    
    initializeWebAudio() {
        // Detect iOS - Web Audio API causes music interruption on iOS
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // Skip Web Audio API on iOS to prevent music interruption
        if (this.isIOS) {
            console.log('iOS detected - using HTML5 audio only to preserve background music');
            this.audioContext = null;
            return;
        }
        
        try {
            // Only use Web Audio on non-iOS platforms
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            
            // Create compressor to prevent clipping with background music
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
            this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);
            
            this.compressor.connect(this.masterGain);
            
            console.log('Web Audio initialized for music-friendly playback');
        } catch (e) {
            console.log('Web Audio not available, using fallback audio system');
            this.audioContext = null;
        }
    }
    
    configureSoundsForMusic() {
        Object.values(this.sounds).forEach(sound => {
            // iOS-specific configuration to preserve background music
            if (this.isIOS) {
                // Very low volumes on iOS to minimize interference
                sound.volume = 0.15;
                
                // Configure for background music preservation
                sound.preload = 'none'; // Don't preload on iOS
                sound.muted = false;
                
                // Set audio category hints for iOS (though limited in web)
                if (sound.setSinkId) {
                    try {
                        sound.setSinkId(''); // Use default audio output
                    } catch (e) {
                        // Ignore if not supported
                    }
                }
            } else {
                // Standard configuration for other platforms
                sound.volume = this.hasMusicPlaying ? 0.25 : 0.35;
                sound.preload = 'auto';
            }
            
            // Load sounds (but only if not iOS or not preloading)
            if (!this.isIOS) {
                sound.load();
            }
            
            // Add event listeners for music detection
            sound.addEventListener('play', () => {
                this.onSoundPlay(sound);
            });
            
            // iOS-specific: Monitor for interruptions
            if (this.isIOS) {
                sound.addEventListener('pause', () => {
                    // If game sound gets paused, it might be due to system audio management
                    console.log('Game sound paused - likely due to system audio management');
                });
                
                sound.addEventListener('ended', () => {
                    // Clean up after sound ends
                    this.currentGameSound = null;
                });
            }
        });
    }
    
    detectBackgroundMusic() {
        // On iOS, always assume music is playing to be safe
        this.hasMusicPlaying = this.isIOS ? true : false;
        
        if (this.isIOS) {
            console.log('iOS detected - assuming background music is playing');
            this.adjustForBackgroundMusic(true);
            this.checkTelegramAudioSettings();
            return;
        }
        
        // Method 1: Check for Web Audio API usage by other apps (non-iOS only)
        if (this.audioContext) {
            // Monitor audio context state changes
            this.audioContext.addEventListener('statechange', () => {
                if (this.audioContext.state === 'suspended') {
                    // Audio might be suspended due to competing audio
                    this.adjustForBackgroundMusic(true);
                }
            });
        }
        
        // Method 2: Listen for visibility changes (user might switch to music app)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // User switched apps, might be adjusting music
                setTimeout(() => {
                    this.checkForMusicPlayback();
                }, 1000);
            }
        });
        
        // Method 3: Check for media session API usage
        this.checkMediaSession();
        
        // Method 4: Start with conservative audio levels
        this.adjustForBackgroundMusic(true); // Assume music is playing initially
        
        // Method 5: Use Telegram Web App settings if available
        this.checkTelegramAudioSettings();
    }
    
    checkForMusicPlayback() {
        try {
            // Check if there are other audio elements playing
            const audioElements = document.querySelectorAll('audio, video');
            let musicDetected = false;
            
            audioElements.forEach(element => {
                if (!element.paused && element !== this.currentGameSound) {
                    musicDetected = true;
                }
            });
            
            // Check for Web Audio nodes that might indicate music
            if (this.audioContext && this.audioContext.state === 'running') {
                // Look for signs of other audio processing
                const baseLatency = this.audioContext.baseLatency || 0;
                if (baseLatency > 0.01) { // Indicates audio processing load
                    musicDetected = true;
                }
            }
            
            this.adjustForBackgroundMusic(musicDetected);
            
        } catch (e) {
            // Fallback to conservative approach
            this.adjustForBackgroundMusic(true);
        }
    }
    
    checkMediaSession() {
        // Check if Media Session API is being used (indicates music apps)
        if ('mediaSession' in navigator) {
            try {
                // If there's already media session metadata, music might be playing
                if (navigator.mediaSession.metadata) {
                    this.adjustForBackgroundMusic(true);
                }
            } catch (e) {
                // Media Session API not fully supported
            }
        }
    }
    
    adjustForBackgroundMusic(musicDetected) {
        const wasPlayingMusic = this.hasMusicPlaying;
        this.hasMusicPlaying = musicDetected;
        
        if (musicDetected !== wasPlayingMusic) {
            console.log(`Background music ${musicDetected ? 'detected' : 'not detected'}, adjusting game audio`);
            
            // Adjust all sound volumes
            Object.values(this.sounds).forEach(sound => {
                sound.volume = musicDetected ? 0.2 : 0.35;
            });
            
            // Adjust Web Audio gain if available
            if (this.masterGain) {
                const targetGain = musicDetected ? 0.3 : 0.6;
                this.masterGain.gain.setTargetAtTime(
                    targetGain, 
                    this.audioContext.currentTime, 
                    0.1
                );
            }
        }
    }
    
    onSoundPlay(sound) {
        this.currentGameSound = sound;
        
        // Resume audio context if suspended (user gesture requirement)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    // Haptic feedback for matched tiles
    triggerHapticFeedback() {
        // Telegram Web App HapticFeedback API (Bot API 6.1+)
        if (tg && tg.HapticFeedback) {
            // Use success notification for matched tiles
            tg.HapticFeedback.notificationOccurred('success');
        }
        // Fallback to native haptic feedback
        else if ('vibrate' in navigator) {
            // Short vibration for tile match
            navigator.vibrate(50);
        }
        
        // For iOS devices, try to trigger haptic feedback
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hapticFeedback) {
            window.webkit.messageHandlers.hapticFeedback.postMessage('success');
        }
        
        // For Android WebView
        if (window.Android && window.Android.vibrate) {
            window.Android.vibrate(50);
        }
    }
    
    // Haptic feedback for tile selection
    triggerSelectionHapticFeedback() {
        // Telegram Web App HapticFeedback API (Bot API 6.1+)
        if (tg && tg.HapticFeedback) {
            // Use selection changed for tile selection
            tg.HapticFeedback.selectionChanged();
        }
        // Fallback to native haptic feedback
        else if ('vibrate' in navigator) {
            // Very short vibration for selection
            navigator.vibrate(25);
        }
    }
    
    // Haptic feedback for wrong moves
    triggerWrongMoveHapticFeedback() {
        // Telegram Web App HapticFeedback API (Bot API 6.1+)
        if (tg && tg.HapticFeedback) {
            // Use error notification for wrong moves
            tg.HapticFeedback.notificationOccurred('error');
        }
        // Fallback to native haptic feedback
        else if ('vibrate' in navigator) {
            // Longer vibration for wrong moves
            navigator.vibrate(100);
        }
    }
    
    // Haptic feedback for game events
    triggerGameEventHapticFeedback(eventType) {
        // Telegram Web App HapticFeedback API (Bot API 6.1+)
        if (tg && tg.HapticFeedback) {
            switch (eventType) {
                case 'level_complete':
                    tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'game_over':
                    tg.HapticFeedback.notificationOccurred('error');
                    break;
                case 'button_press':
                    tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'shuffle':
                    tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'hint':
                    tg.HapticFeedback.impactOccurred('soft');
                    break;
                default:
                    tg.HapticFeedback.impactOccurred('light');
            }
        }
        // Fallback to native haptic feedback
        else if ('vibrate' in navigator) {
            switch (eventType) {
                case 'level_complete':
                    navigator.vibrate([50, 100, 50]); // Success pattern
                    break;
                case 'game_over':
                    navigator.vibrate([100, 200, 100]); // Error pattern
                    break;
                default:
                    navigator.vibrate(25); // Default light feedback
            }
        }
    }
    
    // Handle safe area insets for mobile devices
    updateSafeAreaInsets() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
            // Get safe area insets from Telegram Web App
            const safeArea = tg.initDataUnsafe.start_param;
            
            // Update CSS custom properties
            document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${safeArea.top || 0}px`);
            document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${safeArea.bottom || 0}px`);
            document.documentElement.style.setProperty('--tg-safe-area-inset-left', `${safeArea.left || 0}px`);
            document.documentElement.style.setProperty('--tg-safe-area-inset-right', `${safeArea.right || 0}px`);
        }
        
        // Fallback: detect safe areas using CSS environment variables
        const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)');
        const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
        const safeAreaLeft = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)');
        const safeAreaRight = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)');
        
        if (safeAreaTop && safeAreaTop !== '0px') {
            document.documentElement.style.setProperty('--tg-safe-area-inset-top', safeAreaTop);
        }
        if (safeAreaBottom && safeAreaBottom !== '0px') {
            document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', safeAreaBottom);
        }
        if (safeAreaLeft && safeAreaLeft !== '0px') {
            document.documentElement.style.setProperty('--tg-safe-area-inset-left', safeAreaLeft);
        }
        if (safeAreaRight && safeAreaRight !== '0px') {
            document.documentElement.style.setProperty('--tg-safe-area-inset-right', safeAreaRight);
        }
    }
    
    // Initialize Telegram back button functionality
    initializeTelegramBackButton() {
        if (tg && tg.BackButton) {
            tg.BackButton.onClick(() => {
                if (this.isPaused) {
                    this.togglePause(); // Resume game if paused
                } else if (this.isGameOver) {
                    this.restartGame(); // Restart if game over
                } else {
                    this.togglePause(); // Pause game
                }
            });
        }
    }
    
    playSound(soundName) {
        if (this.soundEnabled && this.sounds[soundName]) {
            const sound = this.sounds[soundName];
            
            // iOS-specific handling to preserve background music
            if (this.isIOS) {
                this.playIOSSafeSound(sound, soundName);
                return;
            }
            
            // Smart volume adjustment based on background music
            this.adjustSoundForContext(sound, soundName);
            
            // Reset and play with music-friendly settings
            sound.currentTime = 0;
            
            // Use Web Audio API if available for better control
            if (this.audioContext && !this.hasMusicPlaying) {
                this.playWithWebAudio(sound, soundName);
            } else {
                // Fallback to regular HTML5 audio with ducking
                this.playWithDucking(sound, soundName);
            }
        }
    }
    
    playIOSSafeSound(sound, soundName) {
        try {
            // iOS-specific configuration for each play
            sound.volume = 0.1; // Very low volume to minimize interference
            sound.currentTime = 0;
            
            // Load only when needed on iOS
            if (sound.readyState === 0) {
                sound.load();
            }
            
            // Play with iOS-safe settings
            const playPromise = sound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log(`iOS-safe sound played: ${soundName}`);
                        this.currentGameSound = sound;
                    })
                    .catch(error => {
                        console.log(`iOS sound play failed: ${error.message}`);
                        // Don't retry on iOS - just fail silently to preserve music
                    });
            }
        } catch (error) {
            console.log(`iOS sound error: ${error.message}`);
            // Fail silently on iOS to preserve background music
        }
    }
    
    adjustSoundForContext(sound, soundName) {
        // Different volume levels based on sound type and music presence
        const soundTypes = {
            'click': { normal: 0.3, withMusic: 0.15 },
            'success': { normal: 0.35, withMusic: 0.2 },
            'wrong': { normal: 0.4, withMusic: 0.2 },
            'gameover': { normal: 0.5, withMusic: 0.25 },
            'levelcomplited': { normal: 0.6, withMusic: 0.3 },
            'victory': { normal: 0.7, withMusic: 0.35 },
            'pause': { normal: 0.3, withMusic: 0.15 },
            'shuffle': { normal: 0.4, withMusic: 0.2 },
            'savegame': { normal: 0.3, withMusic: 0.15 }
        };
        
        const soundConfig = soundTypes[soundName] || { normal: 0.35, withMusic: 0.2 };
        sound.volume = this.hasMusicPlaying ? soundConfig.withMusic : soundConfig.normal;
    }
    
    playWithWebAudio(sound, soundName) {
        try {
            // Create audio source from HTML5 audio element
            if (!sound.webAudioSource) {
                sound.webAudioSource = this.audioContext.createMediaElementSource(sound);
                sound.webAudioGain = this.audioContext.createGain();
                
                // Connect through compressor to prevent clipping
                sound.webAudioSource.connect(sound.webAudioGain);
                sound.webAudioGain.connect(this.compressor);
            }
            
            // Apply dynamic gain control
            const baseGain = this.hasMusicPlaying ? 0.3 : 0.8;
            sound.webAudioGain.gain.setValueAtTime(baseGain, this.audioContext.currentTime);
            
            sound.play().catch(e => console.log('WebAudio sound playback failed:', e));
        } catch (e) {
            // Fallback to regular playback
            this.playWithDucking(sound, soundName);
        }
    }
    
    playWithDucking(sound, soundName) {
        // Apply audio ducking - briefly lower background audio if possible
        if (this.hasMusicPlaying && this.masterGain) {
            // Temporarily reduce overall game audio to make room for this sound
            const originalGain = this.masterGain.gain.value;
            const duckGain = originalGain * 0.7;
            
            // Quick duck
            this.masterGain.gain.setValueAtTime(duckGain, this.audioContext.currentTime);
            this.masterGain.gain.setTargetAtTime(originalGain, this.audioContext.currentTime + 0.1, 0.2);
        }
        
        // Play the sound
        sound.play().catch(e => {
            console.log('Sound playback failed:', e);
            // Re-check for music if audio fails (might indicate competing audio)
            this.checkForMusicPlayback();
        });
        
        // Mark this as current game sound
        this.currentGameSound = sound;
    }
    
    checkTelegramAudioSettings() {
        // Check Telegram Web App environment for audio preferences
        if (tg && tg.initDataUnsafe) {
            try {
                // Check if user has specific audio preferences in Telegram
                const userData = tg.initDataUnsafe.user;
                if (userData && userData.allows_write_to_pm === false) {
                    // User has restrictive settings, be extra conservative with audio
                    this.adjustForBackgroundMusic(true);
                    this.preferHapticOverAudio = true;
                    console.log('Telegram user prefers minimal audio disruption');
                }
            } catch (e) {
                console.log('Could not check Telegram audio preferences');
            }
        }
    }
    
    // Enhanced sound method that prioritizes haptic feedback when music is detected
    playSoundOrHaptic(soundName, hapticType = 'light') {
        // On iOS, prioritize haptic feedback over sound to preserve background music
        if (this.isIOS) {
            // Play haptic feedback first
            if (soundName === 'success') {
                this.triggerHapticFeedback();
            } else if (soundName === 'wrong') {
                this.triggerWrongMoveHapticFeedback();
            } else {
                this.triggerGameEventHapticFeedback(hapticType);
            }
            
            // Optionally play very quiet sound if user has sounds enabled
            if (this.soundEnabled) {
                this.playSound(soundName);
            }
            return;
        }
        
        // If music is playing and we prefer haptic, use haptic instead of sound
        if (this.hasMusicPlaying && this.preferHapticOverAudio) {
            this.triggerGameEventHapticFeedback(hapticType);
            return;
        }
        
        // Otherwise play sound normally
        this.playSound(soundName);
        
        // Also add haptic for enhanced feedback
        if (soundName === 'success') {
            this.triggerHapticFeedback();
        } else if (soundName === 'wrong') {
            this.triggerWrongMoveHapticFeedback();
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundBtn = document.getElementById('soundBtn');
        
        if (this.soundEnabled) {
            soundBtn.textContent = '🔊';
            soundBtn.title = 'Sound On';
            soundBtn.classList.remove('muted');
        } else {
            soundBtn.textContent = '🔇';
            soundBtn.title = 'Sound Off';
            soundBtn.classList.add('muted');
        }
    }
    
    initializeGame() {
        // Set initial level
        this.setLevel(1);
        
        this.createTiles();
        this.initializeBoard();
        this.renderBoard();
        this.startTimer();
        this.playSound('shuffle');
        
        // Initialize hearts display
        this.updateHearts();
        
        // Force board refresh after a short delay to ensure proper sizing
        setTimeout(() => {
            this.renderBoard();
        }, 100);
    }
    
    createTiles() {
        // Генерируем набор как пары, чтобы у каждой ячейки был напарник
        this.tiles = [];
        const level = this.getCurrentLevel();
        const totalCells = this.innerSize.rows * this.innerSize.cols; 
        const totalPairs = Math.floor(totalCells / 2);
        const maxTileTypes = Math.min(level.tileTypes, totalPairs);
        
        for (let p = 0; p < totalPairs; p++) {
            const id = (p % maxTileTypes) + 1; // используем доступные изображения по кругу
            const a = { id, image: `tiles/${id}.png`, matched: false };
            const b = { id, image: `tiles/${id}.png`, matched: false };
            this.tiles.push(a, b);
        }
    }
    
    initializeBoard() {
        // Создаем полную доску с пустыми ячейками
        this.board = [];
        for (let r = 0; r < this.boardSize.rows; r++) {
            this.board[r] = new Array(this.boardSize.cols).fill(null);
        }
        
        // Generate solvable board using reverse simulation
        this.generateSolvableBoard();
        
        // Fill empty cells
        for (let r = 0; r < this.boardSize.rows; r++) {
            for (let c = 0; c < this.boardSize.cols; c++) {
                if (!this.board[r][c]) {
                    this.board[r][c] = {
                        id: null,
                        image: null,
                        row: r,
                        col: c,
                        matched: true, // Пустые ячейки считаются совпавшими
                        element: null,
                    };
                }
            }
        }
    }
    
    // Generate a guaranteed solvable board by reverse simulation
    generateSolvableBoard() {
        const maxAttempts = 10;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`Generating solvable board, attempt ${attempt + 1}`);
            
            if (this.tryGenerateSolvableBoard()) {
                console.log('Successfully generated solvable board');
                return;
            }
        }
        
        console.log('Failed to generate solvable board, using fallback');
        this.generateFallbackBoard();
    }
    
    tryGenerateSolvableBoard() {
        // Clear the inner board area
        for (let ir = 0; ir < this.innerSize.rows; ir++) {
            for (let ic = 0; ic < this.innerSize.cols; ic++) {
                const r = this.innerOffset.row + ir;
                const c = this.innerOffset.col + ic;
                this.board[r][c] = null;
            }
        }
        
        // Create pairs of tiles to place
        const tilePairs = [];
        for (let i = 0; i < this.tiles.length; i += 2) {
            tilePairs.push([this.tiles[i], this.tiles[i + 1]]);
        }
        
        // Shuffle pairs for randomness
        for (let i = tilePairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tilePairs[i], tilePairs[j]] = [tilePairs[j], tilePairs[i]];
        }
        
        // Place pairs in reverse order (simulate reverse of solving)
        for (const [tile1, tile2] of tilePairs) {
            if (!this.placeTilePair(tile1, tile2)) {
                return false; // Failed to place this pair
            }
        }
        
        return true;
    }
    
    placeTilePair(tile1, tile2) {
        const availablePositions = this.getAvailablePositions();
        const maxPairAttempts = 100;
        
        for (let attempt = 0; attempt < maxPairAttempts; attempt++) {
            if (availablePositions.length < 2) return false;
            
            // Pick two random positions
            const pos1Index = Math.floor(Math.random() * availablePositions.length);
            const pos1 = availablePositions[pos1Index];
            availablePositions.splice(pos1Index, 1);
            
            const pos2Index = Math.floor(Math.random() * availablePositions.length);
            const pos2 = availablePositions[pos2Index];
            availablePositions.splice(pos2Index, 1);
            
            // Temporarily place tiles
            this.board[pos1.row][pos1.col] = {
                ...tile1,
                row: pos1.row,
                col: pos1.col,
                element: null
            };
            this.board[pos2.row][pos2.col] = {
                ...tile2,
                row: pos2.row,
                col: pos2.col,
                element: null
            };
            
            // Check if these positions can be connected
            if (this.canConnect(this.board[pos1.row][pos1.col], this.board[pos2.row][pos2.col])) {
                // Success! Keep the placement
                return true;
            }
            
            // Failed, remove tiles and try again
            this.board[pos1.row][pos1.col] = null;
            this.board[pos2.row][pos2.col] = null;
            
            // Return positions to available list
            availablePositions.push(pos1, pos2);
        }
        
        return false;
    }
    
    getAvailablePositions() {
        const positions = [];
        for (let ir = 0; ir < this.innerSize.rows; ir++) {
            for (let ic = 0; ic < this.innerSize.cols; ic++) {
                const r = this.innerOffset.row + ir;
                const c = this.innerOffset.col + ic;
                if (!this.board[r][c]) {
                    positions.push({ row: r, col: c });
                }
            }
        }
        return positions;
    }
    
    // Fallback: simple random placement if solvable generation fails
    generateFallbackBoard() {
        console.log('Using fallback random placement');
        // Перемешиваем все тайлы
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
        
        let tileIndex = 0;
        for (let ir = 0; ir < this.innerSize.rows; ir++) {
            for (let ic = 0; ic < this.innerSize.cols; ic++) {
                const r = this.innerOffset.row + ir;
                const c = this.innerOffset.col + ic;
                this.board[r][c] = {
                    ...this.tiles[tileIndex],
                    row: r,
                    col: c,
                    element: null,
                };
                tileIndex++;
            }
        }
    }
    
    
    renderBoard() {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';

        // Рендерим полную доску 16×10 используя CSS Grid
        for (let r = 0; r < this.boardSize.rows; r++) {
            for (let c = 0; c < this.boardSize.cols; c++) {
                const tile = this.board[r][c];
                if (!tile) continue; // на всякий случай
                
                const tileElement = document.createElement('div');
                tileElement.className = 'tile';
                tileElement.dataset.row = r; // координаты в полной сетке
                tileElement.dataset.col = c;
                
                // CSS Grid positioning (1-based indexing)
                tileElement.style.gridColumn = `${c + 1}`;
                tileElement.style.gridRow = `${r + 1}`;
                
                // Добавляем специальные классы для виртуальных областей (outer border)
                if (r < this.innerOffset.row || r >= this.innerOffset.row + this.innerSize.rows ||
                    c < this.innerOffset.col || c >= this.innerOffset.col + this.innerSize.cols) {
                    tileElement.classList.add('virtual-tile');
                }
                
                if (tile.matched || !tile.image) {
                    tileElement.classList.add('empty');
                }
                
                // Создаем изображение только для тайлов с изображениями
                if (tile.image) {
                    const img = document.createElement('img');
                    img.src = tile.image;
                    img.alt = `Tile ${tile.id}`;
                    if (tile.matched) img.style.display = 'none';
                    tileElement.appendChild(img);
                }
                
                // Добавляем обработчик клика только для тайлов с изображениями и не матченых тайлов
                if (tile.image && !tile.matched) {
                    tileElement.addEventListener('click', () => this.handleTileClick(tile.row, tile.col));
                }
                
                // Сохраняем ссылку на DOM элемент
                tile.element = tileElement;
                
                gameBoard.appendChild(tileElement);
            }
        }
    }
    
    // implement new function to check if the tile is in the inner area
    isTileInInnerArea(tile) {
        return tile.row >= this.innerOffset.row && tile.row < this.innerOffset.row + this.innerSize.rows &&
               tile.col >= this.innerOffset.col && tile.col < this.innerOffset.col + this.innerSize.cols;
    }

    handleTileClick(row, col) {
        if (this.isGameOver || this.isPaused || this.isShuffling || this.isSolving) return;


        const tile = this.board[row][col];
        if (!tile || tile.matched) return;
        
        // Воспроизводим звук клика
        this.playSound('click');
        
        console.log('Tile clicked:', { row, col, tileId: tile.id, matched: tile.matched });
        
        if (!this.selectedTile) {
            this.selectedTile = tile;
            tile.element.classList.add('selected');
            // Haptic feedback for tile selection
            this.triggerSelectionHapticFeedback();
            console.log('First tile selected:', tile.id);
        } else if (this.selectedTile === tile) {
            this.selectedTile.element.classList.remove('selected');
            this.selectedTile = null;
            console.log('Same tile clicked, deselected');
        } else if (this.selectedTile.id === tile.id) {
            console.log('Matching tiles found, checking connection...');
            
            if (this.canConnect(this.selectedTile, tile)) {
                console.log('Connection successful!');
                this.connectTiles(this.selectedTile, tile);
            } else {
                console.log('Connection failed');
                this.showConnectionError();
                // Haptic feedback for wrong move
                this.triggerWrongMoveHapticFeedback();
            }
        } else {
            console.log('Different tile type, switching selection');
            this.selectedTile.element.classList.remove('selected');
            this.selectedTile = tile;
            tile.element.classList.add('selected');
            // Haptic feedback for tile selection change
            this.triggerSelectionHapticFeedback();
        }
    }
    
    canConnect(tile1, tile2) {
        if (!tile1 || !tile2) return false;
        if (tile1.id !== tile2.id) return false;
        console.log(`Checking connection between tiles at (${tile1.row},${tile1.col}) and (${tile2.row},${tile2.col})`);
        
        // Use the improved algorithm from old implementation
        const result = this.checkConnection(tile1.row, tile1.col, tile2.row, tile2.col);
        if (result.ok) {
            this.path = result.path;
            return true;
        }
        return false;
    }
    
    // Проверяем, касаются ли плитки друг друга
    areTilesAdjacent(tile1, tile2) {
        if (tile1.id !== tile2.id) return false;
        
        // Проверяем соседние позиции
        const rowDiff = Math.abs(tile1.row - tile2.row);
        const colDiff = Math.abs(tile1.col - tile2.col);
        
        // Плитки касаются, если они в соседних клетках (по горизонтали или вертикали)
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    // Поиск в ширину (BFS) по полной сетке 10x16 с улучшенной обработкой L-образных путей
    // Main connection checking function based on old implementation
    checkConnection(i1, j1, i2, j2) {
        if (!this.isInsideFullGrid(i1, j1) || !this.isInsideFullGrid(i2, j2)) return { ok: false };
        if ((i1 === i2) && (j1 === j2)) return { ok: false };
        if (this.board[i1][j1].matched || this.board[i2][j2].matched) return { ok: false };
        if (this.board[i1][j1].id !== this.board[i2][j2].id) return { ok: false };
        
        console.log(`Checking connection between (${i1},${j1}) and (${i2},${j2})`);
        
        // First try inner paths (L-shapes within the board)
        const innerResult = this.checkInner(i1, j1, i2, j2);
        if (innerResult.ok) {
            console.log('Inner path found:', innerResult.path);
            return innerResult;
        }
        
        // Then try outer paths (through the frame)
        const outerResult = this.checkOuter(i1, j1, i2, j2);
        if (outerResult.ok) {
            console.log('Outer path found:', outerResult.path);
            return outerResult;
        }
        
        console.log(`No path found between (${i1},${j1}) and (${i2},${j2})`);
        return { ok: false };
    }
    
    // Check for L-shaped paths within the board boundaries  
    checkInner(i1, j1, i2, j2) {
        const self = this;
        const free = function(i, j) {
            if (((i === i1) && (j === j1)) || ((i === i2) && (j === j2)))
                return true;
            if (!self.isInsideFullGrid(i, j)) return false;
            const tile = self.board[i][j];
            if (!tile) return true; // null tiles are considered free
            return tile.matched || !tile.id;
        };

        const ifrom = Math.min(i1, i2);
        const ito = Math.max(i1, i2);
        const jfrom = Math.min(j1, j2);
        const jto = Math.max(j1, j2);

        // Try horizontal-then-vertical L-shapes
        for (let ti = ifrom; ti <= ito; ti++) {
            let ok = true;
            
            // Check path from (i1,j1) to (ti,j1)
            const startI = Math.min(i1, ti);
            const endI = Math.max(i1, ti);
            for (let i = startI; i <= endI; i++) {
                if (!free(i, j1)) {
                    ok = false;
                    break;
                }
            }
            
            // Check path from (ti,j1) to (ti,j2)  
            if (ok) {
                const startJ = Math.min(j1, j2);
                const endJ = Math.max(j1, j2);
                for (let j = startJ; j <= endJ; j++) {
                    if (!free(ti, j)) {
                        ok = false;
                        break;
                    }
                }
            }
            
            // Check path from (ti,j2) to (i2,j2)
            if (ok) {
                const startI2 = Math.min(ti, i2);
                const endI2 = Math.max(ti, i2);
                for (let i = startI2; i <= endI2; i++) {
                    if (!free(i, j2)) {
                        ok = false;
                        break;
                    }
                }
            }

            if (ok) {
                return {
                    ok: true, 
                    path: [
                        { row: i1, col: j1 }, 
                        { row: ti, col: j1 }, 
                        { row: ti, col: j2 }, 
                        { row: i2, col: j2 }
                    ]
                };
            }
        }

        // Try vertical-then-horizontal L-shapes
        for (let tj = jfrom; tj <= jto; tj++) {
            let ok = true;
            
            // Check path from (i1,j1) to (i1,tj)
            const startJ = Math.min(j1, tj);
            const endJ = Math.max(j1, tj);
            for (let j = startJ; j <= endJ; j++) {
                if (!free(i1, j)) {
                    ok = false;
                    break;
                }
            }
            
            // Check path from (i1,tj) to (i2,tj)
            if (ok) {
                const startI = Math.min(i1, i2);
                const endI = Math.max(i1, i2);
                for (let i = startI; i <= endI; i++) {
                    if (!free(i, tj)) {
                        ok = false;
                        break;
                    }
                }
            }
            
            // Check path from (i2,tj) to (i2,j2)
            if (ok) {
                const startJ2 = Math.min(tj, j2);
                const endJ2 = Math.max(tj, j2);
                for (let j = startJ2; j <= endJ2; j++) {
                    if (!free(i2, j)) {
                        ok = false;
                        break;
                    }
                }
            }

            if (ok) {
                return {
                    ok: true, 
                    path: [
                        { row: i1, col: j1 }, 
                        { row: i1, col: tj }, 
                        { row: i2, col: tj }, 
                        { row: i2, col: j2 }
                    ]
                };
            }
        }

        return { ok: false };
    }
    
    // Check for paths that go through the outer frame area
    checkOuter(i1, j1, i2, j2) {
        const self = this;
        const free = function(i, j) {
            // Frame cells are always passable
            if ((i === -1) || (i === self.boardSize.rows) || (j === -1) || (j === self.boardSize.cols))
                return true;
            if (((i === i1) && (j === j1)) || ((i === i2) && (j === j2)))
                return true;
            if (!self.isInsideFullGrid(i, j)) return false;
            const tile = self.board[i][j];
            if (!tile) return true; // null tiles are considered free
            return tile.matched || !tile.id;
        };

        const ifrom = Math.min(i1, i2);
        const ito = Math.max(i1, i2);
        const jfrom = Math.min(j1, j2);  
        const jto = Math.max(j1, j2);

        // Try paths above the board
        for (let dt = 1; dt <= this.boardSize.rows; dt++) {
            const ti = ifrom - dt;
            if (ti >= -1) {
                let ok = true;
                
                // Check path from (i1,j1) up to (ti,j1)
                for (let i = i1; i >= ti; i--) {
                    if (!free(i, j1)) {
                        ok = false;
                        break;
                    }
                }
                
                // Check path from (i2,j2) up to (ti,j2)  
                if (ok) {
                    for (let i = i2; i >= ti; i--) {
                        if (!free(i, j2)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                // Check horizontal path at level ti
                if (ok) {
                    for (let j = jfrom; j <= jto; j++) {
                        if (!free(ti, j)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                if (ok) {
                    return {
                        ok: true,
                        path: [
                            { row: i1, col: j1 }, 
                            { row: ti, col: j1 }, 
                            { row: ti, col: j2 }, 
                            { row: i2, col: j2 }
                        ]
                    };
                }
            }
            
            // Try paths below the board
            const ti2 = ito + dt;
            if (ti2 <= this.boardSize.rows) {
                let ok = true;
                
                // Check path from (i1,j1) down to (ti2,j1)
                for (let i = i1; i <= ti2; i++) {
                    if (!free(i, j1)) {
                        ok = false;
                        break;
                    }
                }
                
                // Check path from (i2,j2) down to (ti2,j2)
                if (ok) {
                    for (let i = i2; i <= ti2; i++) {
                        if (!free(i, j2)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                // Check horizontal path at level ti2
                if (ok) {
                    for (let j = jfrom; j <= jto; j++) {
                        if (!free(ti2, j)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                if (ok) {
                    return {
                        ok: true,
                        path: [
                            { row: i1, col: j1 }, 
                            { row: ti2, col: j1 }, 
                            { row: ti2, col: j2 }, 
                            { row: i2, col: j2 }
                        ]
                    };
                }
            }
        }

        // Try paths to the left of the board
        for (let dt = 1; dt <= this.boardSize.cols; dt++) {
            const tj = jfrom - dt;
            if (tj >= -1) {
                let ok = true;
                
                // Check path from (i1,j1) left to (i1,tj)
                for (let j = j1; j >= tj; j--) {
                    if (!free(i1, j)) {
                        ok = false;
                        break;
                    }
                }
                
                // Check path from (i2,j2) left to (i2,tj)
                if (ok) {
                    for (let j = j2; j >= tj; j--) {
                        if (!free(i2, j)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                // Check vertical path at column tj
                if (ok) {
                    for (let i = ifrom; i <= ito; i++) {
                        if (!free(i, tj)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                if (ok) {
                    return {
                        ok: true,
                        path: [
                            { row: i1, col: j1 }, 
                            { row: i1, col: tj }, 
                            { row: i2, col: tj }, 
                            { row: i2, col: j2 }
                        ]
                    };
                }
            }
            
            // Try paths to the right of the board
            const tj2 = jto + dt;
            if (tj2 <= this.boardSize.cols) {
                let ok = true;
                
                // Check path from (i1,j1) right to (i1,tj2)
                for (let j = j1; j <= tj2; j++) {
                    if (!free(i1, j)) {
                        ok = false;
                        break;
                    }
                }
                
                // Check path from (i2,j2) right to (i2,tj2)
                if (ok) {
                    for (let j = j2; j <= tj2; j++) {
                        if (!free(i2, j)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                // Check vertical path at column tj2
                if (ok) {
                    for (let i = ifrom; i <= ito; i++) {
                        if (!free(i, tj2)) {
                            ok = false;
                            break;
                        }
                    }
                }
                
                if (ok) {
                    return {
                        ok: true,
                        path: [
                            { row: i1, col: j1 }, 
                            { row: i1, col: tj2 }, 
                            { row: i2, col: tj2 }, 
                            { row: i2, col: j2 }
                        ]
                    };
                }
            }
        }

        return { ok: false };
    }
    
    // Восстанавливаем путь для отображения
    reconstructPath(parent, tile1, tile2) {
        const path = [];
        let current = { row: tile2.row, col: tile2.col };
        
        while (current.row !== tile1.row || current.col !== tile1.col) {
            path.unshift(current);
            const key = `${current.row},${current.col}`;
            const parentNode = parent.get(key);
            if (!parentNode) break;
            current = { row: parentNode.row, col: parentNode.col };
        }
        
        path.unshift({ row: tile1.row, col: tile1.col });
        return path;
    }
    
    connectTiles(tile1, tile2) {
        // check is ids are the same
        if (tile1.id != tile2.id) {
            console.log('Different tile clicked, deselected');
            this.selectedTile = null;
            return;
        }

        // Убираем выделение
        tile1.element.classList.remove('selected');
        tile2.element.classList.remove('selected');
        
        // Немедленно помечаем плитки как совпавшие
        tile1.matched = true;
        tile2.matched = true;
        
        // Обновляем UI - плитки становятся пустыми клетками
        tile1.element.classList.add('empty');
        tile2.element.classList.add('empty');
        
        // Убираем изображения из пустых клеток
        const img1 = tile1.element.querySelector('img');
        const img2 = tile2.element.querySelector('img');
        if (img1) img1.style.display = 'none';
        if (img2) img2.style.display = 'none';
        
        // Показываем линию соединения
        this.showConnectionLine(tile1, tile2);
        
        // Увеличиваем счет
        this.score += 10;
        this.updateScore();
        
        // Воспроизводим звук успеха (с учетом фоновой музыки)
        this.playSoundOrHaptic('success', 'success');
        
        // Haptic feedback for successful match
        this.triggerHapticFeedback();
        
        // Проверяем, закончилась ли игра
        console.log('Calling checkGameEnd from connectTiles');
        this.checkGameEnd();
        
        // Проверяем наличие доступных ходов только если игра не закончена
        if (!this.isGameOver) {
            this.checkAndHandleNoMoves();
        }
        
        this.selectedTile = null;
    }

    isInsideFullGrid(row, col) {
        return row >= 0 && row < this.boardSize.rows &&
               col >= 0 && col < this.boardSize.cols;
      }

    // Клетка пуста, если за пределами внутренней области null или внутри и tile.matched
    isCellEmpty(row, col) {
        if (!this.isInsideFullGrid(row, col)) return false;
        const tile = this.board[row]?.[col];
        
        // Frame cells (outer border) are always passable for pathfinding
        if (this.isFrameCell(row, col)) return true;
        
        return !tile || tile.matched === true;
    }
    
    // Check if position is in the frame (outer border) area
    isFrameCell(row, col) {
        // Frame is the outer border of the full grid
        return (row === 0 || row === this.boardSize.rows - 1 || 
                col === 0 || col === this.boardSize.cols - 1);
    }
    
    isPositionEmpty(pos) {
        if (!this.isInsideFullGrid(pos.row, pos.col)) return false;
        const tile = this.board[pos.row][pos.col];
        return !tile || tile.matched;
    }
    
    isValidPosition(row, col) {
        return this.isInsideFullGrid(row, col);
    }
    
    showConnectionLine(tile1, tile2) {
        // Instant visual feedback with screen flash and tile highlights
        this.createInstantFlash(tile1, tile2);
        
        // Очищаем предыдущие линии и эффекты
        this.clearAllLightningEffects();
        
        // Если плитки касаются друг друга, рисуем прямую молнию
        if (this.areTilesAdjacent(tile1, tile2)) {
            this.drawLightningLine(tile1, tile2);
            return;
        }
        
        if (this.path && this.path.length > 0) {
            this.drawLightningPath();
        } else {
            // Если путь не найден, рисуем прямую молнию между плитками
            this.drawLightningLine(tile1, tile2);
        }
    }
    
    // Create instant visual feedback
    createInstantFlash(tile1, tile2) {
        // Flash the screen
        const flash = document.createElement('div');
        flash.className = 'lightning-instant-flash';
        
        // Calculate center point between tiles for flash origin
        const gameBoard = document.getElementById('gameBoard');
        const boardRect = gameBoard.getBoundingClientRect();
        const cellWidth = boardRect.width / 10;
        const cellHeight = boardRect.height / 16;
        
        const tile1X = tile1.col * cellWidth + cellWidth / 2;
        const tile1Y = tile1.row * cellHeight + cellHeight / 2;
        const tile2X = tile2.col * cellWidth + cellWidth / 2;
        const tile2Y = tile2.row * cellHeight + cellHeight / 2;
        
        const centerX = (tile1X + tile2X) / 2;
        const centerY = (tile1Y + tile2Y) / 2;
        
        const flashX = ((boardRect.left + centerX) / window.innerWidth) * 100;
        const flashY = ((boardRect.top + centerY) / window.innerHeight) * 100;
        
        flash.style.setProperty('--flash-x', `${flashX}%`);
        flash.style.setProperty('--flash-y', `${flashY}%`);
        
        document.body.appendChild(flash);
        
        // Flash the tiles themselves
        this.createTileFlash(tile1, boardRect, cellWidth, cellHeight);
        this.createTileFlash(tile2, boardRect, cellWidth, cellHeight);
        
        // Remove flash after animation
        setTimeout(() => {
            flash.remove();
        }, 150);
    }
    
    // Create tile flash effect
    createTileFlash(tile, boardRect, cellWidth, cellHeight) {
        const tileFlash = document.createElement('div');
        tileFlash.className = 'tile-flash';
        
        const x = tile.col * cellWidth;
        const y = tile.row * cellHeight;
        
        tileFlash.style.position = 'fixed';
        tileFlash.style.left = `${boardRect.left + x}px`;
        tileFlash.style.top = `${boardRect.top + y}px`;
        tileFlash.style.width = `${cellWidth}px`;
        tileFlash.style.height = `${cellHeight}px`;
        
        document.body.appendChild(tileFlash);
        
        // Remove after animation
        setTimeout(() => {
            tileFlash.remove();
        }, 200);
    }
    
    clearAllLightningEffects() {
        // Удаляем все старые эффекты (but not instant flash effects)
        const oldEffects = document.querySelectorAll('.path-line, .lightning-container, .lightning-bolt, .lightning-glow, .energy-particle, .lightning-jagged');
        oldEffects.forEach(effect => effect.remove());
    }
    
    // Проверяем, является ли путь L-образным
    isLShapePath() {
        if (!this.path || this.path.length < 3) return false;
        
        // L-образный путь должен иметь минимум 3 точки и содержать поворот
        let hasHorizontal = false;
        let hasVertical = false;
        
        for (let i = 1; i < this.path.length - 1; i++) {
            const prev = this.path[i - 1];
            const curr = this.path[i];
            const next = this.path[i + 1];
            
            // Проверяем горизонтальное движение
            if (curr.row === prev.row && curr.row === next.row) {
                hasHorizontal = true;
            }
            
            // Проверяем вертикальное движение
            if (curr.col === prev.col && curr.col === next.col) {
                hasVertical = true;
            }
        }
        
        // L-образный путь должен содержать и горизонтальное, и вертикальное движение
        return hasHorizontal && hasVertical;
    }
    
    // Legacy function - now redirects to lightning path
    drawPathThroughEmptyCells() {
        this.drawLightningPath();
    }
    
    
    
    // Рисуем горизонтальную линию
    drawHorizontalLine(from, to, tileWidth, tileHeight) {
        const gameBoard = document.getElementById('gameBoard');
        
        const startCol = Math.min(from.col, to.col);
        const endCol = Math.max(from.col, to.col);
        const row = from.row;
        
        const startX = startCol * tileWidth + tileWidth / 2;
        const endX = endCol * tileWidth + tileWidth / 2;
        const y = row * tileHeight + tileHeight / 2;
        
        const line = document.createElement('div');
        line.className = 'path-line';
        line.style.position = 'absolute';
        line.style.background = '#4299e1';
        line.style.height = '3px';
        line.style.zIndex = '10';
        line.style.width = `${endX - startX}px`;
        line.style.left = `${startX}px`;
        line.style.top = `${y - 1.5}px`; // Центрируем линию
        line.style.transform = 'none'; // Без поворота для горизонтальной линии
        
        gameBoard.appendChild(line);
    }
    
    // Рисуем горизонтальную линию для CSS Grid
    drawHorizontalLineGrid(from, to, cellWidth, cellHeight, boardRect) {
        const startCol = Math.min(from.col, to.col);
        const endCol = Math.max(from.col, to.col);
        const row = from.row;
        
        const startX = startCol * cellWidth + cellWidth / 2;
        const endX = endCol * cellWidth + cellWidth / 2;
        const y = row * cellHeight + cellHeight / 2;
        
        const length = endX - startX;
        
        const line = document.createElement('div');
        line.className = 'path-line';
        line.style.position = 'fixed';
        line.style.left = `${boardRect.left + startX}px`;
        line.style.top = `${boardRect.top + y - 1.5}px`;
        line.style.width = `${length}px`;
        line.style.height = '3px';
        line.style.background = '#4299e1';
        line.style.borderRadius = '2px';
        line.style.zIndex = '1000';
        line.style.boxShadow = '0 0 4px rgba(66, 153, 225, 0.6)';
        line.style.pointerEvents = 'none';
        
        document.body.appendChild(line);
    }
    
    // Рисуем вертикальную линию
    drawVerticalLine(from, to, tileWidth, tileHeight) {
        const gameBoard = document.getElementById('gameBoard');
        
        const startRow = Math.min(from.row, to.row);
        const endRow = Math.max(from.row, to.row);
        const col = from.col;
        
        const startY = startRow * tileHeight + tileHeight / 2;
        const endY = endRow * tileHeight + tileHeight / 2;
        const x = col * tileWidth + tileWidth / 2;
        
        const line = document.createElement('div');
        line.className = 'path-line';
        line.style.position = 'absolute';
        line.style.background = '#4299e1';
        line.style.width = '3px'; // Вертикальная линия
        line.style.height = `${endY - startY}px`;
        line.style.zIndex = '10';
        line.style.left = `${x - 1.5}px`; // Центрируем линию
        line.style.top = `${startY}px`;
        line.style.transform = 'none'; // Без поворота для вертикальной линии
        
        gameBoard.appendChild(line);
    }
    
    // Рисуем вертикальную линию для CSS Grid
    drawVerticalLineGrid(from, to, cellWidth, cellHeight, boardRect) {
        const startRow = Math.min(from.row, to.row);
        const endRow = Math.max(from.row, to.row);
        const col = from.col;
        
        const startY = startRow * cellHeight + cellHeight / 2;
        const endY = endRow * cellHeight + cellHeight / 2;
        const x = col * cellWidth + cellWidth / 2;
        
        const length = endY - startY;
        
        const line = document.createElement('div');
        line.className = 'path-line';
        line.style.position = 'fixed';
        line.style.left = `${boardRect.left + x - 1.5}px`;
        line.style.top = `${boardRect.top + startY}px`;
        line.style.width = '3px';
        line.style.height = `${length}px`;
        line.style.background = '#4299e1';
        line.style.borderRadius = '2px';
        line.style.zIndex = '1000';
        line.style.boxShadow = '0 0 4px rgba(66, 153, 225, 0.6)';
        line.style.pointerEvents = 'none';
        
        document.body.appendChild(line);
    }
    
    // Lightning path drawing for complete path
    drawLightningPath() {
        const gameBoard = document.getElementById('gameBoard');
        const boardRect = gameBoard.getBoundingClientRect();
        
        // Calculate grid cell dimensions
        const cellWidth = boardRect.width / 10; // 10 columns
        const cellHeight = boardRect.height / 16; // 16 rows
        
        // Draw lightning segments for each part of the path
        for (let i = 0; i < this.path.length - 1; i++) {
            const current = this.path[i];
            const next = this.path[i + 1];
            
            // Much faster chaining effect
            setTimeout(() => {
                this.drawLightningSegment(current, next, cellWidth, cellHeight, boardRect, i);
            }, i * 30); // Reduced from 100ms to 30ms
        }
        
        // Clean up after animation
        setTimeout(() => {
            this.clearAllLightningEffects();
        }, 700); // Reduced from 1500ms to 700ms
    }
    
    // Draw lightning between two tiles
    drawLightningLine(tile1, tile2) {
        const gameBoard = document.getElementById('gameBoard');
        const boardRect = gameBoard.getBoundingClientRect();
        
        // Calculate grid cell dimensions
        const cellWidth = boardRect.width / 10; // 10 columns
        const cellHeight = boardRect.height / 16; // 16 rows
        
        this.drawLightningSegment(
            { row: tile1.row, col: tile1.col },
            { row: tile2.row, col: tile2.col },
            cellWidth, cellHeight, boardRect, 0
        );
        
        // Clean up after animation
        setTimeout(() => {
            this.clearAllLightningEffects();
        }, 600); // Reduced from 1200ms to 600ms
    }
    
    // Draw a single lightning segment with energy effects
    drawLightningSegment(from, to, cellWidth, cellHeight, boardRect, segmentIndex = 0) {
        const isHorizontal = from.row === to.row;
        const isVertical = from.col === to.col;
        
        if (isHorizontal) {
            this.createHorizontalLightning(from, to, cellWidth, cellHeight, boardRect, segmentIndex);
        } else if (isVertical) {
            this.createVerticalLightning(from, to, cellWidth, cellHeight, boardRect, segmentIndex);
        }
    }
    
    // Create horizontal lightning bolt with effects
    createHorizontalLightning(from, to, cellWidth, cellHeight, boardRect, segmentIndex) {
        const startCol = Math.min(from.col, to.col);
        const endCol = Math.max(from.col, to.col);
        const row = from.row;
        
        const startX = startCol * cellWidth + cellWidth / 2;
        const endX = endCol * cellWidth + cellWidth / 2;
        const y = row * cellHeight + cellHeight / 2;
        const length = endX - startX;
        
        // Create main lightning bolt
        this.createLightningBolt(
            boardRect.left + startX,
            boardRect.top + y - 2,
            length,
            4,
            0, // horizontal rotation
            segmentIndex
        );
        
        // Add jagged lightning effect
        this.createJaggedLightning(
            boardRect.left + startX,
            boardRect.top + y,
            length,
            0,
            segmentIndex
        );
        
        // Add energy particles along the path
        this.createEnergyParticles(
            boardRect.left + startX,
            boardRect.top + y,
            length,
            0,
            segmentIndex
        );
    }
    
    // Create vertical lightning bolt with effects
    createVerticalLightning(from, to, cellWidth, cellHeight, boardRect, segmentIndex) {
        const startRow = Math.min(from.row, to.row);
        const endRow = Math.max(from.row, to.row);
        const col = from.col;
        
        const startY = startRow * cellHeight + cellHeight / 2;
        const endY = endRow * cellHeight + cellHeight / 2;
        const x = col * cellWidth + cellWidth / 2;
        const length = endY - startY;
        
        // Create main lightning bolt
        this.createLightningBolt(
            boardRect.left + x - 2,
            boardRect.top + startY,
            length,
            4,
            90, // vertical rotation
            segmentIndex
        );
        
        // Add jagged lightning effect
        this.createJaggedLightning(
            boardRect.left + x,
            boardRect.top + startY,
            length,
            90,
            segmentIndex
        );
        
        // Add energy particles along the path
        this.createEnergyParticles(
            boardRect.left + x,
            boardRect.top + startY,
            length,
            90,
            segmentIndex
        );
    }
    
    // Create the main lightning bolt element
    createLightningBolt(x, y, length, thickness, rotation, segmentIndex) {
        const container = document.createElement('div');
        container.className = 'lightning-container';
        
        // Enhanced thickness for boldness
        const boltThickness = thickness * 2; // Double the thickness
        const coreThickness = Math.max(2, thickness * 0.6);
        
        // Main lightning bolt
        const bolt = document.createElement('div');
        bolt.className = 'lightning-bolt';
        bolt.style.left = `${x}px`;
        bolt.style.top = `${y}px`;
        bolt.style.width = rotation === 90 ? `${boltThickness}px` : `${length}px`;
        bolt.style.height = rotation === 90 ? `${length}px` : `${boltThickness}px`;
        bolt.style.animationDelay = `${segmentIndex * 0.03}s`; // Reduced from 0.1s to 0.03s
        
        // Lightning core (bright white center)
        const core = document.createElement('div');
        core.className = 'lightning-core';
        const coreOffset = (boltThickness - coreThickness) / 2;
        core.style.left = `${x + (rotation === 90 ? coreOffset : 0)}px`;
        core.style.top = `${y + (rotation === 90 ? 0 : coreOffset)}px`;
        core.style.width = rotation === 90 ? `${coreThickness}px` : `${length}px`;
        core.style.height = rotation === 90 ? `${length}px` : `${coreThickness}px`;
        core.style.animationDelay = `${segmentIndex * 0.03 + 0.05}s`; // Much faster core flash
        
        // Enhanced glow effect
        const glow = document.createElement('div');
        glow.className = 'lightning-glow';
        const glowSize = Math.max(24, boltThickness * 3);
        const glowOffset = glowSize / 2;
        glow.style.left = `${x - glowOffset + boltThickness/2}px`;
        glow.style.top = `${y - glowOffset + boltThickness/2}px`;
        glow.style.width = rotation === 90 ? `${glowSize}px` : `${length + glowSize}px`;
        glow.style.height = rotation === 90 ? `${length + glowSize}px` : `${glowSize}px`;
        glow.style.animationDelay = `${segmentIndex * 0.03}s`; // Faster glow timing
        
        container.appendChild(glow);
        container.appendChild(bolt);
        container.appendChild(core);
        document.body.appendChild(container);
    }
    
    // Create jagged lightning effects
    createJaggedLightning(x, y, length, rotation, segmentIndex) {
        const jaggedCount = Math.floor(length / 15) + 3; // More jagged segments for bolder effect
        
        for (let i = 0; i < jaggedCount; i++) {
            const jagged = document.createElement('div');
            jagged.className = 'lightning-jagged';
            
            const segmentLength = length / jaggedCount;
            const offsetX = rotation === 90 ? 0 : i * segmentLength;
            const offsetY = rotation === 90 ? i * segmentLength : 0;
            const randomOffset = (Math.random() - 0.5) * 12; // Stronger random jagged effect
            
            jagged.style.left = `${x + offsetX + (rotation === 90 ? randomOffset : 0)}px`;
            jagged.style.top = `${y + offsetY + (rotation === 90 ? 0 : randomOffset)}px`;
            jagged.style.width = rotation === 90 ? '4px' : `${segmentLength + 2}px`; // Thicker jagged lines
            jagged.style.height = rotation === 90 ? `${segmentLength + 2}px` : '4px';
            jagged.style.animationDelay = `${segmentIndex * 0.03 + i * 0.01}s`; // Much faster jagged timing
            jagged.style.transform = `rotate(${Math.random() * 10 - 5}deg) scale(${0.8 + Math.random() * 0.4})`; // More variation
            
            document.body.appendChild(jagged);
        }
    }
    
    // Create floating energy particles
    createEnergyParticles(x, y, length, rotation, segmentIndex) {
        const particleCount = Math.floor(length / 12) + 5; // Many more particles for bold effect
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'energy-particle';
            
            const progress = i / (particleCount - 1);
            const offsetX = rotation === 90 ? 0 : progress * length;
            const offsetY = rotation === 90 ? progress * length : 0;
            
            // Enhanced random position variation
            const randomX = (Math.random() - 0.5) * 20;
            const randomY = (Math.random() - 0.5) * 20;
            
            particle.style.left = `${x + offsetX + randomX}px`;
            particle.style.top = `${y + offsetY + randomY}px`;
            particle.style.animationDelay = `${segmentIndex * 0.03 + i * 0.02}s`; // Faster particle timing
            
            // Enhanced particle movement with more dramatic spread
            const moveDistance = 60 + Math.random() * 40; // Larger movement range
            const angle = Math.random() * Math.PI * 2; // Random direction
            const moveX = Math.cos(angle) * moveDistance;
            const moveY = Math.sin(angle) * moveDistance;
            
            particle.style.setProperty('--random-x', `${moveX}px`);
            particle.style.setProperty('--random-y', `${moveY}px`);
            
            // Add size variation for more dramatic effect
            const size = 4 + Math.random() * 4; // 4-8px particles
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            document.body.appendChild(particle);
        }
        
        // Add extra burst particles at the endpoints for dramatic effect
        this.createBurstParticles(x, y, segmentIndex);
        this.createBurstParticles(
            x + (rotation === 90 ? 0 : length), 
            y + (rotation === 90 ? length : 0), 
            segmentIndex
        );
    }
    
    // Create dramatic burst particles at connection points
    createBurstParticles(x, y, segmentIndex) {
        const burstCount = 8;
        
        for (let i = 0; i < burstCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'energy-particle';
            
            const angle = (i / burstCount) * Math.PI * 2;
            const distance = 30 + Math.random() * 30;
            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;
            
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.animationDelay = `${segmentIndex * 0.03 + 0.1 + i * 0.01}s`; // Faster burst timing
            particle.style.setProperty('--random-x', `${moveX}px`);
            particle.style.setProperty('--random-y', `${moveY}px`);
            
            // Larger burst particles
            const size = 5 + Math.random() * 3;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            document.body.appendChild(particle);
        }
    }
    
    // Legacy function kept for compatibility
    drawDirectLine(tile1, tile2) {
        this.drawLightningLine(tile1, tile2);
    }
    
    showConnectionError() {
        // Показываем ошибку соединения
        const tile1 = this.selectedTile;
        tile1.element.classList.remove('selected');
        
        // Воспроизводим звук ошибки (с учетом фоновой музыки)  
        this.playSoundOrHaptic('wrong', 'error');
        
        // Мигаем плиткой
        tile1.element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            tile1.element.style.animation = '';
        }, 500);
        
        this.selectedTile = null;
    }
    
    startTimer() {
        this.gameTimer = setInterval(() => {
            if (!this.isPaused && !this.isGameOver) {
                this.timeLeft--;
                this.updateTimer();
                
                if (this.timeLeft <= 0) {
                    this.gameOver('Time is up!');
                }
            }
        }, 1000);
    }
    
    updateTimer() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timerElement = document.getElementById('timer');
        const timerProgress = document.getElementById('timerProgress');
        
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Обновляем прогресс-бар таймера
        if (timerProgress) {
            const progressPercent = (this.timeLeft / 600) * 100; // 600 секунд = 10 минут
            timerProgress.style.width = `${progressPercent}%`;
            
            // Меняем цвет при малом времени
            if (this.timeLeft <= 30) {
                timerProgress.style.background = 'linear-gradient(90deg, #e53e3e, #c53030, #9b2c2c)';
                timerElement.style.color = '#e53e3e';
                timerElement.style.animation = 'pulse 1s infinite';
            } else if (this.timeLeft <= 60) {
                timerProgress.style.background = 'linear-gradient(90deg, #ed8936, #dd6b20, #c05621)';
            } else {
                timerProgress.style.background = 'linear-gradient(90deg, #48bb78, #38a169, #2f855a)';
                timerElement.style.color = 'white';
                timerElement.style.animation = '';
            }
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
    }
    
    updateLevelDisplay() {
        const levelElement = document.getElementById('currentLevel');
        const descriptionElement = document.getElementById('levelDescription');
        if (levelElement && descriptionElement) {
            const level = this.getCurrentLevel();
            levelElement.textContent = `Уровень ${level.id}: ${level.name}`;
            descriptionElement.textContent = level.description;
        }
    }
    
    updateHearts() {
        const heartsElement = document.getElementById('hearts');
        if (heartsElement) {
            heartsElement.textContent = this.hearts;
        }
    }
    
    loseHeart() {
        if (this.hearts > 0) {
            this.hearts--;
            this.updateHearts();
            
            if (this.hearts <= 0) {
                this.gameOver('No more hearts!');
            }
        }
    }
    
    gainHearts(count) {
        this.hearts = this.hearts + count;
        this.updateHearts();
    }
    
    checkHearts() {
        if (this.hearts <= 0) {
            this.gameOver('No more hearts!');
            return false;
        }
        return true;
    }
    
    checkGameEnd() {
        console.log('=== CHECKING GAME END ===');
        // Проверяем, остались ли несовмещенные плитки на доске
        let unmatched = 0;
        let totalTiles = 0;
        let matchedTiles = 0;
        let nullTiles = 0;
        
        console.log(`Checking game end - innerOffset: (${this.innerOffset.row},${this.innerOffset.col}), innerSize: ${this.innerSize.rows}x${this.innerSize.cols}`);
        
        for (let r = this.innerOffset.row; r < this.innerOffset.row + this.innerSize.rows; r++) {
            for (let c = this.innerOffset.col; c < this.innerOffset.col + this.innerSize.cols; c++) {
                const t = this.board[r]?.[c];
                totalTiles++;
                
                if (!t) {
                    nullTiles++;
                    console.log(`Null tile at (${r},${c})`);
                } else {
                    console.log(`Tile at (${r},${c}): id=${t.id}, matched=${t.matched}`);
                    if (t.matched) {
                        matchedTiles++;
                    } else if (t.id) {
                        unmatched++;
                        console.log(`*** UNMATCHED TILE at (${r},${c}): id=${t.id}, matched=${t.matched} ***`);
                    }
                }
            }
        }
        
        console.log(`SUMMARY: Total=${totalTiles}, Null=${nullTiles}, Matched=${matchedTiles}, Unmatched=${unmatched}`);
        
        if (unmatched > 0) {
            console.log(`Level NOT completed - ${unmatched} unmatched tiles remaining`);
            return; // есть еще живые тайлы
        }
        
        // Level completed!
        console.log('*** LEVEL COMPLETED! ***');
        this.levelCompleted();
    }
    
    levelCompleted() {
        console.log('*** LEVEL COMPLETED FUNCTION CALLED ***');
        this.isGameOver = true; // Mark as game over to prevent further move checking
        
        this.playSound('levelcomplited');
        
        // Send level completion data to Telegram
        this.sendLevelCompletionToTelegram();
        
        // Stop the timer
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        // Update background to next level immediately (if not final level)
        if (this.currentLevel < 11) {
            const nextLevel = this.levels.find(level => level.id === this.currentLevel + 1);
            if (nextLevel) {
                this.updateBackground(nextLevel.background);
            }
        }
        
        const overlay = document.getElementById('gameOverlay');
        
        if (this.currentLevel >= 11) {
            // All levels completed - mega congratulation
            overlay.innerHTML = `
                <div class="game-overlay-content">
                    <h2>🎉🏆 MEGA CONGRATULATIONS! 🏆🎉</h2>
                    <p>You've completed all 11 levels!</p>
                    <p>You are a true PaoPao master!</p>
                    <div class="final-score">Final Score: ${this.score}</div>
                    <button class="btn btn-primary" onclick="game.startNewGame()">Start New Game</button>
                </div>
            `;
        } else {
            // Level completed - show next level button
            overlay.innerHTML = `
                <div class="game-overlay-content">
                    <h2>🎉 Level ${this.currentLevel} Complete! 🎉</h2>
                    <p>Great job! Ready for the next challenge?</p>
                    <div class="score-display">Score: ${this.score}</div>
                    <button class="btn btn-primary" onclick="game.nextLevel()">Play Next Level</button>
                    <button class="btn btn-secondary" onclick="game.startNewGame()">Restart Game</button>
                </div>
            `;
        }
        
        overlay.classList.add('show');
        
        // Show Telegram back button when overlay is shown
        if (tg && tg.BackButton) {
            tg.BackButton.show();
        }
        
        // Даем 2 сердца за прохождение уровня
        this.gainHearts(2);
        this.showHeartReward();
    }
    
    // Send level completion data to Telegram
    sendLevelCompletionToTelegram() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            try {
                tg.sendData(JSON.stringify({
                    action: 'levelCompleted',
                    level: this.currentLevel,
                    score: this.score,
                    hearts: this.hearts
                }));
            } catch (e) {
                console.log('Could not send level completion data to Telegram:', e);
            }
        }
    }
    
    // Update Telegram main button text based on game state
    updateTelegramMainButton() {
        if (tg && tg.MainButton) {
            if (this.isPaused) {
                tg.MainButton.setText('Resume Game');
                tg.MainButton.show();
            } else if (this.isGameOver) {
                tg.MainButton.setText('Play Again');
                tg.MainButton.show();
            } else {
                tg.MainButton.hide();
            }
        }
    }
    

    
    showHeartReward() {
        const gameBoard = document.getElementById('gameBoard');
        const rewardMsg = document.createElement('div');
        rewardMsg.className = 'heart-reward';
        rewardMsg.innerHTML = '+2 ❤️';
        rewardMsg.style.position = 'absolute';
        rewardMsg.style.top = '50%';
        rewardMsg.style.left = '50%';
        rewardMsg.style.transform = 'translate(-50%, -50%)';
        rewardMsg.style.color = '#48bb78';
        rewardMsg.style.fontSize = '2rem';
        rewardMsg.style.fontWeight = 'bold';
        rewardMsg.style.zIndex = '1000';
        rewardMsg.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        rewardMsg.style.animation = 'fadeOutUp 2s ease-out forwards';
        
        gameBoard.appendChild(rewardMsg);
        
        setTimeout(() => {
            if (rewardMsg.parentNode) {
                rewardMsg.parentNode.removeChild(rewardMsg);
            }
        }, 2000);
    }
    
    endGame(won = false, reason = 'game-over') {
        this.isGameOver = true;
        clearInterval(this.gameTimer);
        
        // Воспроизводим соответствующий звук
        if (won) {
            this.playSound('victory');
        } else {
            this.playSound('gameover');
        }
        
        const overlay = document.getElementById('gameOverlay');
        const title = document.getElementById('overlayTitle');
        const message = document.getElementById('overlayMessage');
        const finalScore = document.getElementById('finalScore');
        
        // Reset final score display
        finalScore.style.display = 'inline';
        
        if (won) {
            title.textContent = 'Поздравляем!';
            message.textContent = 'Вы собрали все плитки! Ваш результат:';
        } else if (reason === 'no-hearts') {
            title.textContent = 'Игра окончена!';
            message.textContent = 'У вас закончились сердца! Ваш результат:';
        } else if (reason === 'time-up') {
            title.textContent = 'Время истекло!';
            message.textContent = 'Время вышло! Ваш результат:';
        } else {
            title.textContent = 'Игра окончена!';
            message.textContent = 'Ваш результат:';
        }
        
        finalScore.textContent = this.score;
        
        // Add restart button
        this.addRestartButton();
        
        overlay.classList.add('show');
        
        // Show Telegram back button when overlay is shown
        if (tg && tg.BackButton) {
            tg.BackButton.show();
        }
        
        // Send game data to Telegram if available
        this.sendGameDataToTelegram();
    }
    
    // Send game data to Telegram
    sendGameDataToTelegram() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            try {
                tg.sendData(JSON.stringify({
                    action: 'gameOver',
                    score: this.score,
                    level: this.currentLevel,
                    hearts: this.hearts,
                    timeLeft: this.timeLeft,
                    won: this.isGameOver && this.hearts > 0
                }));
            } catch (e) {
                console.log('Could not send data to Telegram:', e);
            }
        }
    }
    
    addRestartButton() {
        const overlay = document.getElementById('gameOverlay');
        const existingButtons = overlay.querySelectorAll('.level-nav-btn');
        existingButtons.forEach(btn => btn.remove());
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'level-navigation';
        buttonContainer.style.marginTop = '20px';
        
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Повторить уровень';
        restartBtn.className = 'btn btn-primary level-nav-btn';
        restartBtn.onclick = () => {
            overlay.classList.remove('show');
            // Hide Telegram back button when overlay is hidden
            if (tg && tg.BackButton) {
                tg.BackButton.hide();
            }
            this.newGame();
        };
        buttonContainer.appendChild(restartBtn);
        
        overlay.querySelector('.overlay-content').appendChild(buttonContainer);
    }
    
    pauseGame() {
        if (this.isGameOver) return;
        
        // Show confirmation dialog when pausing
        if (!this.isPaused) {
            if (!confirm('Are you sure you want to pause the game?')) {
                return; // User cancelled
            }
        }
        
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        
        // Воспроизводим звук паузы
        this.playSound('pause');
        
        if (this.isPaused) {
            pauseBtn.textContent = '▶️';
            pauseBtn.title = 'Resume';
            pauseBtn.classList.remove('btn-secondary');
            pauseBtn.classList.add('btn-primary');
        } else {
            pauseBtn.textContent = '⏸️';
            pauseBtn.title = 'Pause';
            pauseBtn.classList.remove('btn-primary');
            pauseBtn.classList.add('btn-secondary');
        }
        
        // Update Telegram main button
        this.updateTelegramMainButton();
    }
    
    newGame() {
        // Show confirmation dialog if game is in progress
        if (!this.isGameOver && !this.isPaused) {
            if (!confirm('Are you sure you want to start a new game? Current progress will be lost.')) {
                return; // User cancelled
            }
        }
        
        // Сбрасываем состояние игры
        this.score = 0;
        this.timeLeft = this.getCurrentLevel().timeLimit;
        this.selectedTile = null;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Reset hearts for new game
        this.hearts = this.maxHearts;
        
        // Очищаем таймер
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        // Скрываем оверлей
        document.getElementById('gameOverlay').classList.remove('show');
        
        // Обновляем UI
        this.updateScore();
        this.updateTimer();
        this.updateLevelDisplay(); // Обновляем отображение уровня
        this.updateHearts(); // Обновляем отображение сердец
        
        // Перезапускаем игру
        this.createTiles();
        this.initializeBoard();
        this.renderBoard();
        this.startTimer();
        this.playSound('shuffle');
    }
    

    
    setupEventListeners() {
        // Prevent double-click zoom
        document.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        // Prevent touch zoom
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('gesturechange', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('gestureend', (e) => {
            e.preventDefault();
        });
        
        // Обработчики событий для кнопок
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) newGameBtn.addEventListener('click', () => {
            this.triggerGameEventHapticFeedback('button_press');
            this.newGame();
        });
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.addEventListener('click', () => {
            this.triggerGameEventHapticFeedback('button_press');
            this.pauseGame();
        });
        
        const soundBtn = document.getElementById('soundBtn');
        if (soundBtn) soundBtn.addEventListener('click', () => {
            this.triggerGameEventHapticFeedback('button_press');
            this.toggleSound();
        });
        
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) hintBtn.addEventListener('click', () => {
            this.triggerGameEventHapticFeedback('hint');
            this.hintConnectAnyPair();
        });
 
        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', () => {
            if (!this.isGameOver) {
                this.renderBoard();
            }
        });
        

    }
    
    // Найти любую соединяемую пару и соединить её
    hintConnectAnyPair() {
        if (this.isGameOver || this.isPaused) return;
        // Наивный перебор всех ячеек полной сетки
        for (let r1 = 0; r1 < this.boardSize.rows; r1++) {
            for (let c1 = 0; c1 < this.boardSize.cols; c1++) {
                const a = this.board[r1]?.[c1];
                if (!a || a.matched) continue;
                for (let r2 = r1; r2 < this.boardSize.rows; r2++) {
                    for (let c2 = 0; c2 < this.boardSize.cols; c2++) {
                        if (r1 === r2 && c1 === c2) continue;
                        const b = this.board[r2]?.[c2];
                        if (!b || b.matched) continue;
                        if (a.id !== b.id) continue;
                        // Проверяем возможность соединения
                        if (this.canConnect(a, b)) {
                            this.connectTiles(a, b);
                            return true;
                        }
                    }
                }
            }
        }
        // Если не нашли - просто возвращаем false, не перемешиваем
        this.playSound('wrong');
        return false;
    }

    // Проверка: существует ли хоть одна соединяемая пара
    existsAnyConnection() {
        // Сгруппировать все не совпавшие тайлы по id
        const groups = new Map();
        for (let r = 0; r < this.boardSize.rows; r++) {
            for (let c = 0; c < this.boardSize.cols; c++) {
                const t = this.board[r]?.[c];
                if (!t || t.matched) continue;
                if (!groups.has(t.id)) groups.set(t.id, []);
                groups.get(t.id).push(t);
            }
        }
        // Проверяем пары внутри каждой группы
        for (const arr of groups.values()) {
            if (arr.length < 2) continue;
            // Немного перемешаем для непредвзятости
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    if (this.canConnect(arr[i], arr[j])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Перемешивание оставшихся (не совпавших) тайлов по текущим позициям
    shuffleRemainingTiles() {
        if (this.hearts <= 0) {
            this.gameOver('No more hearts to shuffle!');
            return;
        }
        
        this.isShuffling = true;
        try {
            const cells = [];
            for (let r = this.innerOffset.row; r < this.innerOffset.row + this.innerSize.rows; r++) {
                for (let c = this.innerOffset.col; c < this.innerOffset.col + this.innerSize.cols; c++) {
                    const t = this.board[r]?.[c];
                    if (!t || t.matched) continue;
                    cells.push(t);
                }
            }
            // Собираем пары (id, image)
            const payload = cells.map(t => ({ id: t.id, image: t.image }));
            // Перемешиваем Фишера-Йетса
            for (let i = payload.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [payload[i], payload[j]] = [payload[j], payload[i]];
            }
            // Присваиваем обратно
            for (let i = 0; i < cells.length; i++) {
                cells[i].id = payload[i].id;
                cells[i].image = payload[i].image;
                cells[i].matched = false;
            }
            // Сбрасываем выделение и перерисовываем
            this.selectedTile = null;
            this.renderBoard();
            this.playSound('shuffle');
            
            // Show shuffle penalty message
            this.showShufflePenalty();
        } finally {
            this.isShuffling = false;
        }
    }
    
    showNoHeartsWarning() {
        const gameBoard = document.getElementById('gameBoard');
        const warningMsg = document.createElement('div');
        warningMsg.className = 'no-hearts-warning';
        warningMsg.textContent = '⚠️ Недостаточно сердец для перемешивания!';
        warningMsg.style.position = 'absolute';
        warningMsg.style.top = '50%';
        warningMsg.style.left = '50%';
        warningMsg.style.transform = 'translate(-50%, -50%)';
        warningMsg.style.color = '#e53e3e';
        warningMsg.style.fontSize = '1.5rem';
        warningMsg.style.fontWeight = 'bold';
        warningMsg.style.zIndex = '1000';
        warningMsg.style.textAlign = 'center';
        warningMsg.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        warningMsg.style.animation = 'fadeOutUp 2s ease-out forwards';
        
        gameBoard.appendChild(warningMsg);
        
        setTimeout(() => {
            if (warningMsg.parentNode) {
                warningMsg.parentNode.removeChild(warningMsg);
            }
        }, 2000);
    }
    
    showShufflePenalty() {
        const gameBoard = document.getElementById('gameBoard');
        const penaltyMsg = document.createElement('div');
        penaltyMsg.className = 'shuffle-penalty';
        penaltyMsg.textContent = '-1 ❤️';
        penaltyMsg.style.position = 'absolute';
        penaltyMsg.style.top = '50%';
        penaltyMsg.style.left = '50%';
        penaltyMsg.style.transform = 'translate(-50%, -50%)';
        penaltyMsg.style.color = '#e53e3e';
        penaltyMsg.style.fontSize = '2rem';
        penaltyMsg.style.fontWeight = 'bold';
        penaltyMsg.style.zIndex = '1000';
        penaltyMsg.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        penaltyMsg.style.animation = 'fadeOutUp 1.5s ease-out forwards';
        
        gameBoard.appendChild(penaltyMsg);
        
        setTimeout(() => {
            if (penaltyMsg.parentNode) {
                penaltyMsg.parentNode.removeChild(penaltyMsg);
            }
        }, 1500);
    }

    // Гарантируем существование хотя бы одного хода; при необходимости многократно мешаем
    ensureAnyMoveExists(maxAttempts = 50) {
        if (this.existsAnyConnection()) return true;
        for (let i = 0; i < maxAttempts; i++) {
            this.shuffleRemainingTiles();
            if (this.existsAnyConnection()) return true;
        }
        return false;
    }

    // Пошаговое автоматическое решение уровня с задержкой между ходами
    solveLevelAnimated(stepDelay = 300) {
        if (this.isGameOver || this.isPaused || this.isShuffling || this.isSolving) return;
        this.isSolving = true;
        const step = () => {
            if (this.isGameOver || this.isPaused) { this.isSolving = false; return; }
            let progressed = this.hintConnectAnyPair();
            if (!progressed) {
                if (!this.ensureAnyMoveExists()) { this.isSolving = false; return; }
                progressed = this.hintConnectAnyPair();
            }
            if (progressed) {
                setTimeout(step, stepDelay);
            } else {
                this.isSolving = false;
                this.shuffleRemainingTiles();
            }
        };
        setTimeout(step, stepDelay);
    }



    createLevels() {
        return [
            // Level 1: Easy - Small board, lots of time
            {
                id: 1,
                name: "Начало пути",
                background: "Assets/Backgrounds/Normal/1.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Простой уровень для знакомства с игрой"
            },
            // Level 2: Easy - Slightly larger
            {
                id: 2,
                name: "Первые шаги",
                background: "Assets/Backgrounds/Normal/2.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Немного больше плиток для разминки"
            },
            // Level 3: Easy-Medium
            {
                id: 3,
                name: "Развитие навыков",
                background: "Assets/Backgrounds/Normal/3.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4,    
                description: "Увеличиваем сложность"
            },
            // Level 4: Medium
            {
                id: 4,
                name: "Средний уровень",
                background: "Assets/Backgrounds/Normal/4.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Классический размер доски"
            },
            // Level 5: Medium
            {
                id: 5,
                name: "Логическое мышление",
                background: "Assets/Backgrounds/Normal/5.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Развиваем логическое мышление"
            },
            // Level 6: Medium-Hard
            {
                id: 6,
                name: "Усложнение",
                background: "Assets/Backgrounds/Normal/6.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Увеличиваем количество плиток"
            },
            // Level 7: Hard
            {
                id: 7,
                name: "Сложный уровень",
                background: "Assets/Backgrounds/Normal/7.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Настоящий вызов"
            },
            // Level 8: Hard
            {
                id: 8,
                name: "Эксперт",
                background: "Assets/Backgrounds/Normal/8.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Для опытных игроков"
            },
            // Level 9: Very Hard
            {
                id: 9,
                name: "Мастер",
                background: "Assets/Backgrounds/Normal/9.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Мастерский уровень"
            },
            // Level 10: Very Hard
            {
                id: 10,
                name: "Гроссмейстер",
                background: "Assets/Backgrounds/Normal/10.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Для настоящих мастеров"
            },
            // Level 11: Ultimate
            {
                id: 11,
                name: "Легенда",
                background: "Assets/Backgrounds/Normal/11.jpeg",
                boardSize: { rows: INNER_ROWS, cols: INNER_COLS },
                timeLimit: 600, // 10 minutes
                tileTypes: INNER_ROWS * INNER_COLS / 4, 
                description: "Финальный вызов"
            }
        ];
    }
    
    getCurrentLevel() {
        return this.levels.find(level => level.id === this.currentLevel);
    }
    
    setLevel(levelId) {
        if (levelId >= 1 && levelId <= this.maxLevel) {
            this.currentLevel = levelId;
            const level = this.getCurrentLevel();
            
            // Update board size
            this.innerSize = level.boardSize;
            this.boardSize = { 
                rows: this.innerSize.rows + 2, 
                cols: this.innerSize.cols + 2 
            };
            this.innerOffset = { row: 1, col: 1 };
            
            // Update time limit
            this.timeLeft = level.timeLimit;
            
            // Reset hearts when changing levels
            this.hearts = this.maxHearts;
            
            // Update background
            this.updateBackground(level.background);
            
            // Update level display
            this.updateLevelDisplay();
            
            return true;
        }
        return false;
    }
    
    updateBackground(backgroundPath) {
        console.log(`Updating background to: ${backgroundPath}`);
        const gameContainer = document.querySelector('.game-container');
        
        // Use setProperty to override CSS with !important
        gameContainer.style.setProperty('background-image', `url('${backgroundPath}')`, 'important');
        gameContainer.style.setProperty('background-size', 'cover', 'important');
        gameContainer.style.setProperty('background-position', 'center', 'important');
        gameContainer.style.setProperty('background-repeat', 'no-repeat', 'important');
        
        console.log(`Background updated. Current style:`, gameContainer.style.backgroundImage);
    }
    
    updateLevelDisplay() {
        const levelElement = document.getElementById('currentLevel');
        const descriptionElement = document.getElementById('levelDescription');
        if (levelElement && descriptionElement) {
            const level = this.getCurrentLevel();
            levelElement.textContent = `Уровень ${level.id}: ${level.name}`;
            descriptionElement.textContent = level.description;
        }
    }
    
    updateHearts() {
        const heartsElement = document.getElementById('hearts');
        if (heartsElement) {
            heartsElement.textContent = this.hearts;
        }
    }
    
    loseHeart() {
        if (this.hearts > 0) {
            this.hearts--;
            this.updateHearts();
            
            if (this.hearts <= 0) {
                this.gameOver('No more hearts!');
            }
        }
    }


    // Game over scenarios (hearts <= 0, time over, no moves)
    gameOver(reason = 'Game Over') {
        this.isGameOver = true;
        
        // Stop the timer
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.playSound('gameover');
        
        const overlay = document.getElementById('gameOverlay');
        overlay.innerHTML = `
            <div class="game-overlay-content">
                <h2>💔 Game Over 💔</h2>
                <p>${reason}</p>
                <div class="final-score">Score: ${this.score}</div>
                <div class="game-stats">
                    <p>Level: ${this.currentLevel}</p>
                    <p>Hearts: ${this.hearts}</p>
                    <p>Time: ${Math.floor(this.timeLeft / 60)}:${(this.timeLeft % 60).toString().padStart(2, '0')}</p>
                </div>
                <button class="btn btn-primary" onclick="game.startNewGame()">Try Again</button>
            </div>
        `;
        overlay.classList.add('show');
        
        // Send game data to Telegram
        this.sendGameDataToTelegram();
    }

    // Proceed to next level
    nextLevel() {
        if (this.currentLevel < 11) {
            this.currentLevel++;
            
            // Save current hearts before level change
            const currentHearts = this.hearts;
            
            this.setLevel(this.currentLevel);
            
            // Restore hearts (don't reset to max)
            this.hearts = currentHearts;
            
            this.continueGame(); // Use continueGame instead of newGame
        }
    }

    // Start completely new game (reset to level 1)
    startNewGame() {
        this.currentLevel = 1;
        this.setLevel(1);
        this.newGame();
    }

    // Continue to next level without resetting hearts
    continueGame() {
        // Сбрасываем состояние игры (кроме hearts и score)
        // Score continues accumulating across levels
        this.timeLeft = this.getCurrentLevel().timeLimit;
        this.selectedTile = null;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Don't reset hearts here - they carry over from previous level
        
        // Очищаем таймер
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        // Скрываем оверлей
        document.getElementById('gameOverlay').classList.remove('show');
        
        // Обновляем UI
        this.updateScore();
        this.updateTimer();
        this.updateLevelDisplay();
        this.updateHearts(); // Update display of carried-over hearts
        
        // Перезапускаем игру с новым уровнем
        this.createTiles();
        this.initializeBoard();
        this.renderBoard();
        this.startTimer();
        this.playSound('shuffle');
        
        // Update Telegram main button
        this.updateTelegramMainButton();
    }

    // Check for available moves and auto-shuffle if needed
    checkAndHandleNoMoves() {
        // Skip if game is over
        if (this.isGameOver) return;
        
        // Check if there are any available connections
        if (!this.existsAnyConnection()) {
            console.log('No moves available - auto shuffling...');
            // Check if we have enough hearts for shuffling
            if (this.hearts <= 0) {
                this.gameOver('No more hearts!');
                return;
            }
            // Keep shuffling until connections are available or we run out of hearts
            let shuffleAttempts = 0;
            const maxShuffleAttempts = 10; // Prevent infinite loops
            
            while (!this.existsAnyConnection() && shuffleAttempts < maxShuffleAttempts) {
                console.log(`Shuffle attempt ${shuffleAttempts + 1}`);
                this.shuffleRemainingTiles();
                shuffleAttempts++;
            }
            
            // Final check - if still no moves after maximum shuffles, game over
            if (!this.existsAnyConnection()) {
                console.log(`No moves found after ${shuffleAttempts} shuffle attempts`);
                this.gameOver('No possible moves!');
            } else {
                // Lose a heart after shuffling
                this.loseHeart();
                console.log(`Found moves after ${shuffleAttempts} shuffle attempts`);
            }

        }
    }
}

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(style);

// Запускаем игру когда страница загружена
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PaoPaoGame();
});

