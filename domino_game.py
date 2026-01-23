#!/usr/bin/env python3
"""
Domino Game with GUI - Play against an AI opponent
"""

import tkinter as tk
from tkinter import messagebox
import random
import platform
import subprocess
from dataclasses import dataclass
from typing import Optional


@dataclass
class Domino:
    left: int
    right: int

    def __hash__(self):
        return hash((min(self.left, self.right), max(self.left, self.right)))

    def __eq__(self, other):
        if not isinstance(other, Domino):
            return False
        return (self.left == other.left and self.right == other.right) or \
               (self.left == other.right and self.right == other.left)

    def flip(self):
        return Domino(self.right, self.left)

    def total(self):
        return self.left + self.right

    def is_double(self):
        return self.left == self.right

    def __str__(self):
        return f"[{self.left}|{self.right}]"


class DominoGame:
    def __init__(self):
        self.reset()

    def reset(self):
        # Create all 28 dominoes (double-six set)
        self.boneyard = []
        for i in range(7):
            for j in range(i, 7):
                self.boneyard.append(Domino(i, j))

        random.shuffle(self.boneyard)

        # Deal 7 dominoes to each player
        self.player_hand = [self.boneyard.pop() for _ in range(7)]
        self.ai_hand = [self.boneyard.pop() for _ in range(7)]

        # Board state - list of dominoes played
        self.board = []
        self.left_end = None
        self.right_end = None

        # Determine who goes first (highest double, or highest total)
        self.player_turn = self._determine_first_player()
        self.game_over = False
        self.winner = None

    def _determine_first_player(self):
        # Find highest double
        player_doubles = [d for d in self.player_hand if d.is_double()]
        ai_doubles = [d for d in self.ai_hand if d.is_double()]

        player_highest = max((d.total() for d in player_doubles), default=-1)
        ai_highest = max((d.total() for d in ai_doubles), default=-1)

        if player_highest > ai_highest:
            return True
        elif ai_highest > player_highest:
            return False
        else:
            # No doubles or tie - random
            return random.choice([True, False])

    def can_play(self, domino: Domino) -> list:
        """Returns list of valid placements: 'left', 'right', or both"""
        if not self.board:
            return ['left']  # First move

        placements = []
        if domino.left == self.left_end or domino.right == self.left_end:
            placements.append('left')
        if domino.left == self.right_end or domino.right == self.right_end:
            placements.append('right')
        return placements

    def play_domino(self, domino: Domino, side: str) -> bool:
        """Play a domino on the specified side"""
        if side not in self.can_play(domino):
            return False

        if not self.board:
            self.board.append(domino)
            self.left_end = domino.left
            self.right_end = domino.right
        elif side == 'left':
            if domino.right == self.left_end:
                self.board.insert(0, domino)
                self.left_end = domino.left
            else:
                self.board.insert(0, domino.flip())
                self.left_end = domino.right
        else:  # right
            if domino.left == self.right_end:
                self.board.append(domino)
                self.right_end = domino.right
            else:
                self.board.append(domino.flip())
                self.right_end = domino.left

        return True

    def draw_from_boneyard(self) -> Optional[Domino]:
        if self.boneyard:
            return self.boneyard.pop()
        return None

    def get_playable_dominoes(self, hand: list) -> list:
        """Returns list of (domino, placements) tuples"""
        playable = []
        for d in hand:
            placements = self.can_play(d)
            if placements:
                playable.append((d, placements))
        return playable

    def check_game_over(self):
        # Check if someone emptied their hand
        if not self.player_hand:
            self.game_over = True
            self.winner = "Player"
            return True
        if not self.ai_hand:
            self.game_over = True
            self.winner = "AI"
            return True

        # Check if game is blocked
        player_can_play = bool(self.get_playable_dominoes(self.player_hand))
        ai_can_play = bool(self.get_playable_dominoes(self.ai_hand))

        if not player_can_play and not ai_can_play and not self.boneyard:
            self.game_over = True
            player_total = sum(d.total() for d in self.player_hand)
            ai_total = sum(d.total() for d in self.ai_hand)
            if player_total < ai_total:
                self.winner = "Player"
            elif ai_total < player_total:
                self.winner = "AI"
            else:
                self.winner = "Tie"
            return True

        return False


class DominoAI:
    def __init__(self, game: DominoGame):
        self.game = game

    def choose_move(self) -> Optional[tuple]:
        """Returns (domino, side) or None if must draw"""
        playable = self.game.get_playable_dominoes(self.game.ai_hand)

        if not playable:
            return None

        # Strategy: prefer doubles, then highest scoring
        doubles = [(d, p) for d, p in playable if d.is_double()]
        if doubles:
            domino, placements = max(doubles, key=lambda x: x[0].total())
        else:
            domino, placements = max(playable, key=lambda x: x[0].total())

        return (domino, placements[0])


class DominoGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Domino Game")
        self.root.configure(bg='#1a5f2a')

        self.game = DominoGame()
        self.ai = DominoAI(self.game)
        self.selected_domino = None

        self.setup_gui()
        self.update_display()

        # macOS: bring window to foreground
        if platform.system() == 'Darwin':
            self.root.lift()
            self.root.attributes('-topmost', True)
            self.root.after(100, lambda: self.root.attributes('-topmost', False))
            # Activate the app via AppleScript
            subprocess.run([
                'osascript', '-e',
                'tell application "System Events" to set frontmost of '
                'the first process whose unix id is (do shell script "echo $PPID") to true'
            ], capture_output=True)

        if not self.game.player_turn:
            self.root.after(1000, self.ai_turn)

    def setup_gui(self):
        # Status label
        self.status_var = tk.StringVar(value="Your turn - Select a domino")
        self.status_label = tk.Label(
            self.root, textvariable=self.status_var,
            font=('Arial', 14, 'bold'), bg='#1a5f2a', fg='white'
        )
        self.status_label.pack(pady=10)

        # AI hand (hidden)
        self.ai_frame = tk.Frame(self.root, bg='#1a5f2a')
        self.ai_frame.pack(pady=10)
        tk.Label(
            self.ai_frame, text="AI's Hand:",
            font=('Arial', 12), bg='#1a5f2a', fg='white'
        ).pack()
        self.ai_hand_frame = tk.Frame(self.ai_frame, bg='#1a5f2a')
        self.ai_hand_frame.pack()

        # Board
        self.board_frame = tk.Frame(self.root, bg='#0d3d16', relief='sunken', bd=3)
        self.board_frame.pack(pady=20, padx=20, fill='x')

        # Board info
        self.board_info = tk.Label(
            self.board_frame, text="Board is empty - Play first domino",
            font=('Arial', 11), bg='#0d3d16', fg='#aaffaa'
        )
        self.board_info.pack(pady=5)

        # Board canvas with scrolling
        self.canvas_frame = tk.Frame(self.board_frame, bg='#0d3d16')
        self.canvas_frame.pack(fill='x', padx=10, pady=10)

        self.board_canvas = tk.Canvas(
            self.canvas_frame, height=80, bg='#0d3d16',
            highlightthickness=0
        )
        self.board_canvas.pack(fill='x')

        # Play buttons frame
        self.play_frame = tk.Frame(self.root, bg='#1a5f2a')
        self.play_frame.pack(pady=10)

        self.left_btn = tk.Button(
            self.play_frame, text="Play Left", command=lambda: self.play_selected('left'),
            font=('Arial', 11), state='disabled', width=12
        )
        self.left_btn.pack(side='left', padx=10)

        self.right_btn = tk.Button(
            self.play_frame, text="Play Right", command=lambda: self.play_selected('right'),
            font=('Arial', 11), state='disabled', width=12
        )
        self.right_btn.pack(side='left', padx=10)

        self.draw_btn = tk.Button(
            self.play_frame, text="Draw Tile", command=self.draw_tile,
            font=('Arial', 11), width=12
        )
        self.draw_btn.pack(side='left', padx=10)

        # Player hand
        self.player_frame = tk.Frame(self.root, bg='#1a5f2a')
        self.player_frame.pack(pady=10)
        tk.Label(
            self.player_frame, text="Your Hand:",
            font=('Arial', 12), bg='#1a5f2a', fg='white'
        ).pack()
        self.player_hand_frame = tk.Frame(self.player_frame, bg='#1a5f2a')
        self.player_hand_frame.pack()

        # Info frame
        self.info_frame = tk.Frame(self.root, bg='#1a5f2a')
        self.info_frame.pack(pady=10)

        self.boneyard_var = tk.StringVar()
        tk.Label(
            self.info_frame, textvariable=self.boneyard_var,
            font=('Arial', 10), bg='#1a5f2a', fg='#cccccc'
        ).pack()

        # New game button
        tk.Button(
            self.root, text="New Game", command=self.new_game,
            font=('Arial', 11), width=12
        ).pack(pady=10)

    def create_domino_widget(self, parent, domino, hidden=False, clickable=False):
        frame = tk.Frame(parent, bg='white', relief='raised', bd=2)

        if hidden:
            label = tk.Label(
                frame, text="?|?", font=('Courier', 14, 'bold'),
                bg='#4444aa', fg='white', width=4, height=2
            )
        else:
            color = '#ffffcc' if domino.is_double() else 'white'
            label = tk.Label(
                frame, text=f"{domino.left}|{domino.right}",
                font=('Courier', 14, 'bold'), bg=color, fg='black',
                width=4, height=2
            )

        label.pack(padx=2, pady=2)

        if clickable and not hidden:
            frame.configure(cursor='hand2')
            label.configure(cursor='hand2')
            frame.bind('<Button-1>', lambda e, d=domino: self.select_domino(d))
            label.bind('<Button-1>', lambda e, d=domino: self.select_domino(d))

        return frame

    def select_domino(self, domino):
        if not self.game.player_turn or self.game.game_over:
            return

        self.selected_domino = domino
        self.update_display()

        placements = self.game.can_play(domino)
        self.left_btn.config(state='normal' if 'left' in placements else 'disabled')
        self.right_btn.config(state='normal' if 'right' in placements else 'disabled')

        if placements:
            self.status_var.set(f"Selected {domino} - Choose where to play")
        else:
            self.status_var.set(f"Selected {domino} - Cannot play this tile!")

    def play_selected(self, side):
        if not self.selected_domino or not self.game.player_turn:
            return

        if self.game.play_domino(self.selected_domino, side):
            self.game.player_hand.remove(self.selected_domino)
            self.selected_domino = None
            self.left_btn.config(state='disabled')
            self.right_btn.config(state='disabled')

            if self.game.check_game_over():
                self.end_game()
            else:
                self.game.player_turn = False
                self.update_display()
                self.status_var.set("AI is thinking...")
                self.root.after(800, self.ai_turn)

    def draw_tile(self):
        if not self.game.player_turn or self.game.game_over:
            return

        # Check if player can play
        if self.game.get_playable_dominoes(self.game.player_hand):
            self.status_var.set("You have playable tiles! Select one.")
            return

        domino = self.game.draw_from_boneyard()
        if domino:
            self.game.player_hand.append(domino)
            self.status_var.set(f"Drew {domino}")
            self.update_display()

            # Check if new tile can be played
            if not self.game.get_playable_dominoes(self.game.player_hand):
                if not self.game.boneyard:
                    self.status_var.set("No playable tiles - passing turn")
                    self.game.player_turn = False
                    if self.game.check_game_over():
                        self.end_game()
                    else:
                        self.root.after(800, self.ai_turn)
        else:
            self.status_var.set("Boneyard empty - passing turn")
            self.game.player_turn = False
            if self.game.check_game_over():
                self.end_game()
            else:
                self.root.after(800, self.ai_turn)

    def ai_turn(self):
        if self.game.game_over:
            return

        self.game.player_turn = False
        self.update_display()

        move = self.ai.choose_move()

        if move:
            domino, side = move
            self.game.play_domino(domino, side)
            self.game.ai_hand.remove(domino)
            self.status_var.set(f"AI played {domino} on {side}")
        else:
            # AI must draw
            drew_playable = False
            while self.game.boneyard:
                domino = self.game.draw_from_boneyard()
                self.game.ai_hand.append(domino)
                if self.game.can_play(domino):
                    self.game.play_domino(domino, self.game.can_play(domino)[0])
                    self.game.ai_hand.remove(domino)
                    self.status_var.set(f"AI drew and played {domino}")
                    drew_playable = True
                    break

            if not drew_playable:
                self.status_var.set("AI passed (no playable tiles)")

        if self.game.check_game_over():
            self.end_game()
        else:
            self.game.player_turn = True
            self.update_display()
            playable = self.game.get_playable_dominoes(self.game.player_hand)
            if playable:
                self.status_var.set("Your turn - Select a domino")
            else:
                if self.game.boneyard:
                    self.status_var.set("No playable tiles - Draw from boneyard")
                else:
                    self.status_var.set("No playable tiles and boneyard empty - passing")
                    # Player can't play, pass back to AI
                    self.game.player_turn = False
                    self.root.after(800, self.ai_turn)

    def update_display(self):
        # Update AI hand
        for widget in self.ai_hand_frame.winfo_children():
            widget.destroy()
        for domino in self.game.ai_hand:
            w = self.create_domino_widget(self.ai_hand_frame, domino, hidden=True)
            w.pack(side='left', padx=2)

        # Update board
        self.board_canvas.delete('all')
        if self.game.board:
            total_width = len(self.game.board) * 55
            canvas_width = self.board_canvas.winfo_width() or 600
            start_x = max(10, (canvas_width - total_width) // 2)

            ends_text = f"Left end: {self.game.left_end}  |  Right end: {self.game.right_end}"
            self.board_info.config(text=ends_text)

            for i, domino in enumerate(self.game.board):
                x = start_x + i * 55
                color = '#ffffcc' if domino.is_double() else '#ffffff'
                self.board_canvas.create_rectangle(x, 15, x+50, 65, fill=color, outline='black', width=2)
                self.board_canvas.create_line(x+25, 15, x+25, 65, fill='black')
                self.board_canvas.create_text(x+12, 40, text=str(domino.left), font=('Courier', 12, 'bold'))
                self.board_canvas.create_text(x+38, 40, text=str(domino.right), font=('Courier', 12, 'bold'))
        else:
            self.board_info.config(text="Board is empty - Play first domino")

        # Update player hand
        for widget in self.player_hand_frame.winfo_children():
            widget.destroy()
        for domino in self.game.player_hand:
            w = self.create_domino_widget(self.player_hand_frame, domino, clickable=True)
            if domino == self.selected_domino:
                w.configure(bg='#ffcc00', relief='solid', bd=3)
            w.pack(side='left', padx=2)

        # Update boneyard info
        self.boneyard_var.set(f"Boneyard: {len(self.game.boneyard)} tiles remaining")

        # Update draw button
        if self.game.player_turn and not self.game.get_playable_dominoes(self.game.player_hand):
            self.draw_btn.config(state='normal')
        else:
            self.draw_btn.config(state='normal' if self.game.player_turn else 'disabled')

    def end_game(self):
        self.update_display()

        player_score = sum(d.total() for d in self.game.player_hand)
        ai_score = sum(d.total() for d in self.game.ai_hand)

        if self.game.winner == "Tie":
            msg = f"It's a tie!\n\nYour remaining: {player_score}\nAI remaining: {ai_score}"
        elif self.game.winner == "Player":
            msg = f"You win!\n\nYour remaining: {player_score}\nAI remaining: {ai_score}"
        else:
            msg = f"AI wins!\n\nYour remaining: {player_score}\nAI remaining: {ai_score}"

        self.status_var.set(f"Game Over - {self.game.winner} wins!")
        messagebox.showinfo("Game Over", msg)

    def new_game(self):
        self.game.reset()
        self.ai = DominoAI(self.game)
        self.selected_domino = None
        self.left_btn.config(state='disabled')
        self.right_btn.config(state='disabled')
        self.update_display()

        if self.game.player_turn:
            self.status_var.set("Your turn - Select a domino")
        else:
            self.status_var.set("AI goes first...")
            self.root.after(1000, self.ai_turn)

    def run(self):
        # Force focus on macOS
        self.root.focus_force()
        self.root.mainloop()


if __name__ == "__main__":
    app = DominoGUI()
    app.run()
