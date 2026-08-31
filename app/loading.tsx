export default function Loading() {
  return (
    <div className="wrap">
      <div style={{ paddingTop: 74 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel" />
        ))}
      </div>
    </div>
  );
}
