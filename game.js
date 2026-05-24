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

  // Voeg de canvas van de webcam toe aan de overlay
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