import { jsx as _jsx } from "react/jsx-runtime";
import './Card.css';
/**
 * A surface that holds content: a comment, a receipt, a settings group.
 * Its padding is one value on every side, so it can never come out uneven,
 * and its children are spaced by `gap`, never by their own margins (the
 * first and last child's margins are dropped, so nothing pads the bottom
 * twice). A rounded box inside it takes `var(--ss-card-inner)` as its radius:
 * the card's radius less its padding, so the two curves stay parallel.
 *
 * `flush` makes a sectioned card (a header, a list, a footer): the card
 * itself has no padding or gap, each direct child takes the padding instead,
 * and a full-width hairline runs between children. Use it whenever rows are
 * split by rules that reach both edges, rather than hand-building a box.
 */
export function Card({ pad = 'medium', gap = 12, tone = 'surface', lift, flush, className, style, ...rest }) {
    return (_jsx("div", { ...rest, className: `ss-card${className ? ` ${className}` : ''}`, "data-pad": pad, "data-tone": tone, "data-lift": lift || undefined, "data-flush": flush || undefined, style: { ...style, '--ss-card-gap': `${gap}px` } }));
}
