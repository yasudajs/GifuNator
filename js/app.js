// GifuNator（ギフネイター）メインロジック

const MAX_QUESTIONS = 20;

// アプリの状態
const state = {
  topics: [],
  questions: [],
  targetTopic: null,
  remainingQuestions: MAX_QUESTIONS,
  usedQuestionIds: new Set(),
  currentChoices: [],
  history: [],
  gameStatus: 'playing', // 'playing' | 'won' | 'lost'
  activeFilter: 'all',
  consecutiveWins: 0
};

// DOM要素
const elements = {
  remainingQuestionsCount: document.getElementById('remaining-questions-count'),
  qCountInline: document.getElementById('q-count-inline'),
  mascotSpeech: document.getElementById('mascot-speech'),
  questionsPool: document.getElementById('questions-pool'),
  btnRefreshQuestions: document.getElementById('btn-refresh-questions'),
  historyList: document.getElementById('history-list'),
  historyCount: document.getElementById('history-count'),
  tabCandidate: document.getElementById('tab-candidate'),
  tabDirect: document.getElementById('tab-direct'),
  panelCandidate: document.getElementById('panel-candidate'),
  panelDirect: document.getElementById('panel-direct'),
  candidateList: document.getElementById('candidate-list'),
  totalTopicsCount: document.getElementById('total-topics-count'),
  filterChips: document.querySelectorAll('.chip'),
  directForm: document.getElementById('direct-answer-form'),
  directInput: document.getElementById('direct-input'),
  wrongFeedback: document.getElementById('wrong-answer-feedback'),
  resultModal: document.getElementById('result-modal'),
  modalHeaderIcon: document.getElementById('modal-header-icon'),
  modalTitle: document.getElementById('modal-title'),
  modalSubtitle: document.getElementById('modal-subtitle'),
  modalTargetName: document.getElementById('modal-target-name'),
  modalTargetMeta: document.getElementById('modal-target-meta'),
  modalTargetDesc: document.getElementById('modal-target-desc'),
  modalUsedQuestions: document.getElementById('modal-used-questions'),
  modalRankTitle: document.getElementById('modal-rank-title'),
  btnShareX: document.getElementById('btn-share-x'),
  btnRestart: document.getElementById('btn-restart')
};

// 初期化
async function init() {
  try {
    const [topicsRes, questionsRes] = await Promise.all([
      fetch('data/topics.json'),
      fetch('data/questions.json')
    ]);

    const topicsData = await topicsRes.json();
    const questionsData = await questionsRes.json();

    state.topics = topicsData.topics;
    state.questions = questionsData.questions;

    if (elements.totalTopicsCount) {
      elements.totalTopicsCount.textContent = state.topics.length;
    }

    setupEventListeners();
    startNewGame();
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
    elements.mascotSpeech.textContent = 'データの読み込みに失敗しました。ページを再読み込みしてください。';
  }
}

// イベントリスナー設定
function setupEventListeners() {
  // 質問更新ボタン
  elements.btnRefreshQuestions.addEventListener('click', () => {
    if (state.gameStatus !== 'playing') return;
    drawQuestionChoices();
    setMascotSpeech('別の質問の選択肢を出したぞ。どれを聞く？');
  });

  // タブ切り替え（候補選択 vs 直接入力）
  elements.tabCandidate.addEventListener('click', () => switchTab('candidate'));
  elements.tabDirect.addEventListener('click', () => switchTab('direct'));

  // 候補フィルタリングチップ
  elements.filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      elements.filterChips.forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.activeFilter = e.currentTarget.dataset.filter;
      renderCandidates();
    });
  });

  // 直接入力送信
  elements.directForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.gameStatus !== 'playing') return;
    const inputVal = elements.directInput.value.trim();
    if (!inputVal) return;
    checkAnswer(inputVal, 'direct');
  });

  // モーダル操作
  elements.btnRestart.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    startNewGame();
  });

  elements.btnShareX.addEventListener('click', shareToX);
}

// ゲーム開始
function startNewGame() {
  state.gameStatus = 'playing';
  state.remainingQuestions = MAX_QUESTIONS;
  state.usedQuestionIds.clear();
  state.history = [];

  // ランダムにお題を1つ選択
  const randomIndex = Math.floor(Math.random() * state.topics.length);
  state.targetTopic = state.topics[randomIndex];

  // UI初期化
  updateStatsDisplay();
  clearWrongFeedback();
  renderHistory();
  renderCandidates();
  drawQuestionChoices();

  setMascotSpeech('岐阜に関する言葉を1つ心に決めたぞ。<br>下の質問をぶつけて、わしが考えたお題を当ててみよ！');
}

// 質問を3つ抽選して表示
function drawQuestionChoices() {
  elements.questionsPool.innerHTML = '';

  const availableQuestions = state.questions.filter(q => !state.usedQuestionIds.has(q.id));

  if (availableQuestions.length === 0) {
    elements.questionsPool.innerHTML = '<p class="empty-history">すべての質問を使い切りました！答えを解答してください！</p>';
    return;
  }

  // シャッフルして最大3つ取得
  const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
  state.currentChoices = shuffled.slice(0, 3);

  state.currentChoices.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'question-btn';
    btn.innerHTML = `
      <span class="question-btn-text">Q. ${q.text}</span>
      <span class="question-category-tag">${q.category}</span>
    `;
    btn.addEventListener('click', () => handleSelectQuestion(q));
    elements.questionsPool.appendChild(btn);
  });
}

// 質問を選択したときの処理
function handleSelectQuestion(question) {
  if (state.gameStatus !== 'playing') return;

  // 使用済みに追加
  state.usedQuestionIds.add(question.id);
  state.remainingQuestions -= 1;

  // 判定
  const isYes = !!state.targetTopic.answers[question.id];

  // 履歴に追加
  state.history.unshift({
    questionText: question.text,
    category: question.category,
    isYes: isYes
  });

  // マスコットのリアクション
  if (isYes) {
    setMascotSpeech(`「${question.text}」じゃな？<br>答えは……<strong>【 はい 】</strong>じゃ！`);
  } else {
    setMascotSpeech(`「${question.text}」じゃな？<br>答えは……<strong>【 いいえ 】</strong>じゃ！`);
  }

  updateStatsDisplay();
  renderHistory();

  // ゲームオーバー判定
  if (state.remainingQuestions <= 0) {
    endGame(false);
    return;
  }

  // 次の質問選択肢を引く
  drawQuestionChoices();
}

// 解答チェック
function checkAnswer(answerInput, type = 'candidate') {
  if (state.gameStatus !== 'playing') return;

  clearWrongFeedback();
  const target = state.targetTopic;

  let isCorrect = false;

  if (type === 'candidate') {
    // 候補ボタン（IDまたは完全一致）
    isCorrect = (answerInput === target.id || answerInput === target.name);
  } else {
    // 直接入力（正規化して比較）
    const normalizedInput = normalizeString(answerInput);
    const normalizedTargetName = normalizeString(target.name);
    const normalizedTargetReading = normalizeString(target.reading || '');
    const normalizedAliases = (target.aliases || []).map(normalizeString);

    if (
      normalizedInput === normalizedTargetName ||
      normalizedInput === normalizedTargetReading ||
      normalizedAliases.includes(normalizedInput)
    ) {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    endGame(true);
  } else {
    showWrongFeedback(`「${answerInput}」は違います！まだお題は隠されているぞ…！`);
    setMascotSpeech(`ふっふっふ…「${answerInput}」ではないぞ！<br>もっと質問で絞り込んでみるのじゃ！`);
  }
}

// ゲーム終了（クリア or ギブアップ）
function endGame(isWin) {
  state.gameStatus = isWin ? 'won' : 'lost';

  const usedCount = MAX_QUESTIONS - state.remainingQuestions;
  const target = state.targetTopic;

  elements.modalTargetName.textContent = target.name;
  elements.modalTargetMeta.textContent = `${target.region} / ${target.category}`;
  elements.modalTargetDesc.textContent = target.description;

  if (isWin) {
    elements.modalHeaderIcon.textContent = '🎉';
    elements.modalTitle.textContent = '正解！お見事！';
    elements.modalSubtitle.textContent = 'わしが思い浮かべていたのは…';
    elements.modalUsedQuestions.textContent = `${usedCount} 問`;

    // ランク判定
    let rank = '岐阜ビギナー';
    if (usedCount <= 3) {
      rank = '伝説の岐阜神級 👑';
    } else if (usedCount <= 6) {
      rank = '飛騨牛・長良川級 🥩';
    } else if (usedCount <= 10) {
      rank = '岐阜マスター級 🏯';
    } else if (usedCount <= 15) {
      rank = '岐阜ツウ級 🍵';
    }
    elements.modalRankTitle.textContent = rank;
  } else {
    elements.modalHeaderIcon.textContent = '💀';
    elements.modalTitle.textContent = 'ゲームオーバー！';
    elements.modalSubtitle.textContent = '20問使い切ってしまった…正解はこれじゃ！';
    elements.modalUsedQuestions.textContent = '20問消費（時間切れ）';
    elements.modalRankTitle.textContent = 'まだまだ修行が必要じゃ！';
  }

  elements.resultModal.classList.remove('hidden');
}

// 候補ボタンの描画
function renderCandidates() {
  elements.candidateList.innerHTML = '';

  const filter = state.activeFilter;
  const filtered = state.topics.filter(t => {
    if (filter === 'all') return true;
    if (filter === '美濃') return t.region === '美濃';
    if (filter === '飛騨') return t.region === '飛騨';
    if (filter === 'グルメ') return t.category.includes('グルメ') || t.category.includes('特産') || t.category.includes('料理') || t.category.includes('和菓子');
    if (filter === '名所') return t.category.includes('名所') || t.category.includes('自然') || t.category.includes('温泉') || t.category.includes('世界遺産');
    if (filter === '伝統') return t.category.includes('歴史') || t.category.includes('工芸') || t.category.includes('人物') || t.category.includes('行事') || t.category.includes('祭り');
    return true;
  });

  filtered.forEach(topic => {
    const btn = document.createElement('button');
    btn.className = 'candidate-btn';
    btn.textContent = topic.name;
    btn.addEventListener('click', () => checkAnswer(topic.id, 'candidate'));
    elements.candidateList.appendChild(btn);
  });
}

// 履歴描画
function renderHistory() {
  elements.historyCount.textContent = state.history.length;

  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<p class="empty-history">まだ質問していません。上のカードから質問を選んでください。</p>';
    return;
  }

  elements.historyList.innerHTML = '';
  state.history.forEach(item => {
    const div = document.createElement('div');
    div.className = `history-item ${item.isYes ? 'ans-yes' : 'ans-no'}`;
    div.innerHTML = `
      <span class="history-text">Q. ${item.questionText}</span>
      <span class="history-badge ${item.isYes ? 'yes' : 'no'}">${item.isYes ? 'はい' : 'いいえ'}</span>
    `;
    elements.historyList.appendChild(div);
  });
}

// タブ切り替え
function switchTab(mode) {
  if (mode === 'candidate') {
    elements.tabCandidate.classList.add('active');
    elements.tabDirect.classList.remove('active');
    elements.panelCandidate.classList.remove('hidden');
    elements.panelDirect.classList.add('hidden');
  } else {
    elements.tabDirect.classList.add('active');
    elements.tabCandidate.classList.remove('active');
    elements.panelDirect.classList.remove('hidden');
    elements.panelCandidate.classList.add('hidden');
    elements.directInput.focus();
  }
}

// 状態表示更新
function updateStatsDisplay() {
  elements.remainingQuestionsCount.textContent = state.remainingQuestions;
  elements.qCountInline.textContent = state.remainingQuestions;
}

// マスコット発話更新
function setMascotSpeech(html) {
  elements.mascotSpeech.innerHTML = html;
}

// 不正解フィードバック表示
function showWrongFeedback(message) {
  elements.wrongFeedback.textContent = message;
  elements.wrongFeedback.classList.remove('hidden');
}

function clearWrongFeedback() {
  elements.wrongFeedback.textContent = '';
  elements.wrongFeedback.classList.add('hidden');
}

// 文字列正規化（ひらがな化・小文字化・空白除去）
function normalizeString(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    // カタカナをひらがなに変換
    .replace(/[\u30a1-\u30f6]/g, match => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
}

// X（旧Twitter）シェア
function shareToX() {
  const target = state.targetTopic;
  const isWin = state.gameStatus === 'won';
  const usedCount = MAX_QUESTIONS - state.remainingQuestions;
  const rank = elements.modalRankTitle.textContent;

  let text = '';
  if (isWin) {
    text = `【GifuNator（ギフネイター）】\n岐阜のお題「${target.name}」を${usedCount}問で当てました！🎉\n称号：${rank}\n岐阜にまつわる言葉を当てる20の質問ゲームに挑戦しよう！\n#GifuNator #岐阜県 #岐阜クイズ`;
  } else {
    text = `【GifuNator（ギフネイター）】\n岐阜のお題を当てられませんでした…！正解は「${target.name}」でした！😭\n20の質問で岐阜を当てる推理ゲームに挑戦！\n#GifuNator #岐阜県`;
  }

  const url = window.location.href;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank');
}

// DOM読み込み完了時に実行
document.addEventListener('DOMContentLoaded', init);
