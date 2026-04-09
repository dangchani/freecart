interface Props {
  content: string;
}

export default function TextPopup({ content }: Props) {
  return (
    <div
      className="p-4 text-sm text-gray-800 leading-relaxed overflow-auto max-h-[60vh]"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
