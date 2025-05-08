class Tetris {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nextPieceCanvas = document.getElementById('nextPiece');
        this.nextPieceCtx = this.nextPieceCanvas.getContext('2d');
        this.gridSize = 40;
        this.nextPieceGridSize = 40;
        this.cols = Math.floor(canvas.width / this.gridSize);
        this.rows = Math.floor(canvas.height / this.gridSize);
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.currentPiece = null;
        this.nextPiece = null;
        this.ghostPieceY = 0;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.lastDropTime = Date.now();
        this.lastMoveTime = Date.now();
        this.moveDelay = 50; // 移动延迟（毫秒）
        this.keysPressed = new Set();
        
        // 从 localStorage 获取保存的难度，如果没有则默认为 'easy'
        this.difficulty = localStorage.getItem('tetris-difficulty') || 'easy';
        
        // 难度配置
        this.difficultySettings = {
            easy: {
                baseSpeed: 1000,
                speedIncrease: 0.1,
                speedCap: 2.0
            },
            medium: {
                baseSpeed: 800,
                speedIncrease: 0.2,
                speedCap: 3.0
            },
            hard: {
                baseSpeed: 500,
                speedIncrease: 0.3,
                speedCap: 5.0
            }
        };

        // 设置初始速度
        const settings = this.difficultySettings[this.difficulty];
        this.baseSpeed = settings.baseSpeed;
        this.currentSpeed = this.baseSpeed;
        this.speedMultiplier = 1.0;
        
        // 定义方块形状
        this.shapes = [
            [[1, 1, 1, 1]], // I
            [[1, 1], [1, 1]], // O
            [[1, 1, 1], [0, 1, 0]], // T
            [[1, 1, 1], [1, 0, 0]], // L
            [[1, 1, 1], [0, 0, 1]], // J
            [[1, 1, 0], [0, 1, 1]], // S
            [[0, 1, 1], [1, 1, 0]]  // Z
        ];
        
        // 定义颜色
        this.colors = [
            '#FF0D72', '#0DC2FF', '#0DFF72',
            '#F538FF', '#FF8E0D', '#FFE138',
            '#3877FF'
        ];

        this.clearingLines = []; // 正在消除的行
        this.clearAnimation = {
            active: false,
            startTime: 0,
            duration: 500, // 动画持续时间（毫秒）
            lines: []
        };

        this.bindControls();
        this.bindButtons();
        this.bindVirtualControls();
        this.generateNextPiece();
        this.createNewPiece();
        this.gameLoop();
        
        // 设置正确的难度按钮状态
        document.querySelectorAll('#easy, #medium, #hard').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(this.difficulty).classList.add('active');
    }

    bindButtons() {
        // 暂停按钮
        const pauseBtn = document.getElementById('pause');
        pauseBtn.addEventListener('click', () => this.togglePause());

        // 难度按钮
        const difficulties = ['easy', 'medium', 'hard'];
        difficulties.forEach(diff => {
            const btn = document.getElementById(diff);
            btn.addEventListener('click', () => {
                difficulties.forEach(d => {
                    document.getElementById(d).classList.remove('active');
                });
                btn.classList.add('active');
                this.setDifficulty(diff);
            });
        });
    }

    setDifficulty(difficulty) {
        // 将选择的难度保存到 localStorage
        localStorage.setItem('tetris-difficulty', difficulty);
        // 刷新页面
        window.location.reload();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause');
        pauseBtn.textContent = this.isPaused ? '继续' : '暂停';
        pauseBtn.style.backgroundColor = this.isPaused ? '#27ae60' : '#3498db';
        
        if (!this.isPaused) {
            this.gameLoop();
        }
    }

    updateTimer() {
        if (!this.isPaused && !this.gameOver) {
            this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(this.elapsedTime / 60);
            const seconds = this.elapsedTime % 60;
            document.getElementById('time').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // 根据时间更新速度
            const settings = this.difficultySettings[this.difficulty];
            this.speedMultiplier = Math.min(
                1 + (minutes * settings.speedIncrease),
                settings.speedCap
            );
            this.currentSpeed = this.baseSpeed / this.speedMultiplier;
            this.updateSpeedDisplay();
        }
    }

    updateSpeedDisplay() {
        document.getElementById('speed').textContent = this.speedMultiplier.toFixed(1);
    }

    bindControls() {
        const touchControls = (e) => {
            if (this.isPaused) return;
            e.preventDefault();
            const touch = e.touches[0];
            const canvas = this.canvas;
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            if (this.gameOver) {
                this.resetGame();
                return;
            }

            if (y > canvas.height * 0.8) {
                this.dropPiece();
            } else if (y > canvas.height * 0.2) {
                if (x < canvas.width * 0.3) {
                    this.movePiece(-1, 0);
                } else if (x > canvas.width * 0.7) {
                    this.movePiece(1, 0);
                } else {
                    this.movePiece(0, 1);
                }
            } else {
                this.rotatePiece();
            }
        };

        document.addEventListener('keydown', (e) => {
            if (this.gameOver) {
                if (e.keyCode === 32) { // 空格键重新开始
                    this.resetGame();
                }
                return;
            }
            
            if (e.keyCode === 80) { // P键暂停
                this.togglePause();
                return;
            }

            if (this.isPaused) return;
            
            this.keysPressed.add(e.keyCode);
        });

        document.addEventListener('keyup', (e) => {
            this.keysPressed.delete(e.keyCode);
        });

        // 添加触摸控制
        this.canvas.addEventListener('touchstart', touchControls);
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }

    bindVirtualControls() {
        const buttons = {
            up: () => this.rotatePiece(),
            left: () => this.movePiece(-1, 0),
            right: () => this.movePiece(1, 0),
            down: () => this.movePiece(0, 1),
            drop: () => this.dropPiece()
        };

        // 为每个虚拟按钮添加事件监听
        Object.keys(buttons).forEach(key => {
            const btn = document.querySelector(`.virtual-btn.${key}`);
            if (btn) {
                // 触摸开始事件
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!this.gameOver && !this.isPaused) {
                        buttons[key]();
                    }
                });

                // 鼠标点击事件（为了支持桌面端测试）
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (!this.gameOver && !this.isPaused) {
                        buttons[key]();
                    }
                });
            }
        });

        // 防止触摸滑动
        document.querySelector('.virtual-controls').addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    generateNextPiece() {
        const shapeIndex = Math.floor(Math.random() * this.shapes.length);
        const shape = this.shapes[shapeIndex];
        return {
            shape,
            color: this.colors[shapeIndex],
            x: Math.floor(this.cols / 2) - Math.floor(shape[0].length / 2),
            y: 0
        };
    }

    createNewPiece() {
        if (!this.nextPiece) {
            this.nextPiece = this.generateNextPiece();
        }
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.generateNextPiece();
        this.drawNextPiece();

        if (this.checkCollision()) {
            this.gameOver = true;
        }
    }

    drawNextPiece() {
        const ctx = this.nextPieceCtx;
        const gridSize = this.nextPieceGridSize;
        
        // 清除画布
        ctx.clearRect(0, 0, this.nextPieceCanvas.width, this.nextPieceCanvas.height);
        
        const shape = this.nextPiece.shape;
        const color = this.nextPiece.color;
        
        // 计算居中位置
        const shapeWidth = shape[0].length * gridSize;
        const shapeHeight = shape.length * gridSize;
        const startX = (this.nextPieceCanvas.width - shapeWidth) / 2;
        const startY = (this.nextPieceCanvas.height - shapeHeight) / 2;
        
        // 绘制方块
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    this.drawPreviewBlock(
                        startX + x * gridSize,
                        startY + y * gridSize,
                        gridSize,
                        color
                    );
                }
            }
        }
    }

    drawPreviewBlock(x, y, size, color) {
        const ctx = this.nextPieceCtx;
        const borderWidth = 2;
        
        // 主体颜色
        ctx.fillStyle = color;
        ctx.fillRect(x + borderWidth, y + borderWidth, size - 2 * borderWidth, size - 2 * borderWidth);
        
        // 亮边
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x + borderWidth, y + borderWidth, size - 2 * borderWidth, 4);
        ctx.fillRect(x + borderWidth, y + borderWidth, 4, size - 2 * borderWidth);
        
        // 暗边
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + size - 6, y + borderWidth, 4, size - 2 * borderWidth);
        ctx.fillRect(x + borderWidth, y + size - 6, size - 2 * borderWidth, 4);
    }

    checkCollision(offsetX = 0, offsetY = 0, newShape = null) {
        const shape = newShape || this.currentPiece.shape;
        const n = shape.length;
        const m = shape[0].length;

        for (let y = 0; y < n; y++) {
            for (let x = 0; x < m; x++) {
                if (shape[y][x]) {
                    const newX = this.currentPiece.x + x + offsetX;
                    const newY = this.currentPiece.y + y + offsetY;

                    if (newX < 0 || newX >= this.cols || 
                        newY >= this.rows || 
                        (newY >= 0 && this.grid[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    movePiece(dx, dy) {
        if (!this.checkCollision(dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        return false;
    }

    rotatePiece() {
        const newShape = this.currentPiece.shape[0].map((_, i) =>
            this.currentPiece.shape.map(row => row[i]).reverse()
        );

        if (!this.checkCollision(0, 0, newShape)) {
            this.currentPiece.shape = newShape;
        }
    }

    dropPiece() {
        while (this.movePiece(0, 1));
        this.mergePiece();
        this.createNewPiece();
    }

    mergePiece() {
        const shape = this.currentPiece.shape;
        const n = shape.length;
        const m = shape[0].length;

        for (let y = 0; y < n; y++) {
            for (let x = 0; x < m; x++) {
                if (shape[y][x]) {
                    const newY = this.currentPiece.y + y;
                    if (newY >= 0) {
                        this.grid[newY][this.currentPiece.x + x] = this.currentPiece.color;
                    }
                }
            }
        }

        this.clearLines();
    }

    clearLines() {
        let linesCleared = 0;
        let linesToClear = [];

        // 检查需要消除的行
        for (let y = this.rows - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
                linesCleared++;
            }
        }

        if (linesCleared > 0) {
            // 启动消除动画
            this.clearAnimation = {
                active: true,
                startTime: Date.now(),
                duration: 500,
                lines: linesToClear
            };

            // 更新分数
            this.score += linesCleared * 100;
            document.getElementById('score').textContent = this.score;

            // 延迟实际的行消除
            setTimeout(() => {
                // 实际移除行
                linesToClear.forEach(y => {
                    this.grid.splice(y, 1);
                    this.grid.unshift(Array(this.cols).fill(0));
                });
                this.clearAnimation.active = false;
            }, this.clearAnimation.duration);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格背景
        this.ctx.strokeStyle = '#34495e';
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.ctx.strokeRect(
                    x * this.gridSize,
                    y * this.gridSize,
                    this.gridSize,
                    this.gridSize
                );
            }
        }

        // 绘制已固定的方块
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x]) {
                    if (this.clearAnimation.active && this.clearAnimation.lines.includes(y)) {
                        const progress = (Date.now() - this.clearAnimation.startTime) / this.clearAnimation.duration;
                        if (progress <= 1) {
                            // 闪烁两次
                            const alpha = Math.abs(Math.sin(progress * Math.PI * 2));
                            const color = this.grid[y][x];
                            const baseColor = color.substring(0, 7);
                            this.drawBlock(x, y, baseColor + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
                            
                            // 缩放效果
                            const scale = 1 - progress;
                            if (scale > 0) {
                                this.ctx.save();
                                this.ctx.globalAlpha = scale;
                                this.ctx.translate(
                                    x * this.gridSize + this.gridSize / 2,
                                    y * this.gridSize + this.gridSize / 2
                                );
                                this.ctx.scale(scale, scale);
                                this.ctx.translate(
                                    -x * this.gridSize - this.gridSize / 2,
                                    -y * this.gridSize - this.gridSize / 2
                                );
                                this.drawBlock(x, y, this.grid[y][x]);
                                this.ctx.restore();
                            }
                        }
                    } else {
                        this.drawBlock(x, y, this.grid[y][x]);
                    }
                }
            }
        }

        // 绘制虚拟位置和当前方块
        if (this.currentPiece && !this.isPaused) {
            const ghostY = this.getGhostPiecePosition();
            const shape = this.currentPiece.shape;
            const n = shape.length;
            const m = shape[0].length;

            // 绘制虚拟位置（半透明）
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < m; x++) {
                    if (shape[y][x]) {
                        this.drawGhostBlock(
                            this.currentPiece.x + x,
                            ghostY + y,
                            this.currentPiece.color
                        );
                    }
                }
            }

            // 绘制当前方块
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < m; x++) {
                    if (shape[y][x]) {
                        this.drawBlock(
                            this.currentPiece.x + x,
                            this.currentPiece.y + y,
                            this.currentPiece.color
                        );
                    }
                }
            }
        }

        if (this.gameOver || this.isPaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                this.gameOver ? '游戏结束!' : '已暂停',
                this.canvas.width / 2,
                this.canvas.height / 2
            );
            if (this.gameOver) {
                this.ctx.font = '20px Arial';
                this.ctx.fillText('点击屏幕重新开始', this.canvas.width / 2, this.canvas.height / 2 + 40);
            }
        }
    }

    drawBlock(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            x * this.gridSize,
            y * this.gridSize,
            this.gridSize - 1,
            this.gridSize - 1
        );
    }

    drawGhostBlock(x, y, color) {
        this.ctx.fillStyle = color + '40'; // 添加透明度
        this.ctx.fillRect(
            x * this.gridSize,
            y * this.gridSize,
            this.gridSize - 1,
            this.gridSize - 1
        );
        this.ctx.strokeStyle = color;
        this.ctx.strokeRect(
            x * this.gridSize,
            y * this.gridSize,
            this.gridSize - 1,
            this.gridSize - 1
        );
    }

    handleInput() {
        if (this.isPaused || this.gameOver) return;

        const now = Date.now();
        if (now - this.lastMoveTime >= this.moveDelay) {
            if (this.keysPressed.has(37)) { // 左箭头
                this.movePiece(-1, 0);
            }
            if (this.keysPressed.has(39)) { // 右箭头
                this.movePiece(1, 0);
            }
            if (this.keysPressed.has(40)) { // 下箭头
                this.movePiece(0, 1);
            }
            if (this.keysPressed.has(38)) { // 上箭头
                this.rotatePiece();
            }
            if (this.keysPressed.has(32)) { // 空格
                this.dropPiece();
            }
            this.lastMoveTime = now;
        }
    }

    gameLoop() {
        if (!this.gameOver && !this.isPaused) {
            this.handleInput();
            this.updateTimer();

            const now = Date.now();
            if (now - this.lastDropTime >= this.currentSpeed) {
                if (!this.movePiece(0, 1)) {
                    this.mergePiece();
                    this.createNewPiece();
                }
                this.lastDropTime = now;
            }
        }
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    getGhostPiecePosition() {
        if (!this.currentPiece) return null;
        
        let ghostY = this.currentPiece.y;
        while (!this.checkCollision(0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        return ghostY;
    }

    resetGame() {
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.speedMultiplier = 1.0;
        document.getElementById('score').textContent = '0';
        document.getElementById('time').textContent = '00:00';
        document.getElementById('pause').textContent = '暂停';
        this.createNewPiece();
    }
}

// 初始化游戏
window.onload = () => {
    const canvas = document.getElementById('tetris');
    new Tetris(canvas);
}; 