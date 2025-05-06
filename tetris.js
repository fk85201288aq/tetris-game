class Tetris {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = 30;
        this.cols = canvas.width / this.gridSize;
        this.rows = canvas.height / this.gridSize;
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.currentPiece = null;
        this.ghostPieceY = 0;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.baseSpeed = 1000; // 基础下落速度（毫秒）
        this.currentSpeed = this.baseSpeed;
        this.speedMultiplier = 1.0;
        this.difficulty = 'easy'; // 难度设置
        
        // 难度配置
        this.difficultySettings = {
            easy: {
                baseSpeed: 1000,
                speedIncrease: 0.1,  // 每分钟增加的速度倍数
                speedCap: 2.0        // 最大速度倍数
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

        this.bindControls();
        this.bindButtons();
        this.createNewPiece();
        this.update();
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
                if (!this.isPaused && !this.gameOver) return; // 只能在暂停或游戏结束时更改难度
                
                difficulties.forEach(d => {
                    document.getElementById(d).classList.remove('active');
                });
                btn.classList.add('active');
                this.setDifficulty(diff);
            });
        });
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        const settings = this.difficultySettings[difficulty];
        this.baseSpeed = settings.baseSpeed;
        this.currentSpeed = this.baseSpeed;
        this.speedMultiplier = 1.0;
        this.updateSpeedDisplay();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause');
        pauseBtn.textContent = this.isPaused ? '继续' : '暂停';
        pauseBtn.style.backgroundColor = this.isPaused ? '#27ae60' : '#3498db';
        
        if (!this.isPaused) {
            this.update();
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
            
            switch(e.keyCode) {
                case 37: // 左箭头
                    this.movePiece(-1, 0);
                    break;
                case 39: // 右箭头
                    this.movePiece(1, 0);
                    break;
                case 40: // 下箭头
                    this.movePiece(0, 1);
                    break;
                case 38: // 上箭头
                    this.rotatePiece();
                    break;
                case 32: // 空格
                    this.dropPiece();
                    break;
            }
        });

        // 添加触摸控制
        this.canvas.addEventListener('touchstart', touchControls);
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }

    createNewPiece() {
        const shapeIndex = Math.floor(Math.random() * this.shapes.length);
        const shape = this.shapes[shapeIndex];
        this.currentPiece = {
            shape,
            color: this.colors[shapeIndex],
            x: Math.floor(this.cols / 2) - Math.floor(shape[0].length / 2),
            y: 0
        };

        if (this.checkCollision()) {
            this.gameOver = true;
        }
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

        for (let y = this.rows - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                linesCleared++;
                y++;
            }
        }

        if (linesCleared > 0) {
            this.score += linesCleared * 100;
            document.getElementById('score').textContent = this.score;
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
                    this.drawBlock(x, y, this.grid[y][x]);
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

    update() {
        if (!this.gameOver && !this.isPaused) {
            this.updateTimer();
            if (!this.movePiece(0, 1)) {
                this.mergePiece();
                this.createNewPiece();
            }
        }
        this.draw();
        if (!this.gameOver && !this.isPaused) {
            setTimeout(() => this.update(), this.currentSpeed);
        }
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