import { type HTMLAttributes, type ReactNode } from 'react';
import './Button.css';
export type ButtonProps = HTMLAttributes<HTMLSpanElement> & {
    /** primary: the accent fill, for the one action a moment is about. secondary
     * (the default): the surface with a hairline ring, as most toolbar and form
     * buttons are. tertiary: a quiet gray fill. ghost: no fill until hovered.
     * danger: the destructive fill. */
    variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
    /** small 24px, medium 28px (the default, a desktop app's button), large 32px. */
    size?: 'small' | 'medium' | 'large';
    /** A glyph before the label (a tick on Resolve). Its side pads tighter. */
    icon?: ReactNode;
    /** A glyph after the label (a chevron on a menu button). */
    trailingIcon?: ReactNode;
};
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
export declare function Button({ variant, size, icon, trailingIcon, children, className, ...rest }: ButtonProps): import("react").JSX.Element;
