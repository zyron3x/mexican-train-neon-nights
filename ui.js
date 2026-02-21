// ============================================
// UI RENDERING & DOM MANIPULATION
// ============================================

let selectedDomino = null;
let draggedDomino = null;

// Create domino DOM element
function createDominoElement(domino, orientation = 'horizontal', options = {}) {
    const { clickable = false, draggable = false } = options;
    
    const div = document.createElement('div');
    div.className = `domino ${orientation}`;
    div.setAttribute('draggable', 'true');
    
    const leftHalf = document.createElement('div');
    leftHalf.className = 'domino-half';
    leftHalf.setAttribute('data-value', domino.left);
    leftHalf.textContent = domino.left;
    
    const divider = document.createElement('div');
    divider.className = 'domino-divider';
    
    const rightHalf = document.createElement('div');
    rightHalf.className = 'domino-half';
    rightHalf.setAttribute('data-value', domino.right);
    rightHalf.textContent = domino.right;
    
    div.appendChild(leftHalf);
    div.appendChild(divider);
    div.appendChild(rightHalf);
    
    div.dominoData = domino;
    
    if (clickable) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => selectDomino(domino, div)); // Pass element!
    }
    
    if (draggable) {
        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
            draggedDomino = domino;
            div.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            draggedDomino = null;
        });
    }
    
    return div;
}

// Update entire display
function updateDisplay() {
    if (!game) return;
    
    updateHeader();
    updateTrains();
    
    // Update player hand - only clears THIS container
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    
    game.hands[0].forEach(domino => {
        const dominoEl = createDominoElement(domino, 'vertical');
        
        dominoEl.addEventListener('click', () => selectDomino(domino, dominoEl));
        
        dominoEl.addEventListener('dragstart', (e) => {
            draggedDomino = domino;
            dominoEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        dominoEl.addEventListener('dragend', () => {
            dominoEl.classList.remove('dragging');
            draggedDomino = null;
        });
        
        handContainer.appendChild(dominoEl);
    });
    
    document.getElementById('hand-count').textContent = game.hands[0].length;
    
    updateButtons();
    updatePowerupButtons();
    setupDropZones();
}

// Update header information
function updateHeader() {
    if (!game) return;
    
    // Update round number
    document.getElementById('round-num').textContent = `${game.currentRound + 1}/13`;
    
    // === FIX ENGINE DISPLAY ===
    // Show current engine / starting engine (always the first engine, which is 12)
    const currentEngine = game.engine; // Current round's engine value
    const startingEngine = 12; // Always 12 (the first engine in the game)
    document.getElementById('engine-num').textContent = `(${currentEngine}/${startingEngine})`;
    // =========================
    
    // Update boneyard count
    document.getElementById('boneyard-count').textContent = game.boneyard.length;
    
    // Update AI names
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`ai-name-${i}`).textContent = `👤 ${game.players[i]}`;
    }
}

// Update all train displays
function updateTrains() {
    ['mexican', 0, 1, 2, 3].forEach(train => {
        updateTrain(train);
    });
    
    updateCurrentTurnIndicator();
}

// Update single train display (ATOMIC RENDER)
function updateTrain(train) {
    const trainKey = train === 'mexican' ? 'mexican' : parseInt(train);
    const tilesContainer = document.getElementById(`tiles-${train}`);
    const engineDisplay = document.getElementById(`engine-${train}`);
    
    if (engineDisplay) {
        engineDisplay.textContent = game.engine;
        engineDisplay.classList.toggle('hidden', game.trains[trainKey].length > 0);
    }
    
    // ATOMIC RENDER
    tilesContainer.innerHTML = '';
    game.trains[trainKey].forEach((domino) => {
        const dominoEl = createDominoElement(domino, 'horizontal');
        tilesContainer.appendChild(dominoEl);
    });
    
    // Auto-scroll to show latest tile
    requestAnimationFrame(() => {
        tilesContainer.scrollLeft = tilesContainer.scrollWidth;
    });
    
    // === MOBILE-AWARE STATUS LABELS ===
    if (typeof train === 'number') {
        const statusEl = document.getElementById(`status-${train}`);
        const tileCountEl = document.getElementById(`tile-count-${train}`);
        const isMobile = window.innerWidth <= 768;
        
        if (statusEl) {
            const isPublic = game.publicTrains.has(train);
            // Mobile: Icon only, Desktop: Icon + text
            statusEl.textContent = isMobile 
                ? (isPublic ? '🔐' : '🔒')
                : (isPublic ? '🔐 Public' : '🔒 Private');
            statusEl.classList.toggle('public', isPublic);
        }
        
        if (tileCountEl) {
            // Mobile: Compact format, Desktop: Full text
            tileCountEl.textContent = isMobile 
                ? `🎴 ${game.hands[train].length}`
                : `Tiles: ${game.hands[train].length}`;
        }
    }
    // ===================================
    
    updateTrainPlayability(train);
}

// Update train playability highlighting
function updateTrainPlayability(train) {
    const trainLane = document.getElementById(`train-${train}`);
    if (!trainLane) return;
    
    trainLane.classList.remove('playable');
    
    if (game.currentPlayer === 0 && !game.roundOver) {
        const playableTrains = game.getPlayableTrains(0);
        if (playableTrains.includes(train)) {
            trainLane.classList.add('playable');
        }
    }
}

// Update player's hand display
function updatePlayerHand() {
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    
    game.hands[0].forEach((domino, index) => {
        const dominoEl = createDominoElement(domino, 'vertical', { clickable: true, draggable: true });
        
        handContainer.appendChild(dominoEl);
    });
    
    document.getElementById('hand-count').textContent = game.hands[0].length;
    
    setupDropZones();
}

// Setup drag & drop zones
function setupDropZones() {
    const playableTrains = game.getPlayableTrains(0);
    
    document.querySelectorAll('.train-lane').forEach(lane => {
        const train = lane.getAttribute('data-train');
        
        lane.classList.remove('drop-target');
        
        if (playableTrains.includes(train) || playableTrains.includes(parseInt(train))) {
            lane.addEventListener('dragover', handleDragOver);
            lane.addEventListener('drop', handleDrop);
            lane.addEventListener('dragleave', handleDragLeave);
        } else {
            lane.removeEventListener('dragover', handleDragOver);
            lane.removeEventListener('drop', handleDrop);
            lane.removeEventListener('dragleave', handleDragLeave);
        }
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drop-target');
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drop-target');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    
    if (draggedDomino) {
        const train = e.currentTarget.getAttribute('data-train');
        playerPlayDomino(draggedDomino, train === 'mexican' ? 'mexican' : parseInt(train));
    }
}

// Select domino for placement (Enhanced for Click-to-Place)
function selectDomino(domino, dominoElement) {
    if (gamePaused) return; // ADD THIS LINE
    
    const isPlayerFrozen = game.frozenPlayers.has(0);
    if (game.currentPlayer !== 0 || game.roundOver || isPlayerFrozen) return;
    
    clearHelpHighlights();

    // If clicking the SAME domino, deselect it
    if (selectedDomino && selectedDomino.equals(domino)) {
        selectedDomino = null;
        cleanupTrainClicks();
        document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
        showMessage('Selection cleared');
        return;
    }

    // Clear previous selection
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    
    // Set new selection
    selectedDomino = domino;
    dominoElement.classList.add('selected');
    
    const playableTrains = game.getPlayableTrains(0);
    let canPlayAnywhere = false;
    
    for (let train of playableTrains) {
        if (game.canPlayDomino(domino, train)) {
            canPlayAnywhere = true;
            break;
        }
    }
    
    if (canPlayAnywhere) {
        showMessage(`Selected [${domino.left}|${domino.right}] - Click a train to play`);
        enableTrainClickWithoutHighlight(); // Enable clicking but no visual hint
    } else {
        showMessage(`Selected [${domino.left}|${domino.right}] - Cannot play this tile!`);
        cleanupTrainClicks();
    }
}

// Add this new function that enables clicking WITHOUT visual highlights:
function enableTrainClickWithoutHighlight() {
    const playableTrains = game.getPlayableTrains(0);
    
    // Clean up first to avoid duplicate listeners
    cleanupTrainClicks();
    
    playableTrains.forEach(train => {
        const trainEl = document.getElementById(`train-${train}`);
        if (trainEl && selectedDomino && game.canPlayDomino(selectedDomino, train)) {
            // DON'T add visual styling - just enable clicking
            
            // Store handler so we can remove it later
            const clickHandler = (e) => {
                // FIXED: Only block button clicks, allow clicks on dominoes
                if (e.target.closest('button')) return;
                playDomino(selectedDomino, train);
            };
            
            trainEl._clickHandler = clickHandler;
            trainEl.addEventListener('click', clickHandler);
        }
    });
}

function enableTrainClick() {
    const playableTrains = game.getPlayableTrains(0);
    
    // Clean up first to avoid duplicate listeners
    cleanupTrainClicks();
    
    playableTrains.forEach(train => {
        const trainEl = document.getElementById(`train-${train}`);
        if (trainEl && selectedDomino && game.canPlayDomino(selectedDomino, train)) {
            trainEl.style.cursor = 'pointer';
            trainEl.classList.add('clickable-train');
            
            // Store handler so we can remove it later
            const clickHandler = (e) => {
                // FIXED: Only block button clicks, allow clicks on dominoes
                if (e.target.closest('button')) return;
                playDomino(selectedDomino, train);
            };
            
            trainEl._clickHandler = clickHandler;
            trainEl.addEventListener('click', clickHandler);
        }
    });
}

function cleanupTrainClicks() {
    document.querySelectorAll('.train-lane').forEach(lane => {
        lane.style.cursor = '';
        lane.classList.remove('clickable-train');
        if (lane._clickHandler) {
            lane.removeEventListener('click', lane._clickHandler);
            lane._clickHandler = null;
        }
    });
}

// Update action buttons
function updateButtons() {
    const drawBtn = document.getElementById('btn-draw');
    const passBtn = document.getElementById('btn-pass');
    
    if (!game) return;

    const isPlayerTurn = game.currentPlayer === 0 && !game.roundOver;
    const boneyardEmpty = game.boneyard.length === 0;
    const canDraw = !game.hasDrawn && !boneyardEmpty;
    
    drawBtn.disabled = !isPlayerTurn || !canDraw;

    // FIX: You can pass if you've drawn OR if the boneyard is empty (meaning you're stuck)
    const mustPass = isPlayerTurn && boneyardEmpty && !game.hasDrawn;
    passBtn.disabled = !isPlayerTurn || (!game.hasDrawn && !mustPass);
    
    // Visual cue for the player when they are forced to pass
    if (mustPass) {
        passBtn.classList.add('btn-pass-highlight');
        showMessage('⚠️ Boneyard empty - you must pass!', 3000);
    } else {
        passBtn.classList.remove('btn-pass-highlight');
    }
}

// Update power-up buttons
function updatePowerupButtons() {
    const isPlayerTurn = game.currentPlayer === 0 && !game.roundOver;
    const canUsePowerup = isPlayerTurn && !game.powerupUsedThisTurn;
    
    const wildBtn = document.getElementById('btn-wild');
    wildBtn.disabled = !canUsePowerup || !game.powerups[0].wild;
    wildBtn.classList.toggle('used', !game.powerups[0].wild);
    
    const sabotageBtn = document.getElementById('btn-sabotage');
    sabotageBtn.disabled = !canUsePowerup || !game.powerups[0].sabotage;
    sabotageBtn.classList.toggle('used', !game.powerups[0].sabotage);
    
    const freezeBtn = document.getElementById('btn-freeze');
    freezeBtn.disabled = !canUsePowerup || !game.powerups[0].freeze;
    freezeBtn.classList.toggle('used', !game.powerups[0].freeze);
    
    const oracleBtn = document.getElementById('btn-oracle');
    oracleBtn.disabled = !canUsePowerup || !game.powerups[0].oracle || game.boneyard.length === 0;
    oracleBtn.classList.toggle('used', !game.powerups[0].oracle);
}

// Show status message
function showMessage(text, duration = 3000, isHover = false) {
    const statusInline = document.getElementById('status-inline');
    if (statusInline) {
        statusInline.textContent = text;
        statusInline.style.opacity = '1';
        
        // Store if this is a hover message
        statusInline._isHoverMessage = isHover;
        
        if (statusInline.hideTimeout) {
            clearTimeout(statusInline.hideTimeout);
        }
        
        if (duration > 0) {
            statusInline.hideTimeout = setTimeout(() => {
                statusInline.style.opacity = '0';
                statusInline._isHoverMessage = false;
            }, duration);
        }
    }
}

// Add a function to clear only hover messages
function clearHoverMessage() {
    const statusInline = document.getElementById('status-inline');
    if (statusInline && statusInline._isHoverMessage) {
        statusInline.style.opacity = '0';
        statusInline._isHoverMessage = false;
        if (statusInline.hideTimeout) {
            clearTimeout(statusInline.hideTimeout);
        }
    }
}

// Update current turn indicator
function updateCurrentTurnIndicator() {
    // Remove all current turn indicators
    document.querySelectorAll('.train-lane').forEach(lane => {
        lane.classList.remove('current-turn');
    });
    
    document.querySelector('.player-area')?.classList.remove('your-turn');
    
    if (!game) return;
    
    // Add current-turn class to the current player's train lane (including train-0)
    const trainLane = document.getElementById(`train-${game.currentPlayer}`);
    if (trainLane) {
        trainLane.classList.add('current-turn');
    }
    
    // ALSO add your-turn class to player-area for visual border highlight
    if (game.currentPlayer === 0) {
        document.querySelector('.player-area')?.classList.add('your-turn');
    }
}

// Show AI thinking indicator
function showAiThinking(playerIndex, show = true) {
    const thinkingEl = document.getElementById(`thinking-${playerIndex}`);
    const reactionEl = document.getElementById(`reaction-${playerIndex}`);
    
    if (!thinkingEl) return;
    
    if (show) {
        // Hide reaction when showing thinking
        if (reactionEl) {
            reactionEl.style.display = 'none';
            reactionEl.textContent = '';
        }
        
        thinkingEl.style.display = 'inline-block';
        thinkingEl.textContent = '.';
        
        // Clear any existing interval
        if (thinkingEl._dotInterval) {
            clearInterval(thinkingEl._dotInterval);
        }
        
        // Animate dots: . -> .. -> ...
        let dotCount = 1;
        thinkingEl._dotInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            thinkingEl.textContent = '.'.repeat(dotCount);
        }, 500);
    } else {
        thinkingEl.style.display = 'none';
        thinkingEl.textContent = '';
        if (thinkingEl._dotInterval) {
            clearInterval(thinkingEl._dotInterval);
            thinkingEl._dotInterval = null;
        }
    }
}

// Show AI reaction emoji
function showAiReaction(playerIndex, emoji) {
    const reactionEl = document.getElementById(`reaction-${playerIndex}`);
    const thinkingEl = document.getElementById(`thinking-${playerIndex}`);
    
    if (!reactionEl) return;
    
    // Hide thinking dots when showing reaction
    if (thinkingEl) {
        thinkingEl.style.display = 'none';
        thinkingEl.textContent = '';
        if (thinkingEl._dotInterval) {
            clearInterval(thinkingEl._dotInterval);
            thinkingEl._dotInterval = null;
        }
    }
    
    reactionEl.textContent = emoji;
    reactionEl.style.display = 'inline-block';
    reactionEl.style.opacity = '1';
    reactionEl.style.transform = 'scale(1)';
    
    // Auto-hide after 2.5 seconds
    setTimeout(() => {
        reactionEl.style.opacity = '0';
        reactionEl.style.transform = 'scale(0.5)';
        setTimeout(() => {
            reactionEl.style.display = 'none';
            reactionEl.textContent = '';
        }, 300);
    }, 2500);
}

// Show detailed scores table
function showDetailedScoresTable() {
    const tbody = document.querySelector('#detailed-scores-table tbody');
    tbody.innerHTML = '';
    
    // Update AI names in header
    for (let i = 1; i <= 3; i++) {
        const header = document.getElementById(`ai-header-${i}`);
        if (header && game.players[i]) {
            header.textContent = game.players[i];
        }
    }
    
    // Check if there are any completed rounds
    if (game.roundScores.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 6;
        emptyCell.textContent = 'No completed rounds yet. Play to see scores!';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        emptyCell.style.fontStyle = 'italic';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }
    
    // Create rows for each completed round
    for (let r = 0; r < game.roundScores.length; r++) {
        const row = document.createElement('tr');
        if (r === game.currentRound) {
            row.classList.add('current-round');
        }
        
        // Round number cell - Shows 1, 2, 3...
        const roundCell = document.createElement('td');
        roundCell.classList.add('round-label');
        roundCell.textContent = `${r + 1}`;
        row.appendChild(roundCell);
        
        // Engine value cell - Shows 12, 11, 10...
        const engineCell = document.createElement('td');
        engineCell.textContent = `[${game.roundEngines[r]}|${game.roundEngines[r]}]`;
        row.appendChild(engineCell);
        
        // Player scores
        for (let p = 0; p < 4; p++) {
            const scoreCell = document.createElement('td');
            scoreCell.textContent = game.roundScores[r][p];
            if (p === 0) {
                scoreCell.classList.add('player-col');
            }
            row.appendChild(scoreCell);
        }
        
        tbody.appendChild(row);
    }
    
    // Totals row
    const totalsRow = document.createElement('tr');
    totalsRow.classList.add('totals-row');
    
    const totalsLabel = document.createElement('td');
    totalsLabel.colSpan = 2;
    totalsLabel.textContent = 'Total Score';
    totalsLabel.style.fontWeight = 'bold';
    totalsRow.appendChild(totalsLabel);
    
    for (let p = 0; p < 4; p++) {
        const totalCell = document.createElement('td');
        totalCell.textContent = game.totalScores[p];
        if (p === 0) {
            totalCell.classList.add('player-col');
        }
        totalCell.style.fontWeight = 'bold';
        totalsRow.appendChild(totalCell);
    }
    
    tbody.appendChild(totalsRow);
}

// Animation: Dealing tiles (FIXED)
async function animateDealingTiles() {
    const overlay = document.getElementById('dealing-overlay');
    overlay.classList.add('active');
    
    document.documentElement.classList.add('dealing');
    document.body.classList.add('dealing');
    
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    handContainer.classList.add('dealing');
    
    // Create placeholder elements to reserve space
    const placeholders = [];
    for (let i = 0; i < game.hands[0].length; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'domino vertical placeholder';
        placeholder.style.opacity = '0';
        handContainer.appendChild(placeholder);
        placeholders.push(placeholder);
    }
    
    // Animate tiles flying from center to hand
    for (let i = 0; i < game.hands[0].length; i++) {
        const domino = game.hands[0][i];
        
        // Create flying tile from center
        const flyingTile = document.createElement('div');
        flyingTile.className = 'domino vertical flying-deal';
        flyingTile.innerHTML = `
            <div class="domino-half" data-value="?">?</div>
            <div class="domino-divider"></div>
            <div class="domino-half" data-value="?">?</div>
        `;
        
        // Start from center of screen
        flyingTile.style.position = 'fixed';
        flyingTile.style.left = '50%';
        flyingTile.style.top = '50%';
        flyingTile.style.transform = 'translate(-50%, -50%)';
        flyingTile.style.zIndex = '1000';
        flyingTile.style.opacity = '0';
        
        document.body.appendChild(flyingTile);
        
        // Animate to placeholder position
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const placeholderRect = placeholders[i].getBoundingClientRect();
        const targetX = placeholderRect.left + placeholderRect.width / 2;
        const targetY = placeholderRect.top + placeholderRect.height / 2;
        
        flyingTile.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        flyingTile.style.left = targetX + 'px';
        flyingTile.style.top = targetY + 'px';
        flyingTile.style.transform = 'translate(-50%, -50%) rotateY(360deg)';
        flyingTile.style.opacity = '1';
        
        // After animation, replace placeholder with actual domino
        setTimeout(() => {
            const dominoEl = createDominoElement(domino, 'vertical');
            dominoEl.style.animation = 'flipReveal 0.4s ease-in-out';
            placeholders[i].replaceWith(dominoEl);
            flyingTile.remove();
        }, 600);
        
        await new Promise(resolve => setTimeout(resolve, 80));
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    overlay.classList.remove('active');
    document.documentElement.classList.remove('dealing');
    document.body.classList.remove('dealing');
    handContainer.classList.remove('dealing');
    
    updatePlayerHand();
}

// Animation: Tile placement with FORCED REFLOW BARRIER + requestAnimationFrame
function createTilePlacementAnimation(trainId, domino) {
    const tilesContainer = document.getElementById(`tiles-${trainId}`);
    if (!tilesContainer) return;
    
    // Grab the tile that was JUST rendered by updateDisplay()
    const lastTile = tilesContainer.lastElementChild;
    if (!lastTile) return;

    // === FORCED REFLOW BARRIER TECHNIQUE ===
    // A. INSTANT RESET: Set hidden state (opacity 0, offset position)
    //    This happens in the same execution tick as the render
    lastTile.style.transition = 'none';
    lastTile.style.opacity = '0';
    lastTile.style.transform = 'translateX(50px)';

    // B. THE BARRIER: Force browser to commit styles immediately
    //    This prevents the browser from "optimizing away" the hidden state
    //    Industry standard: Access offsetHeight to trigger synchronous layout
    void lastTile.offsetHeight; 
    // =======================================

    // C. PARTICLE EFFECTS: Spawn at the (invisible) tile position
    const rect = lastTile.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'domino-place-particle';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        
        const angle = (Math.PI * 2 * i) / 12;
        const distance = 30 + Math.random() * 20;
        const px = Math.cos(angle) * distance;
        const py = Math.sin(angle) * distance;
        
        particle.style.setProperty('--px', px + 'px');
        particle.style.setProperty('--py', py + 'px');
        particle.style.animation = `particleBurst ${0.6 + Math.random() * 0.3}s ease-out forwards`;
        
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
    }

    // D. TRIGGER TRANSITION (Next Frame)
    //    requestAnimationFrame ensures Step A is rendered before Step D starts
    //    This gives the browser's rendering engine exactly one "breath" to commit the hidden state
    requestAnimationFrame(() => {
        lastTile.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        lastTile.style.opacity = '1';
        lastTile.style.transform = 'translateX(0)';
    });
}

// Animation: Wild Shuffle (ENHANCED with fly away)
function createShuffleAnimation() {
    const handContainer = document.getElementById('player-hand');
    const dominoes = handContainer.querySelectorAll('.domino');
    
    // Create center vortex effect
    const vortex = document.createElement('div');
    vortex.className = 'shuffle-vortex';
    vortex.style.position = 'fixed';
    vortex.style.left = '50%';
    vortex.style.top = '50%';
    vortex.style.transform = 'translate(-50%, -50%) scale(0)';
    vortex.style.fontSize = '5em';
    vortex.style.zIndex = '999';
    vortex.style.transition = 'all 0.5s ease-out';
    
    document.body.appendChild(vortex);
    
    setTimeout(() => {
        vortex.style.transform = 'translate(-50%, -50%) scale(1) rotate(720deg)';
        vortex.style.opacity = '1';
    }, 50);
    
    // Fly each domino to center
    dominoes.forEach((domino, index) => {
        const clone = domino.cloneNode(true);
        const rect = domino.getBoundingClientRect();
        
        clone.style.position = 'fixed';
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.zIndex = '1000';
        clone.style.transition = 'none';
        
        document.body.appendChild(clone);
        
        setTimeout(() => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            // Add spiral effect
            const angle = (index / dominoes.length) * Math.PI * 2;
            const spiralX = Math.cos(angle) * 50;
            const spiralY = Math.sin(angle) * 50;
            
            clone.style.transition = `all ${0.6 + Math.random() * 0.3}s cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
            clone.style.left = (centerX + spiralX) + 'px';
            clone.style.top = (centerY + spiralY) + 'px';
            clone.style.transform = `rotate(${360 * (index + 1)}deg) scale(0)`;
            clone.style.opacity = '0';
        }, index * 40);
        
        setTimeout(() => clone.remove(), 1200);
    });
    
    // Remove vortex
    setTimeout(() => {
        vortex.style.transform = 'translate(-50%, -50%) scale(0) rotate(1440deg)';
        vortex.style.opacity = '0';
        setTimeout(() => vortex.remove(), 500);
    }, 800);
}

// Animation: Wild Shuffle TO BONEYARD (tiles fly to "Boneyard" text)
function createShuffleAnimationToBoneyard(callback) {
    const handContainer = document.getElementById('player-hand');
    const dominoes = handContainer.querySelectorAll('.domino');
    
    // Find the boneyard info item in the header
    const infoItems = document.querySelectorAll('.info-item');
    let boneyardLabel = null;
    
    infoItems.forEach(item => {
        if (item.textContent.includes('Boneyard')) {
            boneyardLabel = item;
        }
    });
    
    if (!boneyardLabel) {
        console.error('Boneyard label not found');
        if (callback) callback();
        return;
    }
    
    const boneyardRect = boneyardLabel.getBoundingClientRect();
    
    if (dominoes.length === 0) {
        if (callback) callback();
        return;
    }
    
    // === FIX: Preserve container dimensions during animation ===
    const containerRect = handContainer.getBoundingClientRect();
    handContainer.style.minHeight = containerRect.height + 'px';
    handContainer.style.minWidth = containerRect.width + 'px';
    // ==========================================================
    
    // Pulse the boneyard label
    boneyardLabel.style.animation = 'boneyardPulse 0.4s ease-in-out infinite';
    
    // Fly each domino to boneyard text
    let completedAnimations = 0;
    dominoes.forEach((domino, index) => {
        const clone = domino.cloneNode(true);
        const rect = domino.getBoundingClientRect();
        
        clone.style.position = 'fixed';
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.zIndex = '1000';
        clone.style.transition = 'none';
        
        document.body.appendChild(clone);
        
        // Hide original
        domino.style.opacity = '0';
        
        setTimeout(() => {
            const targetX = boneyardRect.left + boneyardRect.width / 2;
            const targetY = boneyardRect.top + boneyardRect.height / 2;
            
            // Add spiral effect
            const angle = (index / dominoes.length) * Math.PI * 2;
            const spiralRadius = 30;
            const spiralX = Math.cos(angle) * spiralRadius;
            const spiralY = Math.sin(angle) * spiralRadius;
            
            clone.style.transition = `all ${0.6 + Math.random() * 0.3}s cubic-bezier(0.34, 1.56, 0.64, 1)`;
            clone.style.left = (targetX + spiralX) + 'px';
            clone.style.top = (targetY + spiralY) + 'px';
            clone.style.transform = `rotate(${360 * (index + 1)}deg) scale(0)`;
            clone.style.opacity = '0';
        }, index * 50);
        
        setTimeout(() => {
            clone.remove();
            completedAnimations++;
            
            // When all animations complete
            if (completedAnimations === dominoes.length) {
                // Stop pulsing
                boneyardLabel.style.animation = '';
                
                // Add a brief flash effect
                boneyardLabel.style.transition = 'all 0.3s ease';
                boneyardLabel.style.transform = 'scale(1.2)';
                boneyardLabel.style.color = '#00ff9d';
                boneyardLabel.style.textShadow = '0 0 20px #00ff9d, 0 0 30px #00ff9d';
                
                setTimeout(() => {
                    boneyardLabel.style.transform = '';
                    boneyardLabel.style.color = '';
                    boneyardLabel.style.textShadow = '';
                    
                    // === FIX: Reset container constraints after new tiles arrive ===
                    handContainer.style.minHeight = '';
                    handContainer.style.minWidth = '';
                    // ================================================================
                    
                    if (callback) callback();
                }, 300);
            }
        }, 1000 + index * 50);
    });
}

// Animation: Explosion (Sabotage)
function createExplosionAnimation(playerIndex) {
    let targetElement;
    if (playerIndex === 0) {
        targetElement = document.querySelector('.player-hand');
    } else {
        targetElement = document.getElementById(`train-${playerIndex}`);
    }
    
    if (!targetElement) return;
    
    const rect = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const emojis = ['💥', '💣', '🔥', '⚡'];
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.position = 'fixed';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.fontSize = '2em';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '999';
        
        const angle = (Math.PI * 2 * i) / 20;
        const distance = 80 + Math.random() * 60;
        const endX = Math.cos(angle) * distance;
        const endY = Math.sin(angle) * distance;
        
        particle.style.setProperty('--endX', endX + 'px');
        particle.style.setProperty('--endY', endY + 'px');
        // FIXED: Use template literal (backticks) instead of single quotes
        particle.style.animation = `explosionBurst ${0.8 + Math.random() * 0.4}s ease-out forwards`;
        
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1300);
    }
    
    targetElement.style.animation = 'shake-medium 0.5s ease-out';
    setTimeout(() => {
        targetElement.style.animation = '';
    }, 500);
}

// Animation: Tile count fly (AI sabotaged)
function createTileCountAnimation(playerIndex) {
    const tileCountEl = document.getElementById(`tile-count-${playerIndex}`);
    if (!tileCountEl) return;
    
    const rect = tileCountEl.getBoundingClientRect();
    const particle = document.createElement('div');
    particle.textContent = '+1';
    particle.style.position = 'fixed';
    particle.style.left = rect.left + 'px';
    particle.style.top = rect.top + 'px';
    particle.style.fontSize = '2em';
    particle.style.fontWeight = 'bold';
    particle.style.color = '#ff0000';
    particle.style.textShadow = '0 0 10px #ff0000';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '999';
    
    particle.style.setProperty('--endX', '0px');
    particle.style.setProperty('--endY', '-50px');
    particle.style.animation = 'tileCountFly 1s ease-out forwards';
    
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1000);
}

// Animation: Player sabotaged (show drawn tile)
function createPlayerSabotageAnimation(drawnTile) {
    const handContainer = document.getElementById('player-hand');
    const rect = handContainer.getBoundingClientRect();
    
    const particle = document.createElement('div');
    particle.textContent = `+1 [${drawnTile.left}|${drawnTile.right}]`;
    particle.style.position = 'fixed';
    particle.style.left = rect.left + rect.width / 2 + 'px';
    particle.style.top = rect.top + 'px';
    particle.style.fontSize = '2em';
    particle.style.fontWeight = 'bold';
    particle.style.color = '#ff0000';
    particle.style.textShadow = '0 0 10px #ff0000';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '999';
    particle.style.transform = 'translate(-50%, -100%)';
    
    particle.style.setProperty('--endX', '0px');
    particle.style.setProperty('--endY', '-80px');
    particle.style.animation = 'tileCountFly 1.2s ease-out forwards';
    
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1200);
}

// Animation: Ice (Freeze)
function createIceAnimation(playerIndex) {
    let targetElement;
    if (playerIndex === 0) {
        targetElement = document.querySelector('.player-area');
    } else {
        targetElement = document.getElementById(`train-${playerIndex}`);
    }
    
    if (!targetElement) return;
    
    const rect = targetElement.getBoundingClientRect();
    
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.textContent = '❄️';
        particle.style.position = 'fixed';
        particle.style.left = (rect.left + Math.random() * rect.width) + 'px';
        particle.style.top = (rect.top - 20) + 'px';
        particle.style.fontSize = '2em';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '999';
        particle.style.animation = `iceFall ${1.5 + Math.random() * 0.5}s ease-out forwards`;
        particle.style.animationDelay = `${i * 0.1}s`;
        
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 2500);
    }
}

// Animation: Boneyard pulse when drawing
function pulseBoneyard() {
    const boneyardEl = document.getElementById('boneyard-count');
    boneyardEl.classList.add('boneyard-pulse');
    setTimeout(() => {
        boneyardEl.classList.remove('boneyard-pulse');
    }, 400);
}

// Animation: Enhanced tile fly from boneyard (for drawing)
function createTileFlyFromBoneyard(callback) {
    const boneyardEl = document.getElementById('boneyard-count');
    const boneyardRect = boneyardEl.getBoundingClientRect();
    
    const handContainer = document.getElementById('player-hand');
    const handRect = handContainer.getBoundingClientRect();
    
    // Create flying tile
    const flyingTile = document.createElement('div');
    flyingTile.className = 'domino vertical flying-from-boneyard';
    flyingTile.innerHTML = `
        <div class="domino-half" data-value="?">?</div>
        <div class="domino-divider"></div>
        <div class="domino-half" data-value="?">?</div>
    `;
    flyingTile.style.position = 'fixed';
    flyingTile.style.left = boneyardRect.left + boneyardRect.width / 2 + 'px';
    flyingTile.style.top = boneyardRect.top + boneyardRect.height / 2 + 'px';
    flyingTile.style.transform = 'translate(-50%, -50%) scale(0.5)';
    flyingTile.style.zIndex = '1000';
    
    document.body.appendChild(flyingTile);
    
    // Animate to hand
    setTimeout(() => {
        const targetX = handRect.left + handRect.width / 2;
        const targetY = handRect.top + handRect.height / 2;
        
        flyingTile.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        flyingTile.style.left = targetX + 'px';
        flyingTile.style.top = targetY + 'px';
        flyingTile.style.transform = 'translate(-50%, -50%) scale(1) rotate(360deg)';
    }, 50);
    
    setTimeout(() => {
        flyingTile.style.transition = 'all 0.3s ease-in-out';
        flyingTile.style.transform = 'translate(-50%, -50%) scale(1) rotateY(180deg)';
        
        setTimeout(() => {
            flyingTile.remove();
            if (callback) callback();
        }, 300);
    }, 800);
}

// Celebration particles
function createCelebration(intensity = 'medium') {
    const overlay = document.getElementById('celebration-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = '';
    
    const emojis = ['🎉', '🎊', '⭐', '✨', '🎆', '🎇', '💫', '🌟'];
    const count = intensity === 'intense' ? 80 : 50;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${intensity === 'intense' ? 'intense color-cycle' : ''}`;
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 1 + 's';
        particle.style.setProperty('--drift', (Math.random() - 0.5) * 200 + 'px');
        
        overlay.appendChild(particle);
    }
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.innerHTML = '';
    }, intensity === 'intense' ? 4000 : 3000);
}

// Enable click handlers on train lanes for the selected domino
function enableTrainClick() {
    const playableTrains = game.getPlayableTrains(0);
    
    // Clean up first to avoid duplicate listeners
    cleanupTrainClicks();
    
    playableTrains.forEach(train => {
        const trainEl = document.getElementById(`train-${train}`);
        if (trainEl && selectedDomino && game.canPlayDomino(selectedDomino, train)) {
            trainEl.style.cursor = 'pointer';
            trainEl.classList.add('clickable-train');
            
            // Store handler so we can remove it later
            const clickHandler = (e) => {
                // FIXED: Only block button clicks, allow clicks on dominoes
                if (e.target.closest('button')) return;
                playDomino(selectedDomino, train);
            };
            
            trainEl._clickHandler = clickHandler;
            trainEl.addEventListener('click', clickHandler);
        }
    });
}

// Clean up all train click handlers
function cleanupTrainClicks() {
    document.querySelectorAll('.train-lane').forEach(lane => {
        lane.style.cursor = '';
        lane.classList.remove('clickable-train');
        if (lane._clickHandler) {
            lane.removeEventListener('click', lane._clickHandler);
            lane._clickHandler = null;
        }
    });
}

// Handle domino selection
function selectDomino(domino, dominoElement) {
    if (gamePaused) return; // ADD THIS LINE
    
    const isPlayerFrozen = game.frozenPlayers.has(0);
    if (game.currentPlayer !== 0 || game.roundOver || isPlayerFrozen) return;
    
    clearHelpHighlights();

    // If clicking the SAME domino, deselect it
    if (selectedDomino && selectedDomino.equals(domino)) {
        selectedDomino = null;
        cleanupTrainClicks();
        document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
        showMessage('Selection cleared');
        return;
    }

    // Clear previous selection
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    
    // Set new selection
    selectedDomino = domino;
    dominoElement.classList.add('selected');
    
    const playableTrains = game.getPlayableTrains(0);
    let canPlayAnywhere = false;
    
    for (let train of playableTrains) {
        if (game.canPlayDomino(domino, train)) {
            canPlayAnywhere = true;
            break;
        }
    }
    
    if (canPlayAnywhere) {
        showMessage(`Selected [${domino.left}|${domino.right}] - Click a train to play`);
        enableTrainClickWithoutHighlight(); // Enable clicking but no visual hint
    } else {
        showMessage(`Selected [${domino.left}|${domino.right}] - Cannot play this tile!`);
        cleanupTrainClicks();
    }
}

// Play domino (SYNCHRONOUS EXECUTION - No setTimeout!)
function playDomino(domino, train) {
    if (gamePaused || !domino || game.currentPlayer !== 0 || game.roundOver) return;
    
    const isPlayerFrozen = game.frozenPlayers.has(0);
    if (isPlayerFrozen) return;
    
    clearHelpHighlights();
    
    if (!game.canPlayDomino(domino, train)) {
        showMessage('❌ Cannot play that domino there!');
        return;
    }
    
    const trainId = train === 'mexican' ? 'mexican' : train;
    
    // === ATOMIC STATE UPDATE PATTERN ===
    // Step 1: Update game data
    game.playDomino(domino, train, 0);
    
    // Step 2: Clear UI selections
    selectedDomino = null;
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    cleanupTrainClicks();
    
    // Step 3: SYNCHRONOUS render (Data → DOM)
    updateDisplay();
    
    // Step 4: SYNCHRONOUS animation (DOM → Visual FX with forced reflow)
    // NO setTimeout! Must be in same execution tick!
    createTilePlacementAnimation(trainId, domino);
    // ===================================
    
    if (game.hands[0].length === 0) {
        setTimeout(() => endRound(), 500);
        return;
    }
    
    if (!game.mustPlayAfterDouble) {
        game.hasDrawn = false;
        advanceTurn();
    } else {
        showMessage('🎲 Double played! Play again.');
        updateButtons();
    }
}

// Clear help highlights
function clearHelpHighlights() {
    document.querySelectorAll('.help-highlight').forEach(el => {
        el.classList.remove('help-highlight');
    });
    document.querySelectorAll('.btn-draw-highlight').forEach(el => {
        el.classList.remove('btn-draw-highlight');
    });
    document.querySelectorAll('.btn-pass-highlight').forEach(el => {
        el.classList.remove('btn-pass-highlight');
    });
}

// MODIFY renderPlayerHand to add click listener
function renderPlayerHand() {
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    
    game.hands[0].forEach(domino => {
        const dominoEl = createDominoElement(domino, 'vertical');
        
        // ADD: Click handler for selection
        dominoEl.addEventListener('click', () => selectDomino(domino, dominoEl));
        
        // Keep existing drag handlers
        dominoEl.addEventListener('dragstart', (e) => {
            draggedDomino = domino;
            dominoEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        dominoEl.addEventListener('dragend', () => {
            dominoEl.classList.remove('dragging');
            draggedDomino = null;
        });
        
        // Store reference for help highlighting
        dominoEl.dominoData = domino;
        
        handContainer.appendChild(dominoEl);
    });
    
    document.getElementById('hand-count').textContent = game.hands[0].length;
}

// Add this at the end of ui.js, after all your existing functions

// ============================================
// ORACLE VISION ANIMATION
// ============================================

function createOracleVisionAnimation(nextTile) {
    // Stage 1: Create full-screen overlay (0s - 0.3s)
    const overlay = document.createElement('div');
    overlay.className = 'oracle-vision-overlay';
    
    // Add header text with purple glow
    const header = document.createElement('div');
    header.style.cssText = `
        position: absolute;
        top: 80px;
        font-size: 36px;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 0 20px rgba(138, 43, 226, 1),
                     0 0 40px rgba(138, 43, 226, 0.8),
                     0 0 60px rgba(138, 43, 226, 0.6);
        animation: oraclePulse 2s ease-in-out infinite;
    `;
    header.textContent = '🔮 ORACLE VISION 🔮';
    overlay.appendChild(header);
    
    // Stage 2: Create the floating tile preview
    const tileContainer = document.createElement('div');
    tileContainer.style.cssText = `
        position: relative;
        transform: scale(0.5);
        opacity: 0;
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    const dominoPreview = createDominoElement(nextTile, 'vertical');
    dominoPreview.style.cssText = `
        transform: scale(3);
        box-shadow: 0 0 50px rgba(138, 43, 226, 1),
                    0 0 100px rgba(138, 43, 226, 0.8),
                    0 0 150px rgba(138, 43, 226, 0.5);
        border: 3px solid rgba(138, 43, 226, 0.8);
        animation: oracleFloat 3s ease-in-out  infinite;
    `;
    
    tileContainer.appendChild(dominoPreview);
    overlay.appendChild(tileContainer);
    
    // Add mystical particles around the tile
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 6px;
            height: 6px;
            background: rgba(138, 43, 226, 0.8);
            border-radius: 50%;
            top: 50%;
            left: 50%;
            animation: oracleParticle ${2 + Math.random() * 2}s ease-out infinite;
            animation-delay: ${Math.random() * 2}s;
            --angle: ${(360 / 20) * i}deg;
            --distance: ${100 + Math.random() * 100}px;
        `;
        overlay.appendChild(particle);
    }
    
    document.body.appendChild(overlay);
    
    // Animate entrance
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        setTimeout(() => {
            tileContainer.style.transform = 'scale(1)';
            tileContainer.style.opacity = '1';
        }, 100);
    });
    
    // Stage 3: After 2 seconds, fly tile back to boneyard
    setTimeout(() => {
        // Get boneyard position
        const boneyardEl = document.getElementById('boneyard-count');
        const boneyardRect = boneyardEl.getBoundingClientRect();
        
        // Calculate center of screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Calculate boneyard center
        const endX = boneyardRect.left + boneyardRect.width / 2;
        const endY = boneyardRect.top + boneyardRect.height / 2;
        
        // Clone the preview for flight
        const flyingTile = dominoPreview.cloneNode(true);
        flyingTile.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            transform: translate(-50%, -50%) scale(3);
            z-index: 10001;
            box-shadow: 0 0 50px rgba(138, 43, 226, 1),
                        0 0 100px rgba(138, 43, 226, 0.8);
            border: 3px solid rgba(138, 43, 226, 0.8);
            transition: all 1s cubic-bezier(0.4, 0.0, 0.2, 1);
            pointer-events: none;
        `;
        
        document.body.appendChild(flyingTile);
        
        // Start fading out overlay
        overlay.style.transition = 'opacity 0.5s ease-out';
        overlay.style.opacity = '0';
        
        // Animate tile flight to boneyard
        requestAnimationFrame(() => {
            setTimeout(() => {
                flyingTile.style.left = `${endX}px`;
                flyingTile.style.top = `${endY}px`;
                flyingTile.style.transform = 'translate(-50%, -50%) scale(0.3)';
                flyingTile.style.opacity = '0';
                
                // Pulse boneyard when tile arrives
                setTimeout(() => {
                    boneyardEl.classList.add('boneyard-pulse');
                    setTimeout(() => {
                        boneyardEl.classList.remove('boneyard-pulse');
                    }, 500);
                }, 900);
            }, 50);
        });
        
        // Cleanup after animations complete
        setTimeout(() => {
            overlay.remove();
            flyingTile.remove();
        }, 1500);
        
    }, 2000); // Wait 2 seconds before flying back
}

// Add this function at the end of ui.js, after createOracleVisionAnimation

// ============================================
// POWER-UP TOOLTIPS ON HOVER
// ============================================

function setupPowerupHoverTooltips() {
    const powerupButtons = {
        'btn-wild': {
            name: 'Wild Shuffle',
            description: '🌀 WILD SHUFFLE! Exchange your entire hand with new tiles from the boneyard'
        },
        'btn-sabotage': {
            name: 'Sabotage',
            description: '💣 SABOTAGE! Force an opponent to draw 1 tile - click to select target'
        },
        'btn-freeze': {
            name: 'Freeze',
            description: '❄️ FREEZE! Make an opponent skip their next turn - click to select target'
        },
        'btn-oracle': {
            name: 'Oracle',
            description: '🔮 ORACLE! Preview the next tile in the boneyard before drawing'
        }
    };

    Object.entries(powerupButtons).forEach(([btnId, info]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled && !btn.classList.contains('used')) {
                    showMessage(`${info.description}`, 0, true); // 0 = no auto-hide, true = isHover
                }
            });
            
            btn.addEventListener('mouseleave', () => {
                // Only clear hover message if we're not in targeting mode
                if (!targetingMode) {
                    clearHoverMessage();
                }
            });
        }
    });
}

// Global functions for privacy modal
function showPrivacy() {
    document.getElementById('privacy-overlay').classList.remove('hidden');
}

function hidePrivacy() {
    document.getElementById('privacy-overlay').classList.add('hidden');
}














