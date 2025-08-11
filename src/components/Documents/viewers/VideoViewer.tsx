export default function VideoViewer({ url, title }: { url: string; title: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <video src={url} controls className="max-w-full max-h-full" aria-label={title} />
    </div>
  );
}

