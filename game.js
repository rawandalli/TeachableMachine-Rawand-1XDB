const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/_D-m8qjc3/';


const CW           = 800;
const CH           = 500;
const PADDLE_W     = 14;
const PADDLE_H     = 90;
const BALL_R       = 8;
const PLAYER_X     = 22;
const AI_X         = CW - 22 - PADDLE_W;
const PADDLE_SPEED = 7;
const BALL_SPEED_0 = 5;
const BALL_SPEED_MAX = 11;
const GAME_SECONDS = 120;

let canvas, ctx;
let playerY = CH / 2 - PADDLE_H / 2;
let aiY     = CH / 2 - PADDLE_H / 2;
let ballX   = CW / 2;
let ballY   = CH / 2;
let ballVX  = 0;
let ballVY  = 0;

let playerScore = 0;
let aiScore     = 0;
let bestScore   = 0;
let timeLeft    = GAME_SECONDS;
let gameRunning = false;
let timerID     = null;
let rafID       = null;


let tmModel    = null;
let tmWebcam   = null;
let usingTM    = false;
let tmHandY    = -1;   
let mouseY     = CH / 2;

const WEBCAM_SIZE = 200;  


let elTimer, elPlayerScore, elAiScore, elBestHud, elTmStatus, elControlBadge;

window.addEventListener('DOMContentLoaded', () => {
  canvas         = document.getElementById('game-canvas');
  ctx            = canvas.getContext('2d');
  elTimer        = document.getElementById('timer-badge');
  elPlayerScore  = document.getElementById('player-score');
  elAiScore      = document.getElementById('ai-score');
  elBestHud      = document.getElementById('best-score-hud');
  elTmStatus     = document.getElementById('tm-status');
  elControlBadge = document.getElementById('control-badge');

  bestScore = parseInt(localStorage.getItem('pong_best') || '0');
  elBestHud.textContent = bestScore;

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('retry-btn').addEventListener('click', startGame);
  document.getElementById('menu-btn').addEventListener('click', goMenu);

  canvas.addEventListener('mousemove', e => {
    const r  = canvas.getBoundingClientRect();
    const sy = CH / r.height;
    mouseY = (e.clientY - r.top) * sy;
  });

  renderScoreboard();
  loadTMModel();
});


function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goMenu() {
  stopGame();
  renderScoreboard();
  showScreen('start-screen');
}

async function loadTMModel() {
  setStatus('Model laden…');
  try {
    tmModel = await tmPose.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');

    console.log('TM model geladen — positie-tracking actief.');

    setStatus('Camera starten…');
    await startWebcam();
    tmLoaded = true;
    usingTM  = true;
    setStatus('Actief — hand tracking aan');
    elControlBadge.textContent = '● Hand Tracking';
    elControlBadge.className   = 'control-badge tm';
  } catch (err) {
    console.warn('TM laden mislukt:', err);
    setStatus('TM niet beschikbaar — muisbediening actief');
    usingTM = false;
  }
}

async function startWebcam() {
  tmWebcam = new tmPose.Webcam(200, 200, true);
  await tmWebcam.setup();
  await tmWebcam.play();

  
  const container   = document.getElementById('webcam-container');
  const placeholder = document.getElementById('cam-placeholder');
  placeholder.style.display = 'none';
  container.appendChild(tmWebcam.canvas);

  requestAnimationFrame(tmLoop);
}

async function tmLoop() {
  if (!tmModel || !tmWebcam) return;
  tmWebcam.update();

  try {
    const { pose } = await tmModel.estimatePose(tmWebcam.canvas);

    if (pose && pose.keypoints) {
      // Keypoint 9 = leftWrist, 10 = rightWrist (PoseNet indices)
      const lw = pose.keypoints[9];
      const rw = pose.keypoints[10];

      // Gebruik de pols met de hoogste detectie-score
      const wrist = (lw.score >= rw.score) ? lw : rw;

      if (wrist.score > 0.2) {
        // Map pols-Y (0–200) lineair naar canvas-Y (0–500)
        tmHandY = (wrist.position.y / WEBCAM_SIZE) * CH;
        setStatus(`Hand Y: ${Math.round(wrist.position.y)} → canvas: ${Math.round(tmHandY)}`);
      } else {
        // Hand niet zichtbaar: bevriesd op laatste positie
        setStatus('Hand niet gevonden — houdt voor camera');
      }
    }
  } catch (err) {
    console.warn('tmLoop fout:', err);
  }

  requestAnimationFrame(tmLoop);
}

function setStatus(msg) {
  if (elTmStatus) elTmStatus.textContent = msg;
}

function startGame() {
  playerScore = 0;
  aiScore     = 0;
  timeLeft    = GAME_SECONDS;
  playerY     = CH / 2 - PADDLE_H / 2;
  aiY         = CH / 2 - PADDLE_H / 2;

  updateHUD();
  resetBall(true);
  showScreen('game-screen');

  gameRunning = true;

  clearInterval(timerID);
  timerID = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) endGame();
  }, 1000);

  cancelAnimationFrame(rafID);
  gameLoop();
}

function stopGame() {
  gameRunning = false;
  clearInterval(timerID);
  cancelAnimationFrame(rafID);
}

function endGame() {
  stopGame();

  if (playerScore > bestScore) {
    bestScore = playerScore;
    localStorage.setItem('pong_best', bestScore);
  }

  saveEntry(playerScore, aiScore);
  renderScoreboard();

  document.getElementById('final-player-score').textContent = pad(playerScore);
  document.getElementById('final-ai-score').textContent     = pad(aiScore);
  document.getElementById('end-best-score').textContent     = bestScore;

  const title = document.getElementById('result-title');
  if (playerScore > aiScore) {
    title.textContent = 'GEWONNEN!';
    title.className   = 'result-title won';
  } else if (playerScore < aiScore) {
    title.textContent = 'VERLOREN!';
    title.className   = 'result-title lost';
  } else {
    title.textContent = 'GELIJKSPEL!';
    title.className   = 'result-title draw';
  }

  showScreen('end-screen');
}

// ════════════════════════════════════════
//  BALL
// ════════════════════════════════════════
function resetBall(towardPlayer) {
  ballX = CW / 2;
  ballY = CH / 2;

  // Kleine willekeurige hoek
  const angle = (Math.random() * 0.4 - 0.2) * Math.PI;
  const dir   = towardPlayer ? -1 : 1;
  ballVX = dir * BALL_SPEED_0 * Math.cos(angle);
  ballVY = BALL_SPEED_0 * Math.sin(angle);
}


function updatePlayer() {
  if (usingTM && tmHandY >= 0) {
    // Paddle-midden volgt direct de handpositie
    // Kleine smoothing (lerp 0.25) zodat de beweging vloeiend is maar stopt als de hand stil staat
    const target = clamp(tmHandY - PADDLE_H / 2, 0, CH - PADDLE_H);
    playerY += (target - playerY) * 0.25;
  } else if (!usingTM) {
    playerY = mouseY - PADDLE_H / 2;
    playerY = clamp(playerY, 0, CH - PADDLE_H);
  }
}

// AI volgt de bal perfect maar stuurt terug naar willekeurige Y
let aiTargetY = CH / 2;

function updateAI() {
  // Zoek nieuwe target zodra bal naar AI beweegt
  if (ballVX > 0 && ballX > CW / 2) {
    const randomTarget = rand(50, CH - 50);
    aiTargetY = randomTarget - PADDLE_H / 2;
  }

  const center = aiY + PADDLE_H / 2;
  const diff   = (aiTargetY + PADDLE_H / 2) - center;
  const step   = clamp(Math.abs(diff), 0, 5);
  aiY += Math.sign(diff) * step;
  aiY  = clamp(aiY, 0, CH - PADDLE_H);
}

function updateBall() {
  ballX += ballVX;
  ballY += ballVY;

  // Muur boven/onder
  if (ballY - BALL_R <= 0)  { ballY = BALL_R;       ballVY =  Math.abs(ballVY); }
  if (ballY + BALL_R >= CH) { ballY = CH - BALL_R;  ballVY = -Math.abs(ballVY); }

   // Speler (links)
  if (
    ballVX < 0 &&
    ballX - BALL_R <= PLAYER_X + PADDLE_W &&
    ballX - BALL_R >= PLAYER_X - 2 &&
    ballY + BALL_R >= playerY &&
    ballY - BALL_R <= playerY + PADDLE_H
  ) {
    ballX = PLAYER_X + PADDLE_W + BALL_R;
    const rel   = (ballY - playerY) / PADDLE_H - 0.5; // -0.5 .. 0.5
    const angle = rel * Math.PI * 0.65;
    const spd   = clamp(mag(ballVX, ballVY) + 0.4, BALL_SPEED_0, BALL_SPEED_MAX);
    ballVX =  spd * Math.cos(angle);
    ballVY =  spd * Math.sin(angle);
    playerScore++;
    updateHUD();
  }

 // AI (rechts)
  if (
    ballVX > 0 &&
    ballX + BALL_R >= AI_X &&
    ballX + BALL_R <= AI_X + PADDLE_W + 2 &&
    ballY + BALL_R >= aiY &&
    ballY - BALL_R <= aiY + PADDLE_H
  ) {
    ballX = AI_X - BALL_R;
    // Stuur bal naar willekeurige hoogte links
    const targetY = rand(60, CH - 60);
    const dx   = -Math.abs(AI_X - PLAYER_X);
    const dy   = targetY - ballY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd  = clamp(mag(ballVX, ballVY) + 0.3, BALL_SPEED_0, BALL_SPEED_MAX);
    ballVX = spd * (dx / dist);
    ballVY = spd * (dy / dist);
    aiTargetY = CH / 2;
  }

   
  if (ballX + BALL_R < 0) {
    aiScore++;
    updateHUD();
    resetBall(false);  
  }

 
  if (ballX - BALL_R > CW) {
    resetBall(true);
  }
}

function draw() {
  // Achtergrond
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, CW, CH);

  // Subtiele gloed links/rechts
  const glowL = ctx.createRadialGradient(PLAYER_X + PADDLE_W, playerY + PADDLE_H / 2, 0, PLAYER_X + PADDLE_W, playerY + PADDLE_H / 2, 120);
  glowL.addColorStop(0,   'rgba(255,85,0,0.08)');
  glowL.addColorStop(1,   'rgba(255,85,0,0)');
  ctx.fillStyle = glowL;
  ctx.fillRect(0, 0, CW / 2, CH);

  // Stippellijn midden
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = 'rgba(99,120,150,0.35)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(CW / 2, 0);
  ctx.lineTo(CW / 2, CH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Speler-paddle (oranje)
  drawPaddle(PLAYER_X, playerY, '#FF5500', '#FF7830');

  // AI-paddle (geel)
  drawPaddle(AI_X, aiY, '#FFCC00', '#FFE566');

  // Bal (wit + gloed)
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPaddle(x, y, colorA, colorB) {
  const grad = ctx.createLinearGradient(x, y, x + PADDLE_W, y);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle  = grad;
  ctx.shadowColor = colorA;
  ctx.shadowBlur  = 14;
  roundRect(ctx, x, y, PADDLE_W, PADDLE_H, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y,     x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h,     x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y,         x + r, y);
  c.closePath();
}

// ════════════════════════════════════════
//  GAME LOOP
// ════════════════════════════════════════
function gameLoop() {
  if (!gameRunning) return;
  updatePlayer();
  updateAI();
  updateBall();
  draw();
  rafID = requestAnimationFrame(gameLoop);
}

function updateHUD() {
  elPlayerScore.textContent = pad(playerScore);
  elAiScore.textContent     = pad(aiScore);
  elBestHud.textContent     = bestScore;
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  elTimer.textContent = `Timer: ${m}:${pad(s)}`;
}

// ════════════════════════════════════════
//  LOCALSTORAGE SCOREBOARD
// ════════════════════════════════════════
function saveEntry(pScore, aScore) {
  const board = getBoard();
  board.push({
    date:   new Date().toLocaleDateString('nl-BE'),
    player: pScore,
    ai:     aScore,
    result: pScore > aScore ? 'W' : pScore < aScore ? 'L' : 'D'
  });
  board.sort((a, b) => b.player - a.player);
  board.splice(10);
  localStorage.setItem('pong_scoreboard', JSON.stringify(board));
}

function getBoard() {
  try { return JSON.parse(localStorage.getItem('pong_scoreboard') || '[]'); }
  catch (_) { return []; }
}

function renderScoreboard() {
  const container = document.getElementById('scoreboard-preview');
  if (!container) return;
  const board = getBoard();
  if (!board.length) { container.innerHTML = ''; return; }

  let html = `
    <table>
      <thead><tr>
        <th>#</th><th>Datum</th><th>Speler</th><th>AI</th><th>Uitslag</th>
      </tr></thead>
      <tbody>
  `;
  board.forEach((e, i) => {
    const cls = e.result === 'W' ? 'result-w' : e.result === 'L' ? 'result-l' : 'result-d';
    const lbl = e.result === 'W' ? 'GEWONNEN' : e.result === 'L' ? 'VERLOREN' : 'GELIJK';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${e.date}</td>
      <td>${pad(e.player)}</td>
      <td>${pad(e.ai)}</td>
      <td class="${cls}">${lbl}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ════════════════════════════════════════
//  HULPFUNCTIES
// ════════════════════════════════════════
function pad(n)            { return String(n).padStart(2, '0'); }
function clamp(v, lo, hi)  { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi)      { return lo + Math.random() * (hi - lo); }
function mag(vx, vy)       { return Math.sqrt(vx * vx + vy * vy); }
