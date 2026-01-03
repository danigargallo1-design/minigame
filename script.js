const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CONFIG = {
    cols: 6,
    rows: 4,
    gridStartY: 0.4,
    maxConnections: 6, 
    cellH: 70,
    fireRate: 600     
};

let connections = [];
let enemies = [];
let bullets = [];
let shockwaves = []; 
let lastSpawn = 0;
let spawnRate = 3000; 
let health = 150;      
let startTime = Date.now();
let bossSpawned = false;
let stopSpawning = false;


function getEnemyStats(level) {
    // 🔒 Enemigos normales: 1 a 15
    const safeLevel = Math.max(1, Math.min(level, 15));

    let color, size;

    if (safeLevel >= 15) {
        color = "#ff00ff";
        size = 22;
    } else {
        const hues = [200, 190, 140, 90, 50, 30, 15, 0, 280];
        color = `hsl(${hues[safeLevel - 1] || 0}, 80%, 50%)`;
        size = 12 + (safeLevel * 1.2);
    }

    return {
        hp: safeLevel,          // 💥 VIDA = NIVEL
        color,
        size,
        damage: safeLevel       // 🔥 daño proporcional y claro
    };
}


function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function animate(time) {
    if (canvas.width === 0) resize();

    ctx.fillStyle = "#1a110a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / CONFIG.cols;
    const gridTop = canvas.height * CONFIG.gridStartY;
    const secondsPassed = (Date.now() - startTime) / 1000;

   


// =========================
// GENERADOR DE ENEMIGOS (CORREGIDO)
// =========================
if (!stopSpawning && time - lastSpawn > spawnRate) {

    // 👑 JEFE EN EL SEGUNDO 120
    if (secondsPassed >= 120 && !bossSpawned) {

        enemies.length = 0; // 🔥 solo se borran enemigos

        const stats = getBossStats();

        enemies.push({
            x: canvas.width / 2,
            y: -80,
            speed: 0.25,
            level: 25,
            ...stats
        });

        bossSpawned = true;
        stopSpawning = true;
        lastSpawn = time;
    }

    // 👾 ENEMIGOS NORMALES (ANTES DEL JEFE)
    else if (!bossSpawned) {

        const level = Math.floor(Math.random() * 15) + 1; // 1–15
        const stats = getEnemyStats(level);

        enemies.push({
            x: Math.random() * (canvas.width - 60) + 30,
            y: -50,
            speed: 0.4 + Math.random() * 0.4,
            level,
            ...stats
        });

        lastSpawn = time;

        if (spawnRate > 700) spawnRate -= 15;
    }
}



    // 2. CUADRÍCULA Y MÁQUINAS
    for (let r = 0; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const tx = c * cellW;
            const ty = gridTop + (r * CONFIG.cellH);
            ctx.strokeStyle = "rgba(205, 127, 50, 0.2)";
            ctx.strokeRect(tx, ty, cellW, CONFIG.cellH);
            
            const conn = connections.find(cn => cn.col === c && cn.row === r);
            if (conn) {
                const cx = tx + cellW / 2;
                const cy = ty + CONFIG.cellH / 2;
                const isStunned = conn.stunUntil > time;

                ctx.fillStyle = isStunned ? "#546e7a" : "#cd7f32";
                ctx.beginPath();
                ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                ctx.fill();

                const enemyInLane = enemies.some(en => Math.floor(en.x / cellW) === c && en.y < canvas.height * 0.85);

                if (!isStunned && enemyInLane && (time - conn.lastFired > CONFIG.fireRate)) {
                    bullets.push({ x: cx, y: cy, col: c });
                    conn.lastFired = time;
                }

                if (isStunned) {
                    ctx.fillStyle = "#00ffff";
                    ctx.textAlign = "center";
                    ctx.font = "bold 16px Arial";
                    ctx.fillText("⚡", cx, cy + 6);
                }
            }
        }
    }

    // 3. ONDAS DE CHOQUE
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.r += 7; 
        sw.opacity -= 0.012;
        ctx.strokeStyle = `rgba(0, 255, 255, ${sw.opacity})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();

        connections.forEach(conn => {
            const mx = (conn.col * cellW) + cellW / 2;
            const my = gridTop + (conn.row * CONFIG.cellH) + CONFIG.cellH / 2;
            const d = Math.hypot(mx - sw.x, my - sw.y);
            if (d < sw.r && d > sw.r - 25) {
                conn.stunUntil = Math.max(conn.stunUntil, time + 2500); 
            }
        });
        if (sw.opacity <= 0) shockwaves.splice(i, 1);
        ctx.lineWidth = 1;
    }

    // 4. ACTUALIZAR ENEMIGOS
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        en.y += en.speed;
        ctx.fillStyle = en.color;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(en.x + en.size, en.y + en.size * 2);
        ctx.lineTo(en.x - en.size, en.y + en.size * 2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 11px Arial";
        ctx.fillText(en.hp, en.x, en.y + en.size * 2 + 10);

        if (en.y > canvas.height * 0.85) {
            health -= en.damage;
            enemies.splice(i, 1);
            const container = document.getElementById('game-container');
            container.style.animation = "shake 0.2s";
            setTimeout(() => container.style.animation = "", 200);
        }
    }

 // 5. ACTUALIZAR BALAS (Mejorado con estelas y brillo)
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        let target = null;
        let minDist = 400;
        
        enemies.forEach(en => {
            let enCol = Math.floor(en.x / cellW);
            if (enCol === b.col && en.y < b.y) {
                let d = Math.hypot(en.x - b.x, en.y - b.y);
                if (d < minDist) { minDist = d; target = en; }
            }
        });

        if (target) b.x += (target.x - b.x) * 0.15;
        b.y -= 9; // Un pelín más rápidas para mejorar el feeling

        // --- DIBUJO DE BALA PRO ---
        // Estela (Trail)
        ctx.strokeStyle = "rgba(255, 215, 0, 0.4)"; 
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x, b.y + 12); 
        ctx.stroke();

        // Núcleo brillante
        ctx.fillStyle = "#fff"; 
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset de grosor para que no afecte a otros elementos
        ctx.lineWidth = 1;

        // --- COLISIONES ---
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            let en = enemies[ei];
            if (Math.hypot(b.x - en.x, b.y - en.y) < 30) {
                en.hp -= 1;
                bullets.splice(i, 1);
                if (en.hp <= 0) {
                    if (en.level === 10) shockwaves.push({ x: en.x, y: en.y, r: 0, opacity: 1 });
                    enemies.splice(ei, 1);
                }
                break;
            }
        }
        if (b && b.y < 0) bullets.splice(i, 1);
    }

    // Comprobación de muerte
    if (health <= 0) {
        alert(`CIUDAD DESTRUIDA - Tiempo: ${Math.floor(secondsPassed)}s`);
        location.reload();
        return;
    }

    // === ACTUALIZACIÓN DE INTERFAZ HTML (Mejorada) ===
    const pPercent = (connections.length / CONFIG.maxConnections) * 100;
    const pBar = document.getElementById('pressure-bar');
    const pTxt = document.getElementById('pressure-val');
    
    if (pTxt) pTxt.innerText = Math.floor(pPercent);
    if (pBar) {
        pBar.style.width = pPercent + "%";
        // Color dinámico: Azul vapor si es bajo, Naranja fuego si está al límite
        if (pPercent >= 100) {
            pBar.style.background = "#ff8c00";
            pBar.style.boxShadow = "0 0 10px #ff8c00";
        } else {
            pBar.style.background = "#00ffff";
            pBar.style.boxShadow = "0 0 10px #00ffff";
        }
    }

    const tTxt = document.getElementById('time-val');
    if (tTxt) tTxt.innerText = Math.floor(secondsPassed);

    const hpPercent = (health / 150) * 100;
    const hBar = document.getElementById('health-bar');
    const hTxt = document.getElementById('hp-val');
    
    if (hTxt) hTxt.innerText = Math.max(0, health);
    if (hBar) {
        hBar.style.width = Math.max(0, hpPercent) + "%";
        
        // Alarma visual si la salud es crítica
        if (hpPercent < 30) {
            hBar.style.animation = "blink 0.5s infinite";
            hBar.style.background = "#ff0000";
        } else {
            hBar.style.animation = "none";
            hBar.style.background = "linear-gradient(90deg, #ff4500, #ff8c00)";
        }
    }

    requestAnimationFrame(animate);
}
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellW = canvas.width / CONFIG.cols;
    const gridTop = canvas.height * CONFIG.gridStartY;
    const col = Math.floor(x / cellW);
    const row = Math.floor((y - gridTop) / CONFIG.cellH);

    if (row >= 0 && row < CONFIG.rows && col >= 0 && col < CONFIG.cols) {
        const idx = connections.findIndex(c => c.col === col && c.row === row);
        if (idx > -1) {
            connections.splice(idx, 1);
        } else if (connections.length < CONFIG.maxConnections) {
            connections.push({ col, row, lastFired: 0, stunUntil: 0 });
        }
    }
});

window.addEventListener('resize', resize);
window.onload = () => { resize(); requestAnimationFrame(animate); };