import styles from './RouteMap.module.scss';

interface RouteMapProps {
    source: [number, number];
    destinations: [number, number][];
    /** Polyline of the actual driven path, `[longitude, latitude]` pairs. Empty for cancelled rides — falls back to a straight dashed line between stops. */
    track: [number, number][];
    className?: string;
}

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 260;
const PADDING = 24;

/**
 * Renders a ride's route as an abstract line drawing — no map tiles, no
 * external mapping library, just the raw lon/lat points scaled into an SVG
 * viewBox. Deliberately not a real map (fits the terminal-minimalism
 * aesthetic, and avoids a tile-provider dependency for what's a personal
 * dashboard, not a navigation tool). Longitude is scaled by `cos(latitude)`
 * so the drawn shape isn't visibly stretched at this dataset's latitudes.
 */
export function RouteMap({ source, destinations, track, className }: RouteMapProps) {
    const allPoints = [source, ...destinations, ...track];
    const lats = allPoints.map(([, lat]) => lat);
    const lons = allPoints.map(([lon]) => lon);
    const avgLatRad = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
    const lonScale = Math.cos(avgLatRad);

    const xs = lons.map((lon) => lon * lonScale);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...lats);
    const maxY = Math.max(...lats);
    // Guards against a degenerate (single-point) bounding box.
    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);

    const drawWidth = VIEW_WIDTH - PADDING * 2;
    const drawHeight = VIEW_HEIGHT - PADDING * 2;
    const scale = Math.min(drawWidth / spanX, drawHeight / spanY);
    const offsetX = PADDING + (drawWidth - spanX * scale) / 2;
    const offsetY = PADDING + (drawHeight - spanY * scale) / 2;

    // Latitude increases north; SVG y increases downward, so it's flipped.
    const project = ([lon, lat]: [number, number]): [number, number] => [
        offsetX + (lon * lonScale - minX) * scale,
        offsetY + (maxY - lat) * scale,
    ];

    const trackPoints = track.map(project);
    const sourcePoint = project(source);
    const destinationPoints = destinations.map(project);

    return (
        <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className={`${styles.map} ${className ?? ''}`}
            role="img"
            aria-label="Route"
        >
            {trackPoints.length > 1 ? (
                <polyline
                    points={trackPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                    className={styles.track}
                />
            ) : (
                destinationPoints.map(([x, y]) => (
                    <line
                        key={`${x},${y}`}
                        x1={sourcePoint[0]}
                        y1={sourcePoint[1]}
                        x2={x}
                        y2={y}
                        className={styles.fallbackLine}
                    />
                ))
            )}
            <circle cx={sourcePoint[0]} cy={sourcePoint[1]} r={5} className={styles.source} />
            {destinationPoints.map(([x, y]) => (
                <circle key={`${x},${y}`} cx={x} cy={y} r={5} className={styles.destination} />
            ))}
        </svg>
    );
}
