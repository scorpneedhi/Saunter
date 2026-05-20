// Stop photo — clean placeholder when no image, or the Wikimedia image when
// the pipeline supplied one. No procedural skyline SVGs, no "Fig. 01" caption.

interface Props {
  name: string;
  photoUrl?: string;
}

export function StopPhoto({ name, photoUrl }: Props) {
  return (
    <div className="stop-photo">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} loading="lazy" />
      ) : (
        <div className="image-slot" aria-hidden="true">
          <span className="image-slot-label">Drop a photo of {name}</span>
        </div>
      )}
    </div>
  );
}
