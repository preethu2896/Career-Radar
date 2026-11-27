import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../parts/Icon.js';
import './Field.css';
/**
 * A text field: label, box, value and caret. The focus ring fades in without
 * moving the text, the placeholder leaves the moment the first character
 * lands (and fades back when emptied), and the caret sits solid while typing,
 * blinking only once it rests. Put data-target on `box`, the part a cursor clicks.
 */
export function Field({ label, value, placeholder, focused, password, status, chip, remove, leading, trailing, box, className, style, ...rest }) {
    // A cleared chip keeps its text while it fades, then lets go
    // (decided while rendering, so not one frame passes without it)
    const held = useRef('');
    const text = useRef(null);
    const [, release] = useState(0);
    if (chip || value)
        held.current = chip ? value : '';
    const let_go = () => {
        if (!held.current)
            return;
        held.current = '';
        release((n) => n + 1);
    };
    const out = !chip && !value && !!held.current;
    // Keep the text only while its fade is visible. A stage reset can disable
    // the transition before it starts, or cancel it halfway through.
    useLayoutEffect(() => {
        const el = text.current;
        if (!out || !el)
            return;
        const check = () => {
            if (Number(getComputedStyle(el).opacity) === 0)
                let_go();
        };
        const settle = (event) => {
            if (event.target === el && event.propertyName === 'opacity')
                check();
        };
        el.addEventListener('transitionend', settle);
        el.addEventListener('transitioncancel', settle);
        check();
        return () => {
            el.removeEventListener('transitionend', settle);
            el.removeEventListener('transitioncancel', settle);
        };
    }, [out]);
    const shown = out ? held.current : value;
    return (_jsxs("div", { ...rest, className: `ss-field${className ? ` ${className}` : ''}`, "data-focused": focused || undefined, "data-status": status, "data-filled": value ? true : undefined, style: style, children: [label && _jsx("span", { className: "ss-field__label", children: label }), _jsxs("div", { "data-cursor": "ibeam", ...box, className: `ss-field__box${box?.className ? ` ${box.className}` : ''}`, children: [leading, _jsxs("span", { className: "ss-field__text", children: [placeholder && _jsx("span", { className: "ss-field__placeholder", children: placeholder }), _jsxs("span", { ref: text, className: "ss-field__value", "data-password": password || undefined, "data-chip": chip || out || undefined, "data-leaving": out || undefined, "data-removable": remove !== undefined || undefined, children: [_jsx("span", { className: "ss-field__chars", children: password ? '•'.repeat(shown.length) : shown }), remove !== undefined && (_jsx("span", { className: "ss-field__x", role: "button", "data-cursor": "hand", "data-target": remove || undefined, children: _jsx(Icon, { name: "close", size: 10, stroke: 1.8 }) }))] }), focused && _jsx("span", { className: "ss-field__caret" }, value.length)] }), status === 'valid' && (_jsx("svg", { className: "ss-field__ok", viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": true, children: _jsx("path", { d: "M3.5 8.5 6.5 11.5 12.5 4.5", pathLength: 1 }) })), trailing] })] }));
}
