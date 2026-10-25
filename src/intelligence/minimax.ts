export type Board = number[]; // 0 empty, +1 keeper (human), -1 altar guardian.
export function boardWinner(board: Board): number | null {
    for (const [a, b, c] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return board.every(Boolean) ? 0 : null;
}
export function minimaxMove(board: Board, pruning = true) {
    let nodes = 0, cutoffs = 0;
    const rootScores: { move: number; value: number }[] = [];
    function value(state: Board, turn: number, depth: number, alpha: number, beta: number): number {
        nodes++; const winner = boardWinner(state);
        if (winner !== null) return winner === -1 ? 10 - depth : winner === 1 ? depth - 10 : 0;
        let best = turn === -1 ? -Infinity : Infinity;
        for (let i = 0; i < 9; i++) if (!state[i]) {
            const next = [...state]; next[i] = turn;
            const score = value(next, -turn, depth + 1, alpha, beta);
            best = turn === -1 ? Math.max(best, score) : Math.min(best, score);
            if (turn === -1) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
            if (pruning && beta <= alpha) { cutoffs++; break; }
        }
        return best;
    }
    if (boardWinner(board) !== null) return { move: -1, value: 0, nodes, cutoffs, rootScores };
    for (let i = 0; i < 9; i++) if (!board[i]) { const next = [...board]; next[i] = -1; rootScores.push({ move: i, value: value(next, 1, 1, -Infinity, Infinity) }); }
    const best = rootScores.reduce((a, b) => b.value > a.value ? b : a);
    return { move: best.move, value: best.value, nodes, cutoffs, rootScores };
}
