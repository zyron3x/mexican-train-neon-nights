// ============================================
// DOMINO CLASS
// ============================================
class Domino {
    constructor(left, right) {
        this.left = left;
        this.right = right;
    }

    flip() {
        return new Domino(this.right, this.left);
    }

    total() {
        return this.left + this.right;
    }

    isDouble() {
        return this.left === this.right;
    }

    equals(other) {
        return (this.left === other.left && this.right === other.right) ||
               (this.left === other.right && this.right === other.left);
    }

    toString() {
        return `[${this.left}|${this.right}]`;
    }

    getScore() {
        if (this.left === 0 && this.right === 0) return 50;
        return this.total();
    }
}

// ============================================
// MEXICAN TRAIN GAME CLASS
// ============================================
class MexicanTrainGame {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.roundEngines = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        this.currentRound = 0;
        
        // Randomly select 3 AI names
        const aiNamePool = ['Jax', 'Zane', 'Meli', 'Sandra', 'Marc', 'Seb', 'Frank', 'Hector', 'Claude', 'Olivia'];
        const shuffledNames = this.shuffle([...aiNamePool]).slice(0, 3);
        this.players = ['You', ...shuffledNames];
        
        this.totalScores = [0, 0, 0, 0];
        this.roundScores = [];
        this.reset();
    }

    reset() {
        this.engine = this.roundEngines[this.currentRound];
        this.boneyard = this.createDominoSet();
        this.hands = [[], [], [], []];
        this.trains = {
            mexican: [],
            0: [],
            1: [],
            2: [],
            3: []
        };
        this.publicTrains = new Set(['mexican']);
        this.currentPlayer = 0;
        this.roundOver = false;
        this.mustCoverDouble = null;
        this.mustPlayAfterDouble = false;
        this.hasDrawn = false;
        this.powerups = {
            0: { wild: true, sabotage: true, freeze: true, oracle: true },
            1: { wild: true, sabotage: true, freeze: true, oracle: true },
            2: { wild: true, sabotage: true, freeze: true, oracle: true },
            3: { wild: true, sabotage: true, freeze: true, oracle: true }
        };
        this.frozenPlayers = new Set();
        this.targetingMode = null;
        this.powerupUsedThisTurn = false;
        this.dealDominoes();
    }

    createDominoSet() {
        const dominoes = [];
        for (let i = 0; i <= 12; i++) {
            for (let j = i; j <= 12; j++) {
                dominoes.push(new Domino(i, j));
            }
        }
        return this.shuffle(dominoes);
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    dealDominoes() {
        const tilesPerPlayer = 15;
        for (let i = 0; i < 4; i++) {
            this.hands[i] = this.boneyard.splice(0, tilesPerPlayer);
        }
    }

    getPlayableTrains(playerIndex) {
        const playable = [];
        
        // Mexican train is always playable
        playable.push('mexican');
        
        // Own train is playable only if you're not frozen
        if (!this.frozenPlayers.has(playerIndex)) {
            playable.push(playerIndex);
        }
        
        // Public trains are playable ONLY if their owner is NOT frozen
        for (let train of this.publicTrains) {
            if (train !== 'mexican' && train !== playerIndex) {
                // Check if the train owner is frozen
                if (!this.frozenPlayers.has(train)) {
                    playable.push(train);
                }
            }
        }
        
        return playable;
    }

    getTrainEnd(train) {
        const trainKey = train === 'mexican' ? 'mexican' : parseInt(train);
        const tiles = this.trains[trainKey];
        
        if (tiles.length === 0) {
            return this.engine;
        }
        
        return tiles[tiles.length - 1].right;
    }

    canPlayDomino(domino, train) {
        const end = this.getTrainEnd(train);
        return domino.left === end || domino.right === end;
    }

    playDomino(domino, train, playerIndex) {
        const trainKey = train === 'mexican' ? 'mexican' : parseInt(train);
        const end = this.getTrainEnd(train);
        
        let orientedDomino = domino;
        if (domino.left === end) {
            orientedDomino = domino;
        } else if (domino.right === end) {
            orientedDomino = domino.flip();
        } else {
            console.error('Domino cannot be played on this train!');
            return false;
        }
        
        this.trains[trainKey].push(orientedDomino);
        
        const handIndex = this.hands[playerIndex].findIndex(d => d.equals(domino));
        if (handIndex !== -1) {
            this.hands[playerIndex].splice(handIndex, 1);
        }
        
        if (orientedDomino.isDouble()) {
            this.mustPlayAfterDouble = true;
        } else {
            this.mustPlayAfterDouble = false;
        }
        
        if (trainKey === playerIndex && this.publicTrains.has(playerIndex)) {
            this.publicTrains.delete(playerIndex);
        }
        
        return true;
    }

    drawFromBoneyard(playerIndex) {
        if (this.boneyard.length === 0) return null;
        const domino = this.boneyard.pop();
        this.hands[playerIndex].push(domino);
        return domino;
    }

    makeTrainPublic(playerIndex) {
        this.publicTrains.add(playerIndex);
    }

    checkRoundOver() {
        // Someone played all their tiles
        for (let i = 0; i < 4; i++) {
            if (this.hands[i].length === 0) {
                return true;
            }
        }
        
        // Stalemate: boneyard empty AND no one can play
        if (this.boneyard.length === 0) {
            for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
                const playableTrains = this.getPlayableTrains(playerIndex);
                const hand = this.hands[playerIndex];
                
                for (let domino of hand) {
                    for (let train of playableTrains) {
                        if (this.canPlayDomino(domino, train)) {
                            return false; // At least one player can play
                        }
                    }
                }
            }
            
            // No one can play and boneyard is empty = stalemate
            return true;
        }
        
        return false;
    }

    getRoundScores() {
        return this.hands.map(hand => 
            hand.reduce((sum, domino) => sum + domino.getScore(), 0)
        );
    }

    nextRound() {
        this.currentRound++;
        if (this.currentRound < this.roundEngines.length) {
            this.reset();
            return true;
        }
        return false;
    }
}

// ============================================
// AI PLAYER CLASS
// ============================================
class AIPlayer {
    constructor(game, playerIndex, difficulty) {
        this.game = game;
        this.playerIndex = playerIndex;
        this.difficulty = difficulty;
    }

    chooseMove() {
        const hand = this.game.hands[this.playerIndex];
        const playableTrains = this.game.getPlayableTrains(this.playerIndex);
        
        let moves = [];
        
        for (let domino of hand) {
            for (let train of playableTrains) {
                if (this.game.canPlayDomino(domino, train)) {
                    const score = this.evaluateMove(domino, train);
                    moves.push({ domino, train, score });
                }
            }
        }
        
        if (moves.length === 0) return null;
        
        moves.sort((a, b) => b.score - a.score);
        
        if (this.difficulty === 'easy') {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        
        if (this.difficulty === 'medium') {
            const topMoves = moves.slice(0, Math.min(3, moves.length));
            return topMoves[Math.floor(Math.random() * topMoves.length)];
        }
        
        return moves[0];
    }

    evaluateMove(domino, train) {
        let score = 0;
        score += domino.total();
        if (domino.isDouble()) score += 20;
        if (train === this.playerIndex) score += 15;
        if (train === 'mexican') score += 10;
        if (domino.left === 0 && domino.right === 0) score += 50;
        return score;
    }
}
