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

