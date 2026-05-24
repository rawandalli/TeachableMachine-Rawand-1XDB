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