// Telegram Web App integration
let tg = null;
try {
    tg = window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        console.log('Telegram Web App initialized');
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
        // Инициализируем звуки
        this.sounds = {
            gameover: new Audio('sounds/gameover.mp3'),
            levelcomplited: new Audio('sounds/levelcomplited.mp3'),
            pause: new Audio('sounds/pause.mp3'),
            savegame: new Audio('sounds/savegame.mp3'),
            success: new Audio('sounds/successstep.mp3'),
            wrong: new Audio('sounds/wrongstep.mp3'),
            victory: new Audio('sounds/victory.mp3'),
            // shuffle: new Audio('sounds/shuffle.wma'), // Убираем shuffle звук, так как он может быть раздражающим
            shuffle: new Audio('sounds/shuffle.mp3'),
            click: new Audio('sounds/successstep.mp3'), // Используем существующий звук для клика
        };
        
        // Предзагружаем звуки
        Object.values(this.sounds).forEach(sound => {
            sound.load();
            sound.volume = 0.5;
        });
    }
    
    // Haptic feedback for matched tiles
    triggerHapticFeedback() {
        // Check if haptic feedback is supported
        if ('vibrate' in navigator) {
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
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(e => console.log('Звук не может быть воспроизведен:', e));
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
                    row: r, // координаты в полной сетке
                    col: c,
                    element: null,
                };
                tileIndex++;
            }
        }
        
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
    
    
    renderBoard() {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';
        
        // Responsive tile sizing based on screen width
        let tileWidth, tileHeight;
        if (window.innerWidth < 932) {
            tileWidth = 36; // Larger tiles for small screens (was 32)
            tileHeight = 45; // Larger tiles for small screens (was 40)
        } else {
            tileWidth = 40; // Standard tiles for larger screens
            tileHeight = 50;
        }
        
        
        // Рендерим полную доску 10x16 (включая виртуальные области)
        for (let r = 0; r < this.boardSize.rows; r++) {
            for (let c = 0; c < this.boardSize.cols; c++) {
                const tile = this.board[r][c];
                if (!tile) continue; // на всякий случай
                
                const tileElement = document.createElement('div');
                tileElement.className = 'tile';
                tileElement.dataset.row = r; // координаты в полной сетке
                tileElement.dataset.col = c;
                
                // Координаты относительно полной доски 
                // 10x16
                const left = c * tileWidth;
                const top = r * tileHeight;
                
                // Фиксированный размер и позиция
                tileElement.style.width = `${tileWidth}px`;
                tileElement.style.height = `${tileHeight}px`;
                tileElement.style.left = `${left}px`;
                tileElement.style.top = `${top}px`;
                
                // Добавляем специальные классы для виртуальных областей
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
                
                // Добавляем обработчик клика только для тайлов с изображениями
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
            }
        } else {
            console.log('Different tile type, switching selection');
            this.selectedTile.element.classList.remove('selected');
            this.selectedTile = tile;
            tile.element.classList.add('selected');
        }
    }
    
    canConnect(tile1, tile2) {
        console.log(`Checking connection between tiles at (${tile1.row},${tile1.col}) and (${tile2.row},${tile2.col})`);
        
        // Сначала проверяем прямые соединения
        if (this.areTilesAdjacent(tile1, tile2)) {
            console.log('Direct adjacent connection found');
            return true;
        }
        
        // Затем проверяем L-образные пути (более эффективно для диагональных расположений)
        if (this.canConnectLShape(tile1, tile2)) {
            console.log('L-shaped path found');
            return true;
        }
        
        // Наконец, используем поиск в ширину (BFS) для сложных путей
        console.log('Trying BFS pathfinding...');
        return this.findPathBFS(tile1, tile2);
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
    findPathBFS(tile1, tile2) {
        if (tile1.id !== tile2.id) return false;
        
        const queue = [];
        const visited = new Set();
        const parent = new Map();
        
        queue.push({ row: tile1.row, col: tile1.col, turns: 0, direction: null });
        visited.add(`${tile1.row},${tile1.col}`);
        
        const directions = [
            { row: -1, col: 0, name: 'up' },
            { row: 1, col: 0, name: 'down' },
            { row: 0, col: -1, name: 'left' },
            { row: 0, col: 1, name: 'right' }
        ];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.row === tile2.row && current.col === tile2.col) {
                this.path = this.reconstructPath(parent, tile1, tile2);
                return true;
            }
            
            for (const dir of directions) {
                const newRow = current.row + dir.row;
                const newCol = current.col + dir.col;
                const key = `${newRow},${newCol}`;
                
                // 1) Проверка границ 10x16
                if (!this.isInsideFullGrid(newRow, newCol)) continue;
                
                // 2) Уже посещали
                if (visited.has(key)) continue;
                
                // 3) Проверка пустоты клетки (кроме клетки назначения)
                const isTarget = (newRow === tile2.row && newCol === tile2.col);
                if (!isTarget && !this.isCellEmpty(newRow, newCol)) continue;
                
                // 4) Улучшенная логика подсчета поворотов для L-образных путей
                let newTurns = current.turns;
                if (current.direction && current.direction !== dir.name) {
                    newTurns++;
                }
                
                // Разрешаем до 2 поворотов (этого достаточно для L-образных путей)
                if (newTurns > 2) continue;
                
                // 5) Добавляем в очередь с приоритетом для путей с меньшим количеством поворотов
                queue.push({ 
                    row: newRow, 
                    col: newCol, 
                    turns: newTurns, 
                    direction: dir.name,
                    priority: newTurns // Приоритет для BFS
                });
                visited.add(key);
                parent.set(key, { row: current.row, col: current.col, direction: dir.name });
            }
            
            // Сортируем очередь по приоритету (меньше поворотов = выше приоритет)
            queue.sort((a, b) => (a.priority || 0) - (b.priority || 0));
        }
        return false;
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
        // Соединяем плитки - они исчезают с доски
        tile1.matched = true;
        tile2.matched = true;
        
        // Обновляем UI - плитки становятся пустыми клетками
        tile1.element.classList.remove('selected');
        tile1.element.classList.add('empty');
        tile2.element.classList.add('empty');
        
        // Убираем изображения из пустых клеток
        const img1 = tile1.element.querySelector('img');
        const img2 = tile2.element.querySelector('img');
        if (img1) img1.style.display = 'none';
        if (img2) img2.style.display = 'none';
        
        // Показываем линию соединения
        this.showConnectionLine(tile1, tile2);
        
        // Воспроизводим звук успеха
        this.playSound('success');
        
        // Увеличиваем счет
        this.score += 10;
        this.updateScore();
        
        // Проверяем, закончилась ли игра
        this.checkGameEnd();
        
        this.selectedTile = null;

        // После успешного соединения гарантируем существование следующего хода
        this.ensureAnyMoveExists();
    }

    isInsideFullGrid(row, col) {
        return row >= 0 && row < this.boardSize.rows &&
               col >= 0 && col < this.boardSize.cols;
      }

    // Клетка пуста, если за пределами внутренней области null или внутри и tile.matched
    isCellEmpty(row, col) {
        if (!this.isInsideFullGrid(row, col)) return false;
        const tile = this.board[row]?.[col];
        return !tile || tile.matched === true;
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
        // Очищаем предыдущие линии
        const oldLines = document.querySelectorAll('.path-line');
        oldLines.forEach(line => line.remove());
        
        // Если плитки касаются друг друга, рисуем прямую линию
        if (this.areTilesAdjacent(tile1, tile2)) {
            this.drawDirectLine(tile1, tile2);
            return;
        }
        
        // Если путь найден через L-образную проверку, рисуем его пошагово
        if (this.path && this.path.length > 0) {
            // // Проверяем, является ли это L-образным путем
            // const isLShape = this.isLShapePath();
            // if (isLShape) {
            //     this.drawLShapePath();
            // } else {
            //     this.drawPathThroughEmptyCells();
            // }
            this.drawPathThroughEmptyCells();
        } else {
            // Если путь не найден, рисуем прямую линию между плитками
            this.drawDirectLine(tile1, tile2);
        }
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
    
    // Рисуем путь через пустые клетки (теперь для полной доски 10x16, строго по сетке)
    drawPathThroughEmptyCells() {
        const gameBoard = document.getElementById('gameBoard');
        
        // Responsive tile sizing based on screen width
        let tileWidth, tileHeight;
        if (window.innerWidth < 932) {
            tileWidth = 36; // Larger tiles for small screens (was 32)
            tileHeight = 45; // Larger tiles for small screens (was 40)
        } else {
            tileWidth = 40; // Standard tiles for larger screens
            tileHeight = 50;
        }
        
        // Рисуем линии между последовательными точками пути строго по сетке
        for (let i = 0; i < this.path.length - 1; i++) {
            const current = this.path[i];
            const next = this.path[i + 1];
            
            // Определяем направление движения
            const isHorizontal = current.row === next.row;
            const isVertical = current.col === next.col;
            
            if (isHorizontal) {
                // Горизонтальная линия
                this.drawHorizontalLine(current, next, tileWidth, tileHeight);
            } else if (isVertical) {
                // Вертикальная линия
                this.drawVerticalLine(current, next, tileWidth, tileHeight);
            }
        }
        
        setTimeout(() => {
            document.querySelectorAll('.path-line').forEach(line => line.remove());
        }, 1200);
    }
    
    // Рисуем L-образный путь пошагово через каждую клетку (только по столбцам и строкам)
    drawLShapePath() {
        if (!this.path || this.path.length < 2) return;
        
        const gameBoard = document.getElementById('gameBoard');
        
        // Responsive tile sizing based on screen width
        let tileWidth, tileHeight;
        if (window.innerWidth < 932) {
            tileWidth = 36; // Larger tiles for small screens (was 32)
            tileHeight = 45; // Larger tiles for small screens (was 40)
        } else {
            tileWidth = 40; // Standard tiles for larger screens
            tileHeight = 50;
        }
        
        const toPixel = (row, col) => {
            // Теперь используем координаты полной доски 10x16
            const x = col * tileWidth + tileWidth / 2;
            const y = row * tileHeight + tileHeight / 2;
            return { x, y };
        };
        
        // Рисуем линии между последовательными точками пути строго по сетке
        for (let i = 0; i < this.path.length - 1; i++) {
            const current = this.path[i];
            const next = this.path[i + 1];
            
            // Определяем направление движения
            const isHorizontal = current.row === next.row;
            const isVertical = current.col === next.col;
            
            if (isHorizontal) {
                // Горизонтальная линия
                this.drawHorizontalLine(current, next, tileWidth, tileHeight);
            } else if (isVertical) {
                // Вертикальная линия
                this.drawVerticalLine(current, next, tileWidth, tileHeight);
            }
        }
        
        setTimeout(() => {
            document.querySelectorAll('.path-line').forEach(line => line.remove());
        }, 1200);
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
    
    // Проверяем, находится ли позиция внутри внутренней (игровой) области 16x9
    isPositionInGameBoard(row, col) {
        return row >= this.innerOffset.row && row < this.innerOffset.row + this.innerSize.rows &&
               col >= this.innerOffset.col && col < this.innerOffset.col + this.innerSize.cols;
    }
    
    // Рисуем прямую линию между плитками (строго по сетке)
    drawDirectLine(tile1, tile2) {
        const gameBoard = document.getElementById('gameBoard');
        
        // Определяем направление движения
        const isHorizontal = tile1.row === tile2.row;
        const isVertical = tile1.col === tile2.col;
        
        // Responsive tile sizing based on screen width
        let tileWidth, tileHeight;
        if (window.innerWidth < 932) {
            tileWidth = 36; // Larger tiles for small screens (was 32)
            tileHeight = 45; // Larger tiles for small screens (was 40)
        } else {
            tileWidth = 40; // Standard tiles for larger screens
            tileHeight = 50;
        }
        
        if (isHorizontal) {
            // Горизонтальная линия
            this.drawHorizontalLine(
                { row: tile1.row, col: tile1.col },
                { row: tile2.row, col: tile2.col },
                tileWidth, tileHeight
            );
        } else if (isVertical) {
            // Вертикальная линия
            this.drawVerticalLine(
                { row: tile1.row, col: tile1.col },
                { row: tile2.row, col: tile2.col },
                tileWidth, tileHeight
            );
        }
        
        // Убираем линию через 1 секунду
        setTimeout(() => {
            document.querySelectorAll('.path-line').forEach(line => line.remove());
        }, 800);
    }
    
    isPathThroughVirtualBoard(tile1, tile2) {
        // Проверяем, идет ли путь через виртуальную доску
        return this.canConnectThroughVirtualBoard(tile1, tile2) && 
               !this.canConnectDirect(tile1, tile2) && 
               !this.canConnectWithOneTurn(tile1, tile2) && 
               !this.canConnectWithTwoTurns(tile1, tile2);
    }
    
    showConnectionError() {
        // Показываем ошибку соединения
        const tile1 = this.selectedTile;
        tile1.element.classList.remove('selected');
        
        // Воспроизводим звук ошибки
        this.playSound('wrong');
        
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
                    this.endGame(false, 'time-up');
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
                this.endGame(false, 'no-hearts');
            }
        }
    }
    
    gainHearts(count) {
        this.hearts = Math.min(this.maxHearts, this.hearts + count);
        this.updateHearts();
    }
    
    checkHearts() {
        if (this.hearts <= 0) {
            this.endGame(false, 'no-hearts');
            return false;
        }
        return true;
    }
    
    checkGameEnd() {
        // Проверяем, остались ли несовмещенные плитки на доске
        for (let r = this.innerOffset.row; r < this.innerOffset.row + this.innerSize.rows; r++) {
            for (let c = this.innerOffset.col; c < this.innerOffset.col + this.innerSize.cols; c++) {
                const t = this.board[r]?.[c];
                if (t && !t.matched) return; // есть еще живые тайлы
            }
        }
        
        // Level completed!
        this.levelCompleted();
    }
    
    levelCompleted() {
        this.playSound('levelcomplited');
        
        // Send level completion data to Telegram
        this.sendLevelCompletionToTelegram();
        
        // Показываем overlay с поздравлением
        const overlay = document.getElementById('gameOverlay');
        overlay.innerHTML = `
            <div class="game-overlay-content">
                <h2>🎉 Уровень ${this.currentLevel} пройден! 🎉</h2>
                <p>Отличная работа! Игра завершена.</p>
                <button class="btn" onclick="game.newGame()">Играть снова</button>
            </div>
        `;
        overlay.classList.add('show');
        
        // Show Telegram back button when overlay is shown
        if (tg && tg.BackButton) {
            tg.BackButton.show();
        }
        
        // Даем 2 сердца за прохождение уровня
        this.gainHearts(2);
        this.showHeartReward();
        
        // Останавливаем таймер
        clearInterval(this.gameTimer);
        
        // Показываем поздравление на 3 секунды, затем перезапускаем игру
        setTimeout(() => {
            overlay.classList.remove('show');
            // Hide Telegram back button when overlay is hidden
            if (tg && tg.BackButton) {
                tg.BackButton.hide();
            }
            this.newGame();
        }, 3000);
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
        if (newGameBtn) newGameBtn.addEventListener('click', () => this.newGame());
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseGame());
        
        const soundBtn = document.getElementById('soundBtn');
        if (soundBtn) soundBtn.addEventListener('click', () => this.toggleSound());
        
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) hintBtn.addEventListener('click', () => this.hintConnectAnyPair());
 
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
                        // Проверяем возможность соединения через BFS
                        if (this.findPathBFS(a, b)) {
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
                    if (this.findPathBFS(arr[i], arr[j])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Перемешивание оставшихся (не совпавших) тайлов по текущим позициям
    shuffleRemainingTiles() {
        if (this.hearts <= 1) {
            this.showNoHeartsWarning();
            return;
        }
        
        this.isShuffling = true;
        try {
            // Lose a heart for shuffling
            this.loseHeart();
            
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
        const gameContainer = document.querySelector('.game-container');
        gameContainer.style.backgroundImage = `url('${backgroundPath}')`;
        gameContainer.style.backgroundSize = 'cover';
        gameContainer.style.backgroundPosition = 'center';
        gameContainer.style.backgroundRepeat = 'no-repeat';
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
                this.endGame(false, 'no-hearts');
            }
        }
    }
    
    gainHearts(count) {
        this.hearts = Math.min(this.maxHearts, this.hearts + count);
        this.updateHearts();
    }
    
    checkHearts() {
        if (this.hearts <= 0) {
            this.endGame(false, 'no-hearts');
            return false;
        }
        return true;
    }

    // Специальная проверка для L-образных путей (более эффективна для диагональных расположений)
    canConnectLShape(tile1, tile2) {
        if (tile1.id !== tile2.id) return false;
        
        const rowDiff = Math.abs(tile1.row - tile2.row);
        const colDiff = Math.abs(tile1.col - tile2.col);
        
        // L-образный путь возможен только если тайлы не на одной линии
        if (rowDiff === 0 || colDiff === 0) return false;
        
        // Проверяем два возможных L-образных пути:
        // 1) Сначала по горизонтали, потом по вертикали
        const path1 = this.checkLPath(tile1, tile2, 'horizontal');
        if (path1) {
            this.path = path1;
            return true;
        }
        
        // 2) Сначала по вертикали, потом по горизонтали
        const path2 = this.checkLPath(tile1, tile2, 'vertical');
        if (path2) {
            this.path = path2;
            return true;
        }
        
        return false;
    }
    
    // Проверяет конкретный L-образный путь
    checkLPath(tile1, tile2, firstDirection) {
        const path = [];
        
        if (firstDirection === 'horizontal') {
            // Сначала идем по горизонтали
            const startCol = Math.min(tile1.col, tile2.col);
            const endCol = Math.max(tile1.col, tile2.col);
            const row = tile1.row;
            
            // Проверяем горизонтальный участок и добавляем промежуточные точки
            for (let col = startCol; col <= endCol; col++) {
                if (col === tile1.col || col === tile2.col) continue; // Пропускаем сами тайлы
                if (!this.isCellEmpty(row, col)) return null; // Путь заблокирован
                path.push({ row, col });
            }
            
            // Потом идем по вертикали
            const startRow = Math.min(tile1.row, tile2.row);
            const endRow = Math.max(tile1.row, tile2.row);
            const col = tile2.col;
            
            // Проверяем вертикальный участок и добавляем промежуточные точки
            for (let row = startRow; row <= endRow; row++) {
                if (row === tile1.row || row === tile2.row) continue; // Пропускаем сами тайлы
                if (!this.isCellEmpty(row, col)) return null; // Путь заблокирован
                path.push({ row, col });
            }
        } else {
            // Сначала идем по вертикали
            const startRow = Math.min(tile1.row, tile2.row);
            const endRow = Math.max(tile1.row, tile2.row);
            const col = tile1.col;
            
            // Проверяем вертикальный участок и добавляем промежуточные точки
            for (let row = startRow; row <= endRow; row++) {
                if (row === tile1.row || row === tile2.row) continue; // Пропускаем сами тайлы
                if (!this.isCellEmpty(row, col)) return null; // Путь заблокирован
                path.push({ row, col });
            }
            
            // Потом идем по горизонтали
            const startCol = Math.min(tile1.col, tile2.col);
            const endCol = Math.max(tile1.col, tile2.col);
            const row = tile2.row;
            
            // Проверяем горизонтальный участок и добавляем промежуточные точки
            for (let col = startCol; col <= endCol; col++) {
                if (col === tile1.col || col === tile2.col) continue; // Пропускаем сами тайлы
                if (!this.isCellEmpty(row, col)) return null; // Путь заблокирован
                path.push({ row, col });
            }
        }
        
        // Создаем полный путь с промежуточными точками для плавного рисования
        const fullPath = [];
        fullPath.push({ row: tile1.row, col: tile1.col });
        
        // Добавляем промежуточные точки в правильном порядке
        if (firstDirection === 'horizontal') {
            // Сначала горизонтальные точки
            const horizontalPoints = path.filter(p => p.row === tile1.row);
            fullPath.push(...horizontalPoints);
            
            // Потом вертикальные точки
            const verticalPoints = path.filter(p => p.col === tile2.col);
            fullPath.push(...verticalPoints);
        } else {
            // Сначала вертикальные точки
            const verticalPoints = path.filter(p => p.col === tile1.col);
            fullPath.push(...verticalPoints);
            
            // Потом горизонтальные точки
            const horizontalPoints = path.filter(p => p.row === tile2.row);
            fullPath.push(...horizontalPoints);
        }
        
        fullPath.push({ row: tile2.row, col: tile2.col });
        
        return fullPath;
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
    new PaoPaoGame();
});

