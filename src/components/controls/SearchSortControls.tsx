'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 250;

interface SelectFilter {
    /** Query string param name. */
    key: string;
    initialValue: string;
    /** Value that means "no filter" — omitted from the URL instead of written as `key=defaultValue`. */
    defaultValue: string;
    options: readonly { value: string; label: string }[];
    className: string;
}

interface SearchSortControlsProps {
    initialQuery: string;
    placeholder: string;
    selects: SelectFilter[];
    containerClassName: string;
    searchClassName: string;
}

/** Debounced search box plus an arbitrary number of filter/sort `<select>`s, all reflected into the URL query string. */
export function SearchSortControls({
    initialQuery,
    placeholder,
    selects,
    containerClassName,
    searchClassName,
}: SearchSortControlsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState(initialQuery);
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(selects.map((select) => [select.key, select.initialValue])),
    );
    const queryRef = useRef(initialQuery);
    const valuesRef = useRef(values);

    const navigate = useCallback(
        (nextQuery: string, nextValues: Record<string, string>) => {
            const params = new URLSearchParams();
            if (nextQuery) {
                params.set('q', nextQuery);
            }
            for (const select of selects) {
                const value = nextValues[select.key];
                if (value && value !== select.defaultValue) {
                    params.set(select.key, value);
                }
            }
            const search = params.toString();
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        },
        [pathname, router, selects],
    );

    useEffect(() => {
        if (query === queryRef.current) {
            return;
        }
        const timeout = window.setTimeout(() => {
            queryRef.current = query;
            navigate(query, valuesRef.current);
        }, SEARCH_DELAY_MS);
        return () => window.clearTimeout(timeout);
    }, [navigate, query]);

    return (
        <div className={containerClassName}>
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className={searchClassName}
            />
            {selects.map((select) => (
                <select
                    key={select.key}
                    value={values[select.key]}
                    onChange={(event) => {
                        const nextValues = {
                            ...valuesRef.current,
                            [select.key]: event.target.value,
                        };
                        valuesRef.current = nextValues;
                        setValues(nextValues);
                        navigate(queryRef.current, nextValues);
                    }}
                    className={select.className}
                >
                    {select.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ))}
        </div>
    );
}
