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
    const sentQueriesRef = useRef(new Set<string>());

    // Sync a query/filter change that didn't originate here (back/forward navigation, a link
    // elsewhere on the page) during render rather than an effect, and without a `key` on this
    // component: remounting would recreate the search `<input>`, dropping DOM focus and closing
    // the on-screen keyboard on iOS after every debounced search. Only reacts when the props
    // themselves change, so a stale prop (URL not updated yet) never overwrites local state.
    const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
    if (initialQuery !== prevInitialQuery) {
        setPrevInitialQuery(initialQuery);
        // The echo of a query we navigated to ourselves must not clobber newer typing.
        if (!sentQueriesRef.current.delete(initialQuery)) {
            queryRef.current = initialQuery;
            setQuery(initialQuery);
        }
    }

    const initialValuesKey = JSON.stringify(selects.map((select) => select.initialValue));
    const [prevInitialValuesKey, setPrevInitialValuesKey] = useState(initialValuesKey);
    if (initialValuesKey !== prevInitialValuesKey) {
        setPrevInitialValuesKey(initialValuesKey);
        const nextValues = Object.fromEntries(
            selects.map((select) => [select.key, select.initialValue]),
        );
        valuesRef.current = nextValues;
        setValues(nextValues);
    }

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
            sentQueriesRef.current.add(query);
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
