import type { LinkPreview } from "@revivenotes/shared";

type LinkPreviewCardProps = {
  preview: LinkPreview;
  large?: boolean;
};

export default function LinkPreviewCard({ preview, large = false }: LinkPreviewCardProps) {
  if (large) {
    return (
      <div>
        <div className="flex flex-col gap-1.5 p-4" dir="auto">
          {preview.site_name ? <p className="text-base font-semibold text-emerald-700">{preview.site_name}</p> : null}
          {preview.title ? <p className="text-lg font-semibold leading-snug break-words">{preview.title}</p> : null}
          {preview.description && !preview.image_url ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-neutral-700">{preview.description}</p>
          ) : null}
        </div>
        {preview.image_url ? (
          // next/image would download this remote file on the server.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.image_url}
            alt=""
            width={640}
            height={360}
            referrerPolicy="no-referrer"
            className="aspect-video w-full bg-neutral-100 object-cover"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-hidden rounded border border-neutral-200 bg-white p-3">
      {preview.image_url ? (
        // next/image would download this remote file on the server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image_url}
          alt=""
          width={64}
          height={64}
          referrerPolicy="no-referrer"
          className="h-16 w-16 shrink-0 rounded object-cover"
        />
      ) : null}
      <div className="min-w-0" dir="auto">
        {preview.site_name ? <p className="text-xs text-neutral-500">{preview.site_name}</p> : null}
        {preview.title ? <p className="font-medium break-words">{preview.title}</p> : null}
        {preview.description ? (
          <p className="line-clamp-2 break-words text-sm text-neutral-600">{preview.description}</p>
        ) : null}
      </div>
    </div>
  );
}
