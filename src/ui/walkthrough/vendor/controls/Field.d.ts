import { type HTMLAttributes, type ReactNode } from 'react';
import './Field.css';
export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    label?: ReactNode;
    /** The typed value. Drive it with act.type(). */
    value: string;
    placeholder?: string;
    /** Focus ring and a blinking caret. */
    focused?: boolean;
    /** Dots instead of the value. */
    password?: boolean;
    /** valid: a check at the end and a calm ring. error: the ring turns danger. */
    status?: 'valid' | 'error';
    /** The typed value committed as a chip, in place (a filter on Enter): the
     * text stays where it was typed while a surface grows around it. Clear the
     * value and the chip together; the chip fades out holding its text. */
    chip?: boolean;
    /** Gives the chip a remove ×, with this data-target for the cursor. */
    remove?: string;
    leading?: ReactNode;
    trailing?: ReactNode;
    /** Props for the input box itself, the thing to click: data-target, data-cursor. */
    box?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
}
/**
 * A text field: label, box, value and caret. The focus ring fades in without
 * moving the text, the placeholder leaves the moment the first character
 * lands (and fades back when emptied), and the caret sits solid while typing,
 * blinking only once it rests. Put data-target on `box`, the part a cursor clicks.
 */
export declare function Field({ label, value, placeholder, focused, password, status, chip, remove, leading, trailing, box, className, style, ...rest }: FieldProps): import("react").JSX.Element;
