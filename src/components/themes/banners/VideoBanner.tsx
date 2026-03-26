/**
 * VideoBanner - 비디오 배너
 * 배경에 비디오가 재생되는 배너
 */

import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, VolumeX, Pause, Play } from 'lucide-react';

interface Props {
  videoUrl: string;
  posterImage?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  link?: string;
  height?: 'medium' | 'large' | 'full';
  textPosition?: 'left' | 'center' | 'right';
  textColor?: 'light' | 'dark';
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

const heightClasses = {
  medium: 'h-64 md:h-96',
  large: 'h-96 md:h-[600px]',
  full: 'h-screen',
};

const positionClasses = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

export default function VideoBanner({
  videoUrl,
  posterImage,
  title,
  subtitle,
  buttonText,
  link,
  height = 'large',
  textPosition = 'center',
  textColor = 'light',
  showControls = true,
  autoPlay = true,
  loop = true,
  muted: initialMuted = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const textColorClass = textColor === 'dark' ? 'text-gray-900' : 'text-white';
  const buttonStyle = textColor === 'dark'
    ? 'bg-gray-900 text-white hover:bg-gray-800'
    : 'bg-white text-gray-900 hover:bg-gray-100';

  return (
    <div className={`relative overflow-hidden ${heightClasses[height]}`}>
      {/* 비디오 */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterImage}
        autoPlay={autoPlay}
        loop={loop}
        muted={initialMuted}
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 콘텐츠 */}
      <div className={`absolute inset-0 flex flex-col justify-center px-8 md:px-16 ${positionClasses[textPosition]}`}>
        <div className="max-w-2xl">
          {subtitle && (
            <p className={`text-sm md:text-base ${textColorClass} opacity-80 mb-2`}>
              {subtitle}
            </p>
          )}
          {title && (
            <h2 className={`text-3xl md:text-5xl font-bold ${textColorClass} mb-4`}>
              {title}
            </h2>
          )}
          {buttonText && link && (
            <Link to={link} className={`inline-block px-8 py-3 font-medium transition-colors ${buttonStyle}`}>
              {buttonText}
            </Link>
          )}
        </div>
      </div>

      {/* 비디오 컨트롤 */}
      {showControls && (
        <div className="absolute bottom-6 right-6 flex gap-2">
          <button
            onClick={togglePlay}
            className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={toggleMute}
            className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
