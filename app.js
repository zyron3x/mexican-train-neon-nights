// ============================================
// MAIN APPLICATION LOGIC
// ============================================

let game = null;
let selectedDifficulty = 'medium';
let gameInProgress = false;
let gamePaused = false; // ADD THIS
let pendingTimeouts = []; // ADD THIS - track all setTimeout IDs

let targetingMode = null; // 'sabotage', 'freeze', or null

// Initialize game on page load
window.addEventListener('DOMContentLoaded', () => {
    setupDifficultySelection();
    setupPowerupTooltips();
    setupPowerupHoverTooltips(); // ADD THIS LINE
    
    // Add 'loaded' class to body after a short delay to prevent FOUC
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Helper function to create cancellable timeouts
function setGameTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        // Remove from array when executed
        pendingTimeouts = pendingTimeouts.filter(id => id !== timeoutId);
        if (!gamePaused) {
            callback();
        }
    }, delay);
    pendingTimeouts.push(timeoutId);
    return timeoutId;
}

// Helper function to clear all pending timeouts
function clearAllGameTimeouts() {
    pendingTimeouts.forEach(id => clearTimeout(id));
    pendingTimeouts = [];
}

// Setup difficulty selection
function setupDifficultySelection() {
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedDifficulty = btn.getAttribute('data-difficulty');
        });
    });
}

// Start new game
function startGame() {
    // COMPLETE RESET - clear everything first
    clearAllGameTimeouts();
    gamePaused = false;
    
    // Clear any existing animations
    document.querySelectorAll('.flying-deal, .flying-from-boneyard, .oracle-vision-overlay, .shuffle-vortex').forEach(el => el.remove());
    
    // Clear targeting mode and selections
    if (typeof clearTargetingMode === 'function') {
        clearTargetingMode();
    }
    if (typeof clearHelpHighlights === 'function') {
        clearHelpHighlights();
    }
    
    // STOP ALL ANIMATIONS on train lanes and buttons
    document.querySelectorAll('.train-lane').forEach(lane => {
        lane.style.animation = '';
        lane.classList.remove('freeze-target', 'sabotage-target', 'frozen', 'clickable-train');
        lane.style.cursor = '';
    });
    
    document.querySelectorAll('.powerup-btn').forEach(btn => {
        btn.style.animation = '';
        btn.classList.remove('targeting');
    });
    
    // Remove AI thinking/reaction indicators
    document.querySelectorAll('.ai-thinking').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
        if (el._dotInterval) {
            clearInterval(el._dotInterval);
            el._dotInterval = null;
        }
    });
    document.querySelectorAll('.ai-reaction').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
    
    // Remove frozen class from player area
    const playerArea = document.querySelector('.player-area');
    if (playerArea) playerArea.classList.remove('frozen');
    
    // Reset global state
    selectedDomino = null;
    targetingMode = null;
    draggedDomino = null;
    
    // Clear any domino selections
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    if (typeof cleanupTrainClicks === 'function') {
        cleanupTrainClicks();
    }
    
    // Create new game
    game = new MexicanTrainGame(selectedDifficulty);
    gameInProgress = true;
    
    hideWelcome();
    updateDisplay();
    animateDealingTiles();
}

// New game (from in-game button)
function newGame() {
    const statusDiv = document.getElementById('current-game-status');
    const backBtn = document.getElementById('back-to-game-btn');
    
    if (gameInProgress && game && !game.roundOver) {
        // PAUSE THE GAME immediately
        gamePaused = true;
        
        // CLEAR ALL TARGETING ANIMATIONS when opening menu
        clearTargetingMode();
        
        // Show game status
        statusDiv.style.display = 'block';
        backBtn.style.display = 'block';
        document.getElementById('status-round').textContent = (game.currentRound + 1);
        document.getElementById('status-score').textContent = game.totalScores[0];
    } else {
        // No game in progress
        statusDiv.style.display = 'none';
        backBtn.style.display = 'none';
    }
    
    showWelcome();
}

// Back to current game
function backToCurrentGame() {
    // UNPAUSE THE GAME
    gamePaused = false;
    
    hideWelcome();
    
    // Resume AI turn if it was interrupted and it's still AI's turn
    if (game && game.currentPlayer !== 0 && !game.roundOver) {
        setGameTimeout(() => {
            aiTurn();
        }, 500);
    }
}

// Player plays a domino - MODIFY to use playDomino from ui.js
function playerPlayDomino(domino, train) {
    // This now just calls the ui.js version
    playDomino(domino, train);
}

// Draw tile from boneyard (ENHANCED with animation)
function drawTile() {
    if (gamePaused || game.currentPlayer !== 0 || game.roundOver || game.hasDrawn) return;
    
    // Clear selection when drawing
    selectedDomino = null;
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    cleanupTrainClicks();
    
    clearTargetingMode();
    clearHelpHighlights();
    
    pulseBoneyard();
    
    // Draw the tile first
    const domino = game.drawFromBoneyard(0);
    if (!domino) {
        showMessage('Boneyard is empty!');
        return;
    }
    
    game.hasDrawn = true;
    
    // === UPDATE HEADER IMMEDIATELY AFTER DRAWING ===
    updateHeader();
    // ==============================================
    
    const handContainer = document.getElementById('player-hand');
    
    // Create flying tile from boneyard
    const boneyardEl = document.getElementById('boneyard-count');
    const boneyardRect = boneyardEl.getBoundingClientRect();
    
    const flyingTile = document.createElement('div');
    flyingTile.className = 'domino vertical';
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
    flyingTile.style.opacity = '0';
    
    document.body.appendChild(flyingTile);
    
    // Calculate target position in the hand container
    const handRect = handContainer.getBoundingClientRect();
    const targetX = handRect.right - 30; // Right side of container
    const targetY = handRect.top + handRect.height / 2;
    
    // Animate to target position
    setTimeout(() => {
        flyingTile.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        flyingTile.style.left = targetX + 'px';
        flyingTile.style.top = targetY + 'px';
        flyingTile.style.transform = 'translate(-50%, -50%) scale(1) rotateY(360deg)';
        flyingTile.style.opacity = '1';
    }, 50);
    
    // After animation, add actual domino to hand
    setTimeout(() => {
        const newDominoEl = createDominoElement(domino, 'vertical');
        newDominoEl.style.animation = 'flipReveal 0.4s ease-in-out';
        
        // Add event listeners
        newDominoEl.addEventListener('click', () => selectDomino(domino, newDominoEl));
        newDominoEl.addEventListener('dragstart', (e) => {
            draggedDomino = domino;
            newDominoEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        newDominoEl.addEventListener('dragend', () => {
            newDominoEl.classList.remove('dragging');
            draggedDomino = null;
        });
        
        // Add to hand container
        handContainer.appendChild(newDominoEl);
        
        // Remove flying tile
        flyingTile.remove();
        
        document.getElementById('hand-count').textContent = game.hands[0].length;
        
        updateButtons();
        setupDropZones();
        
        // Simply show which tile was drawn
        showMessage(`Drew [${domino.left}|${domino.right}]`);
    }, 650);
}

// Pass turn
function passTurn() {
    if (gamePaused || game.currentPlayer !== 0 || game.roundOver) return;
    
    // Only allow pass if drawn OR boneyard is empty
    if (!game.hasDrawn && game.boneyard.length > 0) {
        showMessage('❌ You must draw before passing!');
        return;
    }

    // Clear selection when passing
    selectedDomino = null;
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    cleanupTrainClicks();
    
    clearTargetingMode();
    clearHelpHighlights();
    
    game.makeTrainPublic(0);
    game.hasDrawn = false;
    
    const message = game.boneyard.length === 0 ? 
        '🚫 Passed (boneyard empty). Train is public.' : 
        'Your train is now public!';
    showMessage(message, 2000);
    
    // CHECK FOR STALEMATE IMMEDIATELY
    if (game.checkRoundOver()) {
        setTimeout(() => endRound(), 1000);
    } else {
        advanceTurn();
    }
}

// Advance to next player's turn
function advanceTurn() {
    if (gamePaused || !game || game.roundOver) return;
    
    selectedDomino = null;
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    cleanupTrainClicks();
    
    clearTargetingMode();
    clearHelpHighlights();
    
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    game.powerupUsedThisTurn = false;
    
    if (game.frozenPlayers.has(game.currentPlayer)) {
        showMessage(`${game.players[game.currentPlayer]} is frozen! Skipping turn... ❄️`);
        
        if (game.currentPlayer === 0) {
            const playerArea = document.querySelector('.player-area');
            if (playerArea) playerArea.classList.remove('frozen');
            
            const yourTrainEl = document.getElementById(`train-0`);
            if (yourTrainEl) yourTrainEl.classList.remove('frozen');
        } else {
            const trainEl = document.getElementById(`train-${game.currentPlayer}`);
            if (trainEl) trainEl.classList.remove('frozen');
        }
        
        game.frozenPlayers.delete(game.currentPlayer);
        
        setGameTimeout(() => {
            if (!gamePaused && game) advanceTurn();
        }, 1500);
        return;
    }
    
    updateDisplay();
    
    if (game.currentPlayer !== 0) {
        setGameTimeout(() => {
            if (!gamePaused && game) aiTurn();
        }, 1000);
    }
}

// AI player's turn
async function aiTurn() {
    if (gamePaused || !game || game.roundOver) return;
    
    const aiIndex = game.currentPlayer;
    
    if (aiIndex === 0) return;
    
    const ai = new AIPlayer(game, aiIndex, selectedDifficulty);
    
    showAiThinking(aiIndex, true);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (gamePaused || !game || game.roundOver) {
        showAiThinking(aiIndex, false);
        return;
    }
    
    if (Math.random() < 0.3 && selectedDifficulty !== 'easy') {
        if (await aiUsePowerup(aiIndex, selectedDifficulty)) {
            if (gamePaused || !game || game.roundOver) {
                showAiThinking(aiIndex, false);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
    
    if (gamePaused || !game || game.roundOver) {
        showAiThinking(aiIndex, false);
        return;
    }
    
    const move = ai.chooseMove();
    
    if (move) {
        showAiThinking(aiIndex, false);
        showAiReaction(aiIndex, '😎');
        
        // === ATOMIC STATE UPDATE ===
        game.playDomino(move.domino, move.train, aiIndex);
        updateDisplay();
        createTilePlacementAnimation(move.train, move.domino);
        // ==========================
        
        if (game.hands[aiIndex].length === 0) {
            setGameTimeout(() => { if (!gamePaused && game) endRound(); }, 1200);
            return;
        }
        
        if (!game.mustPlayAfterDouble) {
            setGameTimeout(() => { if (!gamePaused && game) advanceTurn(); }, 1200);
        } else {
            setGameTimeout(() => { if (!gamePaused && game) aiTurn(); }, 1200);
        }
        return; // IMPORTANT: Exit here to prevent fall-through
    }
    
    // No move available - try drawing
    if (game.boneyard.length > 0 && !game.hasDrawn) {
        showAiThinking(aiIndex, false);
        showAiReaction(aiIndex, '🤔');
        
        pulseBoneyard();
        const drawnTile = game.drawFromBoneyard(aiIndex);

        updateHeader();
        
        game.hasDrawn = true;
        
        updateDisplay();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (gamePaused || !game || game.roundOver) {
            return;
        }
        
        const newAi = new AIPlayer(game, aiIndex, selectedDifficulty);
        const newMove = newAi.chooseMove();
        
        if (newMove) {
            showAiReaction(aiIndex, '💪');
            
            // === ATOMIC STATE UPDATE ===
            game.playDomino(newMove.domino, newMove.train, aiIndex);
            updateDisplay();
            createTilePlacementAnimation(newMove.train, newMove.domino);
            // ==========================
            
            if (game.hands[aiIndex].length === 0) {
                setGameTimeout(() => { if (!gamePaused && game) endRound(); }, 1200);
                return;
            }
            setGameTimeout(() => { if (!gamePaused && game) advanceTurn(); }, 1200);
        } else {
            showAiReaction(aiIndex, '😔');
            game.makeTrainPublic(aiIndex);
            game.hasDrawn = false;
            updateDisplay();
            
            setGameTimeout(() => {
                if (!gamePaused && game) advanceTurn();
            }, 1200);
        }
    } else {
        // Can't draw or no tiles - make train public
        showAiThinking(aiIndex, false);
        showAiReaction(aiIndex, '😔');
        game.makeTrainPublic(aiIndex);
        game.hasDrawn = false;
        updateDisplay();
        
        // CHECK FOR STALEMATE
        if (game.checkRoundOver()) {
            showMessage('🚫 Stalemate reached! Scoring hands...', 2000);
            setGameTimeout(() => { if (!gamePaused && game) endRound(); }, 1000);
        } else {
            setGameTimeout(() => {
                if (!gamePaused && game) advanceTurn();
            }, 1200);
        }
    }
}

// AI uses power-up with ENDGAME AWARENESS
async function aiUsePowerup(aiIndex, difficulty) {
    const availablePowerups = [];
    if (game.powerups[aiIndex].wild) availablePowerups.push('wild');
    if (game.powerups[aiIndex].sabotage) availablePowerups.push('sabotage');
    if (game.powerups[aiIndex].freeze) availablePowerups.push('freeze');
    
    if (availablePowerups.length === 0) return false;

    // === ENDGAME AWARENESS ===
    const boneyardCount = game.boneyard.length;
    const myHandSize = game.hands[aiIndex].length;
    const isEndgame = boneyardCount < 5;

    // 1. Identify the LEADER (Player with fewest tiles)
    let leaderIndex = 0;
    let minTiles = Infinity;
    for (let i = 0; i < 4; i++) {
        if (game.hands[i].length < minTiles) {
            minTiles = game.hands[i].length;
            leaderIndex = i;
        }
    }

    let chosenPowerup = null;

    // 2. STRATEGY SELECTION
    if (difficulty !== 'easy') {
        // A. Emergency Wild Shuffle: If my hand is huge and boneyard is shrinking
        if (game.powerups[aiIndex].wild && myHandSize > 10 && boneyardCount > myHandSize) {
            chosenPowerup = 'wild';
        }
        // B. Target the Leader: If someone is about to win (less than 3 tiles)
        else if (minTiles <= 3 && leaderIndex !== aiIndex) {
            // Priority: Sabotage the leader to bloat their hand, or Freeze them to stop them
            if (game.powerups[aiIndex].sabotage) {
                chosenPowerup = 'sabotage';
            } else if (game.powerups[aiIndex].freeze) {
                chosenPowerup = 'freeze';
            }
        }
        // C. General Aggression: 40% chance to just be mean if it's the endgame
        else if (isEndgame && Math.random() < 0.4) {
            chosenPowerup = availablePowerups[Math.floor(Math.random() * availablePowerups.length)];
        }
    } else {
        // Easy mode stays random
        chosenPowerup = availablePowerups[Math.floor(Math.random() * availablePowerups.length)];
    }

    if (!chosenPowerup) return false;

    // 3. EXECUTION (Targeting the leader specifically)
    if (chosenPowerup === 'wild') {
        if (game.boneyard.length >= game.hands[aiIndex].length) {
            // === FIX: Remember how many tiles we're returning ===
            const tilesReturned = game.hands[aiIndex].length;
            
            game.boneyard.push(...game.hands[aiIndex]);
            game.boneyard = game.shuffle(game.boneyard);
            
            game.hands[aiIndex] = [];
            
            // Draw back the SAME number of tiles we returned
            for (let i = 0; i < tilesReturned && game.boneyard.length > 0; i++) {
                game.hands[aiIndex].push(game.boneyard.pop());
            }
            // ==================================================
            
            game.powerups[aiIndex].wild = false;
            game.powerupUsedThisTurn = true;
            showMessage(`${game.players[aiIndex]} used Wild Shuffle! 🌀`);
            showAiReaction(aiIndex, '🎰');
            updateDisplay();
            return true;
        }
    } else if (chosenPowerup === 'sabotage' || chosenPowerup === 'freeze') {
        // ALWAYS target the leader (the person with least tiles) unless the leader is the AI itself
        let targetPlayer = (leaderIndex === aiIndex) ? (aiIndex + 1) % 4 : leaderIndex;

        if (chosenPowerup === 'sabotage') {
            const drawnTile = game.drawFromBoneyard(targetPlayer);
            if (drawnTile) {
                game.powerups[aiIndex].sabotage = false;
                game.powerupUsedThisTurn = true;
                
                if (targetPlayer === 0) {
                    showMessage(`💥 ${game.players[aiIndex]} sabotaged you! Drew [${drawnTile.left}|${drawnTile.right}]`, 3000);
                    createExplosionAnimation(targetPlayer);
                    createPlayerSabotageAnimation(drawnTile);
                } else {
                    showMessage(`${game.players[aiIndex]} sabotaged ${game.players[targetPlayer]}! 💣`);
                    createExplosionAnimation(targetPlayer);
                    createTileCountAnimation(targetPlayer);
                    showAiReaction(targetPlayer, '😤');
                }
                
                updateDisplay();
                return true;
            }
        } else if (chosenPowerup === 'freeze') {
            if (game.frozenPlayers.has(targetPlayer)) return false; // Don't double freeze
            
            game.frozenPlayers.add(targetPlayer);
            game.powerups[aiIndex].freeze = false;
            game.powerupUsedThisTurn = true;
            
            showMessage(`${game.players[aiIndex]} froze ${game.players[targetPlayer]}! ❄️`);
            createIceAnimation(targetPlayer);
            
            if (targetPlayer === 0) {
                const playerArea = document.querySelector('.player-area');
                if (playerArea) playerArea.classList.add('frozen');
                
                const yourTrainEl = document.getElementById(`train-0`);
                if (yourTrainEl) yourTrainEl.classList.add('frozen');
            } else {
                const trainEl = document.getElementById(`train-${targetPlayer}`);
                if (trainEl) trainEl.classList.add('frozen');
                showAiReaction(targetPlayer, '🥶');
            }
            
            updateDisplay();
            return true;
        }
    }
    
    return false;
}

// Player power-ups
function useWildShuffle() {
    if (gamePaused || !game.powerups[0].wild || game.powerupUsedThisTurn) return;
    if (game.boneyard.length < game.hands[0].length) {
        showMessage('❌ Not enough tiles in boneyard!');
        return;
    }
    
    clearTargetingMode();
    clearHelpHighlights();
    
    selectedDomino = null;
    cleanupTrainClicks();
    
    // === LOCK DASHBOARD SIZE (parent wrapper) ===
    const dashboard = document.getElementById('player-dashboard');
    const currentHeight = dashboard.offsetHeight;
    const currentWidth = dashboard.offsetWidth;
    
    dashboard.style.height = currentHeight + 'px';
    dashboard.style.width = currentWidth + 'px';
    // ============================================
    
    createShuffleAnimationToBoneyard(() => {
        const tilesReturned = game.hands[0].length;
        
        game.boneyard.push(...game.hands[0]);
        game.boneyard = game.shuffle(game.boneyard);
        
        game.hands[0] = [];
        
        for (let i = 0; i < tilesReturned && game.boneyard.length > 0; i++) {
            game.hands[0].push(game.boneyard.pop());
        }
        
        game.powerups[0].wild = false;
        game.powerupUsedThisTurn = true;
        
        // Clear only the hand container, not the powerups
        const handContainer = document.getElementById('player-hand');
        handContainer.innerHTML = '';
        
        updateButtons();
        updateHeader();
        
        showMessage('Wild Shuffle used! Drawing new hand...');
        
        setTimeout(() => {
            animateDealingTiles().then(() => {
                // === RELEASE SIZE LOCK ===
                dashboard.style.height = '';
                dashboard.style.width = '';
                // ========================
            });
        }, 500);
    });
}

function useSabotage() {
    if (gamePaused || !game.powerups[0].sabotage || game.powerupUsedThisTurn) return;
    
    clearTargetingMode();
    clearHelpHighlights();
    
    targetingMode = 'sabotage';
    
    // Add RED targeting feedback with animation
    const sabotageBtn = document.getElementById('btn-sabotage');
    sabotageBtn.classList.add('targeting');
    sabotageBtn.setAttribute('data-targeting-type', 'sabotage'); // ADD THIS LINE
    
    document.body.classList.add('targeting-cursor');
    
    showMessage('💣 Select an opponent to sabotage! Press ESC to cancel');
    
    [1, 2, 3].forEach(playerIndex => {
        const trainEl = document.getElementById(`train-${playerIndex}`);
        if (trainEl) {
            trainEl.classList.add('sabotage-target');
            trainEl.style.cursor = 'crosshair';
            
            const clickHandler = () => {
                executeSabotage(playerIndex);
            };
            
            trainEl._powerupClickHandler = clickHandler;
            trainEl.addEventListener('click', clickHandler);
        }
    });
}

function executeSabotage(targetPlayerIndex) {
    if (game.boneyard.length === 0) {
        showMessage('❌ Boneyard is empty!');
        clearTargetingMode();
        return;
    }
    
    game.powerups[0].sabotage = false;
    game.powerupUsedThisTurn = true;
    
    clearTargetingMode();
    
    const drawnTile = game.boneyard.pop();
    game.hands[targetPlayerIndex].push(drawnTile);
    
    createExplosionAnimation(targetPlayerIndex);
    createTileCountAnimation(targetPlayerIndex);
    showAiReaction(targetPlayerIndex, '😱');
    
    showMessage(`💥 ${game.players[targetPlayerIndex]} sabotaged! Drew 1 tile`, 3000);
    
    updateDisplay();
    updatePowerupButtons();
}

function useFreeze() {
    if (gamePaused || !game.powerups[0].freeze || game.powerupUsedThisTurn) return;
    
    clearTargetingMode();
    clearHelpHighlights();
    
    targetingMode = 'freeze';
    
    // Add CYAN targeting feedback with animation
    const freezeBtn = document.getElementById('btn-freeze');
    freezeBtn.classList.add('targeting');
    freezeBtn.setAttribute('data-targeting-type', 'freeze'); // ADD THIS LINE
    
    document.body.classList.add('targeting-cursor');
    
    showMessage('❄️ Select an opponent to freeze! Press ESC to cancel');
    
    [1, 2, 3].forEach(playerIndex => {
        const trainEl = document.getElementById(`train-${playerIndex}`);
        if (trainEl) {
            trainEl.classList.add('freeze-target');
            trainEl.style.cursor = 'crosshair';
            
            const clickHandler = () => {
                executeFreeze(playerIndex);
            };
            
            trainEl._powerupClickHandler = clickHandler;
            trainEl.addEventListener('click', clickHandler);
        }
    });
}

function executeFreeze(targetPlayerIndex) {
    game.powerups[0].freeze = false;
    game.powerupUsedThisTurn = true;
    
    // CLEAR TARGETING MODE FIRST - stops blinking
    clearTargetingMode();
    
    game.frozenPlayers.add(targetPlayerIndex);
    
    // Create ice animation
    createIceAnimation(targetPlayerIndex);
    
    // Add frozen class to train
    const trainEl = document.getElementById(`train-${targetPlayerIndex}`);
    if (trainEl) {
        trainEl.classList.add('frozen');
        showAiReaction(targetPlayerIndex, '🥶');
    }
    
    showMessage(`❄️ ${game.players[targetPlayerIndex]} is frozen for 1 turn!`, 3000);
    
    updateDisplay();
    updatePowerupButtons();
}

function useOracle() {
    if (gamePaused || !game || !game.powerups[0].oracle || game.powerupUsedThisTurn || game.boneyard.length === 0) {
        console.log('Oracle check failed:', {
            hasGame: !!game,
            hasOracle: game?.powerups[0]?.oracle,
            powerupUsed: game?.powerupUsedThisTurn,
            boneyardLength: game?.boneyard?.length
        });
        return;
    }
    
    clearTargetingMode();
    if (typeof clearHelpHighlights === 'function') {
        clearHelpHighlights();
    }
    
    const nextTile = game.boneyard[game.boneyard.length - 1];
    console.log('Using Oracle, next tile:', nextTile);
    
    game.powerups[0].oracle = false;
    game.powerupUsedThisTurn = true;
    
    if (typeof createOracleVisionAnimation === 'function') {
        createOracleVisionAnimation(nextTile);
    } else {
        console.error('createOracleVisionAnimation is not defined!');
    }
    
    showMessage(`🔮 Oracle reveals: [${nextTile.left}|${nextTile.right}]`, 4000);
    
    updateDisplay();
    updatePowerupButtons();
}

// Show help - MODIFY
function showHelp() {
    clearTargetingMode();
    clearHelpHighlights();
    
    const playableTrains = game.getPlayableTrains(0);
    const hand = game.hands[0];
    
    clearHelpHighlights();
    
    let foundPlayable = false;
    
    hand.forEach(domino => {
        for (let train of playableTrains) {
            if (game.canPlayDomino(domino, train)) {
                const dominoElements = document.querySelectorAll('.player-hand .domino');
                dominoElements.forEach(el => {
                    if (el.dominoData && el.dominoData.equals(domino)) {
                        el.classList.add('help-highlight');
                        foundPlayable = true;
                        
                        setTimeout(() => {
                            el.classList.remove('help-highlight');
                        }, 5000);
                    }
                });
            }
        }
    });
    
    if (foundPlayable) {
        showMessage('💡 Highlighted tiles can be played!', 5000);
    } else {
        showMessage('❌ No playable tiles. Draw or pass!', 3000);
        
        if (!game.hasDrawn && game.boneyard.length > 0) {
            document.getElementById('btn-draw').classList.add('btn-draw-highlight');
            setTimeout(() => {
                document.getElementById('btn-draw').classList.remove('btn-draw-highlight');
            }, 5000);
        } else if (game.hasDrawn) {
            document.getElementById('btn-pass').classList.add('btn-pass-highlight');
            setTimeout(() => {
                document.getElementById('btn-pass').classList.remove('btn-pass-highlight');
            }, 5000);
        }
    }
}

// End round
function endRound() {
    game.roundOver = true;
    const roundScores = game.getRoundScores();
    game.roundScores.push(roundScores);
    
    for (let i = 0; i < 4; i++) {
        game.totalScores[i] += roundScores[i];
    }
    
    const winnerIndex = roundScores.indexOf(Math.min(...roundScores));
    
    if (winnerIndex === 0) {
        createCelebration('medium');
    }
    
    showRoundEndScreen(roundScores, winnerIndex);
}

// Show round end screen
function showRoundEndScreen(roundScores, winnerIndex) {
    const table = document.getElementById('round-scores');
    let html = '<thead><tr><th>Player</th><th>Round Score</th><th>Total Score</th></tr></thead><tbody>';
    
    game.players.forEach((player, i) => {
        const isWinner = i === winnerIndex;
        html += `<tr ${isWinner ? 'style="background: rgba(0, 255, 157, 0.2);"' : ''}>`;
        html += `<td>${player}${isWinner ? ' 🏆' : ''}</td>`;
        html += `<td>${roundScores[i]}</td>`;
        html += `<td><strong>${game.totalScores[i]}</strong></td>`;
        html += '</tr>';
    });
    html += '</tbody>';
    
    table.innerHTML = html;
    
    document.getElementById('round-end-title').textContent = 
        winnerIndex === 0 ? '🎉 You Won the Round! 🎉' : `Round ${game.currentRound + 1} Complete`;
    
    document.getElementById('round-end-overlay').classList.remove('hidden');
}

// Next round
function nextRound() {
    document.getElementById('round-end-overlay').classList.add('hidden');
    
    if (game.nextRound()) {
        updateDisplay();
        animateDealingTiles();
    } else {
        showGameEndScreen();
    }
}

// Show game end screen
function showGameEndScreen() {
    const minScore = Math.min(...game.totalScores);
    const winnerIndex = game.totalScores.indexOf(minScore);
    
    if (winnerIndex === 0) {
        createCelebration('intense');
    }
    
    const table = document.getElementById('final-scores');
    let html = '<thead><tr><th>Rank</th><th>Player</th><th>Final Score</th></tr></thead><tbody>';
    
    const rankings = game.players.map((player, i) => ({ player, score: game.totalScores[i], index: i }));
    rankings.sort((a, b) => a.score - b.score);
    
    rankings.forEach((entry, rank) => {
        const isWinner = rank === 0;
        html += `<tr ${isWinner ? 'style="background: rgba(0, 255, 157, 0.2);"' : ''}>`;
        html += `<td>${rank + 1}${isWinner ? ' 🏆' : ''}</td>`;
        html += `<td>${entry.player}</td>`;
        html += `<td><strong>${entry.score}</strong></td>`;
        html += '</tr>';
    });
    html += '</tbody>';
    
    table.innerHTML = html;
    
    document.getElementById('game-end-overlay').classList.remove('hidden');
    gameInProgress = false;
}

// Modal controls
function showWelcome() {
    document.getElementById('welcome-overlay').classList.remove('hidden');
}

function hideWelcome() {
    document.getElementById('welcome-overlay').classList.add('hidden');
}

function showRules() {
    document.getElementById('rules-overlay').classList.remove('hidden');
}

function hideRules() {
    document.getElementById('rules-overlay').classList.add('hidden');
}

function showDetailedScores() {
    if (!game) {
        showMessage('❌ No game in progress!');
        return;
    }
    
    showDetailedScoresTable();
    document.getElementById('detailed-scores-overlay').classList.remove('hidden');
}

function hideDetailedScores() {
    document.getElementById('detailed-scores-overlay').classList.add('hidden');
}

function handleOverlayClick(event, overlayId) {
    if (event.target.id === overlayId) {
        document.getElementById(overlayId).classList.add('hidden');
    }
}

// Power-up tooltips
function setupPowerupTooltips() {
    const tooltips = {
        'btn-wild': 'Return your hand to the boneyard and shuffle. Redraw a new hand.',
        'btn-sabotage': 'Force an opponent to draw 1 tile.',
        'btn-freeze': 'Freeze an opponent for their next turn.',
        'btn-oracle': 'View the next tile in the boneyard.'
    };
    
    Object.entries(tooltips).forEach(([btnId, text]) => {
        const btn = document.getElementById(btnId);
        btn.title = text;
    });
}

// ============================================
// POWER-UP TARGETING MODE MANAGEMENT
// ============================================

function clearTargetingMode() {
    targetingMode = null;
    
    // Remove all target highlighting and animations
    document.querySelectorAll('.train-lane').forEach(lane => {
        lane.classList.remove('sabotage-target', 'freeze-target');
        lane.style.cursor = '';
        lane.style.animation = ''; // STOP any ongoing animations
        
        if (lane._powerupClickHandler) {
            lane.removeEventListener('click', lane._powerupClickHandler);
            lane._powerupClickHandler = null;
        }
    });
    
    // Remove targeting class from powerup buttons and stop their animations
    document.querySelectorAll('.powerup-btn').forEach(btn => {
        btn.classList.remove('targeting');
        btn.style.animation = ''; // STOP button animations
    });
    
    document.body.classList.remove('targeting-cursor');
    
    if (typeof selectedDomino !== 'undefined') {
        selectedDomino = null;
    }
    document.querySelectorAll('.domino.selected').forEach(el => {
        el.classList.remove('selected');
    });
    if (typeof cleanupTrainClicks === 'function') {
        cleanupTrainClicks();
    }
}

// In app.js, FIND the playDominoOnTrain function and UPDATE it:
function playDominoOnTrain(domino, train) {
    if (gamePaused || game.currentPlayer !== 0 || game.roundOver) return false;
    
    if (game.hasDrawn) {
        showMessage('❌ You already drew this turn!');
        return false;
    }
    
    const playableTrains = game.getPlayableTrains(0);
    
    if (!playableTrains.includes(train)) {
        showMessage('❌ Cannot play on this train!');
        return false;
    }
    
    if (!game.canPlayDomino(domino, train)) {
        showMessage('❌ Domino does not match train end!');
        return false;
    }
    
    const success = game.playDomino(domino, train, 0);
    
    if (success) {
        selectedDomino = null;
        document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
        cleanupTrainClicks();
        
        showMessage(`Played ${domino.toString()} on ${train === 'mexican' ? 'Mexican Train' : game.players[train] + "'s train"}`);
        
        updateDisplay();
        
        if (game.checkRoundOver()) {
            endRound();
            return true;
        }
        
        if (game.mustPlayAfterDouble) {
            showMessage('⚠️ Must play again after double!');
            updateDisplay();
        } else {
            advanceTurn();
        }
    }
    
    return success;
}

// Also UPDATE the drawTile function to NOT block after powerup:
function drawTile() {
    if (gamePaused || game.currentPlayer !== 0 || game.roundOver || game.hasDrawn) return;
    
    // REMOVE powerup check here too
    /*
    if (game.powerupUsedThisTurn) {
        showMessage('❌ Cannot draw after using a power-up this turn!');
        return;
    }
    */
    
    // Clear selection when drawing
    selectedDomino = null;
    document.querySelectorAll('.domino.selected').forEach(el => el.classList.remove('selected'));
    cleanupTrainClicks();
    
    clearTargetingMode();
    clearHelpHighlights();
    
    pulseBoneyard();
    
    // Draw the tile first
    const domino = game.drawFromBoneyard(0);
    if (!domino) {
        showMessage('Boneyard is empty!');
        return;
    }
    
    game.hasDrawn = true;
    
    const handContainer = document.getElementById('player-hand');
    
    // Create flying tile from boneyard
    const boneyardEl = document.getElementById('boneyard-count');
    const boneyardRect = boneyardEl.getBoundingClientRect();
    
    const flyingTile = document.createElement('div');
    flyingTile.className = 'domino vertical';
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
    flyingTile.style.opacity = '0';
    
    document.body.appendChild(flyingTile);
    
    // Calculate target position in the hand container
    const handRect = handContainer.getBoundingClientRect();
    const targetX = handRect.right - 30; // Right side of container
    const targetY = handRect.top + handRect.height / 2;
    
    // Animate to target position
    setTimeout(() => {
        flyingTile.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        flyingTile.style.left = targetX + 'px';
        flyingTile.style.top = targetY + 'px';
        flyingTile.style.transform = 'translate(-50%, -50%) scale(1) rotateY(360deg)';
        flyingTile.style.opacity = '1';
    }, 50);
    
    // After animation, add actual domino to hand
    setTimeout(() => {
        const newDominoEl = createDominoElement(domino, 'vertical');
        newDominoEl.style.animation = 'flipReveal 0.4s ease-in-out';
        
        // Add event listeners
        newDominoEl.addEventListener('click', () => selectDomino(domino, newDominoEl));
        newDominoEl.addEventListener('dragstart', (e) => {
            draggedDomino = domino;
            newDominoEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        newDominoEl.addEventListener('dragend', () => {
            newDominoEl.classList.remove('dragging');
            draggedDomino = null;
        });
        
        // Add to hand container
        handContainer.appendChild(newDominoEl);
        
        // Remove flying tile
        flyingTile.remove();
        
        document.getElementById('hand-count').textContent = game.hands[0].length;
        
        updateButtons();
        setupDropZones();
        
        // Simply show which tile was drawn
        showMessage(`Drew [${domino.left}|${domino.right}]`);
    }, 650);
}

// ============================================
// ESC KEY HANDLER - Cancel Targeting Mode
// ============================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && targetingMode) {
        clearTargetingMode();
        showMessage('❌ Power-up cancelled');
    }
});