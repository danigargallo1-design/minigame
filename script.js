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
let particles = []; 
let lastSpawn = 0;
let spawnRate = 3000; 
let health = 150;      
let startTime = Date.now();
let bossSpawned = false;
let stopSpawning = false;

function getEnemyStats(level) {
    let color, size, hp, damage;
    if (level >= 30) {
        color = "#ff3300"; size = 50; hp = 150; damage = 100;
    } else {
        const safeLevel = Math.max(1, Math.min(level, 15));
        hp = level; damage = level;
        if (safeLevel >= 15) {
            color = "#ff00ff"; size = 22;
        } else {
            const hues = [200, 190, 140, 90, 50, 30, 15, 0, 280];
            color = `hsl(${hues[safeLevel - 1] || 0}, 80%, 50%)`;
            size = 12 + (safeLevel * 1.2);
        }
    }
    return { hp, color, size, damage, hitFlash: 0 };
}

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function animate(time) {
    if (canvas.width === 0) resize();

    // 1. LIMPIEZA
    ctx.fillStyle = "#1a110a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / CONFIG.cols;
    const gridTop = canvas.height * CONFIG.gridStartY;
    const secondsPassed = (Date.now() - startTime) / 1000;
    
    const baseNodeX = canvas.width / 2;
    const baseNodeY = canvas.height * 0.92;

    // 2. GENERADOR DE ENEMIGOS
    if (!stopSpawning && time - lastSpawn > spawnRate) {
        if (secondsPassed >= 120 && !bossSpawned) {
            enemies.length = 0; 
            const stats = getEnemyStats(30);
            enemies.push({ x: canvas.width / 2, y: -100, speed: 0.15, level: 30, ...stats });
            bossSpawned = true;
            stopSpawning = true;
        } else if (!bossSpawned) {
            const level = Math.floor(Math.random() * 15) + 1;
            const stats = getEnemyStats(level);
            enemies.push({ x: Math.random() * (canvas.width - 60) + 30, y: -50, speed: 0.4 + Math.random() * 0.4, level, ...stats });
            if (spawnRate > 700) spawnRate -= 15;
        }
        lastSpawn = time;
    }

    // 3. DIBUJAR CABLES
    connections.forEach(conn => {
        const tx = conn.col * cellW + cellW / 2;
        const ty = gridTop + (conn.row * CONFIG.cellH) + CONFIG.cellH / 2;
        const isStunned = conn.stunUntil > time;
        const sway = Math.sin((time / 1000) + conn.phase) * 3;
        const currentSag = conn.sag + sway;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.moveTo(baseNodeX, baseNodeY);
        const cpX = (baseNodeX + tx) / 2;
        const cpY = Math.max(baseNodeY, ty) + currentSag; 
        ctx.quadraticCurveTo(cpX, cpY, tx, ty);
        ctx.strokeStyle = isStunned ? "#00ffff" : "#382212"; 
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = isStunned ? "#ffffff" : "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    });

    // 4. CUADRÍCULA Y MÁQUINAS
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

                conn.recoil = (conn.recoil || 0) * 0.85;
                conn.flash = (conn.flash || 0) * 0.7;
                const drawY = cy + conn.recoil;

                // Muzzle Flash
                if (conn.flash > 0.1) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, drawY - 15, 25 * conn.flash, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 200, ${conn.flash})`;
                    ctx.shadowBlur = 15; ctx.shadowColor = "#ffcc00";
                    ctx.fill();
                    ctx.restore();
                }

                ctx.fillStyle = isStunned ? "#546e7a" : "#cd7f32";
                ctx.beginPath(); ctx.arc(cx, drawY, 18, 0, Math.PI * 2); ctx.fill();

                const enemyInLane = enemies.some(en => Math.floor(en.x / cellW) === c);
                const canFire = bossSpawned ? enemies.length > 0 : enemyInLane;

                if (!isStunned && canFire && (time - conn.lastFired > CONFIG.fireRate)) {
                    bullets.push({ x: cx, y: cy - 10, col: c });
                    conn.lastFired = time;
                    conn.recoil = 12;
                    conn.flash = 1.0;
                }
                if (isStunned) {
                    ctx.fillStyle = "#00ffff"; ctx.textAlign = "center";
                    ctx.fillText("⚡", cx, drawY + 6);
                }
            }
        }
    }

    // 5. ACTUALIZAR ENEMIGOS
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        en.y += en.speed;
        if (en.hitFlash > 0) en.hitFlash -= 0.15;

        ctx.fillStyle = en.hitFlash > 0 ? `rgba(255,255,255,${en.hitFlash})` : en.color;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(en.x + en.size, en.y + en.size * 2);
        ctx.lineTo(en.x - en.size, en.y + en.size * 2);
        ctx.fill();

        ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.fillText(en.hp, en.x, en.y + en.size * 2 + 12);

        if (en.y > canvas.height * 0.85) {
            health -= en.damage;
            enemies.splice(i, 1);
            document.getElementById('game-container').style.animation = "shake 0.2s";
            setTimeout(() => document.getElementById('game-container').style.animation = "", 200);
        }
    }

    // 6. BALAS INTELIGENTES (Lógica restaurada)
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        let target = null;

        if (bossSpawned && enemies.length > 0) {
            target = enemies[0];
            b.x += (target.x - b.x) * 0.12;
            b.y += (target.y - b.y) * 0.12;
        } else {
            let minDist = 1000;
            enemies.forEach(en => {
                let enCol = Math.floor(en.x / cellW);
                if (enCol === b.col && en.y < b.y) {
                    let d = Math.hypot(en.x - b.x, en.y - b.y);
                    if (d < minDist) { minDist = d; target = en; }
                }
            });
            if (target) b.x += (target.x - b.x) * 0.15;
            b.y -= 10;
        }

        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();

        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            let en = enemies[ei];
            const hitBox = en.level >= 30 ? 60 : 35;
            if (Math.hypot(b.x - en.x, b.y - en.y) < hitBox) {
                en.hp--;
                en.hitFlash = 1.0;
                for(let p=0; p<6; p++) {
                    particles.push({
                        x: b.x, y: b.y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
                        life: 1.0, color: en.color
                    });
                }
                bullets.splice(i, 1);
                if (en.hp <= 0) {
                    if (en.level === 30) {
                        enemies.splice(ei, 1);
                        setTimeout(() => { alert("¡VICTORIA!"); location.reload(); }, 200);
                        return;
                    }
                    if (en.level === 10) shockwaves.push({ x: en.x, y: en.y, r: 0, opacity: 1 });
                    enemies.splice(ei, 1);
                }
                break;
            }
        }
        if (b && (b.y < -50 || b.y > canvas.height + 50)) bullets.splice(i, 1);
    }

    // 7. ONDAS Y PARTÍCULAS
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.r += 7; sw.opacity -= 0.02;
        ctx.strokeStyle = `rgba(0, 255, 255, ${sw.opacity})`;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
        connections.forEach(conn => {
            const mx = (conn.col * cellW) + cellW / 2;
            const my = gridTop + (conn.row * CONFIG.cellH) + CONFIG.cellH / 2;
            if (Math.hypot(mx - sw.x, my - sw.y) < sw.r) conn.stunUntil = Math.max(conn.stunUntil, time + 2000);
        });
        if (sw.opacity <= 0) shockwaves.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.03;
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1.0;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // 8. ESTRUCTURA CENTRAL
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.moveTo(baseNodeX - 30, canvas.height);
    ctx.lineTo(baseNodeX - 15, baseNodeY - 5);
    ctx.lineTo(baseNodeX + 15, baseNodeY - 5);
    ctx.lineTo(baseNodeX + 30, canvas.height);
    ctx.fill();

    updateUI(secondsPassed);
    if (health <= 0) { alert("CIUDAD DESTRUIDA"); location.reload(); return; }
    requestAnimationFrame(animate);
}

function updateUI(sec) {
    // Boiler Pressure (Basado en número de máquinas activas)
    const pPercent = (connections.length / CONFIG.maxConnections) * 100;
    const pBar = document.getElementById('pressure-bar');
    const pTxt = document.getElementById('pressure-val');
    if (pTxt) pTxt.innerText = Math.floor(pPercent);
    if (pBar) pBar.style.width = pPercent + "%";

    // Time
    const tTxt = document.getElementById('time-val');
    if (tTxt) tTxt.innerText = Math.floor(sec);

    // HP
    const hpPercent = (health / 150) * 100;
    const hBar = document.getElementById('health-bar');
    const hTxt = document.getElementById('hp-val');
    if (hTxt) hTxt.innerText = Math.max(0, Math.floor(health));
    if (hBar) {
        hBar.style.width = Math.max(0, hpPercent) + "%";
        hBar.style.background = hpPercent < 30 ? "#ff0000" : "linear-gradient(90deg, #ff4500, #ff8c00)";
    }
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
            const tx = col * cellW + cellW / 2;
            const dx = Math.abs(tx - (canvas.width / 2));
            connections.push({ 
                col, row, lastFired: 0, stunUntil: 0, recoil: 0, flash: 0,
                sag: 20 + (dx * 0.25) + Math.random() * 50,
                phase: Math.random() * Math.PI * 2 
            });
        }
    }
});

window.addEventListener('resize', resize);
window.onload = () => { resize(); requestAnimationFrame(animate); };
