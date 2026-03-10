/* =============================================
   きめるん — Application Logic
   Three selection methods: Shuffle Cards, Wheel, Random Pick
   ============================================= */

(() => {
    'use strict';

    // ----- Constants -----
    const SEGMENT_COLORS = [
        '#4A90D9', '#5CB88A', '#E8924F', '#D96BA0',
        '#7B68D9', '#D9B84A', '#4ABCD9', '#D96B6B'
    ];

    const MAX_CHOICES = 8;
    const MIN_CHOICES = 2;
    const MAX_HISTORY = 10;
    const HISTORY_KEY = 'kimerun_history';
    const METHOD_KEY = 'kimerun_method';

    const PRESETS = {
        lunch: ['ハンバーグ', 'パスタ', 'カレー', 'ラーメン', '寿司'],
        weekend: ['映画を観る', '買い物', 'カフェ巡り', '公園で散歩', 'ゲーム'],
        movie: ['アクション', 'コメディ', 'ホラー', 'SF', 'ロマンス']
    };

    const METHOD_ICONS = {
        shuffle: '🃏',
        wheel: '🎡',
        random: '✨'
    };

    // ----- DOM Elements -----
    const inputSection = document.getElementById('input-section');
    const selectionSection = document.getElementById('selection-section');
    const resultSection = document.getElementById('result-section');
    const choicesContainer = document.getElementById('choices-container');
    const addChoiceBtn = document.getElementById('add-choice-btn');
    const startBtn = document.getElementById('start-btn');
    const decideBtn = document.getElementById('decide-btn');
    const backToInputBtn = document.getElementById('back-to-input-btn');
    const retryBtn = document.getElementById('retry-btn');
    const changeBtn = document.getElementById('change-btn');
    const resultText = document.getElementById('result-text');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const methodSelector = document.getElementById('method-selector');

    // Stage elements
    const shuffleStage = document.getElementById('shuffle-stage');
    const wheelStage = document.getElementById('wheel-stage');
    const randomStage = document.getElementById('random-stage');
    const wheelCanvas = document.getElementById('wheel-canvas');
    const wheelCtx = wheelCanvas.getContext('2d');
    const randomDisplay = document.getElementById('random-display');

    // ----- State -----
    let choices = [];
    let currentMethod = localStorage.getItem(METHOD_KEY) || 'shuffle';
    let isAnimating = false;
    let currentWheelRotation = 0;

    // ----- Initialize -----
    function init() {
        addChoiceRow('');
        addChoiceRow('');
        updateStartButton();
        renderHistory();
        bindEvents();
        setActiveMethod(currentMethod);
    }

    // ----- Event Binding -----
    function bindEvents() {
        addChoiceBtn.addEventListener('click', () => {
            const rows = choicesContainer.querySelectorAll('.choice-row');
            if (rows.length < MAX_CHOICES) {
                addChoiceRow('');
                updateStartButton();
            }
        });

        startBtn.addEventListener('click', goToSelection);
        decideBtn.addEventListener('click', decide);
        backToInputBtn.addEventListener('click', goToInput);
        retryBtn.addEventListener('click', () => {
            resultSection.classList.add('hidden');
            selectionSection.classList.remove('hidden');
            setupStage();
        });
        changeBtn.addEventListener('click', goToInput);
        clearHistoryBtn.addEventListener('click', clearHistory);

        // Method selector
        methodSelector.querySelectorAll('.method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveMethod(btn.dataset.method);
            });
        });

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = PRESETS[btn.dataset.preset];
                if (preset) loadPreset(preset);
            });
        });
    }

    // ----- Method Selection -----
    function setActiveMethod(method) {
        currentMethod = method;
        localStorage.setItem(METHOD_KEY, method);
        methodSelector.querySelectorAll('.method-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.method === method);
        });
    }

    // ----- Choice Management -----
    function addChoiceRow(value) {
        const rows = choicesContainer.querySelectorAll('.choice-row');
        if (rows.length >= MAX_CHOICES) return;

        const index = rows.length;
        const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

        const row = document.createElement('div');
        row.className = 'choice-row';
        row.innerHTML = `
      <span class="choice-row__number" style="background: ${color}">${index + 1}</span>
      <input type="text" class="choice-row__input" placeholder="選択肢 ${index + 1}" 
             maxlength="20" value="${escapeHtml(value)}" autocomplete="off">
      <button class="choice-row__remove" title="削除">×</button>
    `;

        const input = row.querySelector('.choice-row__input');
        const removeBtn = row.querySelector('.choice-row__remove');

        input.addEventListener('input', updateStartButton);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const allInputs = choicesContainer.querySelectorAll('.choice-row__input');
                const currentIndex = Array.from(allInputs).indexOf(input);
                if (currentIndex < allInputs.length - 1) {
                    allInputs[currentIndex + 1].focus();
                } else if (allInputs.length < MAX_CHOICES) {
                    addChoiceRow('');
                    updateStartButton();
                    setTimeout(() => {
                        const newInputs = choicesContainer.querySelectorAll('.choice-row__input');
                        newInputs[newInputs.length - 1].focus();
                    }, 50);
                }
            }
        });

        removeBtn.addEventListener('click', () => {
            const currentRows = choicesContainer.querySelectorAll('.choice-row');
            if (currentRows.length <= MIN_CHOICES) return;
            row.style.animation = 'fadeSlideIn 200ms ease reverse forwards';
            setTimeout(() => {
                row.remove();
                renumberRows();
                updateStartButton();
            }, 180);
        });

        choicesContainer.appendChild(row);
        if (value === '') input.focus();
    }

    function renumberRows() {
        const rows = choicesContainer.querySelectorAll('.choice-row');
        rows.forEach((row, i) => {
            const num = row.querySelector('.choice-row__number');
            num.textContent = i + 1;
            num.style.background = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const input = row.querySelector('.choice-row__input');
            input.placeholder = `選択肢 ${i + 1}`;
        });
    }

    function getFilledChoices() {
        const inputs = choicesContainer.querySelectorAll('.choice-row__input');
        return Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
    }

    function updateStartButton() {
        const filled = getFilledChoices();
        const rows = choicesContainer.querySelectorAll('.choice-row');
        startBtn.disabled = filled.length < MIN_CHOICES;

        if (rows.length >= MAX_CHOICES) {
            addChoiceBtn.style.display = 'none';
        } else {
            addChoiceBtn.style.display = '';
        }
    }

    function loadPreset(items) {
        choicesContainer.innerHTML = '';
        items.forEach(item => addChoiceRow(item));
        updateStartButton();
    }

    // ----- Navigation -----
    function goToSelection() {
        choices = getFilledChoices();
        if (choices.length < MIN_CHOICES) return;

        inputSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        selectionSection.classList.remove('hidden');

        setupStage();
    }

    function goToInput() {
        selectionSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
    }

    function setupStage() {
        // Hide all stages
        shuffleStage.classList.add('hidden');
        wheelStage.classList.add('hidden');
        randomStage.classList.add('hidden');

        decideBtn.disabled = false;
        isAnimating = false;

        switch (currentMethod) {
            case 'shuffle':
                shuffleStage.classList.remove('hidden');
                setupShuffleCards();
                break;
            case 'wheel':
                wheelStage.classList.remove('hidden');
                drawWheel(0);
                break;
            case 'random':
                randomStage.classList.remove('hidden');
                randomDisplay.textContent = '—';
                randomDisplay.classList.remove('cycling', 'decided');
                break;
        }
    }

    function decide() {
        if (isAnimating) return;
        isAnimating = true;
        decideBtn.disabled = true;

        switch (currentMethod) {
            case 'shuffle':
                runShuffleAnimation();
                break;
            case 'wheel':
                runWheelSpin();
                break;
            case 'random':
                runRandomPick();
                break;
        }
    }

    // ============================================
    // METHOD 1: Shuffle Cards
    // ============================================
    function setupShuffleCards() {
        shuffleStage.innerHTML = '';
        choices.forEach((choice, i) => {
            const card = document.createElement('div');
            card.className = 'shuffle-card';
            card.dataset.index = i;
            card.innerHTML = `
                <div class="shuffle-card__face shuffle-card__back">?</div>
                <div class="shuffle-card__face shuffle-card__front" style="border-color: ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}">${escapeHtml(truncateText(choice, 10))}</div>
            `;
            shuffleStage.appendChild(card);
        });
    }

    function runShuffleAnimation() {
        const cards = shuffleStage.querySelectorAll('.shuffle-card');
        const targetIndex = Math.floor(Math.random() * choices.length);

        // Shuffle animation
        let shuffleCount = 0;
        const maxShuffles = 3;

        function doShuffle() {
            cards.forEach(card => {
                card.classList.add('shuffling');
            });

            setTimeout(() => {
                cards.forEach(card => {
                    card.classList.remove('shuffling');
                });

                shuffleCount++;
                if (shuffleCount < maxShuffles) {
                    setTimeout(doShuffle, 200);
                } else {
                    // Flip the winner
                    setTimeout(() => {
                        const winnerCard = cards[targetIndex];
                        winnerCard.classList.add('flipped');

                        // Dim other cards
                        cards.forEach((card, i) => {
                            if (i !== targetIndex) {
                                card.classList.add('dimmed');
                            }
                        });

                        setTimeout(() => {
                            winnerCard.classList.add('winner');
                        }, 300);

                        setTimeout(() => {
                            showResult(choices[targetIndex]);
                        }, 1200);
                    }, 400);
                }
            }, 600);
        }

        doShuffle();
    }

    // ============================================
    // METHOD 2: Spin Wheel
    // ============================================
    function drawWheel(rotation) {
        const canvas = wheelCanvas;
        const ctx = wheelCtx;
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 4;
        const segAngle = (2 * Math.PI) / choices.length;

        ctx.clearRect(0, 0, w, h);

        // Draw segments
        for (let i = 0; i < choices.length; i++) {
            const startAngle = rotation + i * segAngle;
            const endAngle = startAngle + segAngle;
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

            // Segment fill
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Segment border
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + segAngle / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${getWheelFontSize(choices.length)}px "Noto Sans JP", sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 2;

            const text = truncateText(choices[i], 8);
            ctx.fillText(text, radius * 0.6, 0);
            ctx.restore();
        }

        // Center circle
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ccc';
        ctx.fill();
    }

    function getWheelFontSize(count) {
        if (count <= 3) return 15;
        if (count <= 5) return 13;
        return 11;
    }

    function runWheelSpin() {
        const segAngle = (2 * Math.PI) / choices.length;
        const fullRotations = (5 + Math.random() * 3) * Math.PI * 2;
        const targetSegment = Math.floor(Math.random() * choices.length);
        const targetAngle = -(targetSegment * segAngle + segAngle / 2) - Math.PI / 2;
        const totalRotation = fullRotations + targetAngle - currentWheelRotation;

        const startRotation = currentWheelRotation;
        const duration = 4000 + Math.random() * 1000;
        const startTime = performance.now();

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function animateSpin(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutQuart(progress);

            currentWheelRotation = startRotation + totalRotation * eased;
            drawWheel(currentWheelRotation);

            if (progress < 1) {
                requestAnimationFrame(animateSpin);
            } else {
                isAnimating = false;
                setTimeout(() => {
                    showResult(choices[targetSegment]);
                }, 500);
            }
        }

        requestAnimationFrame(animateSpin);
    }

    // ============================================
    // METHOD 3: Random Pick
    // ============================================
    function runRandomPick() {
        randomDisplay.classList.add('cycling');
        randomDisplay.classList.remove('decided');

        let cycleCount = 0;
        const totalCycles = 25;
        let currentIndex = 0;

        function cycle() {
            currentIndex = (currentIndex + 1) % choices.length;
            randomDisplay.textContent = choices[currentIndex];
            cycleCount++;

            // Slow down toward the end
            const progress = cycleCount / totalCycles;
            const delay = 60 + progress * progress * 300;

            if (cycleCount < totalCycles) {
                setTimeout(cycle, delay);
            } else {
                // Final pick
                const finalIndex = Math.floor(Math.random() * choices.length);
                randomDisplay.textContent = choices[finalIndex];
                randomDisplay.classList.remove('cycling');
                randomDisplay.classList.add('decided');

                isAnimating = false;
                setTimeout(() => {
                    showResult(choices[finalIndex]);
                }, 800);
            }
        }

        cycle();
    }

    // ----- Result -----
    function showResult(result) {
        resultText.textContent = result;

        selectionSection.classList.add('hidden');
        resultSection.classList.remove('hidden');

        // Save to history
        addToHistory(result, choices);
    }

    // ----- History -----
    function getHistory() {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addToHistory(result, allChoices) {
        const history = getHistory();
        history.unshift({
            result,
            choices: allChoices,
            method: currentMethod,
            time: new Date().toISOString()
        });

        while (history.length > MAX_HISTORY) {
            history.pop();
        }

        saveHistory(history);
        renderHistory();
    }

    function renderHistory() {
        const history = getHistory();
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyEmpty.style.display = '';
            clearHistoryBtn.style.display = 'none';
            return;
        }

        historyEmpty.style.display = 'none';
        clearHistoryBtn.style.display = '';

        history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';

            const d = new Date(item.time);
            const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            const methodIcon = METHOD_ICONS[item.method] || '✨';

            li.innerHTML = `
        <span class="history-item__method">${methodIcon}</span>
        <span class="history-item__choices" title="${escapeHtml(item.choices.join(' / '))}">${escapeHtml(item.choices.join(' / '))}</span>
        <span class="history-item__result">→ ${escapeHtml(item.result)}</span>
        <span class="history-item__time">${timeStr}</span>
      `;
            historyList.appendChild(li);
        });
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    }

    // ----- Utility -----
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen - 1) + '…';
    }

    // ----- Start -----
    init();
})();
