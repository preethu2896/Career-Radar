import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './Segmented.css';
/**
 * A segmented control: equal segments, one raised thumb that slides to the
 * chosen one. `targets` names each segment for the cursor; `cursor` is the
 * pointer it shows over them (hand, pointer).
 */
export function Segmented({ items, value, targets, cursor, className, style, ...rest }) {
    return (_jsxs("div", { ...rest, className: `ss-seg${className ? ` ${className}` : ''}`, style: { ['--n']: items.length, ...style }, children: [_jsx("span", { className: "ss-seg__thumb", style: { transform: `translateX(${value * 100}%)` } }), items.map((o, i) => (_jsx("span", { className: "ss-seg__option", "data-on": i === value || undefined, "data-target": targets?.[i], "data-cursor": cursor, children: o }, i)))] }));
}
