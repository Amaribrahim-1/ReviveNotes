/** A decorative push pin at the top center of a sticky note. */
export default function NotePin() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-2.5 left-1/2 z-10 size-5 -translate-x-1/2 rounded-full bg-rn-pin shadow-[0_3px_3px_rgb(0_0_0_/_0.35)]"
    >
      <span className="absolute top-1 left-1 size-1.5 rounded-full bg-rn-pin-shine" />
    </span>
  );
}
