import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../reduced-motion.js';
import './Roll.css';
/**
 * Text that rolls when it changes. Only the part that differs moves: in
 * "$0.01 per 1,000" to "$0.0098 per 1,000", "$0.0" and " per 1,000" hold still
 * while the old digits slide up and out and the new ones rise in one by one.
 * Words move whole: "Checking calendars" to "Everyone can make it" rolls word
 * by word, and a change never splits a word.
 * The changing part eases to its new width, so the text after it moves with it.
 * For prices, counts in words, statuses and labels.
 */
export function Roll({ delay = 0, children, ...rest }) {
    const reduced = useReducedMotion();
    const [held, setHeld] = useState(children);
    useEffect(() => {
        if (!delay || reduced)
            return setHeld(children);
        const id = setTimeout(() => setHeld(children), delay);
        return () => clearTimeout(id);
    }, [children, delay, reduced]);
    return _jsx(RollNow, { ...rest, children: delay && !reduced ? held : children });
}
function RollNow({ children, stagger = 45, variant = 'roll', align, className, style, }) {
    const reduced = useReducedMotion();
    const [view, setView] = useState({ text: children, head: 0, tail: 0, old: '', key: 0, numeric: true });
    const mid = useRef(null);
    const root = useRef(null);
    const fromWidth = useRef(null);
    // Inline text has no computed width. Use the line box's scale to convert
    // its painted width back to local CSS pixels, including inside a Phone or
    // Camera. offsetWidth rounds away the fractions that keep a suffix still.
    const rootWidth = () => {
        if (!root.current || !mid.current)
            return 0;
        const height = parseFloat(getComputedStyle(mid.current).height);
        const scale = height > 0 ? mid.current.getBoundingClientRect().height / height : 1;
        return root.current.getBoundingClientRect().width / (scale || 1);
    };
    const [side, setSide] = useState(align ?? 'start');
    useLayoutEffect(() => {
        if (align)
            return setSide(align);
        const el = root.current;
        if (!el?.parentElement)
            return;
        // Look through wrappers that only hold the roll (a <b>, a value span):
        // they size to it, so where the wrapper sits is where the text pins
        let box = el;
        while (box.parentElement && box.parentElement.childElementCount === 1 && Math.abs(box.parentElement.getBoundingClientRect().width - box.getBoundingClientRect().width) < 1)
            box = box.parentElement;
        const parent = box.parentElement;
        if (!parent)
            return;
        const p = getComputedStyle(parent);
        const flex = /flex/.test(p.display) && p.flexDirection.startsWith('row');
        // Pushed to the right edge by an auto margin (or anything else) reads the
        // same from the layout: flush with the row's end, slack before it
        const pushed = () => {
            const prev = box.previousElementSibling;
            const r = box.getBoundingClientRect();
            const pr = parent.getBoundingClientRect();
            const flush = Math.abs(pr.right - parseFloat(p.paddingRight) - parseFloat(p.borderRightWidth) - r.right) < 1;
            const slack = prev ? r.left - prev.getBoundingClientRect().right - (parseFloat(p.columnGap) || 0) : 0;
            return flush && slack > 1;
        };
        const end = /right|end/.test(getComputedStyle(el).textAlign) ||
            (flex && box === parent.lastElementChild && (/space-between|flex-end|^end/.test(p.justifyContent) || pushed()));
        setSide(end ? 'end' : 'start');
    }, [align]);
    useEffect(() => {
        if (reduced) {
            setView({ text: children, head: 0, tail: 0, old: '', key: 0, numeric: true });
            return;
        }
        if (view.text === children)
            return;
        const a = view.text;
        const b = children;
        let head = 0;
        while (head < a.length && head < b.length && a[head] === b[head])
            head++;
        let tail = 0;
        while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail])
            tail++;
        // Digits can change one at a time; words can't. Snap a wordy change out to
        // whole words.
        const numeric = /^[\d.,$€£%+\-−\s]*$/.test(a.slice(head, a.length - tail) + b.slice(head, b.length - tail));
        if (!numeric) {
            const space = (c) => c === undefined || /\s/.test(c);
            while (head > 0 && !space(b[head - 1]) && !space(b[head]))
                head--;
            while (tail > 0 && !space(b[b.length - tail - 1]) && !space(b[b.length - tail]))
                tail--;
        }
        const key = view.key + 1;
        // Capture the rendered width before repartitioning head/middle/tail.
        // During interruption this is between endpoints, not the old target.
        fromWidth.current = rootWidth();
        setView({ text: b, head, tail, old: a.slice(head, a.length - tail), key, numeric });
        const id = setTimeout(() => setView((v) => (v.key === key ? { ...v, old: '' } : v)), 700);
        return () => clearTimeout(id);
    }, [children, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
    // While the old and new text swap, the box starts at the old text's width,
    // opens to the wider of the two so neither runs into what follows, then
    // settles to the new width. Set on the element directly so the starting
    // width never animates from a stale value.
    useLayoutEffect(() => {
        const el = mid.current;
        const live = el?.querySelector('[data-live]');
        const out = el?.querySelector('[data-out]');
        if (!el || !live)
            return;
        const width = (node) => parseFloat(getComputedStyle(node).width) || 0;
        const next = width(live);
        if (reduced || view.key === 0) {
            el.style.transition = 'none';
            el.style.width = `${next}px`;
            fromWidth.current = null;
            return;
        }
        // Repartitioning moves unchanged text out of the grid. Subtract its new
        // width from the old rendered total so that move itself changes no room.
        const affixes = rootWidth() - width(el);
        const previous = fromWidth.current;
        fromWidth.current = null;
        const start = previous === null ? (out ? width(out) : 0) : Math.max(0, previous - affixes);
        el.style.transition = 'none';
        el.style.width = `${start}px`;
        void el.offsetWidth;
        el.style.transition = '';
        // A control's label: the box and the crossfade are one move, straight to
        // the new width, and the box clips the old label as it goes
        if (variant === 'fade') {
            el.style.width = `${next}px`;
            return;
        }
        const widest = Math.max(next, start, out ? width(out) : 0);
        el.style.width = `${widest}px`;
        if (widest === next)
            return;
        const id = setTimeout(() => (el.style.width = `${next}px`), 360);
        return () => clearTimeout(id);
    }, [view.key, reduced, reduced ? children : undefined]);
    // The settled render must not wait for an effect: a Stage poster can
    // arrive in the same commit that disables its CSS animations.
    const { text, head, tail, old, key, numeric } = reduced
        ? { text: children, head: 0, tail: 0, old: '', key: 0, numeric: true }
        : view;
    const now = text.slice(head, text.length - tail);
    // Characters for numbers, whole words (with their spaces) for text
    const units = numeric ? now.split('') : now.split(/(?<=\s)/);
    return (_jsxs("span", { ref: root, className: `ss-roll${className ? ` ${className}` : ''}`, "data-variant": variant, "data-align": side, style: style, children: [text.slice(0, head), _jsxs("span", { ref: mid, className: "ss-roll__mid", children: [old && (_jsx("span", { className: "ss-roll__item", "data-out": true, children: old }, `o${key}`)), _jsx("span", { className: "ss-roll__item", "data-live": true, children: key > 0 && variant === 'fade'
                            ? _jsx("span", { className: "ss-roll__char", children: now })
                            : key > 0
                                ? units.map((c, i) => (_jsx("span", { className: "ss-roll__char", style: { animationDelay: `${i * stagger}ms` }, children: c }, i)))
                                : now }, `n${key}`)] }), text.slice(text.length - tail)] }));
}
