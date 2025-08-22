export default function AudioViewer({ url, title }: { url: string; title: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <audio src={url} controls aria-label={title} className="w-full max-w-3xl" />
    </div>
  );
}


