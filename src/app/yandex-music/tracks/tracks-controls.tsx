'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 250;

interface TracksControlsProps {
    initialQuery: string;
    initialSort: string;
    placeholder: string;
    sortOptions: readonly { value: string; label: string }[];
    classNames: { container: string; search: string; sort: string };
}

export function TracksControls({
    initialQuery,
    initialSort,
    placeholder,
    sortOptions,
    classNames,
}: TracksControlsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState(initialQuery);
    const [sort, setSort] = useState(initialSort);
    const queryRef = useRef(initialQuery);
    const sortRef = useRef(initialSort);

    const navigate = useCallback(
        (nextQuery: string, nextSort: string) => {
            const params = new URLSearchParams();
            if (nextQuery) {
                params.set('q', nextQuery);
            }
            if (nextSort !== 'listens') {
                params.set('sort', nextSort);
            }
            const search = params.toString();
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    useEffect(() => {
        if (query === queryRef.current) {
            return;
        }
        const timeout = window.setTimeout(() => {
            queryRef.current = query;
            navigate(query, sortRef.current);
        }, SEARCH_DELAY_MS);
        return () => window.clearTimeout(timeout);
    }, [navigate, query]);

    return (
        <div className={classNames.container}>
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className={classNames.search}
            />
            <select
                value={sort}
                onChange={(event) => {
                    const nextSort = event.target.value;
                    setSort(nextSort);
                    sortRef.current = nextSort;
                    navigate(queryRef.current, nextSort);
                }}
                className={classNames.sort}
            >
                {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
