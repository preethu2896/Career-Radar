import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './Badge.css';
/**
 * A small status pill. `dot` adds a status dot before the label; `icon` puts
 * a glyph there instead (a tick on Matched), beside the label rather than in
 * it, so the label's trimmed box still centers the words on their ink.
 */
export function Badge({ tone = 'neutral', dot, icon, children, className, ...rest }) {
    return (_jsxs("span", { ...rest, className: `ss-badge${className ? ` ${className}` : ''}`, "data-tone": tone, "data-lead": dot || icon ? '' : undefined, children: [dot && _jsx("span", { className: "ss-badge__dot" }), icon, _jsx("span", { className: "ss-badge__label", children: children })] }));
}
