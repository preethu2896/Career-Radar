import type { CSSProperties, ReactNode } from 'react';
import type { CursorKind } from '../cursor.js';
import './Segmented.css';
/**
 * A segmented control: equal segments, one raised thumb that slides to the
 * chosen one. `targets` names each segment for the cursor; `cursor` is the
 * pointer it shows over them (hand, pointer).
 */
export declare function Segmented({ items, value, targets, cursor, className, style, ...rest }: {
    items: ReactNode[];
    value: number;
    targets?: (string | undefined)[];
    cursor?: CursorKind;
    className?: string;
    style?: CSSProperties;
} & Record<`data-${string}`, unknown>): import("react").JSX.Element;
