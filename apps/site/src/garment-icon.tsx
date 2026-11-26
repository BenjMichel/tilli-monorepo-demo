/** Small sewing-pattern silhouettes shared by the picker and basket. */
export function GarmentIcon({ type }: { type: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'pants' ? (
        <>
          <path d="M20 9h24l4 46H35l-3-29-3 29H16l4-46Z" />
          <path d="M20 15h24M32 9v12M21 15c0 6-2 8-4 9M43 15c0 6 2 8 4 9M17 50h12M35 50h12" />
        </>
      ) : type === 'skirt' ? (
        <>
          <path d="M23 10h18l12 43c-14 5-28 5-42 0l12-43Z" />
          <path d="M22 16h20M27 22l-5 28M37 22l5 28M32 20v32" />
        </>
      ) : (
        <>
          <path d="m24 8-7 12 9 9-13 25c12 4 26 4 38 0L38 29l9-9-7-12c-4 7-12 7-16 0Z" />
          <path d="M26 29h12M23 24h18M28 36l-4 15M36 36l4 15" />
        </>
      )}
    </svg>
  );
}
