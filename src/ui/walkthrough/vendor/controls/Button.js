import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useState } from 'react';
import { Roll } from '../motion/Roll.js';
import './Button.css';
/**
 * A push button. Its padding is set once, so a row never squeezes it and both
 * ends always read the same: `flex: none`, one line, and the side with an icon
 * a few px tighter than the side with words, because a glyph reads as further
 * in than text does. The label is trimmed to its letters, so the words center
 * on their ink beside an icon. A click from the cursor presses it (the stage
 * marks it data-pressed) and hovering marks it data-hover; neither moves the
 * label. Put data-target on it to aim the cursor.
 *
 * A text label changes through Roll's fade: the words crossfade in place and
 * the button eases to its new width, so a button beside it moves with it
 * instead of jumping (Resolve to Resolved, Comment to Posting). An icon that
 * arrives later (a tick once it's done) grows its slot open and fades in, and
 * one that leaves closes it, so the width changes as one movement too.
 */
export function Button({ variant = 'secondary', size = 'medium', icon, trailingIcon, children, className, ...rest }) {
    // The leading slot stays mounted once it has held an icon, so it can open
    // and close; an icon that arrives after mount opens it a frame later, from
    // closed, rather than appearing at full size
    const [last, setLast] = useState(icon);
    const [open, setOpen] = useState(!!icon);
    const has = !!icon;
    useLayoutEffect(() => {
        if (!has)
            return setOpen(false);
        setLast(icon);
        if (open)
            return;
        const id = requestAnimationFrame(() => setOpen(true));
        return () => cancelAnimationFrame(id);
    }, [has]);
    return (_jsxs("span", { role: "button", "data-cursor": "pointer", ...rest, className: `ss-button${className ? ` ${className}` : ''}`, "data-variant": variant, "data-size": size, "data-leading": open ? '' : undefined, "data-trailing": trailingIcon ? '' : undefined, children: [last != null && (_jsx("span", { className: "ss-button__icon ss-button__lead", "data-open": open || undefined, onTransitionEnd: (e) => { if (!has && e.propertyName === 'width')
                    setLast(null); }, children: icon ?? last })), children != null && children !== false && (_jsx("span", { className: "ss-button__label", children: typeof children === 'string' || typeof children === 'number' ? _jsx(Roll, { variant: "fade", children: String(children) }) : children })), trailingIcon && _jsx("span", { className: "ss-button__icon", children: trailingIcon })] }));
}
