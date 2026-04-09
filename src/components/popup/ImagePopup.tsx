interface Props {
  imageUrl: string;
  linkUrl?: string;
}

export default function ImagePopup({ imageUrl, linkUrl }: Props) {
  const img = (
    <img
      src={imageUrl}
      alt="팝업 이미지"
      className="w-full h-auto block"
      draggable={false}
    />
  );

  if (linkUrl) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer">
        {img}
      </a>
    );
  }

  return img;
}
